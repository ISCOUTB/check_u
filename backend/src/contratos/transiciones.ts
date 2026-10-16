import type { JobStatus, RequestStatus } from './enums.js';

// Tablas de transiciones permitidas (spec de la Tarea 02, sección 5). Son datos: dicen qué cambio
// está permitido, no cuándo hacerlo; eso lo decide el consolidador (Tarea 10).

/**
 * Solicitud. closed se alcanza desde ready_for_formal_submission y, como cierre administrativo,
 * desde cualquier estado no final. ready_for_formal_submission no es la aprobación del grado.
 */
export const TRANSICIONES_SOLICITUD: Readonly<Record<RequestStatus, readonly RequestStatus[]>> =
  Object.freeze({
    queued: Object.freeze(['processing', 'closed'] as const),
    processing: Object.freeze([
      'awaiting_review',
      'correction_required',
      'ready_for_formal_submission',
      'closed',
    ] as const),
    awaiting_review: Object.freeze([
      'processing',
      'correction_required',
      'ready_for_formal_submission',
      'closed',
    ] as const),
    correction_required: Object.freeze(['queued', 'closed'] as const),
    ready_for_formal_submission: Object.freeze(['closed'] as const),
    closed: Object.freeze([] as const),
  });

/** Trabajo de procesamiento. completed y failed son finales. */
export const TRANSICIONES_TRABAJO: Readonly<Record<JobStatus, readonly JobStatus[]>> = Object.freeze({
  queued: Object.freeze(['processing'] as const),
  processing: Object.freeze(['completed', 'failed', 'retry_pending'] as const),
  retry_pending: Object.freeze(['queued'] as const),
  completed: Object.freeze([] as const),
  failed: Object.freeze([] as const),
});

export function transicionSolicitudPermitida(de: RequestStatus, a: RequestStatus): boolean {
  return TRANSICIONES_SOLICITUD[de].includes(a);
}

export function transicionTrabajoPermitida(de: JobStatus, a: JobStatus): boolean {
  return TRANSICIONES_TRABAJO[de].includes(a);
}
