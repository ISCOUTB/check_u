import { transportarEnvio, type AlProgreso } from "../envio-documental";
import { mensajeDelResultado } from "./messages";
import type { DocumentoSolicitud, SolicitudDetalle } from "./types";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

export class ErrorConsultaSolicitud extends Error {
  constructor(readonly status: number) {
    super("No fue posible consultar el análisis documental.");
  }
}

/** Siempre recupera resultados persistidos para la sesión actual. */
export async function obtenerSolicitudDetalle(signal?: AbortSignal, idSolicitud?: string): Promise<SolicitudDetalle> {
  const controlador = new AbortController();
  const cancelar = () => controlador.abort();
  const limite = setTimeout(cancelar, 15_000);
  signal?.addEventListener("abort", cancelar, { once: true });
  if (signal?.aborted) cancelar();
  try {
    const respuesta = await fetch(`${API_URL}${idSolicitud ? `/estudiante/solicitudes/${encodeURIComponent(idSolicitud)}/analisis` : '/estudiante/solicitud/analisis'}`, {
      credentials: "include", cache: "no-store", signal: controlador.signal,
    });
    if (!respuesta.ok) throw new ErrorConsultaSolicitud(respuesta.status);
    const datos = await respuesta.json();
    if (!datos || !Array.isArray(datos.documentos) || !datos.estudiante || !datos.informacion)
      throw new Error("Respuesta de análisis inválida.");
    return { ...datos, documentos: datos.documentos.map((d: DocumentoSolicitud) => ({ ...d,
      resultados: d.resultados.map(r => ({ ...r, mensaje: mensajeDelResultado(d.tipo, r.estado, r.mensaje, r.confianza) })),
    })) };
  } finally {
    clearTimeout(limite);
    signal?.removeEventListener("abort", cancelar);
  }
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

/** Cancelación persistida e idempotente: no cambia el estado local antes de confirmar la API. */
export async function cancelarPreinscripcion(id: string): Promise<{estado:'CANCELADA';canceladaEn:string|null}> {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  try {
    const r=await fetch(`${API_URL}/estudiante/solicitudes/${encodeURIComponent(id)}/cancelacion`, {
      method:'POST',credentials:'include',cache:'no-store',signal:controller.signal,
    });
    const data=await r.json().catch(()=>null);
    if (!r.ok) throw new Error(typeof data?.message==='string'?data.message:'No fue posible cancelar la preinscripción.');
    if (data?.estado!=='CANCELADA' || data.id!==id) throw new Error('No se pudo confirmar el estado de la preinscripción. Vuelve a consultarla.');
    return data;
  } catch(e) {
    if(controller.signal.aborted) throw new Error('La cancelación tardó demasiado en responder. Consulta el estado antes de reintentar.');
    throw e;
  } finally {clearTimeout(timer);}
}
