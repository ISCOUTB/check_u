import { JobStatus, RequestStatus } from './enums.js';
import {
  TRANSICIONES_SOLICITUD,
  TRANSICIONES_TRABAJO,
  transicionSolicitudPermitida,
  transicionTrabajoPermitida,
} from './transiciones.js';

// Tablas de la sección 5 del spec, escritas a mano para no depender del código bajo prueba.
const PERMITIDAS_SOLICITUD: Record<RequestStatus, RequestStatus[]> = {
  queued: ['processing', 'closed'],
  processing: ['awaiting_review', 'correction_required', 'ready_for_formal_submission', 'closed'],
  awaiting_review: ['processing', 'correction_required', 'ready_for_formal_submission', 'closed'],
  correction_required: ['queued', 'closed'],
  ready_for_formal_submission: ['closed'],
  closed: [],
};

const PERMITIDAS_TRABAJO: Record<JobStatus, JobStatus[]> = {
  queued: ['processing'],
  processing: ['completed', 'failed', 'retry_pending'],
  retry_pending: ['queued'],
  completed: [],
  failed: [],
};

function todosLosPares<T extends string>(estados: readonly T[]): [T, T][] {
  return estados.flatMap((de) => estados.map((a): [T, T] => [de, a]));
}

describe('transiciones de solicitud', () => {
  it.each(todosLosPares(RequestStatus.options))('%s → %s', (de, a) => {
    expect(transicionSolicitudPermitida(de, a)).toBe(PERMITIDAS_SOLICITUD[de].includes(a));
  });

  it('la tabla cubre todos los estados', () => {
    expect(Object.keys(TRANSICIONES_SOLICITUD).sort()).toEqual([...RequestStatus.options].sort());
  });

  it('ningún estado puede pasar a sí mismo', () => {
    for (const estado of RequestStatus.options) {
      expect(transicionSolicitudPermitida(estado, estado)).toBe(false);
    }
  });

  it('closed es final', () => {
    expect(TRANSICIONES_SOLICITUD.closed).toEqual([]);
  });
});

describe('transiciones de trabajo', () => {
  it.each(todosLosPares(JobStatus.options))('%s → %s', (de, a) => {
    expect(transicionTrabajoPermitida(de, a)).toBe(PERMITIDAS_TRABAJO[de].includes(a));
  });

  it('la tabla cubre todos los estados', () => {
    expect(Object.keys(TRANSICIONES_TRABAJO).sort()).toEqual([...JobStatus.options].sort());
  });

  it('completed y failed son finales', () => {
    expect(TRANSICIONES_TRABAJO.completed).toEqual([]);
    expect(TRANSICIONES_TRABAJO.failed).toEqual([]);
  });
});
