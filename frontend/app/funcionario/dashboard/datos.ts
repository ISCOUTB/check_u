import type { EstadoVisible } from "@/app/components/ui/StatusBadge";

/** Tipos y etiquetas de presentación del listado real de solicitudes. */
/** Los cuatro estados calculados de los documentos (Tarea 42a) y las dos decisiones de la funcionaria. */
export type EstadoSolicitud = Extract<EstadoVisible, "valido" | "no_valido" | "inconsistente" | "por_revisar" | "aceptada" | "anulada">;
export type NivelAcademico = "PREGRADO" | "POSGRADO";

export interface SolicitudResumen {
    numero: string;
    fecha: string;
    fechaRegistro: string;
    estudiante: string;
    nivel: NivelAcademico;
    estado: EstadoSolicitud;
    periodId: string;
    /** Día del primer envío en Bogotá (YYYY-MM-DD); null en solicitudes viejas sin entrega. */
    fechaEnvio: string | null;
    /** Instante del primer envío (ISO). */
    envioEn: string | null;
}

export const ESTADOS_SOLICITUD: EstadoSolicitud[] = ["valido", "no_valido", "inconsistente", "por_revisar", "aceptada", "anulada"];
export const ETIQUETA_SOLICITUD: Record<EstadoSolicitud, string> = {
    valido: "Válida", no_valido: "No válida", inconsistente: "Inconsistente", por_revisar: "Por revisar",
    aceptada: "Aceptada", anulada: "Anulada",
};
export const ETIQUETA_PLURAL: Record<EstadoSolicitud, string> = {
    valido: "Válidas", no_valido: "No válidas", inconsistente: "Inconsistentes", por_revisar: "Por revisar",
    aceptada: "Aceptadas", anulada: "Anuladas",
};
export const DESCRIPCION_CONTADOR: Record<EstadoSolicitud, string> = {
    valido: "Solicitudes válidas", no_valido: "Solicitudes no válidas", inconsistente: "Solicitudes inconsistentes", por_revisar: "Solicitudes pendientes de revisión",
    aceptada: "Solicitudes aceptadas por la funcionaria", anulada: "Solicitudes anuladas",
};
