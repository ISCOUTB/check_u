import type { InformarAvance } from './progreso-envio.js';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import {
  AnalisisPreinscripcionService,
  validarArchivos,
  type PdfPreinscripcion,
} from './analisis-preinscripcion.service.js';
import type { PoolClient } from 'pg';
import {
  consultarContextoPeriodo,
  requerirPeriodoElegible,
} from '../periodos/asignacion-periodo.js';
import { TypeDocument } from '../contratos/enums.js';
import {
  validarBorrador,
  proyeccion,
  PERFIL,
  PREGRADO,
  POSGRADO,
  PROGRAMA,
  EXPERIENCIA,
} from './borrador.js';
import { DatabaseService } from '../database/database.service.js';
import { TIPO_DOCUMENTO_LEGADO } from '../contratos/mapeo.js';
import { recalcularEstado } from './recalcular-estado.js';
import {
  admiteSegundo,
  claveDocumento,
  documentosRequeridos,
} from './requisitos-documentales.js';
import type {
  DatosEnvioPreinscripcion,
  DocumentoCargadoDTO,
  RespuestaEnvioPreinscripcion,
  RespuestaEstadoNavegacion,
  RespuestaGuardarBorrador,
  RespuestaObtenerBorrador,
  RespuestaSolicitudEstudiante,
  SolicitudResumen,
} from './solicitudes.types.js';

function normalizarTipoDocumento(tipo: string): string {
  const limpio = tipo.trim().toLowerCase();
  if (limpio === 'estampilla2') return 'estampilla_pro_cultura';
  const segundo = limpio.replace(/-2$/, '');
  if (segundo !== limpio && admiteSegundo(segundo)) return segundo;
  return TIPO_DOCUMENTO_LEGADO[limpio] ?? limpio;
}

@Injectable()
export class SolicitudesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly analisis: AnalisisPreinscripcionService,
  ) {}

  async obtenerSolicitudEstudiante(
    idEstudiante: number,
  ): Promise<RespuestaSolicitudEstudiante> {
    const consulta = `
      SELECT id_solicitud, id_periodo, tipo_solicitud, estado
      FROM solicitud_grado
      WHERE id_estudiante = $1 AND estado NOT IN ('CANCELADA','CERRADA')
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

  async obtenerEstadoNavegacion(
    idEstudiante: number,
  ): Promise<RespuestaEstadoNavegacion> {
    const resultado = await this.databaseService.query<SolicitudResumen>(
      `SELECT id_solicitud, tipo_solicitud, estado
       FROM solicitud_grado
       WHERE id_estudiante = $1 AND estado NOT IN ('CANCELADA','CERRADA')
       ORDER BY id_solicitud DESC
       LIMIT 1`,
      [idEstudiante],
    );

    if (resultado.rows.length === 0) {
      return {
        ok: true,
        estado: 'SIN_SOLICITUD',
        destino: '/estudiante/bienvenida',
      };
    }

    const fila = resultado.rows[0];
    const nivel = fila.tipo_solicitud === 'POSGRADO' ? 'POSGRADO' : 'PREGRADO';

    if (fila.estado === 'BORRADOR') {
      return {
        ok: true,
        estado: 'BORRADOR',
        destino: `/estudiante/iniciar_preinscripcion?nivel=${nivel}`,
        id_solicitud: fila.id_solicitud,
        nivel,
      };
    }

    // EN_PROCESO u otro estado no borrador = ya envió
    return {
      ok: true,
      estado: 'ENVIADA',
      destino: '/estudiante/home',
      id_solicitud: fila.id_solicitud,
      nivel,
    };
  }

  async enviarPreinscripcion(
    idEstudiante: number,
    payload?: DatosEnvioPreinscripcion,
    archivos: PdfPreinscripcion[] = [],
    informar: InformarAvance = () => {},
  ): Promise<RespuestaEnvioPreinscripcion> {
    informar('Subiendo documentos.');
    validarArchivos(archivos);
    informar('Documentos cargados.');
    // Primero guarda el borrador. Un fallo del motor no pierde los campos del estudiante.
    const datos = validarBorrador(payload);
    const esperados = documentosRequeridos(
      datos.nivel === 'POSGRADO' ? 'POSGRADO' : 'PREGRADO',
      datos.nivel !== 'POSGRADO' && datos.segundoPrograma === true,
    ).map(claveDocumento);
    if (
      archivos.length !== esperados.length ||
      esperados.some((t) => !archivos.some((a) => a.tipo === t))
    )
      throw new BadRequestException(
        'Adjunta los documentos requeridos para tu nivel académico.',
      );
    const payloadReal = {
      ...datos,
      documentos: archivos.map((a) => ({
        id: a.tipo,
        nombre: a.originalname,
        tamano: a.buffer.length,
      })),
    };
    informar('Registrando solicitud de preinscripción.');
    await this.guardarBorrador(idEstudiante, payloadReal);
    informar('Solicitud de preinscripción almacenada.');
    const creados: string[] = [];
    return this.databaseService
      .transaction<RespuestaEnvioPreinscripcion>(async (client) => {
        // 1. Obtener y bloquear la solicitud activa
        const resSolicitud = await client.query<SolicitudResumen>(
          `SELECT id_solicitud, id_periodo, tipo_solicitud, estado
         FROM solicitud_grado
         WHERE id_estudiante = $1 AND estado NOT IN ('CANCELADA','CERRADA')
         ORDER BY id_solicitud DESC
         LIMIT 1
         FOR UPDATE;`,
          [idEstudiante],
        );

        let solicitud = resSolicitud.rows[0];

        if (!solicitud) {
          if (payload?.nivel || payload?.tipo_solicitud) {
            const nivel = (payload.nivel ||
              payload.tipo_solicitud)!.toUpperCase();
            const insertRes = await client.query<SolicitudResumen>(
              `INSERT INTO solicitud_grado (id_estudiante, tipo_solicitud, estado)
             VALUES ($1, $2, 'BORRADOR')
             RETURNING id_solicitud, id_periodo, tipo_solicitud, estado;`,
              [idEstudiante, nivel],
            );
            solicitud = insertRes.rows[0];
          } else {
            throw new BadRequestException(
              'No existe una solicitud de grado para el estudiante',
            );
          }
        }

        if (solicitud.estado !== 'BORRADOR') {
          throw new ConflictException(
            `La solicitud ya ha sido enviada o no se encuentra en estado BORRADOR (estado actual: ${solicitud.estado})`,
          );
        }

        await this.asegurarPeriodo(client, solicitud, idEstudiante);

        await client.query(
          `DELETE FROM documentos WHERE id_solicitud = $1 AND id_entrega IS NULL
        AND NOT (tipo_documento || CASE WHEN orden = 2 THEN '-2' ELSE '' END = ANY($2::text[]))`,
          [solicitud.id_solicitud, archivos.map((a) => a.tipo)],
        );

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

        informar('Enviando documentos al motor de análisis documental.');
        await this.analisis.procesar(
          client,
          solicitud.id_solicitud,
          idEntrega,
          idEstudiante,
          solicitud.tipo_solicitud,
          archivos,
          creados,
          informar,
        );

        // 6. El estado de la solicitud sale de sus documentos (Tarea 42a), una sola vez por envío.
        const estado = await recalcularEstado(client, solicitud.id_solicitud, {
          envioInicial: true,
        });

        return {
          ok: true,
          id_solicitud: solicitud.id_solicitud,
          id_entrega: idEntrega,
          estado,
          mensaje:
            'Preinscripción registrada. Consulta los resultados del análisis documental.',
        };
      })
      .catch(async (error: unknown) => {
        await this.analisis.descartar(creados);
        throw error;
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
         FROM solicitud_grado WHERE id_estudiante = $1 AND estado NOT IN ('CANCELADA','CERRADA') ORDER BY id_solicitud DESC LIMIT 1`,
        [idEstudiante],
      );
      const solicitud = res.rows[0];
      const periodos = await consultarContextoPeriodo(
        client,
        solicitud?.id_periodo ?? null,
        idEstudiante,
      );
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
         WHERE id_estudiante = $1 AND estado NOT IN ('CANCELADA','CERRADA') ORDER BY id_solicitud DESC LIMIT 1 FOR UPDATE`,
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
      await this.asegurarPeriodo(client, solicitud, idEstudiante);
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
        const conSegundoPrograma = datos.segundoPrograma === true;
        await client.query(
          'DELETE FROM solicitud_programa WHERE id_solicitud = $1',
          [id],
        );
        if (!conSegundoPrograma)
          await client.query(
            'DELETE FROM solicitud_programa WHERE id_solicitud = $1 AND orden = 2',
            [id],
          );
        for (const programa of datos.programas) {
          if (programa.orden === 2 && !conSegundoPrograma) continue;
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
          if (orden === 2 && !admiteSegundo(tipo))
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
        periodos: await consultarContextoPeriodo(client, solicitud.id_periodo!, idEstudiante),
        guardadoEn: new Date(
          actualizado.rows[0].fecha_actualizacion,
        ).toISOString(),
      };
    });
  }

  private async asegurarPeriodo(
    client: PoolClient,
    solicitud: SolicitudResumen,
    idEstudiante: number,
  ) {
    if (solicitud.id_periodo) return;
    // Incluye borradores históricos sin periodo: se vinculan una sola vez al siguiente guardado.
    const idPeriodo = await requerirPeriodoElegible(client, idEstudiante);
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
    if (
      !u ||
      !u.nombres?.trim() ||
      !u.apellidos?.trim() ||
      !u.codigo_estudiante?.trim()
    ) {
      throw new BadRequestException(
        'Faltan nombres, apellidos o código estudiantil del estudiante',
      );
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
      throw new BadRequestException(
        'Perfil de estudiante incompleto o número de documento inválido',
      );
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
      throw new BadRequestException(
        'Información académica incompleta: falta programa principal o modalidad',
      );
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
        throw new BadRequestException(
          'Falta información requerida de pregrado',
        );
      }
      const preg = resPreg.rows[0];
      if (
        preg.conoce_registro_saber_pro === true &&
        (!preg.numero_registro_saber_pro ||
          !preg.numero_registro_saber_pro.trim())
      ) {
        throw new BadRequestException(
          'Debe registrar el número de registro Saber Pro',
        );
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
        throw new BadRequestException(
          'Falta información de estudios de posgrado',
        );
      }
      const pos = resPos.rows[0];
      if (
        !pos.nivel_estudios_alcanzado?.trim() ||
        !pos.titulo_obtenido?.trim()
      ) {
        throw new BadRequestException(
          'Debe completar nivel de estudios y título obtenido',
        );
      }
    }

    // Validar documentos cargados
    const resDocs = await client.query<{
      tipo_documento: string;
      orden?: number | null;
    }>(
      `SELECT tipo_documento, orden FROM documentos
       WHERE id_solicitud = $1 AND (id_entrega IS NULL OR estado = 'CARGADO');`,
      [idSolicitud],
    );

    const existentes = new Set(
      resDocs.rows.map((d) =>
        claveDocumento({
          tipo: normalizarTipoDocumento(d.tipo_documento),
          orden: d.orden ?? 1,
        }),
      ),
    );

    // Doble programa en pregrado: una evaluación de Banner y una estampilla por programa (orden 2).
    const hayPrograma2 = resPrograma.rows.some(
      (p) => p.orden === 2 && p.programa?.trim(),
    );
    const faltantes = documentosRequeridos(tipoSolicitud, hayPrograma2)
      .filter((d) => !existentes.has(claveDocumento(d)))
      .map((d) =>
        d.orden === 2 ? `${d.tipo} (segundo programa)` : d.tipo,
      );

    if (faltantes.length > 0) {
      throw new BadRequestException(
        `Documentos obligatorios faltantes para ${tipoSolicitud}: ${faltantes.join(', ')}`,
      );
    }
  }
}
