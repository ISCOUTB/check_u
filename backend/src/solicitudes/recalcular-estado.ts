import type { PoolClient } from 'pg';
import {
  calcularEstadoSolicitud,
  type DocumentoActual,
} from './estado-solicitud.js';
import { documentosRequeridos } from './requisitos-documentales.js';

/** Decisiones de la funcionaria: el sistema ya no recalcula estas solicitudes. */
export const ESTADOS_FINALES: readonly string[] = Object.freeze([
  'ACEPTADA',
  'CERRADA',
]);

/**
 * Recalcula y guarda el estado dentro de la transacción del llamador (envío, reenvío o
 * resolución). Un borrador o una solicitud decidida se devuelven sin cambios.
 */
export async function recalcularEstado(
  client: PoolClient,
  idSolicitud: number,
): Promise<string> {
  const s = await client.query<{
    tipo_solicitud: string;
    estado: string;
    doble: boolean;
  }>(
    `SELECT tipo_solicitud, estado,
      EXISTS (SELECT 1 FROM solicitud_programa p WHERE p.id_solicitud = s.id_solicitud
        AND p.orden = 2 AND btrim(p.programa) <> '') AS doble
    FROM solicitud_grado s WHERE id_solicitud = $1 FOR UPDATE`,
    [idSolicitud],
  );
  const solicitud = s.rows[0];
  if (!solicitud) throw new Error(`No existe la solicitud ${idSolicitud}`);
  if (
    solicitud.estado === 'BORRADOR' ||
    ESTADOS_FINALES.includes(solicitud.estado)
  )
    return solicitud.estado;
  const docs = await client.query<DocumentoActual>(
    `SELECT tipo_documento AS tipo, orden, version, estado FROM documentos
    WHERE id_solicitud = $1 AND id_entrega IS NOT NULL`,
    [idSolicitud],
  );
  const estado = calcularEstadoSolicitud(
    documentosRequeridos(solicitud.tipo_solicitud, solicitud.doble),
    docs.rows,
  );
  await client.query(
    `UPDATE solicitud_grado SET estado = $2, fecha_actualizacion = CURRENT_TIMESTAMP
    WHERE id_solicitud = $1`,
    [idSolicitud, estado],
  );
  return estado;
}
