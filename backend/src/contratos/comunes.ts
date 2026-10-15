import { z } from 'zod';
import { RequiredAction } from './enums.js';

/** Fecha y hora ISO 8601 con zona horaria (Z o ±HH:MM); sin zona es inválida. */
export const FechaHora = z.iso.datetime({ offset: true });

/** Fecha local AAAA-MM-DD (America/Bogota). */
export const FechaLocal = z.iso.date();

/** Confianza de una extracción o comparación, entre 0 y 1. */
export const Confianza = z.number().min(0).max(1);

/** Identificador opaco (id_student, request_id, idempotency_key…): texto no vacío. */
export const Identificador = z.string().min(1);

/** Texto con contenido; solo espacios cuenta como vacío. */
export const TextoNoVacio = z.string().trim().min(1);

/**
 * Arreglos que no admiten elementos repetidos. La exportación a JSON Schema les pone
 * uniqueItems: true (ver exportar.ts), así el trabajador de Python también lo exige.
 */
export const ESQUEMAS_SIN_REPETIDOS = new Set<z.ZodType>();

export function sinRepetidos<T extends z.ZodArray<z.ZodType>>(arreglo: T): T {
  const esquema = arreglo.refine((elementos) => new Set(elementos).size === elementos.length, {
    message: 'No se admiten elementos repetidos',
  });
  ESQUEMAS_SIN_REPETIDOS.add(esquema);
  return esquema;
}

/**
 * Regla de reenvío de la Tarea 02, como dos variantes del esquema (viaja dentro del JSON Schema):
 * - resubmission_allowed true  ⇒ required_action upload_new_version y un motivo;
 * - resubmission_allowed false ⇒ cualquier acción menos upload_new_version, sin motivo.
 */
export function conReglaDeReenvio<S extends z.ZodRawShape>(base: S) {
  return z.discriminatedUnion('resubmission_allowed', [
    z.strictObject({
      ...base,
      resubmission_allowed: z.literal(true),
      required_action: z.literal('upload_new_version'),
      resubmission_reason: TextoNoVacio,
    }),
    z.strictObject({
      ...base,
      resubmission_allowed: z.literal(false),
      required_action: RequiredAction.exclude(['upload_new_version']),
      resubmission_reason: z.null(),
    }),
  ]);
}
