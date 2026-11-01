import Icono from "./Icono";
import styles from "./StatusBadge.module.css";

export type EstadoVisible =
    | "valido"
    | "no_valido"
    | "inconsistente"
    | "por_revisar"
    | "procesando"
    | "falta_cargar"
    // Estados propios de una solicitud de grado completa.
    | "cancelada"
    | "anulada"
    | "aceptada"
    | "en_proceso"
    | "borrador";

/** Etiquetas de mapeo.json (contratos), las de carga y los estados de la solicitud. */
export const ETIQUETA_ESTADO: Record<EstadoVisible, string> = {
    valido: "Válido",
    no_valido: "No válido",
    inconsistente: "Inconsistente",
    por_revisar: "Por revisar",
    procesando: "Procesando",
    falta_cargar: "Falta cargar",
    cancelada: "Cancelada",
    anulada: "Anulada",
    aceptada: "Aceptada",
    en_proceso: "En proceso",
    borrador: "Borrador",
};

/**
 * Estado de un documento o una solicitud: ícono + texto, nunca solo color. etiqueta permite el
 * texto propio de una pantalla (p. ej. "Corrección requerida" para el estudiante).
 */
export default function StatusBadge({ estado, etiqueta }: { estado: EstadoVisible; etiqueta?: string }) {
    return (
        <span className={styles.estado} data-estado={estado}>
            <Icono nombre={estado} tamano={14} />
            {etiqueta ?? ETIQUETA_ESTADO[estado]}
        </span>
    );
}
