import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { consultarContextoPeriodo, requerirPeriodoElegible } from '../periodos/asignacion-periodo.js';
import { TypeDocument } from '../contratos/enums.js';
import { validarBorrador, proyeccion, PERFIL, PREGRADO, POSGRADO, PROGRAMA, EXPERIENCIA } from './borrador.js';
import { DatabaseService } from '../database/database.service.js';
import { TIPO_DOCUMENTO_LEGADO } from '../contratos/mapeo.js';
import type {
  DatosEnvioPreinscripcion,
  DocumentoCargadoDTO,
  RespuestaEnvioPreinscripcion,
  RespuestaGuardarBorrador,
  RespuestaObtenerBorrador,
  RespuestaSolicitudEstudiante,
  SolicitudResumen,
} from './solicitudes.types.js';

const DOCUMENTOS_REQUERIDOS_PREGRADO = [
  'identification',
  'academic_evaluation',
  'paz_y_salvo_bib',
  'estampilla_pro_cultura',
  'saber_pro',
];

const DOCUMENTOS_REQUERIDOS_POSGRADO = [
  'identification',
  'paz_y_salvo_bib',
  'estampilla_pro_cultura',
];

function normalizarTipoDocumento(tipo: string): string {
  const limpio = tipo.trim().toLowerCase();
  if (limpio === 'estampilla2' || limpio === 'estampilla_pro_cultura-2') return 'estampilla_pro_cultura';
  return TIPO_DOCUMENTO_LEGADO[limpio] ?? limpio;
}

@Injectable()
export class SolicitudesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async obtenerSolicitudEstudiante(
    idEstudiante: number,
  ): Promise<RespuestaSolicitudEstudiante> {
    const consulta = `
      SELECT id_solicitud, id_periodo, tipo_solicitud, estado
      FROM solicitud_grado
      WHERE id_estudiante = $1
      ORDER BY id_solicitud DESC
      LIMIT 1;
    `;

    const resultado = await this.databaseService.query<SolicitudResumen>(
      consulta,
      [idEstudiante],
    );

    if (resultado.rows.length === 0) {
      return {
        tiene_solicitud: false,
        solicitud: null,
      };
    }

    const fila = resultado.rows[0];
    return {
      tiene_solicitud: true,
      solicitud: {
        id_solicitud: fila.id_solicitud,
        tipo_solicitud: fila.tipo_solicitud,
        estado: fila.estado,
      },
    };
  }

  async enviarPreinscripcion(
    idEstudiante: number,
    payload?: DatosEnvioPreinscripcion,
  ): Promise<RespuestaEnvioPreinscripcion> {
    return this.databaseService.transaction(async (client) => {
      // 1. Obtener y bloquear la solicitud activa
      const resSolicitud = await client.query<SolicitudResumen>(
        `SELECT id_solicitud, id_periodo, tipo_solicitud, estado
         FROM solicitud_grado
         WHERE id_estudiante = $1
         ORDER BY id_solicitud DESC
         LIMIT 1
         FOR UPDATE;`,
        [idEstudiante],
      );

      let solicitud = resSolicitud.rows[0];

      if (!solicitud) {
        if (payload?.nivel || payload?.tipo_solicitud) {
          const nivel = (payload.nivel || payload.tipo_solicitud)!.toUpperCase();
          const insertRes = await client.query<SolicitudResumen>(
            `INSERT INTO solicitud_grado (id_estudiante, tipo_solicitud, estado)
             VALUES ($1, $2, 'BORRADOR')
             RETURNING id_solicitud, id_periodo, tipo_solicitud, estado;`,
            [idEstudiante, nivel],
          );
          solicitud = insertRes.rows[0];
        } else {
          throw new BadRequestException('No existe una solicitud de grado para el estudiante');
        }
      }

      if (solicitud.estado !== 'BORRADOR') {
        throw new ConflictException(
          `La solicitud ya ha sido enviada o no se encuentra en estado BORRADOR (estado actual: ${solicitud.estado})`,
        );
      }

      await this.asegurarPeriodo(client, solicitud);

      // 2. Persistir datos del formulario si vienen en el payload
      if (payload) {
        await this.persistirDatosFormulario(
          client,
          idEstudiante,
          solicitud.id_solicitud,
          solicitud.tipo_solicitud,
          payload,
        );
      }

      // 3. Validar completitud de campos obligatorios e información documental
      await this.validarRequisitosCompletos(
        client,
        idEstudiante,
        solicitud.id_solicitud,
        solicitud.tipo_solicitud,
      );

      // 4. Insertar fila en entregas (tipo_entrega = 'INICIAL', numero_entrega = 1)
      const resEntrega = await client.query<{ id_entrega: number }>(
        `INSERT INTO entregas (id_solicitud, numero_entrega, tipo_entrega, fecha_entrega)
         VALUES ($1, 1, 'INICIAL', CURRENT_TIMESTAMP)
         RETURNING id_entrega;`,
        [solicitud.id_solicitud],
      );
      const idEntrega = resEntrega.rows[0].id_entrega;

      // 5. Asignar id_entrega a los documentos no asociados y cambiar su estado a 'POR_VALIDAR'
      await client.query(
        `UPDATE documentos
         SET id_entrega = $1, estado = 'POR_VALIDAR'
         WHERE id_solicitud = $2 AND id_entrega IS NULL;`,
        [idEntrega, solicitud.id_solicitud],
      );

      // 6. Transicionar el estado de la solicitud a 'EN_PROCESO'
      await client.query(
        `UPDATE solicitud_grado
         SET estado = 'EN_PROCESO'
         WHERE id_solicitud = $1;`,
        [solicitud.id_solicitud],
      );

      return {
        ok: true,
        id_solicitud: solicitud.id_solicitud,
        id_entrega: idEntrega,
        estado: 'EN_PROCESO',
        mensaje: 'Preinscripción registrada correctamente. Pendiente de análisis.',
      };
    });
  }

  async obtenerBorrador(
    idEstudiante: number,
  ): Promise<RespuestaObtenerBorrador> {
    return this.databaseService.transaction(async (client) => {
      // Un único snapshot para evitar mezclar campos de dos guardados concurrentes.
      await client.query(
        'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
      );
      const res = await client.query<
        SolicitudResumen & {
          segundo_programa: boolean | null;
          fecha_actualizacion: Date;
        }
      >(
        `SELECT id_solicitud, id_periodo, tipo_solicitud, estado, segundo_programa, fecha_actualizacion
         FROM solicitud_grado WHERE id_estudiante = $1 ORDER BY id_solicitud DESC LIMIT 1`,
        [idEstudiante],
      );
      const solicitud = res.rows[0];
      const periodos = await consultarContextoPeriodo(client, solicitud?.id_periodo ?? null);
      if (!solicitud || solicitud.estado !== 'BORRADOR') {
        return {
          ok: true,
          id_solicitud: solicitud?.id_solicitud ?? null,
          estado: solicitud?.estado ?? null,
          borrador: null,
          periodos,
        };
      }
      const id = solicitud.id_solicitud;
      const usuario = await client.query(
        `SELECT nombres, apellidos, codigo_estudiante AS "codigoEstudiantil"
        FROM usuarios WHERE id_usuario = $1`,
        [idEstudiante],
      );
      const perfil = await client.query(
        `SELECT ${proyeccion(PERFIL)} FROM perfil_estudiante WHERE id_usuario = $1`,
        [idEstudiante],
      );
      const programas = await client.query(
        `SELECT ${proyeccion(PROGRAMA)} FROM solicitud_programa WHERE id_solicitud = $1 ORDER BY orden`,
        [id],
      );
      const pregrado =
        solicitud.tipo_solicitud === 'PREGRADO'
          ? await client.query(
              `SELECT ${proyeccion(PREGRADO)} FROM informacion_pregrado WHERE id_solicitud = $1`,
              [id],
            )
          : { rows: [] };
      const posgrado =
        solicitud.tipo_solicitud === 'POSGRADO'
          ? await client.query(
              `SELECT ${proyeccion(POSGRADO)} FROM informacion_posgrado WHERE id_solicitud = $1`,
              [id],
            )
          : { rows: [] };
      const experiencia =
        solicitud.tipo_solicitud === 'POSGRADO'
          ? await client.query(
              `SELECT ${proyeccion(EXPERIENCIA)} FROM experiencia_laboral WHERE id_solicitud = $1 ORDER BY orden`,
              [id],
            )
          : { rows: [] };
      const docs = await client.query(
        `SELECT tipo_documento, orden, nombre_original, tamano_bytes
        FROM documentos WHERE id_solicitud = $1 AND id_entrega IS NULL AND estado = 'CARGADO'
        ORDER BY version`,
        [id],
      );
      const documentos: Record<string, DocumentoCargadoDTO> = {};
      for (const doc of docs.rows) {
        const tipo = normalizarTipoDocumento(doc.tipo_documento);
        const clave = doc.orden === 2 ? `${tipo}-2` : tipo;
        documentos[clave] = {
          id: clave,
          nombre: doc.nombre_original,
          tamano: doc.tamano_bytes,
        };
      }
      return {
        ok: true,
        id_solicitud: id,
        estado: 'BORRADOR',
        periodos,
        borrador: {
          ...usuario.rows[0],
          nivel: solicitud.tipo_solicitud,
          segundoPrograma: solicitud.segundo_programa,
          perfil: perfil.rows[0] ?? {},
          programas: programas.rows,
          pregrado: pregrado.rows[0] ?? {},
          posgrado: posgrado.rows[0] ?? {},
          experiencia: experiencia.rows,
          documentos,
          guardadoEn: new Date(solicitud.fecha_actualizacion).toISOString(),
        },
      };
    });
  }

  async guardarBorrador(
    idEstudiante: number,
    payload?: DatosEnvioPreinscripcion,
  ): Promise<RespuestaGuardarBorrador> {
    const datos = validarBorrador(payload);
    return this.databaseService.transaction(async (client) => {
      // Bloquear una fila que SIEMPRE existe evita duplicados incluso en el primer guardado.
      await client.query(
        'SELECT id_usuario FROM usuarios WHERE id_usuario = $1 FOR UPDATE',
        [idEstudiante],
      );
      const res = await client.query<SolicitudResumen>(
        `SELECT id_solicitud, id_periodo, tipo_solicitud, estado FROM solicitud_grado
         WHERE id_estudiante = $1 ORDER BY id_solicitud DESC LIMIT 1 FOR UPDATE`,
        [idEstudiante],
      );
      let solicitud = res.rows[0];
      if (solicitud && solicitud.estado !== 'BORRADOR') {
        throw new ConflictException(
          `La preinscripción ya fue enviada y no puede ser modificada en estado ${solicitud.estado}`,
        );
      }
      const nivel =
        datos.nivel ??
        datos.tipo_solicitud ??
        solicitud?.tipo_solicitud ??
        'PREGRADO';
      if (!solicitud) {
        const insert = await client.query<SolicitudResumen>(
          `INSERT INTO solicitud_grado (id_estudiante, tipo_solicitud, estado)
           VALUES ($1, $2, 'BORRADOR') RETURNING id_solicitud, id_periodo, tipo_solicitud, estado`,
          [idEstudiante, nivel],
        );
        solicitud = insert.rows[0];
      }
      await this.asegurarPeriodo(client, solicitud);
      const id = solicitud.id_solicitud;
      if (nivel !== solicitud.tipo_solicitud) {
        // Limpiar los hijos antes de cambiar el nivel, respetando los triggers SQL.
        for (const tabla of [
          'informacion_pregrado',
          'informacion_posgrado',
          'experiencia_laboral',
          'solicitud_programa',
        ]) {
          await client.query(`DELETE FROM ${tabla} WHERE id_solicitud = $1`, [
            id,
          ]);
        }
        // Los documentos ya cargados permanecen vinculados a la misma solicitud.
      }
      const actualizado = await client.query<{ fecha_actualizacion: Date }>(
        `UPDATE solicitud_grado SET tipo_solicitud = $2,
         segundo_programa = CASE WHEN $3::boolean THEN $4::boolean ELSE segundo_programa END,
         fecha_actualizacion = CURRENT_TIMESTAMP
         WHERE id_solicitud = $1 AND estado = 'BORRADOR' RETURNING fecha_actualizacion`,
        [
          id,
          nivel,
          datos.segundoPrograma !== undefined,
          datos.segundoPrograma ?? null,
        ],
      );
      await this.guardarCampos(
        client,
        'usuarios',
        'id_usuario',
        idEstudiante,
        {
          nombres: 'nombres',
          apellidos: 'apellidos',
          codigoEstudiantil: 'codigo_estudiante',
        },
        Object.fromEntries(
          Object.entries(datos).filter(
            ([k, v]) =>
              ['nombres', 'apellidos', 'codigoEstudiantil'].includes(k) &&
              typeof v === 'string' &&
              v.trim(),
          ),
        ),
        false,
      );
      if (datos.perfil)
        await this.guardarCampos(
          client,
          'perfil_estudiante',
          'id_usuario',
          idEstudiante,
          PERFIL,
          datos.perfil,
        );
      if (datos.programas) {
        await client.query(
          'DELETE FROM solicitud_programa WHERE id_solicitud = $1',
          [id],
        );
        for (const programa of datos.programas) {
          if (programa.orden === 2 && datos.segundoPrograma === false) continue;
          await this.guardarCampos(
            client,
            'solicitud_programa',
            'id_solicitud',
            id,
            PROGRAMA,
            {
              ...programa,
              tipoOpcionGrado:
                nivel === 'POSGRADO' ? '' : programa.tipoOpcionGrado,
            },
          );
        }
      }
      if (datos.segundoPrograma === false)
        await client.query(
          'DELETE FROM solicitud_programa WHERE id_solicitud = $1 AND orden = 2',
          [id],
        );
      if (nivel === 'PREGRADO' && datos.pregrado) {
        // Combinar respuestas parciales con lo existente antes de limpiar campos dependientes.
        const previo = await client.query(
          `SELECT ${proyeccion(PREGRADO)} FROM informacion_pregrado WHERE id_solicitud = $1`,
          [id],
        );
        const preg = { ...previo.rows[0], ...datos.pregrado };
        if (preg.conoceRegistroSaberPro !== true) {
          preg.numeroRegistroSaberPro = '';
          preg.fechaExamenSaberPro = '';
        }
        if (preg.esEmpleadoUtb !== true) preg.tipoContrato = '';
        await this.guardarCampos(
          client,
          'informacion_pregrado',
          'id_solicitud',
          id,
          PREGRADO,
          preg,
        );
      }
      if (nivel === 'POSGRADO') {
        if (datos.posgrado)
          await this.guardarCampos(
            client,
            'informacion_posgrado',
            'id_solicitud',
            id,
            POSGRADO,
            datos.posgrado,
          );
        if (datos.experiencia) {
          await client.query(
            'DELETE FROM experiencia_laboral WHERE id_solicitud = $1',
            [id],
          );
          for (const exp of datos.experiencia)
            await this.guardarCampos(
              client,
              'experiencia_laboral',
              'id_solicitud',
              id,
              EXPERIENCIA,
              exp,
            );
        }
      }
      // Solo metadatos: el transporte/almacenamiento del archivo corresponde al servicio de carga.
      if (datos.documentos) {
        const docs = Array.isArray(datos.documentos)
          ? datos.documentos
          : Object.values(datos.documentos);
        for (const doc of docs) {
          const original = doc.tipo ?? doc.id ?? '';
          const tipo = normalizarTipoDocumento(original.replace(/-2$/, ''));
          if (!TypeDocument.safeParse(tipo).success)
            throw new BadRequestException('Tipo documental inválido');
          const orden =
            original.endsWith('-2') ||
            doc.id?.endsWith('-2') ||
            original === 'estampilla2'
              ? 2
              : 1;
          if (orden === 2 && tipo !== 'estampilla_pro_cultura')
            throw new BadRequestException('Orden documental inválido');
          await client.query(
            `INSERT INTO documentos
            (id_solicitud, tipo_documento, orden, nombre_original, mime_type, tamano_bytes, version, estado, id_entrega)
            VALUES ($1, $2, $3, $4, 'application/pdf', $5, 1, 'CARGADO', NULL)
            ON CONFLICT (id_solicitud, tipo_documento, orden, version) DO UPDATE
            SET nombre_original = EXCLUDED.nombre_original, tamano_bytes = EXCLUDED.tamano_bytes
            WHERE documentos.id_entrega IS NULL AND documentos.estado = 'CARGADO'`,
            [id, tipo, orden, doc.nombre, doc.tamano],
          );
        }
      }
      return {
        ok: true,
        id_solicitud: id,
        estado: 'BORRADOR',
        mensaje: 'Borrador guardado exitosamente',
        periodos: await consultarContextoPeriodo(client, solicitud.id_periodo!),
        guardadoEn: new Date(
          actualizado.rows[0].fecha_actualizacion,
        ).toISOString(),
      };
    });
  }

  private async asegurarPeriodo(client: PoolClient, solicitud: SolicitudResumen) {
    if (solicitud.id_periodo) return;
    // Incluye borradores históricos sin periodo: se vinculan una sola vez al siguiente guardado.
    const idPeriodo = await requerirPeriodoElegible(client);
    await client.query(
      'UPDATE solicitud_grado SET id_periodo = $2 WHERE id_solicitud = $1 AND id_periodo IS NULL',
      [solicitud.id_solicitud, idPeriodo],
    );
    solicitud.id_periodo = idPeriodo;
  }

  private async guardarCampos(
    client: PoolClient,
    tabla: string,
    clave: string,
    id: number,
    mapa: Record<string, string>,
    datos: object,
    insertar = true,
  ) {
    const campos = Object.entries(datos).filter(
      ([k, v]) => mapa[k] && v !== undefined,
    );
    if (!campos.length) return;
    const columnas = campos.map(([k]) => mapa[k]);
    const valores = campos.map(([, v]) =>
      typeof v === 'string' ? v.trim() || null : v,
    );
    const parametros = columnas.map((_, i) => `$${i + 2}`);
    if (!insertar) {
      await client.query(
        `UPDATE ${tabla} SET ${columnas.map((c, i) => `${c} = ${parametros[i]}`).join(', ')} WHERE ${clave} = $1`,
        [id, ...valores],
      );
      return;
    }
    const conflicto = columnas.includes('orden') ? `${clave}, orden` : clave;
    await client.query(
      `INSERT INTO ${tabla} (${clave}, ${columnas.join(', ')})
      VALUES ($1, ${parametros.join(', ')}) ON CONFLICT (${conflicto}) DO UPDATE
      SET ${columnas.map((c) => `${c} = EXCLUDED.${c}`).join(', ')}`,
      [id, ...valores],
    );
  }

  private async persistirDatosFormulario(
    client: PoolClient,
    idEstudiante: number,
    idSolicitud: number,
    tipoSolicitud: string,
    payload: DatosEnvioPreinscripcion,
  ): Promise<void> {
    // Actualizar datos básicos de usuario si se especificaron
    if (payload.nombres || payload.apellidos || payload.codigoEstudiantil) {
      await client.query(
        `UPDATE usuarios
         SET nombres = COALESCE(NULLIF($1, ''), nombres),
             apellidos = COALESCE(NULLIF($2, ''), apellidos),
             codigo_estudiante = COALESCE(NULLIF($3, ''), codigo_estudiante)
         WHERE id_usuario = $4;`,
        [
          payload.nombres?.trim() ?? '',
          payload.apellidos?.trim() ?? '',
          payload.codigoEstudiantil?.trim() ?? '',
          idEstudiante,
        ],
      );
    }

    // Persistir perfil_estudiante
    if (payload.perfil) {
      const p = payload.perfil;
      await client.query(
        `INSERT INTO perfil_estudiante (
           id_usuario, tipo_documento_identidad, numero_documento,
           fecha_nacimiento, genero, departamento_residencia, ciudad_residencia,
           direccion_residencia, telefono_fijo, telefono_celular
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id_usuario) DO UPDATE SET
           tipo_documento_identidad = EXCLUDED.tipo_documento_identidad,
           numero_documento = EXCLUDED.numero_documento,
           fecha_nacimiento = COALESCE(EXCLUDED.fecha_nacimiento, perfil_estudiante.fecha_nacimiento),
           genero = COALESCE(EXCLUDED.genero, perfil_estudiante.genero),
           departamento_residencia = COALESCE(EXCLUDED.departamento_residencia, perfil_estudiante.departamento_residencia),
           ciudad_residencia = COALESCE(EXCLUDED.ciudad_residencia, perfil_estudiante.ciudad_residencia),
           direccion_residencia = COALESCE(EXCLUDED.direccion_residencia, perfil_estudiante.direccion_residencia),
           telefono_fijo = COALESCE(EXCLUDED.telefono_fijo, perfil_estudiante.telefono_fijo),
           telefono_celular = COALESCE(EXCLUDED.telefono_celular, perfil_estudiante.telefono_celular);`,
        [
          idEstudiante,
          p.tipoDocumento?.trim() || null,
          p.numeroDocumento?.trim() || null,
          p.fechaNacimiento?.trim() || null,
          p.genero?.trim() || null,
          p.departamento?.trim() || null,
          p.ciudad?.trim() || null,
          p.direccion?.trim() || null,
          p.telefonoFijo?.trim() || null,
          p.celular?.trim() || null,
        ],
      );
    }

    // Persistir solicitud_programa. El programa 2 solo se guarda si el estudiante respondió que sí:
    // si no, se borra el que hubiera, para que la fila 2 siempre signifique "hay segundo programa"
    // (y entonces se exige su estampilla, ver validarRequisitosCompletos).
    if (payload.programas && Array.isArray(payload.programas)) {
      const conSegundoPrograma = payload.segundoPrograma === true;
      if (!conSegundoPrograma) {
        await client.query(`DELETE FROM solicitud_programa WHERE id_solicitud = $1 AND orden = 2;`, [
          idSolicitud,
        ]);
      }
      for (const prog of payload.programas) {
        if (prog.orden === 2 && !conSegundoPrograma) continue;
        if (!prog.programa && !prog.modalidad) continue;
        const tipoOpcion =
          tipoSolicitud === 'POSGRADO'
            ? null
            : prog.tipoOpcionGrado?.trim() || null;

        await client.query(
          `INSERT INTO solicitud_programa (
             id_solicitud, orden, programa, modalidad, tipo_opcion_grado
           ) VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id_solicitud, orden) DO UPDATE SET
             programa = EXCLUDED.programa,
             modalidad = EXCLUDED.modalidad,
             tipo_opcion_grado = EXCLUDED.tipo_opcion_grado;`,
          [
            idSolicitud,
            prog.orden,
            prog.programa?.trim() || null,
            prog.modalidad?.trim() || null,
            tipoOpcion,
          ],
        );
      }
    }

    // Persistir datos específicos de pregrado
    if (tipoSolicitud === 'PREGRADO' && payload.pregrado) {
      const preg = payload.pregrado;
      const conoce = preg.conoceRegistroSaberPro ?? false;
      const numSaberPro = conoce ? preg.numeroRegistroSaberPro?.trim() || null : null;
      const esEmp = preg.esEmpleadoUtb ?? false;
      const tipoContrato = esEmp ? preg.tipoContrato?.trim() || null : null;

      await client.query(
        `INSERT INTO informacion_pregrado (
           id_solicitud, conoce_registro_saber_pro, numero_registro_saber_pro,
           fecha_examen_saber_pro, es_empleado_utb, tipo_contrato, es_hijo_empleado_utb
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id_solicitud) DO UPDATE SET
           conoce_registro_saber_pro = EXCLUDED.conoce_registro_saber_pro,
           numero_registro_saber_pro = EXCLUDED.numero_registro_saber_pro,
           fecha_examen_saber_pro = EXCLUDED.fecha_examen_saber_pro,
           es_empleado_utb = EXCLUDED.es_empleado_utb,
           tipo_contrato = EXCLUDED.tipo_contrato,
           es_hijo_empleado_utb = EXCLUDED.es_hijo_empleado_utb;`,
        [
          idSolicitud,
          conoce,
          numSaberPro,
          preg.fechaExamenSaberPro?.trim() || null,
          esEmp,
          tipoContrato,
          preg.esHijoDeEmpleadoUtb ?? false,
        ],
      );
    }

    // Persistir datos específicos de posgrado
    if (tipoSolicitud === 'POSGRADO') {
      if (payload.posgrado) {
        const pos = payload.posgrado;
        await client.query(
          `INSERT INTO informacion_posgrado (
             id_solicitud, nivel_estudios_alcanzado, titulo_obtenido, es_egresado_pregrado_utb
           ) VALUES ($1, $2, $3, $4)
           ON CONFLICT (id_solicitud) DO UPDATE SET
             nivel_estudios_alcanzado = EXCLUDED.nivel_estudios_alcanzado,
             titulo_obtenido = EXCLUDED.titulo_obtenido,
             es_egresado_pregrado_utb = EXCLUDED.es_egresado_pregrado_utb;`,
          [
            idSolicitud,
            pos.nivelEstudios?.trim() || null,
            pos.tituloObtenido?.trim() || null,
            pos.esEgresadoPregradoUtb ?? false,
          ],
        );
      }

      if (payload.experiencia && Array.isArray(payload.experiencia)) {
        for (const exp of payload.experiencia) {
          if (!exp.empresa && !exp.cargo) continue;
          await client.query(
            `INSERT INTO experiencia_laboral (
               id_solicitud, orden, empresa, cargo, tiempo
             ) VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (id_solicitud, orden) DO UPDATE SET
               empresa = EXCLUDED.empresa,
               cargo = EXCLUDED.cargo,
               tiempo = EXCLUDED.tiempo;`,
            [
              idSolicitud,
              exp.orden,
              exp.empresa?.trim() || null,
              exp.cargo?.trim() || null,
              exp.tiempo?.trim() || null,
            ],
          );
        }
      }
    }

    // Persistir metadatos de documentos si vienen en el payload
    if (payload.documentos) {
      const docsArray: DocumentoCargadoDTO[] = Array.isArray(payload.documentos)
        ? payload.documentos
        : Object.values(payload.documentos);

      for (const doc of docsArray) {
        let idTipo = doc.tipo || doc.id;
        let orden = 1;
        if (doc.id && (doc.id.endsWith('-2') || doc.id === 'estampilla2')) {
          idTipo = 'estampilla_pro_cultura';
          orden = 2;
        } else if (idTipo && (idTipo.endsWith('-2') || idTipo === 'estampilla2')) {
          idTipo = 'estampilla_pro_cultura';
          orden = 2;
        }
        if (!idTipo) continue;
        const nombre = doc.nombre || `${idTipo}.pdf`;
        const tamano = doc.tamano && doc.tamano > 0 ? doc.tamano : 1024;

        await client.query(
          `INSERT INTO documentos (
             id_solicitud, tipo_documento, orden, nombre_original,
             mime_type, tamano_bytes, version, estado
           ) VALUES ($1, $2, $3, $4, 'application/pdf', $5, 1, 'CARGADO')
           ON CONFLICT (id_solicitud, tipo_documento, orden, version) DO UPDATE SET
             nombre_original = EXCLUDED.nombre_original,
             tamano_bytes = EXCLUDED.tamano_bytes,
             estado = 'CARGADO';`,
          [idSolicitud, idTipo, orden, nombre, tamano],
        );
      }
    }
  }

  private async validarRequisitosCompletos(
    client: PoolClient,
    idEstudiante: number,
    idSolicitud: number,
    tipoSolicitud: string,
  ): Promise<void> {
    // Validar usuario
    const resUsuario = await client.query<{
      nombres: string;
      apellidos: string;
      codigo_estudiante: string;
    }>(
      `SELECT nombres, apellidos, codigo_estudiante FROM usuarios WHERE id_usuario = $1;`,
      [idEstudiante],
    );
    const u = resUsuario.rows[0];
    if (!u || !u.nombres?.trim() || !u.apellidos?.trim() || !u.codigo_estudiante?.trim()) {
      throw new BadRequestException('Faltan nombres, apellidos o código estudiantil del estudiante');
    }

    // Validar perfil_estudiante
    const resPerfil = await client.query<{
      tipo_documento_identidad: string;
      numero_documento: string;
    }>(
      `SELECT tipo_documento_identidad, numero_documento
       FROM perfil_estudiante
       WHERE id_usuario = $1;`,
      [idEstudiante],
    );
    const perfil = resPerfil.rows[0];
    if (
      !perfil ||
      !perfil.tipo_documento_identidad?.trim() ||
      !perfil.numero_documento?.trim() ||
      !/^[A-Za-z0-9]+$/.test(perfil.numero_documento.trim())
    ) {
      throw new BadRequestException('Perfil de estudiante incompleto o número de documento inválido');
    }

    // Validar solicitud_programa
    const resPrograma = await client.query<{
      orden: number;
      programa: string;
      modalidad: string;
      tipo_opcion_grado: string | null;
    }>(
      `SELECT orden, programa, modalidad, tipo_opcion_grado
       FROM solicitud_programa
       WHERE id_solicitud = $1
       ORDER BY orden ASC;`,
      [idSolicitud],
    );
    const prog1 = resPrograma.rows.find((p) => p.orden === 1);
    if (!prog1 || !prog1.programa?.trim() || !prog1.modalidad?.trim()) {
      throw new BadRequestException('Información académica incompleta: falta programa principal o modalidad');
    }

    if (tipoSolicitud === 'PREGRADO') {
      const resPreg = await client.query<{
        conoce_registro_saber_pro: boolean | null;
        numero_registro_saber_pro: string | null;
      }>(
        `SELECT conoce_registro_saber_pro, numero_registro_saber_pro
         FROM informacion_pregrado
         WHERE id_solicitud = $1;`,
        [idSolicitud],
      );
      if (resPreg.rows.length === 0) {
        throw new BadRequestException('Falta información requerida de pregrado');
      }
      const preg = resPreg.rows[0];
      if (
        preg.conoce_registro_saber_pro === true &&
        (!preg.numero_registro_saber_pro || !preg.numero_registro_saber_pro.trim())
      ) {
        throw new BadRequestException('Debe registrar el número de registro Saber Pro');
      }
    } else if (tipoSolicitud === 'POSGRADO') {
      const resPos = await client.query<{
        nivel_estudios_alcanzado: string | null;
        titulo_obtenido: string | null;
      }>(
        `SELECT nivel_estudios_alcanzado, titulo_obtenido
         FROM informacion_posgrado
         WHERE id_solicitud = $1;`,
        [idSolicitud],
      );
      if (resPos.rows.length === 0) {
        throw new BadRequestException('Falta información de estudios de posgrado');
      }
      const pos = resPos.rows[0];
      if (!pos.nivel_estudios_alcanzado?.trim() || !pos.titulo_obtenido?.trim()) {
        throw new BadRequestException('Debe completar nivel de estudios y título obtenido');
      }
    }

    // Validar documentos cargados
    const resDocs = await client.query<{ tipo_documento: string; orden?: number | null }>(
      `SELECT tipo_documento, orden FROM documentos
       WHERE id_solicitud = $1 AND (id_entrega IS NULL OR estado = 'CARGADO');`,
      [idSolicitud],
    );

    const tiposExistentes = new Set(
      resDocs.rows.map((d) => normalizarTipoDocumento(d.tipo_documento)),
    );

    const requeridos =
      tipoSolicitud === 'PREGRADO'
        ? DOCUMENTOS_REQUERIDOS_PREGRADO
        : DOCUMENTOS_REQUERIDOS_POSGRADO;

    const faltantes = requeridos.filter((tipo) => !tiposExistentes.has(tipo));

    // Doble programa en pregrado: una estampilla Pro-Cultura por programa (la del segundo, con orden 2).
    const hayPrograma2 = resPrograma.rows.some((p) => p.orden === 2 && p.programa?.trim());
    const hayEstampilla2 = resDocs.rows.some(
      (d) => normalizarTipoDocumento(d.tipo_documento) === 'estampilla_pro_cultura' && (d.orden ?? 1) === 2,
    );
    if (tipoSolicitud === 'PREGRADO' && hayPrograma2 && !hayEstampilla2) {
      faltantes.push('estampilla_pro_cultura (segundo programa)');
    }

    if (faltantes.length > 0) {
      throw new BadRequestException(
        `Documentos obligatorios faltantes para ${tipoSolicitud}: ${faltantes.join(', ')}`,
      );
    }
  }
}
