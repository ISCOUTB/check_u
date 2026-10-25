import { describe, expect, it } from 'vitest';
import { ExtractedValue } from './resultado-documento.js';

describe('ExtractedValue: confianza conocida o desconocida', () => {
  it('acepta un valor con confianza desconocida', () => {
    expect(
      ExtractedValue.safeParse({
        value: 'NOMBRE FICTICIO',
        confidence: null,
      }).success,
    ).toBe(true);
  });

  it('acepta valores con confianza numérica válida', () => {
    for (const value of ['DATO FICTICIO', 42, false]) {
      expect(
        ExtractedValue.safeParse({
          value,
          confidence: 0.9,
        }).success,
      ).toBe(true);
    }
  });

  it('acepta ausencia de valor y confianza', () => {
    expect(
      ExtractedValue.safeParse({
        value: null,
        confidence: null,
      }).success,
    ).toBe(true);
  });

  it('rechaza confianza numérica sin valor', () => {
    expect(
      ExtractedValue.safeParse({
        value: null,
        confidence: 0.9,
      }).success,
    ).toBe(false);
  });

  it('rechaza confianza fuera del rango permitido', () => {
    for (const confidence of [-0.1, 1.1]) {
      expect(
        ExtractedValue.safeParse({
          value: 'DATO FICTICIO',
          confidence,
        }).success,
      ).toBe(false);
    }
  });

  it('exige que la propiedad confidence esté presente', () => {
    expect(
      ExtractedValue.safeParse({
        value: 'DATO FICTICIO',
      }).success,
    ).toBe(false);
  });
});
