import { z } from 'zod';
import { FechaHora, Identificador } from './comunes.js';
import { AcademicLevel } from './enums.js';
import { DocumentValidationResult } from './resultado-documento.js';
import { CrossValidationResult } from './validacion-cruzada.js';

/**
 * Estado del análisis, no de una solicitud de grado.
 * "completed" no significa que todos los documentos sean válidos.
 */
export const AnalysisStatus = z.enum(['completed', 'partial', 'failed']);

/**
 * Respuesta común de análisis documental.
 * No requiere crear una solicitud ni guardar resultados en base de datos.
 */
export const DocumentAnalysisResponse = z.strictObject({
  analysis_id: Identificador,
  level: AcademicLevel,
  status: AnalysisStatus,
  documents: z.array(DocumentValidationResult),
  cross_validations: z.array(CrossValidationResult),
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
  generated_at: FechaHora,
});

export type DocumentAnalysisResponse = z.infer<typeof DocumentAnalysisResponse>;
