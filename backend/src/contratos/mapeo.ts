import type { DocumentClassification, TypeDocument } from './enums.js';

// Equivalencias con lo que existe hoy (Ajuste de la issue #6). Sirven para mostrar etiquetas en
// español (Tarea 12) y para pasar datos viejos de frontend/ y webapp/ a los contratos.

/** Etiqueta en español de cada clasificación, para mostrarla al estudiante y al funcionario. */
export const ETIQUETAS_CLASIFICACION: Readonly<Record<DocumentClassification, string>> = Object.freeze({
  valid: 'Válido',
  invalid: 'No válido',
  inconsistent: 'Inconsistente',
  to_check: 'Por revisar',
});

/**
 * Clasificaciones viejas → nuevas. frontend/ usa valida, no-valida, inconsistente, por-revisar y
 * por_revisar; webapp/ usa valida, inconsistente y por_revisar. El por_revisar de webapp/ también
 * cubría "la fuente no respondió": eso ahora es una regla no_evaluable con su motivo.
 */
export const CLASIFICACION_LEGADA: Readonly<Record<string, DocumentClassification>> = Object.freeze({
  valida: 'valid',
  'no-valida': 'invalid',
  inconsistente: 'inconsistent',
  'por-revisar': 'to_check',
  por_revisar: 'to_check',
});

/** Tipos documentales viejos → nuevos. acta_grado e icfes (experimentales) no se incluyen. */
export const TIPO_DOCUMENTO_LEGADO: Readonly<Record<string, TypeDocument>> = Object.freeze({
  cedula: 'identification',
  banner: 'academic_evaluation',
  estampilla: 'estampilla_pro_cultura',
  biblioteca: 'paz_y_salvo_bib',
  'saber-pro': 'saber_pro',
});
