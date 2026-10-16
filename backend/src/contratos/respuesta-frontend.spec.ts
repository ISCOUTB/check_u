import { cargarEjemplos } from '../../test/soporte/ejemplos.js';
import * as contratos from './index.js';
import { RequestResultResponse } from './respuesta-frontend.js';

describe('request-result-response', () => {
  const { validos, invalidos } = cargarEjemplos('request-result-response');

  it('tiene al menos un ejemplo válido y uno inválido', () => {
    expect(validos.length).toBeGreaterThan(0);
    expect(invalidos.length).toBeGreaterThan(0);
  });

  it.each(validos)('acepta $archivo', ({ datos }) => {
    expect(RequestResultResponse.safeParse(datos).success).toBe(true);
  });

  it.each(invalidos)('rechaza $archivo', ({ datos }) => {
    expect(RequestResultResponse.safeParse(datos).success).toBe(false);
  });
});

describe('index de contratos', () => {
  it('reexporta lo que usan las demás tareas', () => {
    expect(contratos.requiredDocuments('posgrado')).toHaveLength(3);
    expect(contratos.transicionSolicitudPermitida('queued', 'processing')).toBe(true);
    expect(contratos.DocumentValidationResult).toBeDefined();
    expect(contratos.RequestResultResponse).toBeDefined();
  });
});
