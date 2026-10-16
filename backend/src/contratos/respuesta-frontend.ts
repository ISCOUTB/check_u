import { z } from 'zod';
import { conReglaDeReenvio, FechaHora, Identificador, TextoNoVacio } from './comunes.js';
import { ResubmissionPolicy } from './entrega.js';
import {
  AcademicLevel,
  DocumentClassification,
  JobStatus,
  RequestStatus,
  TypeDocument,
  ValidationStatus,
} from './enums.js';
import { RuleEvaluation } from './resultado-documento.js';

/** Estado de un documento como lo ve el frontend; misma regla de reenvío que el resultado. */
export const RequestDocumentStatus = conReglaDeReenvio({
  type_document: TypeDocument,
  required: z.boolean(),
  /** Versión vigente; null si aún no se ha cargado. */
  current_version: z.number().int().min(1).nullable(),
  /** null mientras no haya un resultado de validación. */
  classification: DocumentClassification.nullable(),
  validation_status: ValidationStatus,
  rules: z.array(RuleEvaluation),
  errors: z.array(z.string()),
  versions: z.array(z.strictObject({ version: z.number().int().min(1), submitted_at: FechaHora })),
});
export type RequestDocumentStatus = z.infer<typeof RequestDocumentStatus>;

/** Comentario del personal de grados, visible para el estudiante. */
export const ReviewComment = z.strictObject({
  author_role: z.literal('funcionario'),
  text: TextoNoVacio,
  created_at: FechaHora,
});
export type ReviewComment = z.infer<typeof ReviewComment>;

/**
 * Lo que consume el frontend para mostrar una solicitud (Tarea 12). No lleva reglas de negocio:
 * el frontend muestra lo que el backend ya decidió.
 */
export const RequestResultResponse = z.strictObject({
  request_id: Identificador,
  id_student: Identificador,
  level: AcademicLevel,
  status: RequestStatus,
  status_reason: z.string().nullable(),
  processing: z.strictObject({
    status: JobStatus.nullable(),
    updated_at: FechaHora.nullable(),
  }),
  documents: z.array(RequestDocumentStatus),
  comments: z.array(ReviewComment),
  resubmission_policy: ResubmissionPolicy,
  generated_at: FechaHora,
});
export type RequestResultResponse = z.infer<typeof RequestResultResponse>;
