/** Respuesta del motor / de POST /api/documentos/analizar */
export type RespuestaAnalisis = {
  id_student: string;
  nivel?: string;
  resultados: Record<string, unknown>[];
  errores: {
    indice: number;
    nombre?: string;
    type_document?: string;
    error: string;
  }[];
  estado_general: string;
};
