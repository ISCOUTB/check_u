import type { PoolClient } from 'pg';
import {
  calcularEstadoSolicitud,
  type DocumentoActual,
  type EstadoCalculado,
} from './estado-solicitud.js';
import { documentosRequeridos } from './requisitos-documentales.js';

/** Decisiones de la funcionaria y la cancelación del estudiante: el sistema ya no las recalcula. */
export const ESTADOS_FINALES: readonly string[] = Object.freeze([
  'ACEPTADA',
  'CERRADA',
  'CANCELADA',
]);

/** Tarea 44: el estudiante cancela una solicitud enviada que la funcionaria aún no decide. */
export const ESTADOS_CANCELABLES: readonly string[] = Object.freeze([
  'EN_PROCESO',
  'POR_REVISAR',
  'NO_VALIDA',
  'INCONSISTENTE',
  'VALIDA',
]);

/**
 * Recalcula y guarda el estado dentro de la transacción del llamador (envío, reenvío o
 * resolución). Una solicitud decidida se devuelve sin cambios, y un borrador también, salvo en
 * su envío inicial (`envioInicial`), que es cuando deja de serlo.
 */
export async function recalcularEstado(
  client: PoolClient,
  idSolicitud: number,
  { envioInicial = false }: { envioInicial?: boolean } = {},
): Promise<string> {
  const s = await client.query<{ estado: string }>(
    'SELECT estado FROM solicitud_grado WHERE id_solicitud = $1 FOR UPDATE',
    [idSolicitud],
  );
  const solicitud = s.rows[0];
  if (!solicitud) throw new Error(`No existe la solicitud ${idSolicitud}`);
  if (
    (solicitud.estado === 'BORRADOR' && !envioInicial) ||
    ESTADOS_FINALES.includes(solicitud.estado)
  )
    return solicitud.estado;
  const estado = await calcularEstadoActual(client, idSolicitud);
  await client.query(
    `UPDATE solicitud_grado SET estado = $2, fecha_actualizacion = CURRENT_TIMESTAMP
    WHERE id_solicitud = $1`,
    [idSolicitud, estado],
  );
  return estado;
}

/** Lo que dicen hoy sus documentos, sin guardarlo. El llamador ya tiene la fila bloqueada. */
export async function calcularEstadoActual(
  client: PoolClient,
  idSolicitud: number,
): Promise<EstadoCalculado> {
  const s = await client.query<{ tipo_solicitud: string; doble: boolean }>(
    `SELECT tipo_solicitud,
      EXISTS (SELECT 1 FROM solicitud_programa p WHERE p.id_solicitud = s.id_solicitud
        AND p.orden = 2 AND btrim(p.programa) <> '') AS doble
    FROM solicitud_grado s WHERE id_solicitud = $1`,
    [idSolicitud],
  );
  const docs = await client.query<DocumentoActual>(
    `SELECT tipo_documento AS tipo, orden, version, estado FROM documentos
    WHERE id_solicitud = $1 AND id_entrega IS NOT NULL`,
    [idSolicitud],
  );
  return calcularEstadoSolicitud(
    documentosRequeridos(s.rows[0].tipo_solicitud, s.rows[0].doble),
    docs.rows,
  );
}
