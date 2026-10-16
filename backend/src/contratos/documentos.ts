import { AcademicLevel, type TypeDocument } from './enums.js';

/** Documentos requeridos por nivel, en el orden en que se piden (docs/PROMPT_BASE.md). */
export const DOCUMENTOS_POR_NIVEL: Readonly<Record<AcademicLevel, readonly TypeDocument[]>> =
  Object.freeze({
    pregrado: Object.freeze([
      'identification',
      'academic_evaluation',
      'paz_y_salvo_bib',
      'estampilla_pro_cultura',
      'saber_pro',
    ] as const),
    posgrado: Object.freeze(['identification', 'paz_y_salvo_bib', 'estampilla_pro_cultura'] as const),
  });

/**
 * El required_documents(level) de la Tarea 02. Función pura: devuelve una lista nueva en cada
 * llamada, y un nivel que no existe es un error de validación, no una lista vacía.
 */
export function requiredDocuments(level: AcademicLevel): TypeDocument[] {
  return [...DOCUMENTOS_POR_NIVEL[AcademicLevel.parse(level)]];
}
