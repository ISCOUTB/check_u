const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

export type EstadoNavegacion = 'SIN_SOLICITUD' | 'BORRADOR' | 'ENVIADA';

export type DestinoNavegacion =
  | '/estudiante/bienvenida'
  | '/estudiante/iniciar_preinscripcion'
  | '/estudiante/home';

export interface RespuestaEstadoNavegacion {
  ok: true;
  estado: EstadoNavegacion;
  destino: DestinoNavegacion;
  id_solicitud?: number;
  nivel?: string;
}

export class ErrorEstadoNavegacion extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'ErrorEstadoNavegacion';
  }
}

/** Consulta el estado de navegación del estudiante autenticado. */
export async function obtenerEstadoNavegacion(): Promise<RespuestaEstadoNavegacion> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`${API_URL}/solicitudes/estado`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });
  } catch {
    throw new ErrorEstadoNavegacion('No se pudo conectar con el servidor.');
  }

  if (respuesta.status === 401) {
    throw new ErrorEstadoNavegacion('Sesión no válida o expirada', 401);
  }

  if (respuesta.status === 403) {
    throw new ErrorEstadoNavegacion('Acceso restringido a estudiantes', 403);
  }

  if (!respuesta.ok) {
    throw new ErrorEstadoNavegacion(
      'No se pudo obtener el estado de la solicitud.',
      respuesta.status,
    );
  }

  return (await respuesta.json()) as RespuestaEstadoNavegacion;
}
