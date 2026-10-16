import { z } from 'zod';

// Valores fijos de los contratos (docs/PROMPT_BASE.md y Tarea 02). Son compartidos con el
// trabajador de Python y el frontend: cambiar uno es un cambio de contrato.

/** Tipo documental; lo da el sistema según el campo de carga, el OCR no lo infiere. */
export const TypeDocument = z.enum([
  'identification',
  'academic_evaluation',
  'paz_y_salvo_bib',
  'estampilla_pro_cultura',
  'saber_pro',
]);
export type TypeDocument = z.infer<typeof TypeDocument>;

export const AcademicLevel = z.enum(['pregrado', 'posgrado']);
export type AcademicLevel = z.infer<typeof AcademicLevel>;

/** Estado de un trabajo de procesamiento; los reintentos pertenecen al trabajo. */
export const JobStatus = z.enum(['queued', 'processing', 'completed', 'failed', 'retry_pending']);
export type JobStatus = z.infer<typeof JobStatus>;

/** Estado general de una solicitud. ready_for_formal_submission no es la aprobación del grado. */
export const RequestStatus = z.enum([
  'queued',
  'processing',
  'awaiting_review',
  'correction_required',
  'ready_for_formal_submission',
  'closed',
]);
export type RequestStatus = z.infer<typeof RequestStatus>;

/** Resultado de una regla. no_cumple y no_evaluable nunca se mezclan. */
export const RuleResult = z.enum(['cumple', 'no_cumple', 'no_evaluable']);
export type RuleResult = z.infer<typeof RuleResult>;

/**
 * Por qué una regla quedó no_evaluable. Separa "no se pudo leer" (low_confidence) de "la fuente
 * externa no respondió" (source_unavailable), que webapp/ mezclaba en por_revisar.
 */
export const NoEvaluableReason = z.enum([
  'low_confidence',
  'source_unavailable',
  'source_pending',
  'missing_dependency',
]);
export type NoEvaluableReason = z.infer<typeof NoEvaluableReason>;

/** Clasificación de un documento según sus reglas. */
export const DocumentClassification = z.enum(['valid', 'invalid', 'inconsistent', 'to_check']);
export type DocumentClassification = z.infer<typeof DocumentClassification>;

/** Estado del procesamiento de un documento; es un campo distinto de su clasificación. */
export const ValidationStatus = z.enum(['pending', 'processing', 'completed', 'failed']);
export type ValidationStatus = z.infer<typeof ValidationStatus>;

/** Lo que el estudiante (o el sistema) debe hacer a continuación con un documento. */
export const RequiredAction = z.enum([
  'none',
  'upload_new_version',
  'wait_for_review',
  'wait_for_external_validation',
  'wait_for_processing',
  'correct_data',
  'contact_administration',
]);
export type RequiredAction = z.infer<typeof RequiredAction>;

/** Resultado de una comparación entre fuentes (Tarea 09). Una fuente inaccesible no implica falsedad. */
export const CrossValidationOutcome = z.enum([
  'confirmed_match',
  'confirmed_mismatch',
  'insufficient_information',
  'source_pending',
  'source_unavailable',
  'manual_review_required',
]);
export type CrossValidationOutcome = z.infer<typeof CrossValidationOutcome>;

/** Fuente de un dato en la validación cruzada: un documento, lo diligenciado o una fuente externa. */
export const CrossValidationSource = z.enum([
  ...TypeDocument.options,
  'application_data',
  'banner',
  'rui',
]);
export type CrossValidationSource = z.infer<typeof CrossValidationSource>;

export const SubmissionType = z.enum(['initial', 'resubmission']);
export type SubmissionType = z.infer<typeof SubmissionType>;
