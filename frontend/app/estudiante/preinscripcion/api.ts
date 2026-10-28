import { transportarEnvio, type AlProgreso } from "../envio-documental";
import { mensajeDelResultado } from "./messages";
import type { DocumentoSolicitud, SolicitudDetalle } from "./types";
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
  return { ...datos, documentos: datos.documentos.map((d: DocumentoSolicitud) => ({ ...d,
    resultados: d.resultados.map(r => ({ ...r, mensaje: mensajeDelResultado(d.tipo, r.estado, r.mensaje, r.confianza) })),
  })) };
}

/** Envía nuevas versiones por identificador del documento, con clave estable por intento. */
export async function enviarDocumentosReenvio(
  solicitudId: string, documentos: { id: string; archivo: File }[], clave: string, alProgreso: AlProgreso,
): Promise<{ ok: boolean; mensaje: string }> {
  const form = new FormData();
  form.append('ids', JSON.stringify(documentos.map(d => Number(d.id)))); form.append('clave', clave);
  for (const d of documentos) form.append('documentos', d.archivo);
  return transportarEnvio(`${API_URL}/solicitudes/${encodeURIComponent(solicitudId)}/correcciones`, form, alProgreso, documentos.length);
}
