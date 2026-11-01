import { NotFoundException } from '@nestjs/common';
import {
  consultarContextoPeriodo,
  dentroDelPlazoCorreccion,
  fechaCorteCorreccion,
} from '../periodos/asignacion-periodo.js';
import { observacionesDocumento } from './observaciones-documento.js';
import type { DatabaseService } from '../database/database.service.js';

export async function detalleAnalisis(
  db: DatabaseService,
  idEstudiante: number,
  idSolicitud?: number,
) {
  return db.transaction(async (client) => {
    await client.query(
      'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
    );
    const res = await client.query(
      `SELECT s.id_solicitud, s.tipo_solicitud, s.estado, s.id_periodo,
      s.fecha_creacion AS fecha_solicitud,
      u.nombres, u.apellidos, u.codigo_estudiante, u.correo, pe.*
      FROM solicitud_grado s JOIN usuarios u ON u.id_usuario = s.id_estudiante
      LEFT JOIN perfil_estudiante pe ON pe.id_usuario = u.id_usuario
      WHERE s.id_estudiante = $1 AND ($2::integer IS NULL OR s.id_solicitud=$2) ORDER BY s.id_solicitud DESC LIMIT 1`,
      [idEstudiante, idSolicitud ?? null],
    );
    const s = res.rows[0];
    if (!s) throw new NotFoundException('No hay preinscripción registrada.');
    const programas = await client.query(
      'SELECT * FROM solicitud_programa WHERE id_solicitud = $1 ORDER BY orden',
      [s.id_solicitud],
    );
    const especificos = await client.query(
      s.tipo_solicitud === 'PREGRADO'
        ? 'SELECT * FROM informacion_pregrado WHERE id_solicitud = $1'
        : 'SELECT * FROM informacion_posgrado WHERE id_solicitud = $1',
      [s.id_solicitud],
    );
    const experiencia = await client.query(
      'SELECT * FROM experiencia_laboral WHERE id_solicitud = $1 ORDER BY orden',
      [s.id_solicitud],
    );
    const cuenta = await client.query<{ usados: number }>(
      `SELECT COUNT(*)::int AS usados FROM entregas WHERE id_solicitud=$1 AND tipo_entrega='CORRECCION'
      AND fecha_entrega_bogota=(CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date`,
      [s.id_solicitud],
    );
    const fin = await client.query<{ fecha_fin: string | null }>(
      'SELECT fecha_fin::text AS fecha_fin FROM periodos_grado WHERE id = $1',
      [s.id_periodo ?? null],
    );
    const fechaFin = fin.rows[0]?.fecha_fin ?? null;
    // Tarea 42a: después de fecha_fin − 7 ya no se corrige.
    const admite =
      ['EN_PROCESO', 'POR_REVISAR', 'NO_VALIDA', 'INCONSISTENTE'].includes(
        s.estado,
      ) && (!fechaFin || dentroDelPlazoCorreccion(fechaFin));
    const documentos = await client.query(
      `SELECT d.*, v.detalle, v.mensaje,
      (SELECT MAX(r.expira_en) FROM rutas r WHERE r.id_documento = d.id_documento) AS expira_en,
      EXISTS (SELECT 1 FROM rutas r JOIN solicitud_grado sg ON sg.id_solicitud=d.id_solicitud
        JOIN periodos_grado p ON p.id=sg.id_periodo WHERE r.id_documento = d.id_documento AND r.activa
        AND ((p.fecha_fin+16)::timestamp AT TIME ZONE 'America/Bogota') > CURRENT_TIMESTAMP) AS archivo_disponible
      FROM documentos d LEFT JOIN LATERAL (SELECT detalle, mensaje FROM validaciones
        WHERE id_documento = d.id_documento ORDER BY id_validacion DESC LIMIT 1) v ON TRUE
      WHERE d.id_solicitud = $1 AND d.id_entrega IS NOT NULL
      ORDER BY d.tipo_documento, d.orden, d.version DESC`,
      [s.id_solicitud],
    );
    const actuales = documentos.rows.filter(
      (d, i, filas) =>
        filas.findIndex(
          (f) => f.tipo_documento === d.tipo_documento && f.orden === d.orden,
        ) === i,
    );
    const etiquetas: Record<string, string> = {
      identification: 'Documento de identidad',
      academic_evaluation: 'Evaluación de Grado (Banner)',
      paz_y_salvo_bib: 'Paz y Salvo de Biblioteca',
      estampilla_pro_cultura: 'Estampilla Pro-Cultura',
      saber_pro: 'Resultados Saber Pro',
    };
    const documentosUi = actuales.map((d) => ({
      id: String(d.id_documento),
      tipo: d.tipo_documento,
      orden: d.orden,
      version: d.version,
      nombre:
        (etiquetas[d.tipo_documento] ?? d.tipo_documento) +
        (d.orden === 2 ? ' · segundo programa' : ''),
      descripcion: d.nombre_original,
      fileName: d.nombre_original,
      resultados: observacionesDocumento(
        d.estado,
        d.detalle as Record<string, unknown> | null,
      ),
      analisis: d.detalle ?? null,
      expiraEn: d.expira_en,
      archivoDisponible: d.archivo_disponible,
      resubmission_allowed:
        admite && d.estado !== 'VALIDO' && cuenta.rows[0].usados < 3,
    }));
    const periodos = await consultarContextoPeriodo(
      client,
      s.id_periodo ?? null,
    );
    const p = programas.rows[0] ?? {},
      p2 = programas.rows[1] ?? {},
      extra = especificos.rows[0] ?? {};
    const fecha = (v: unknown) =>
      v instanceof Date
        ? v.toISOString().slice(0, 10)
        : typeof v === 'string'
          ? v.slice(0, 10)
          : '';
    const informacion = {
      nombres: s.nombres,
      apellidos: s.apellidos,
      codigoEstudiantil: s.codigo_estudiante,
      correo: s.correo,
      tipoDocumento: s.tipo_documento_identidad ?? '',
      numeroDocumento: s.numero_documento ?? '',
      fechaNacimiento: fecha(s.fecha_nacimiento),
      genero: s.genero ?? '',
      telefonoFijo: s.telefono_fijo ?? '',
      telefonoCelular: s.telefono_celular ?? '',
      departamento: s.departamento_residencia ?? '',
      ciudad: s.ciudad_residencia ?? '',
      direccion: s.direccion_residencia ?? '',
      programa: p.programa ?? '',
      modalidad: p.modalidad ?? '',
      tipoOpcionGrado: p.tipo_opcion_grado ?? '',
      tieneSegundoPrograma: Boolean(p2.programa),
      segundoPrograma: p2.programa ?? '',
      modalidadSegundoPrograma: p2.modalidad ?? '',
      tipoOpcionGradoSegundo: p2.tipo_opcion_grado ?? '',
      conoceRegistroSaberPro: extra.conoce_registro_saber_pro ?? false,
      numeroRegistroSaberPro: extra.numero_registro_saber_pro ?? '',
      fechaExamenSaberPro: fecha(extra.fecha_examen_saber_pro),
      esEmpleadoUtb: extra.es_empleado_utb ?? false,
      tipoContrato: extra.tipo_contrato ?? '',
      esHijoEmpleadoUtb: extra.es_hijo_empleado_utb ?? false,
      nivelEstudiosAlcanzado: extra.nivel_estudios_alcanzado ?? '',
      tituloObtenido: extra.titulo_obtenido ?? '',
      esEgresadoPregradoUtb: extra.es_egresado_pregrado_utb ?? false,
      cargos: experiencia.rows.map((e) => ({
        empresa: e.empresa ?? '',
        cargo: e.cargo ?? '',
        tiempo: e.tiempo ?? '',
      })),
    };
    return {
      id: String(s.id_solicitud),
      estadoSolicitud: s.estado,
      estadoAnalisis:
        !actuales.length || actuales.some((d) => !d.detalle)
          ? 'pendiente'
          : 'registrado',
      estudiante: {
        codigo: s.codigo_estudiante,
        nombre: `${s.nombres} ${s.apellidos}`,
        tipoDocumento: informacion.tipoDocumento,
        numeroDocumento: informacion.numeroDocumento,
        fechaNacimiento: informacion.fechaNacimiento,
        programa: informacion.programa,
        facultad: '',
        nivel: s.tipo_solicitud,
        correo: s.correo,
        telefono: informacion.telefonoCelular,
        ciudad: informacion.ciudad,
        fechaSolicitud: String(s.fecha_solicitud),
      },
      informacion,
      documentos: documentosUi,
      periodos,
      fechaCorteCorreccion: fechaFin ? fechaCorteCorreccion(fechaFin) : null,
      politicaReenvios: {
        usados: cuenta.rows[0].usados,
        limite: admite ? 3 : 0,
        zona: 'America/Bogota',
      },
    };
  });
}
