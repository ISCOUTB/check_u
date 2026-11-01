/**
 * api.ts — Consultas del inicio del estudiante.
 *
 * El resumen de "Mi solicitud de grado" usa el detalle real del análisis
 * documental. Las notificaciones siguen teniendo su propio cliente.
 */

export {
    ErrorConsultaSolicitud,
    obtenerSolicitudDetalle,
} from "../preinscripcion/api";
export { DOCUMENTOS_POR_NIVEL } from "../documentos-requeridos";
export type {
    DocumentoSolicitud,
    EstadoDocumento,
    SolicitudDetalle,
} from "../preinscripcion/types";

export interface Notificacion {
    id: string;
    titulo: string;
    descripcion: string;
    tipo: "success" | "warning" | "error" | "info";
    generadoPor: "system" | "motor" | "funcionario";
    leida: boolean;
    /** ISO 8601 en zona America/Bogota */
    fecha: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

async function consultarNotificaciones(
    ruta: string,
    method: "GET" | "PATCH",
    signal?: AbortSignal,
) {
    const controlador = new AbortController();
    const cancelar = () => controlador.abort();
    const limite = setTimeout(cancelar, 8000);
    signal?.addEventListener("abort", cancelar, { once: true });
    if (signal?.aborted) cancelar();
    try {
        const r = await fetch(`${API_URL}/estudiante/notificaciones${ruta}`, {
            method,
            credentials: "include",
            cache: "no-store",
            signal: controlador.signal,
        });
        if (!r.ok)
            throw new Error(
                r.status === 401
                    ? "Tu sesión expiró. Vuelve a iniciar sesión."
                    : "No fue posible consultar las notificaciones.",
            );
        return await r.json();
    } finally {
        clearTimeout(limite);
        signal?.removeEventListener("abort", cancelar);
    }
}

/** Solo recupera avisos persistidos del estudiante autenticado; nunca usa datos de demostración. */
export async function obtenerNotificaciones(
    signal?: AbortSignal,
): Promise<Notificacion[]> {
    const datos = (await consultarNotificaciones("", "GET", signal)) as {
        notificaciones?: unknown;
    };
    if (!Array.isArray(datos?.notificaciones))
        throw new Error("Respuesta de notificaciones inválida.");
    return datos.notificaciones.map((n: Record<string, unknown>) => {
        if (
            !n ||
            typeof n.id !== "string" ||
            typeof n.titulo !== "string" ||
            typeof n.msg !== "string" ||
            !["success", "warning", "error", "info"].includes(String(n.tipo)) ||
            !["system", "motor", "funcionario"].includes(
                String(n.generado_por),
            ) ||
            typeof n.leida !== "boolean" ||
            typeof n.creadoEn !== "string" ||
            Number.isNaN(Date.parse(n.creadoEn))
        )
            throw new Error("Notificación inválida.");
        return {
            id: n.id,
            titulo: n.titulo,
            descripcion: n.msg,
            fecha: n.creadoEn,
            tipo: n.tipo as Notificacion["tipo"],
            generadoPor: n.generado_por as Notificacion["generadoPor"],
            leida: n.leida,
        };
    });
}

export async function marcarNotificacionLeida(id: string): Promise<void> {
    const r = (await consultarNotificaciones(
        `/${encodeURIComponent(id)}/leida`,
        "PATCH",
    )) as { id?: string; leida?: boolean };
    if (r?.id !== id || r.leida !== true)
        throw new Error("No fue posible confirmar la lectura.");
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilitarios de presentación (sin lógica de negocio)
// ─────────────────────────────────────────────────────────────────────────────

/** Formatea una fecha ISO para mostrarla de forma legible. */
export function formatearFecha(iso: string): string {
    const fecha = new Date(iso);
    const ahora = new Date();
    const diffMs = ahora.getTime() - fecha.getTime();
    const diffH = diffMs / (1000 * 60 * 60);

    if (diffH < 1) return "Hace un momento";
    if (diffH < 24) {
        return `Hoy, ${fecha.toLocaleTimeString("es-CO", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "America/Bogota",
        })}`;
    }
    if (diffH < 48) return "Ayer";
    return fecha.toLocaleDateString("es-CO", {
        day: "numeric",
        month: "short",
        timeZone: "America/Bogota",
    });
}
