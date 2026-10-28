import { fechaInstitucional } from './asignacion-periodo.js';

describe('Fecha institucional para asignación', () => {
  it.each([
    ['2026-11-23T04:59:59Z', '2026-11-22'],
    ['2026-11-23T05:00:00Z', '2026-11-23'],
    ['2027-01-01T02:00:00Z', '2026-12-31'],
    ['2028-03-01T04:00:00Z', '2028-02-29'],
  ])('%s corresponde al día %s de Bogotá', (instante, fecha) => {
    expect(fechaInstitucional(new Date(instante))).toBe(fecha);
  });
});
