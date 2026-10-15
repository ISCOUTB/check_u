import { z } from 'zod';
import { FechaHora, FechaLocal, Identificador } from './comunes.js';
import { TypeDocument } from './enums.js';

/** Un documento incluido en una entrega, con la versión que crea. */
export const SubmittedDocument = z.strictObject({
  type_document: TypeDocument,
  document_version: z.number().int().min(1),
});
export type SubmittedDocument = z.infer<typeof SubmittedDocument>;

/**
 * Sin tipos repetidos. JSON Schema no puede expresar la unicidad por campo, así que esta regla
 * solo la exige Zod: el trabajador de Python debe comprobarla (ver docs/contratos.md).
 */
const DocumentosEntregados = z
  .array(SubmittedDocument)
  .min(1)
  .refine(
    (documentos) => new Set(documentos.map((d) => d.type_document)).size === documentos.length,
    { message: 'Un tipo de documento no puede repetirse en una entrega' },
  );

const campos = {
  /** Clave de idempotencia: la misma entrega enviada dos veces no se procesa dos veces. */
  idempotency_key: Identificador,
  id_student: Identificador,
  request_id: Identificador,
  submission_number: z.number().int().min(1),
  /** Fecha calendario en America/Bogota; con ella se cuenta el límite diario (Tarea 11). */
  local_submission_date: FechaLocal,
  submitted_at: FechaHora,
  documents: DocumentosEntregados,
};

/**
 * Entrega inicial o de corrección. La inicial no consume reenvíos (resubmission_number 0); un
 * reenvío lleva su número (1 o más). El tope diario es política de la Tarea 11, no del esquema.
 */
export const Submission = z.discriminatedUnion('submission_type', [
  z.strictObject({ ...campos, submission_type: z.literal('initial'), resubmission_number: z.literal(0) }),
  z.strictObject({
    ...campos,
    submission_type: z.literal('resubmission'),
    resubmission_number: z.number().int().min(1),
  }),
]);
export type Submission = z.infer<typeof Submission>;

/** Cupo de reenvíos del estudiante en el día local (lo expone la Tarea 11). */
export const ResubmissionPolicy = z.strictObject({
  daily_limit: z.number().int().min(0),
  used_today: z.number().int().min(0),
  remaining_today: z.number().int().min(0),
  timezone: z.literal('America/Bogota'),
  local_date: FechaLocal,
  /** Desde qué fecha puede volver a enviar cuando agotó el cupo; null si aún tiene cupo. */
  next_available_date: FechaLocal.nullable(),
});
export type ResubmissionPolicy = z.infer<typeof ResubmissionPolicy>;
