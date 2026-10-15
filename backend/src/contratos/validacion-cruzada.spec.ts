import { cargarEjemplos } from '../../test/soporte/ejemplos.js';
import { CrossValidationResult } from './validacion-cruzada.js';

describe('cross-validation-result', () => {
  const { validos, invalidos } = cargarEjemplos('cross-validation-result');

  it('tiene al menos un ejemplo válido y uno inválido', () => {
    expect(validos.length).toBeGreaterThan(0);
    expect(invalidos.length).toBeGreaterThan(0);
  });

  it.each(validos)('acepta $archivo', ({ datos }) => {
    expect(CrossValidationResult.safeParse(datos).success).toBe(true);
  });

  it.each(invalidos)('rechaza $archivo', ({ datos }) => {
    expect(CrossValidationResult.safeParse(datos).success).toBe(false);
  });
});
