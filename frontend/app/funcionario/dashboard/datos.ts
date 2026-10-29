import type { EstadoVisible } from "@/app/components/ui/StatusBadge";

/** Tipos y etiquetas de presentación del listado real de solicitudes. */
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
