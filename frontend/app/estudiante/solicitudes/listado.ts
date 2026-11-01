/**
 * listado.ts — Presentación del historial de preinscripciones del estudiante.
 *
 * Solo transforma el contrato real de `GET /api/estudiante/solicitudes`.
 * No decide permisos ni estados: esos valores llegan persistidos del backend.
 */

import type { EstadoVisible } from "@/app/components/ui/StatusBadge";

export type NivelSolicitud = "PREGRADO" | "POSGRADO";

export interface PeriodoListado {
    id: string;
    nombre: string;
    /** Fecha calendario `YYYY-MM-DD`, sin zona horaria. */
    fechaInicio: string;
    /** Fecha calendario `YYYY-MM-DD`, sin zona horaria. */
    fechaFin: string;
    fechaCorte?: string | null;
}

export interface SolicitudListado {
    id: string;
    nivel: NivelSolicitud;
    estado: string;
    activa: boolean;
    /** Fecha de la entrega inicial; null mientras no se haya enviado. */
    fechaSolicitud: string | null;
    fechaCreacion: string;
    canceladaEn: string | null;
    periodo: PeriodoListado | null;
}

export interface EstadoPresentado {
    etiqueta: string;
    tono: EstadoVisible;
}

/**
 * Traducción de los nombres internos del backend a las etiquetas del estudiante.
 * `NO_VALIDA` se presenta como Inválida y `CERRADA` como Anulada, igual que en el
 * resto del módulo del estudiante.
 */
const ESTADOS: Record<string, EstadoPresentado> = {
    VALIDA: { etiqueta: "Válida", tono: "valido" },
    NO_VALIDA: { etiqueta: "Inválida", tono: "no_valido" },
    INCONSISTENTE: { etiqueta: "Inconsistente", tono: "inconsistente" },
    POR_REVISAR: { etiqueta: "Por revisar", tono: "por_revisar" },
    CANCELADA: { etiqueta: "Cancelada", tono: "cancelada" },
    CERRADA: { etiqueta: "Anulada", tono: "anulada" },
    // Estados que todavía forman parte del proceso, pero aún no tienen resultado final.
    EN_PROCESO: { etiqueta: "En proceso", tono: "en_proceso" },
    BORRADOR: { etiqueta: "Borrador", tono: "borrador" },
};

export function presentarEstado(estado: string): EstadoPresentado {
    return ESTADOS[estado] ?? { etiqueta: estado || "Sin estado", tono: "por_revisar" };
}

/** Fecha calendario para una fecha sin hora (`DATE` de PostgreSQL). */
function fechaCalendario(valor: string): string | null {
    const coincidencia = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
    if (!coincidencia) return null;
    const [, anio, mes, dia] = coincidencia;
    return `${dia}/${mes}/${anio}`;
}

/**
 * Para marcas de tiempo se usa el día de Bogotá, porque la fecha de envío que ve
 * el estudiante es la del calendario institucional. Las fechas `DATE` se muestran
 * tal cual, sin convertirlas a otra zona.
 */
function fechaDeBogota(valor: string): string | null {
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return null;
    const partes = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Bogota",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(fecha);
    const porTipo = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
    return porTipo.year && porTipo.month && porTipo.day
        ? `${porTipo.day}/${porTipo.month}/${porTipo.year}`
        : null;
}

export function formatearFechaSolicitud(valor: string | null | undefined): string {
    if (!valor) return "Sin enviar";
    const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(valor);
    return (soloFecha ? fechaCalendario(valor) : fechaDeBogota(valor)) ?? "Sin fecha";
}

export function formatearFechaPeriodo(valor: string | null | undefined): string {
    if (!valor) return "Sin fecha";
    return fechaCalendario(valor) ?? fechaDeBogota(valor) ?? "Sin fecha";
}

export function formatearPeriodo(periodo: PeriodoListado | null): string {
    if (!periodo) return "Sin periodo asignado";
    return `${formatearFechaPeriodo(periodo.fechaInicio)} – ${formatearFechaPeriodo(periodo.fechaFin)}`;
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
    return Boolean(valor) && typeof valor === "object" && !Array.isArray(valor);
}

function normalizarPeriodo(valor: unknown): PeriodoListado | null {
    if (!esObjeto(valor)) return null;
    if (
        typeof valor.id !== "string" ||
        typeof valor.nombre !== "string" ||
        typeof valor.fechaInicio !== "string" ||
        typeof valor.fechaFin !== "string"
    )
        return null;
    return {
        id: valor.id,
        nombre: valor.nombre,
        fechaInicio: valor.fechaInicio.slice(0, 10),
        fechaFin: valor.fechaFin.slice(0, 10),
        fechaCorte: typeof valor.fechaCorte === "string" ? valor.fechaCorte : null,
    };
}

/** Valida y normaliza una fila del contrato; una fila inválida no se inventa. */
export function normalizarSolicitud(valor: unknown): SolicitudListado {
    if (!esObjeto(valor)) throw new Error("Solicitud inválida.");
    const { id, nivel, estado, activa, fechaSolicitud, fechaCreacion, canceladaEn } = valor;
    if (
        !(typeof id === "string" || typeof id === "number") ||
        !["PREGRADO", "POSGRADO"].includes(String(nivel)) ||
        typeof estado !== "string" ||
        !estado ||
        typeof activa !== "boolean" ||
        !(fechaSolicitud === null || typeof fechaSolicitud === "string") ||
        typeof fechaCreacion !== "string" ||
        !(canceladaEn === null || typeof canceladaEn === "string")
    )
        throw new Error("Solicitud inválida.");
    return {
        id: String(id),
        nivel: nivel as NivelSolicitud,
        estado,
        activa,
        fechaSolicitud,
        fechaCreacion,
        canceladaEn,
        periodo: normalizarPeriodo(valor.periodo),
    };
}
