import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { ESQUEMAS_SIN_REPETIDOS } from './comunes.js';
import { DOCUMENTOS_POR_NIVEL } from './documentos.js';
import { ResubmissionPolicy, Submission } from './entrega.js';
import * as enums from './enums.js';
import { CLASIFICACION_LEGADA, ETIQUETAS_CLASIFICACION, TIPO_DOCUMENTO_LEGADO } from './mapeo.js';
import { RequestResultResponse } from './respuesta-frontend.js';
import { DocumentValidationResult, RuleEvaluation } from './resultado-documento.js';
import { TRANSICIONES_SOLICITUD, TRANSICIONES_TRABAJO } from './transiciones.js';
import { CrossValidationResult } from './validacion-cruzada.js';

/** Esquemas que se exportan a JSON Schema; la clave es también la carpeta de sus ejemplos. */
export const ESQUEMAS_CONTRATO: Readonly<Record<string, z.ZodType>> = Object.freeze({
  'rule-evaluation': RuleEvaluation,
  'document-validation-result': DocumentValidationResult,
  'cross-validation-result': CrossValidationResult,
  submission: Submission,
  'resubmission-policy': ResubmissionPolicy,
  'request-result-response': RequestResultResponse,
});

const TITULOS: Readonly<Record<string, string>> = {
  'rule-evaluation': 'RuleEvaluation',
  'document-validation-result': 'DocumentValidationResult',
  'cross-validation-result': 'CrossValidationResult',
  submission: 'Submission',
  'resubmission-policy': 'ResubmissionPolicy',
  'request-result-response': 'RequestResultResponse',
};

const URL_BASE = 'https://checku.iscoutb.dev/contratos/';

/**
 * contratos/esquemas/ en la raíz del repo, donde exportar-cli.ts escribe lo que genera Zod. Se
 * resuelve desde este archivo (src/contratos o dist/contratos), no desde la carpeta actual: el
 * script borra los archivos que no reconoce.
 */
export function carpetaEsquemas(): string {
  return fileURLToPath(new URL('../../../contratos/esquemas/', import.meta.url));
}

/**
 * Todo lo que va en contratos/esquemas/, por nombre de archivo: un JSON Schema por esquema (draft
 * 2020-12) más los enums, los documentos requeridos, las tablas de transiciones y el mapeo a los
 * nombres viejos, en JSON.
 */
export function generarEsquemas(): Record<string, unknown> {
  const archivos: Record<string, unknown> = {};

  for (const [nombre, esquema] of Object.entries(ESQUEMAS_CONTRATO)) {
    const jsonSchema = z.toJSONSchema(esquema, {
      // Los arreglos marcados con sinRepetidos() exigen elementos únicos también en JSON Schema.
      override: (contexto) => {
        if (ESQUEMAS_SIN_REPETIDOS.has(contexto.zodSchema)) {
          contexto.jsonSchema.uniqueItems = true;
        }
      },
    });
    archivos[`${nombre}.schema.json`] = {
      $id: `${URL_BASE}${nombre}.schema.json`,
      title: TITULOS[nombre],
      ...jsonSchema,
    };
  }

  archivos['enums.json'] = Object.fromEntries(
    Object.entries(enums).map(([nombre, enumeracion]) => [nombre, enumeracion.options]),
  );
  archivos['documentos-requeridos.json'] = DOCUMENTOS_POR_NIVEL;
  archivos['transiciones.json'] = { solicitud: TRANSICIONES_SOLICITUD, trabajo: TRANSICIONES_TRABAJO };
  archivos['mapeo.json'] = {
    etiquetas_clasificacion: ETIQUETAS_CLASIFICACION,
    clasificacion_legada: CLASIFICACION_LEGADA,
    tipo_documento_legado: TIPO_DOCUMENTO_LEGADO,
  };

  return archivos;
}
