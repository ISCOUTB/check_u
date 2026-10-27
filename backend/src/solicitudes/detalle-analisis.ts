import { NotFoundException } from '@nestjs/common';
import type { DatabaseService } from '../database/database.service.js';

export async function detalleAnalisis(
  db: DatabaseService,
  idEstudiante: number,
) {
  return db.transaction(async (client) => {
    await client.query(
      'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
    );
    const res = await client.query(
      `SELECT s.id_solicitud, s.tipo_solicitud, s.estado, s.fecha_creacion AS fecha_solicitud,
      u.nombres, u.apellidos, u.codigo_estudiante, u.correo, pe.*
      FROM solicitud_grado s JOIN usuarios u ON u.id_usuario = s.id_estudiante
      LEFT JOIN perfil_estudiante pe ON pe.id_usuario = u.id_usuario
      WHERE s.id_estudiante = $1 ORDER BY s.id_solicitud DESC LIMIT 1`,
      [idEstudiante],
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
    const documentos = await client.query(
      `SELECT d.*, v.detalle, v.mensaje,
      (SELECT MAX(r.expira_en) FROM rutas r WHERE r.id_documento = d.id_documento) AS expira_en,
      EXISTS (SELECT 1 FROM rutas r WHERE r.id_documento = d.id_documento AND r.activa) AS archivo_disponible
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
      nombre:
        (etiquetas[d.tipo_documento] ?? d.tipo_documento) +
        (d.orden === 2 ? ' · segundo programa' : ''),
      descripcion: d.nombre_original,
      fileName: d.nombre_original,
      resultados: [
        {
          estado: ['VALIDO', 'NO_VALIDO', 'INCONSISTENTE'].includes(d.estado)
            ? d.estado.toLowerCase()
            : 'por_revisar',
          mensaje:
            d.mensaje ?? 'Análisis pendiente. No hay resultados registrados.',
        },
      ],
      analisis: d.detalle ?? null,
      expiraEn: d.expira_en,
      archivoDisponible: d.archivo_disponible,
      resubmission_allowed: false,
    }));
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
      politicaReenvios: { usados: 0, limite: 0, zona: 'America/Bogota' },
    };
  });
}
