import { z } from 'zod';
import { Confianza, FechaHora, Identificador, sinRepetidos, TextoNoVacio } from './comunes.js';
import { CrossValidationOutcome, CrossValidationSource } from './enums.js';

/** Un dato usado en la comparación, tal como se leyó y ya normalizado. */
export const CrossValidationEvidence = z.strictObject({
  source: CrossValidationSource,
  field: Identificador,
  value: z.string().nullable(),
  normalized_value: z.string().nullable(),
  /** Versión del documento de donde salió; null para datos de la solicitud o fuentes externas. */
  document_version: z.number().int().min(1).nullable(),
});
export type CrossValidationEvidence = z.infer<typeof CrossValidationEvidence>;

/**
 * Resultado de comparar un dato entre fuentes (Tarea 09). Se inserta, no reemplaza resultados
 * individuales. Una coincidencia aproximada no es prueba definitiva.
 */
export const CrossValidationResult = z.strictObject({
  rule: Identificador,
  rule_version: Identificador,
  sources: sinRepetidos(z.array(CrossValidationSource).min(2)),
  fields: z.array(Identificador).min(1),
  outcome: CrossValidationOutcome,
  evidence: z.array(CrossValidationEvidence),
  /** Similitud calculada y umbral usado; null cuando no aplica (p. ej. fuente pendiente). */
  similarity: Confianza.nullable(),
  threshold: Confianza.nullable(),
  reason: TextoNoVacio,
  evaluated_at: FechaHora,
});
export type CrossValidationResult = z.infer<typeof CrossValidationResult>;
