import type { EstadoVisible } from "@/app/components/ui/StatusBadge";

/**
 * Datos locales de demostración. El dashboard todavía no consume solicitudes reales del backend.
 * periodId es una asociación explícita de prueba; no se calcula a partir de la fecha.
 */
export type EstadoSolicitud = Extract<EstadoVisible, "valido" | "no_valido" | "inconsistente" | "por_revisar">;
export type NivelAcademico = "PREGRADO" | "POSGRADO";

export interface SolicitudResumen {
    numero: string;
    fecha: string;
    fechaRegistro: string;
    estudiante: string;
    nivel: NivelAcademico;
    estado: EstadoSolicitud;
    periodId: string;
}

export const SOLICITUDES: SolicitudResumen[] = [
    { numero: "GR-2026-001", fecha: "04/10/2026 08:30", fechaRegistro: "2026-10-04T08:30:00", estudiante: "Juan David Pérez", nivel: "PREGRADO", estado: "valido", periodId: "periodo-2026-1" },
    { numero: "GR-2026-002", fecha: "04/10/2026 09:10", fechaRegistro: "2026-10-04T09:10:00", estudiante: "María Fernanda López", nivel: "PREGRADO", estado: "no_valido", periodId: "periodo-2026-1" },
    { numero: "GR-2026-003", fecha: "04/10/2026 09:45", fechaRegistro: "2026-10-04T09:45:00", estudiante: "Carlos Andrés Martínez", nivel: "POSGRADO", estado: "inconsistente", periodId: "periodo-2026-1" },
    { numero: "GR-2026-004", fecha: "04/10/2026 10:05", fechaRegistro: "2026-10-04T10:05:00", estudiante: "Laura Sofía Rodríguez", nivel: "PREGRADO", estado: "por_revisar", periodId: "periodo-2026-1" },
    { numero: "GR-2026-005", fecha: "04/10/2026 10:20", fechaRegistro: "2026-10-04T10:20:00", estudiante: "Daniel José Gómez", nivel: "POSGRADO", estado: "valido", periodId: "periodo-2026-1" },
];

export const ESTADOS_SOLICITUD: EstadoSolicitud[] = ["valido", "no_valido", "inconsistente", "por_revisar"];
export const ETIQUETA_SOLICITUD: Record<EstadoSolicitud, string> = {
    valido: "Válida", no_valido: "No válida", inconsistente: "Inconsistente", por_revisar: "Por revisar",
};
export const ETIQUETA_PLURAL: Record<EstadoSolicitud, string> = {
    valido: "Válidas", no_valido: "No válidas", inconsistente: "Inconsistentes", por_revisar: "Por revisar",
};
export const DESCRIPCION_CONTADOR: Record<EstadoSolicitud, string> = {
    valido: "Solicitudes válidas", no_valido: "Solicitudes no válidas", inconsistente: "Solicitudes inconsistentes", por_revisar: "Solicitudes pendientes de revisión",
};
