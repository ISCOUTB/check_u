import {
  dentroDelPlazoCorreccion,
  fechaCorteCorreccion,
  fechaInstitucional,
} from './asignacion-periodo.js';

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

describe('Plazo de corrección (Tarea 42a): hasta fecha_fin − 7, inclusive', () => {
  it('el corte es fecha_fin menos siete días, también al cambiar de mes', () => {
    expect(fechaCorteCorreccion('2026-11-30')).toBe('2026-11-23');
    expect(fechaCorteCorreccion('2026-12-03')).toBe('2026-11-26');
    expect(fechaCorteCorreccion('2027-03-05')).toBe('2027-02-26');
  });

  it('fecha_fin − 7 se permite y fecha_fin − 6 se rechaza', () => {
    expect(dentroDelPlazoCorreccion('2026-11-30', '2026-11-23')).toBe(true);
    expect(dentroDelPlazoCorreccion('2026-11-30', '2026-11-24')).toBe(false);
    expect(dentroDelPlazoCorreccion('2026-11-30', '2026-11-01')).toBe(true);
  });

  it('a las 23:30 de Bogotá del último día todavía se permite, aunque en UTC ya sea el día siguiente', () => {
    const hoy = fechaInstitucional(new Date('2026-11-24T04:30:00Z'));
    expect(hoy).toBe('2026-11-23');
    expect(dentroDelPlazoCorreccion('2026-11-30', hoy)).toBe(true);
  });
});
