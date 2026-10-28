/**
 * messages.ts — Mensajes exactos por documento × estado.
 * Deben coincidir literalmente con el issue #25.
 */

import type { EstadoDocumento, TipoDocumento } from "./types";

type MensajesPorEstado = Record<EstadoDocumento, string>;

export const MENSAJES_DOCUMENTO: Record<TipoDocumento, MensajesPorEstado> = {
  identification: {
    valido:
      "El documento suministrado parece auténtico con un nivel de confianza del XX%.",
    no_valido:
      "El documento suministrado no parece corresponder a una cédula de ciudadanía.",
    inconsistente:
      "La información del documento no coincide con la información suministrada.",
    por_revisar:
      "No fue posible extraer correctamente la información del documento. Sube un documento más legible o espera a que el personal encargado lo revise.",
  },
  academic_evaluation: {
    valido: "Cumples con los requisitos académicos establecidos.",
    no_valido:
      "El documento suministrado no corresponde a la estructura esperada de la Evaluación de Grado expedida por Banner.",
    inconsistente:
      "La información del documento no coincide con la información suministrada.",
    por_revisar:
      "No fue posible procesar correctamente el documento. Sube la Evaluación de Grado en formato PDF digital, preferiblemente sin escanear, o espera a que el personal encargado lo revise.",
  },
  estampilla_pro_cultura: {
    valido: "El comprobante fue verificado correctamente.",
    no_valido:
      "No fue posible encontrar el comprobante en los registros oficiales.",
    inconsistente:
      "La información del comprobante no coincide con la información suministrada.",
    por_revisar:
      "No fue posible procesar correctamente el documento. Sube el comprobante en formato PDF digital, preferiblemente sin escanear, o espera a que el personal encargado lo revise.",
  },
  saber_pro: {
    valido: "Cumples con el requisito mínimo de 100 puntos establecido.",
    no_valido:
      "No cumples con el requisito mínimo de 100 puntos establecido. Debes repetir la prueba antes de continuar con el proceso.",
    inconsistente:
      "La información de los resultados no coincide con la información suministrada.",
    por_revisar:
      "No fue posible identificar tu puntaje en el documento. El documento será revisado por el personal encargado.",
  },
  paz_y_salvo_bib: {
    valido: "Se verificó correctamente la firma electrónica del documento.",
    no_valido:
      "No se encontró una firma electrónica válida. Solicita a la Biblioteca un certificado de Paz y Salvo firmado electrónicamente.",
    inconsistente:
      "La información del documento no coincide con la información suministrada.",
    por_revisar:
      "No fue posible procesar correctamente el documento. Sube el Paz y Salvo en formato PDF digital, preferiblemente sin escanear, o espera a que el personal encargado lo revise.",
  },
};

/**
 * Devuelve el mensaje para un documento y estado.
 * Para "valido" de cédula reemplaza XX por la confianza si se entrega.
 */
export function obtenerMensaje(
  tipo: TipoDocumento,
  estado: EstadoDocumento,
  confianza?: number
): string {
  const plantilla = MENSAJES_DOCUMENTO[tipo][estado];
  if (tipo === "identification" && estado === "valido" && confianza != null) {
    return plantilla.replace("XX", String(confianza));
  }
  return plantilla;
}
/** Las observaciones específicas del motor tienen prioridad sobre los textos generales de referencia. */
export function mensajeDelResultado(tipo: TipoDocumento, estado: EstadoDocumento, observacion: string | undefined, confianza?: number): string {
  if (observacion?.trim() && observacion !== 'Consulta las observaciones del análisis documental.') return observacion;
  if (estado === 'por_revisar') return obtenerMensaje(tipo, estado, confianza);
  if (estado === 'valido') return tipo === 'identification' && confianza == null
    ? 'Las comprobaciones obligatorias del documento se completaron correctamente. El motor no informó un porcentaje de confianza.'
    : obtenerMensaje(tipo, estado, confianza);
  // Un NO_VALIDO puede deberse a formato, firma o contenido: no atribuirlo al puntaje sin evidencia.
  return 'El documento requiere atención. Consulta las comprobaciones del análisis para identificar qué debes corregir.';
}
