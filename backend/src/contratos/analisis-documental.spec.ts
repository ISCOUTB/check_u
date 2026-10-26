import { describe, expect, it } from 'vitest';
import { DocumentAnalysisResponse } from './analisis-documental.js';

const respuestaBase = {
  analysis_id: 'analisis-prueba-001',
  level: 'pregrado',
  status: 'failed',
  documents: [],
  cross_validations: [],
  warnings: [],
  errors: ['No fue posible procesar los documentos'],
  generated_at: '2026-10-24T15:30:00-05:00',
};

describe('DocumentAnalysisResponse', () => {
  it('acepta una respuesta de análisis sin solicitud persistida', () => {
    expect(DocumentAnalysisResponse.safeParse(respuestaBase).success).toBe(
      true,
    );
  });

  it('rechaza niveles fuera del contrato', () => {
    const resultado = DocumentAnalysisResponse.safeParse({
      ...respuestaBase,
      level: 'PREGRADO',
    });

    expect(resultado.success).toBe(false);
  });

  it('rechaza fechas sin zona horaria', () => {
    const resultado = DocumentAnalysisResponse.safeParse({
      ...respuestaBase,
      generated_at: '2026-10-24T15:30:00',
    });

    expect(resultado.success).toBe(false);
  });

  it('rechaza documentos que no cumplen el contrato individual', () => {
    const resultado = DocumentAnalysisResponse.safeParse({
      ...respuestaBase,
      documents: [{ type_document: 'identification' }],
    });

    expect(resultado.success).toBe(false);
  });

  it('rechaza comparaciones incompletas', () => {
    const resultado = DocumentAnalysisResponse.safeParse({
      ...respuestaBase,
      cross_validations: [{ rule: 'comparar-nombres' }],
    });

    expect(resultado.success).toBe(false);
  });

  it('rechaza campos adicionales no definidos', () => {
    const resultado = DocumentAnalysisResponse.safeParse({
      ...respuestaBase,
      request_id: 'solicitud-inventada',
    });

    expect(resultado.success).toBe(false);
  });
});
