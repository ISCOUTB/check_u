export type EstadoNavegacion = "SIN_SOLICITUD" | "BORRADOR" | "ENVIADA";

export interface RespuestaEstadoNavegacion {
  ok: true;
  estado: EstadoNavegacion;
  destino: string;
  id_solicitud?: number;
  nivel?: "PREGRADO" | "POSGRADO";
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

/**
 * Consulta al backend a dónde debe ir el estudiante autenticado.
 * No crea borradores ni asume SIN_SOLICITUD si la red falla.
 */
export async function obtenerEstadoNavegacion(
  signal?: AbortSignal,
): Promise<RespuestaEstadoNavegacion> {
  const controlador = new AbortController();
  let agotado = false;
  const cancelar = () => controlador.abort();
  const timer = setTimeout(() => {
    agotado = true;
    controlador.abort();
  }, 15000);
  signal?.addEventListener("abort", cancelar, { once: true });
  if (signal?.aborted) cancelar();
  try {
    const respuesta = await fetch(`${API_URL}/solicitudes/estado`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      signal: controlador.signal,
    });
    if (!respuesta.ok)
      throw new Error(
        respuesta.status === 401 || respuesta.status === 403
          ? "Sesión no válida o sin permiso."
          : "No se pudo obtener el estado de la solicitud.",
      );
    const data = await respuesta.json();
    if (
      data?.ok !== true ||
      !["SIN_SOLICITUD", "BORRADOR", "ENVIADA"].includes(data.estado)
    )
      throw new Error("El estado de navegación recibido no es válido.");
    if (
      data.estado === "BORRADOR" &&
      !["PREGRADO", "POSGRADO"].includes(data.nivel)
    )
      throw new Error(
        "No fue posible identificar el nivel del borrador guardado.",
      );
    // Recupera también respuestas de versiones anteriores que omitían el query del nivel.
    // El destino se construye con estados y niveles conocidos, sin aceptar redirecciones arbitrarias.
    const destino =
      data.estado === "BORRADOR"
        ? `/estudiante/iniciar_preinscripcion?nivel=${data.nivel}`
        : data.estado === "SIN_SOLICITUD"
          ? "/estudiante/bienvenida"
          : "/estudiante/home";
    return { ...data, destino } as RespuestaEstadoNavegacion;
  } catch (error) {
    if (agotado)
      throw new Error(
        "La consulta del estado de la solicitud tardó demasiado. Intenta nuevamente.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancelar);
  }
}
