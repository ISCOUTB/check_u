/**
 * api.ts — Consulta del historial real de preinscripciones del estudiante.
 *
 * El backend identifica al estudiante por la sesión; nunca se envía un ID desde
 * el cliente. La lista incluye las solicitudes canceladas y anuladas.
 */

import { normalizarSolicitud, type SolicitudListado } from "./listado";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

export class ErrorListadoSolicitudes extends Error {
    constructor(readonly status: number) {
        super(
            status === 401
                ? "Tu sesión expiró. Vuelve a iniciar sesión."
                : "No fue posible consultar tus solicitudes.",
        );
    }
}

export async function obtenerSolicitudes(
    signal?: AbortSignal,
): Promise<SolicitudListado[]> {
    const controlador = new AbortController();
    const cancelar = () => controlador.abort();
    const limite = setTimeout(cancelar, 15_000);
    signal?.addEventListener("abort", cancelar, { once: true });
    if (signal?.aborted) cancelar();

    try {
        const respuesta = await fetch(`${API_URL}/estudiante/solicitudes`, {
            credentials: "include",
            cache: "no-store",
            signal: controlador.signal,
        });
        if (!respuesta.ok) throw new ErrorListadoSolicitudes(respuesta.status);
        const datos = (await respuesta.json()) as { solicitudes?: unknown };
        if (!datos || !Array.isArray(datos.solicitudes))
            throw new Error("Respuesta de solicitudes inválida.");
        return datos.solicitudes.map(normalizarSolicitud);
    } finally {
        clearTimeout(limite);
        signal?.removeEventListener("abort", cancelar);
    }
}
