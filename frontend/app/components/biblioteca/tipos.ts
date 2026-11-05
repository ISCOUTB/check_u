/**
 * Resultado de la consulta de Paz y Salvo en Biblioteca (Tarea 50), tal como lo guarda el backend:
 * la salida del motor (modules/validadores/fuentes/alma, consultar_para_checku).
 */
export type EstadoBiblioteca = "cumple" | "no_cumple" | "no_evaluable" | "no_encontrado" | "inconsistente";
export type ResultadoCriterio = "cumple" | "no_cumple" | "no_evaluable";

export interface CriterioBiblioteca {
    resultado: ResultadoCriterio;
    motivo: string | null;
    mensaje: string;
    pendientes?: number | null;
    valor_total?: number | null;
    moneda?: string | null;
    informativo?: boolean;
}

export interface ResultadoBiblioteca {
    estado: EstadoBiblioteca;
    paz_y_salvo: boolean | null;
    mensaje: string;
    fuente: string;
    consultado_en: string | null;
    identidad: { coincide: boolean | null; campos_distintos: string[] };
    criterios: Partial<Record<"prestamos" | "multas" | "solicitudes" | "opcion_grado", CriterioBiblioteca>>;
    acciones_requeridas: string[];
}

/**
 * Mensajes del documento que la tabla no repite. Sin resultado de Biblioteca se muestran todos; con él,
 * solo los distintos de su mensaje general (por ejemplo, la resolución manual de la funcionaria).
 */
export function mensajesFueraDeTabla(mensajes: readonly string[], resultado: ResultadoBiblioteca | null | undefined): string[] {
    return resultado ? mensajes.filter((m) => m !== resultado.mensaje) : [...mensajes];
}
