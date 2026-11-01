import { ConflictException } from '@nestjs/common';
import type { PoolClient } from 'pg';

export interface PeriodoInscripcion {
  id: string;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  fechaGraduacion: string;
  fechaCorte: string;
  estado: 'ABIERTO' | 'CERRADO';
}

export interface ContextoPeriodo {
  fechaActual: string;
  periodoAsignado: PeriodoInscripcion | null;
  periodoDisponible: PeriodoInscripcion | null;
  proximosPeriodos: PeriodoInscripcion[];
}

const FORMATO_FECHA = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Bogota',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Fecha institucional, independiente de la zona horaria del proceso o del navegador. */
export function fechaInstitucional(instante = new Date()): string {
  const partes = FORMATO_FECHA.formatToParts(instante);
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

/** Último día para corregir documentos (Tarea 42a): fecha_fin − 7, en fechas de calendario. */
export function fechaCorteCorreccion(fechaFin: string): string {
  const [a, m, d] = fechaFin.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d - 7)).toISOString().slice(0, 10);
}

/** El día del corte todavía se permite. `hoy` es la fecha institucional (Bogotá). */
export function dentroDelPlazoCorreccion(
  fechaFin: string,
  hoy = fechaInstitucional(),
): boolean {
  return hoy <= fechaCorteCorreccion(fechaFin);
}

const COLUMNAS = `id, nombre, fecha_inicio::text AS "fechaInicio",
  fecha_fin::text AS "fechaFin", fecha_graduacion::text AS "fechaGraduacion",
  (fecha_fin - 7)::text AS "fechaCorte", estado`;

/** Desempate estable: primero inicio, después fin y UUID. Nunca asigna futuros. */
export async function buscarPeriodoElegible(
  client: PoolClient,
  fecha: string,
  bloquear = false,
  idEstudiante?: number,
): Promise<PeriodoInscripcion | null> {
  const resultado = await client.query<PeriodoInscripcion>(
    `SELECT ${COLUMNAS} FROM periodos_grado
     WHERE estado = 'ABIERTO' AND fecha_inicio <= fecha_fin
       AND fecha_inicio <= $1::date AND $1::date < fecha_fin - 7
       AND ($2::integer IS NULL OR NOT EXISTS (SELECT 1 FROM solicitud_grado s
         WHERE s.id_estudiante=$2 AND s.id_periodo=periodos_grado.id AND s.estado='CANCELADA'))
     ORDER BY fecha_inicio ASC, fecha_fin ASC, id ASC LIMIT 1${bloquear ? ' FOR SHARE' : ''}`,
    [fecha, idEstudiante ?? null],
  );
  return resultado.rows[0] ?? null;
}

/** Debe ejecutarse dentro de la misma transacción que crea o actualiza la solicitud. */
export async function requerirPeriodoElegible(
  client: PoolClient,
  idEstudiante?: number,
): Promise<string> {
  // FOR SHARE impide que una edición o cierre concurrente invalide la selección antes del COMMIT.
  const periodo = await buscarPeriodoElegible(
    client,
    fechaInstitucional(),
    true,
    idEstudiante,
  );
  if (!periodo)
    throw new ConflictException({
      statusCode: 409,
      codigo: 'SIN_PERIODO_DISPONIBLE',
      message:
        'Actualmente no hay un periodo de inscripción disponible para asignar tu solicitud. Consulta las próximas fechas o comunícate con la oficina de grados.',
    });
  return periodo.id;
}

/** Consulta informativa: no crea solicitudes ni cambia asignaciones existentes. */
export async function consultarContextoPeriodo(
  client: PoolClient,
  idPeriodo: string | null,
  idEstudiante?: number,
): Promise<ContextoPeriodo> {
  const fechaActual = fechaInstitucional();
  const asignado = idPeriodo
    ? ((
        await client.query<PeriodoInscripcion>(
          `SELECT ${COLUMNAS} FROM periodos_grado WHERE id = $1`,
          [idPeriodo],
        )
      ).rows[0] ?? null)
    : null;
  const disponible = idPeriodo
    ? null
    : await buscarPeriodoElegible(client, fechaActual, false, idEstudiante);
  const proximos = await client.query<PeriodoInscripcion>(
    `SELECT ${COLUMNAS} FROM periodos_grado
     WHERE estado = 'ABIERTO' AND fecha_inicio <= fecha_fin
       AND fecha_inicio > $1::date
     ORDER BY fecha_inicio ASC, fecha_fin ASC, id ASC LIMIT 5`,
    [fechaActual],
  );
  return {
    fechaActual,
    periodoAsignado: asignado,
    periodoDisponible: disponible,
    proximosPeriodos: proximos.rows,
  };
}
