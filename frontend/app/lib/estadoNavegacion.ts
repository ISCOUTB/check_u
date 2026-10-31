export type EstadoNavegacion = 'SIN_SOLICITUD' | 'BORRADOR' | 'ENVIADA';

export interface RespuestaEstadoNavegacion {
  ok: true;
  estado: EstadoNavegacion;
  destino: string;
  id_solicitud?: number;
  nivel?: 'PREGRADO' | 'POSGRADO';
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

/**
 * Consulta al backend a dónde debe ir el estudiante autenticado.
 * No crea borradores ni asume SIN_SOLICITUD si la red falla.
 */
export async function obtenerEstadoNavegacion(
  signal?: AbortSignal,
): Promise<RespuestaEstadoNavegacion> {
  const respuesta = await fetch(`${API_URL}/solicitudes/estado`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    signal,
  });

  if (!respuesta.ok) {
    throw new Error(
      respuesta.status === 401 || respuesta.status === 403
        ? 'Sesión no válida o sin permiso.'
        : 'No se pudo obtener el estado de la solicitud.',
    );
  }

  return respuesta.json() as Promise<RespuestaEstadoNavegacion>;
}
