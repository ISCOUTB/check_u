import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service.js';
import { TIPO_DOCUMENTO_LEGADO } from '../contratos/mapeo.js';
import type {
  DatosEnvioPreinscripcion,
  DocumentoCargadoDTO,
  RespuestaEnvioPreinscripcion,
  RespuestaGuardarBorrador,
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
  if (limpio === 'estampilla2') return 'estampilla_pro_cultura';
  return TIPO_DOCUMENTO_LEGADO[limpio] ?? limpio;
}

@Injectable()
export class SolicitudesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async obtenerSolicitudEstudiante(
    idEstudiante: number,
  ): Promise<RespuestaSolicitudEstudiante> {
    const consulta = `
      SELECT id_solicitud, tipo_solicitud, estado
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
        `SELECT id_solicitud, tipo_solicitud, estado
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
             RETURNING id_solicitud, tipo_solicitud, estado;`,
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

  async guardarBorrador(
    idEstudiante: number,
    payload?: DatosEnvioPreinscripcion,
  ): Promise<RespuestaGuardarBorrador> {
    return this.databaseService.transaction(async (client) => {
      const resSolicitud = await client.query<SolicitudResumen>(
        `SELECT id_solicitud, tipo_solicitud, estado
         FROM solicitud_grado
         WHERE id_estudiante = $1
         ORDER BY id_solicitud DESC
         LIMIT 1
         FOR UPDATE;`,
        [idEstudiante],
      );

      let solicitud = resSolicitud.rows[0];

      if (solicitud && solicitud.estado !== 'BORRADOR') {
        throw new ConflictException(
          `La preinscripción ya fue enviada y no puede ser modificada en estado ${solicitud.estado}`,
        );
      }

      if (!solicitud) {
        const nivel = (payload?.nivel || payload?.tipo_solicitud || 'PREGRADO').toUpperCase();
        const insertRes = await client.query<SolicitudResumen>(
          `INSERT INTO solicitud_grado (id_estudiante, tipo_solicitud, estado)
           VALUES ($1, $2, 'BORRADOR')
           RETURNING id_solicitud, tipo_solicitud, estado;`,
          [idEstudiante, nivel],
        );
        solicitud = insertRes.rows[0];
      }

      if (payload) {
        await this.persistirDatosFormulario(
          client,
          idEstudiante,
          solicitud.id_solicitud,
          solicitud.tipo_solicitud,
          payload,
        );
      }

      return {
        ok: true,
        guardadoEn: new Date().toISOString(),
      };
    });
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
          p.tipoDocumento?.trim() || 'CC',
          p.numeroDocumento?.trim() || '12345678',
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

    // Persistir solicitud_programa
    if (payload.programas && Array.isArray(payload.programas)) {
      for (const prog of payload.programas) {
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
            prog.programa?.trim() || '',
            prog.modalidad?.trim() || 'PRESENCIAL',
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
            pos.nivelEstudios?.trim() || 'PROFESIONAL',
            pos.tituloObtenido?.trim() || 'Título Previo',
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
        const idTipo = doc.id || doc.tipo;
        if (!idTipo) continue;
        const nombre = doc.nombre || `${idTipo}.pdf`;
        const tamano = doc.tamano && doc.tamano > 0 ? doc.tamano : 1024;

        await client.query(
          `INSERT INTO documentos (
             id_solicitud, tipo_documento, orden, nombre_original,
             mime_type, tamano_bytes, version, estado
           ) VALUES ($1, $2, 1, $3, 'application/pdf', $4, 1, 'CARGADO')
           ON CONFLICT (id_solicitud, tipo_documento, orden, version) DO NOTHING;`,
          [idSolicitud, idTipo, nombre, tamano],
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
    const resDocs = await client.query<{ tipo_documento: string }>(
      `SELECT tipo_documento FROM documentos
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

    if (faltantes.length > 0) {
      throw new BadRequestException(
        `Documentos obligatorios faltantes para ${tipoSolicitud}: ${faltantes.join(', ')}`,
      );
    }
  }
}
