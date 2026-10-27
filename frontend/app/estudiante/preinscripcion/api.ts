import type { SolicitudDetalle, TipoDocumento } from "./types";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

/** Siempre recupera resultados persistidos para la sesión actual. */
export async function obtenerSolicitudDetalle(): Promise<SolicitudDetalle> {
  const respuesta = await fetch(`${API_URL}/estudiante/solicitud/analisis`, {
    credentials: "include", cache: "no-store",
  });
  if (!respuesta.ok) throw new Error("No fue posible consultar el análisis documental.");
  const datos = await respuesta.json();
  if (!datos || !Array.isArray(datos.documentos) || !datos.estudiante || !datos.informacion)
    throw new Error("Respuesta de análisis inválida.");
  return datos;
}

/** El reenvío de correcciones aún no tiene integración persistente. Nunca simula éxito. */
export async function enviarDocumentosReenvio(
  _solicitudId: string, _tipos: TipoDocumento[], _idempotencyKey: string,
): Promise<{ ok: boolean; mensaje: string }> {
  void _solicitudId; void _tipos; void _idempotencyKey;
  return { ok: false, mensaje: "El reenvío aún no está disponible. Comunícate con la oficina de grados." };
}
