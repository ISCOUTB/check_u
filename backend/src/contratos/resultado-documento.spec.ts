import type { z } from 'zod';
import { cargarEjemplos } from '../../test/soporte/ejemplos.js';
import { DocumentValidationResult, RuleEvaluation } from './resultado-documento.js';

// Cada ejemplo inválido cambia un solo campo de un ejemplo válido; su nombre dice qué regla prueba.
const ESQUEMAS: [string, z.ZodType][] = [
  ['rule-evaluation', RuleEvaluation],
  ['document-validation-result', DocumentValidationResult],
];

describe.each(ESQUEMAS)('%s', (nombre, esquema) => {
  const { validos, invalidos } = cargarEjemplos(nombre);

  it('tiene al menos un ejemplo válido y uno inválido', () => {
    expect(validos.length).toBeGreaterThan(0);
    expect(invalidos.length).toBeGreaterThan(0);
  });

  it.each(validos)('acepta $archivo', ({ datos }) => {
    expect(esquema.safeParse(datos).success).toBe(true);
  });

  it.each(invalidos)('rechaza $archivo', ({ datos }) => {
    expect(esquema.safeParse(datos).success).toBe(false);
  });
});
