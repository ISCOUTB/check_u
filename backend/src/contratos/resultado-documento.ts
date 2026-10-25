import { z } from 'zod';
import {
  Confianza,
  conReglaDeReenvio,
  FechaHora,
  Identificador,
} from './comunes.js';
import {
  DocumentClassification,
  NoEvaluableReason,
  RuleResult,
  TypeDocument,
  ValidationStatus,
} from './enums.js';

function evaluacion<R extends z.ZodType, M extends z.ZodType>(
  result: R,
  motivo: M,
) {
  return z.strictObject({
    rule: Identificador,
    result,
    no_evaluable_reason: motivo,
    /** Obligatoria: el consolidador exige que las obligatorias evaluables se cumplan. */
    mandatory: z.boolean(),
    message: z.string(),
    timestamp: FechaHora,
    errors: z.array(z.string()),
  });
}

/**
 * Una regla aplicada a un documento (estructura de document_strc.py más mandatory). Dos variantes,
 * para que viaje al JSON Schema: no_evaluable lleva su motivo; cumple y no_cumple, null.
 */
export const RuleEvaluation = z.discriminatedUnion('result', [
  evaluacion(RuleResult.exclude(['no_evaluable']), z.null()),
  evaluacion(z.literal('no_evaluable'), NoEvaluableReason),
]);
export type RuleEvaluation = z.infer<typeof RuleEvaluation>;

/**
 * Un dato extraído con su confianza. Lo que no se pudo extraer va con value y confidence en null:
 * nunca se inventa un valor, y no hay valor sin confianza ni confianza sin valor.
 */

export const ExtractedValue = z.union([
  z.strictObject({
    value: z.null(),
    confidence: z.null(),
  }),
  z.strictObject({
    value: z.union([z.string(), z.number(), z.boolean()]),
    confidence: Confianza.nullable(),
  }),
]);
export type ExtractedValue = z.infer<typeof ExtractedValue>;

/**
 * Resultado de validar una versión de un documento. Los datos de identidad (first_name, last_name,
 * code_student, número de identificación…) van dentro de extracted_data, con su confianza.
 */
export const DocumentValidationResult = conReglaDeReenvio({
  id_student: Identificador,
  type_document: TypeDocument,
  document_version: z.number().int().min(1),
  extracted_data: z.record(z.string().min(1), ExtractedValue),
  rules: z.array(RuleEvaluation),
  errors: z.array(z.string()),
  document_classification: DocumentClassification,
  validation_status: ValidationStatus,
  /** Versión del conjunto de reglas con que se validó. */
  validation_version: Identificador,
  timestamp: FechaHora,
});
export type DocumentValidationResult = z.infer<typeof DocumentValidationResult>;
