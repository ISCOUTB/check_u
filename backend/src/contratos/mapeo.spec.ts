import { CLASIFICACION_LEGADA, ETIQUETAS_CLASIFICACION, TIPO_DOCUMENTO_LEGADO } from './mapeo.js';

// Ajuste de la issue #6: equivalencias con lo que usan hoy frontend/ y webapp/.
describe('mapeo a lo que existe hoy', () => {
  it('cada clasificación tiene su etiqueta en español', () => {
    expect(ETIQUETAS_CLASIFICACION).toEqual({
      valid: 'Válido',
      invalid: 'No válido',
      inconsistent: 'Inconsistente',
      to_check: 'Por revisar',
    });
  });

  it('las clasificaciones de frontend/ y webapp/ apuntan a la nueva', () => {
    expect(CLASIFICACION_LEGADA).toEqual({
      valida: 'valid',
      'no-valida': 'invalid',
      inconsistente: 'inconsistent',
      'por-revisar': 'to_check',
      por_revisar: 'to_check',
    });
  });

  it('los tipos documentales viejos apuntan al nuevo, sin acta_grado ni icfes', () => {
    expect(TIPO_DOCUMENTO_LEGADO).toEqual({
      cedula: 'identification',
      banner: 'academic_evaluation',
      estampilla: 'estampilla_pro_cultura',
      biblioteca: 'paz_y_salvo_bib',
      'saber-pro': 'saber_pro',
    });
  });

  it('las tablas no se pueden modificar', () => {
    expect(Object.isFrozen(ETIQUETAS_CLASIFICACION)).toBe(true);
    expect(Object.isFrozen(CLASIFICACION_LEGADA)).toBe(true);
    expect(Object.isFrozen(TIPO_DOCUMENTO_LEGADO)).toBe(true);
  });
});
