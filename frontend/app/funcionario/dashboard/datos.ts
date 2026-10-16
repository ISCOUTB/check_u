import type { EstadoVisible } from "@/app/components/ui/StatusBadge";

/**
 * ⚠️ SIMULADO: preinscripciones de ejemplo para el dashboard. Se reemplazan por la API de
 * solicitudes cuando exista (tareas 05 y 12).
 */

export type EstadoSolicitud = Extract<EstadoVisible, "valido" | "no_valido" | "inconsistente" | "por_revisar">;

export interface SolicitudResumen {
    numero: string;
    fecha: string;
    estudiante: string;
    estado: EstadoSolicitud;
}

export const SOLICITUDES: SolicitudResumen[] = [
    { numero: "GR-2026-001", fecha: "04/10/2026 08:30", estudiante: "Juan David Pérez", estado: "valido" },
    { numero: "GR-2026-002", fecha: "04/10/2026 09:10", estudiante: "María Fernanda López", estado: "no_valido" },
    { numero: "GR-2026-003", fecha: "04/10/2026 09:45", estudiante: "Carlos Andrés Martínez", estado: "inconsistente" },
    { numero: "GR-2026-004", fecha: "04/10/2026 10:05", estudiante: "Laura Sofía Rodríguez", estado: "por_revisar" },
    { numero: "GR-2026-005", fecha: "04/10/2026 10:20", estudiante: "Daniel José Gómez", estado: "valido" },
];

export const ESTADOS_SOLICITUD: EstadoSolicitud[] = ["valido", "no_valido", "inconsistente", "por_revisar"];

/** Una solicitud (femenino): "Válida", "No válida"… */
export const ETIQUETA_SOLICITUD: Record<EstadoSolicitud, string> = {
    valido: "Válida",
    no_valido: "No válida",
    inconsistente: "Inconsistente",
    por_revisar: "Por revisar",
};

/** Varias solicitudes, para filtros, contadores y gráficos. */
export const ETIQUETA_PLURAL: Record<EstadoSolicitud, string> = {
    valido: "Válidas",
    no_valido: "No válidas",
    inconsistente: "Inconsistentes",
    por_revisar: "Por revisar",
};

export const DESCRIPCION_CONTADOR: Record<EstadoSolicitud, string> = {
    valido: "Preinscripciones válidas",
    no_valido: "Preinscripciones no válidas",
    inconsistente: "Preinscripciones inconsistentes",
    por_revisar: "Preinscripciones pendientes",
};
