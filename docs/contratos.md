# Contratos de datos de CheckU

Enums, esquemas y tablas que comparten la API (NestJS), el trabajador de Python y el frontend. Es el entregable de la Tarea 02 (issue #6); el diseño está en [`docs/superpowers/specs/2026-10-14-contratos-datos-design.md`](superpowers/specs/2026-10-14-contratos-datos-design.md).

**Contratos, no reglas de negocio.** Dicen qué forma tienen los datos y qué cambios de estado están permitidos. Quién clasifica un documento, cuándo cambia una solicitud de estado o si se acepta un reenvío lo deciden las tareas 08 a 11.

## Dónde está cada cosa

| Qué | Dónde | Quién lo usa |
|---|---|---|
| Fuente única (Zod 4) | `backend/src/contratos/` (se importa desde `index.ts`) | La API de NestJS |
| JSON Schema exportados (draft 2020-12) | `contratos/esquemas/*.schema.json` | El trabajador de Python (Tarea 06), con cualquier validador de JSON Schema |
| Enums, documentos requeridos y transiciones en JSON | `contratos/esquemas/enums.json`, `documentos-requeridos.json`, `transiciones.json` | El trabajador de Python |
| Etiquetas en español y nombres viejos → nuevos | `backend/src/contratos/mapeo.ts` y `contratos/esquemas/mapeo.json` | El frontend (Tarea 12) y quien pase datos de `frontend/` o `webapp/` |
| Ejemplos válidos e inválidos | `contratos/ejemplos/<esquema>/{validos,invalidos}/` | Las pruebas de los dos lados |

## Cómo se cambia un contrato

1. Edita el esquema en `backend/src/contratos/` y agrega o ajusta sus ejemplos en `contratos/ejemplos/`.
2. Regenera los JSON Schema desde `backend/`:

   ```bash
   npm run contratos:exportar
   ```

3. Corre `npm test`. Dos pruebas protegen la sincronía:
   - **desalineación:** `contratos/esquemas/` debe ser exactamente lo que genera Zod. Si cambiaste Zod sin exportar, o editaste un `.json` a mano, falla;
   - **paridad:** cada ejemplo debe dar el mismo resultado en Zod y en el JSON Schema exportado, validado con ajv.

Nunca edites los `.json` de `contratos/esquemas/` a mano.

## Convenciones

- Campos en inglés y snake_case, como en `document_strc.py`. Valores tal cual los dan `docs/PROMPT_BASE.md` y las tareas.
- Objetos estrictos: un campo desconocido es un error.
- **Fecha y hora:** ISO 8601 con zona horaria (`2026-10-14T09:30:00-05:00` o `…Z`). Sin zona es inválida.
- **Fecha local:** `AAAA-MM-DD`, en la zona `America/Bogota`.
- **Confianza:** entre 0 y 1.
- **Identificadores** (`id_student`, `request_id`, `idempotency_key`…): texto no vacío, sin espacios al inicio ni al final (`"   "` y `" 123"` son inválidos).

## Enums

| Enum | Valores |
|---|---|
| `TypeDocument` | `identification`, `academic_evaluation`, `paz_y_salvo_bib`, `estampilla_pro_cultura`, `saber_pro` |
| `AcademicLevel` | `pregrado`, `posgrado` |
| `JobStatus` | `queued`, `processing`, `completed`, `failed`, `retry_pending` |
| `RequestStatus` | `queued`, `processing`, `awaiting_review`, `correction_required`, `ready_for_formal_submission`, `closed` |
| `RuleResult` | `cumple`, `no_cumple`, `no_evaluable` (los dos últimos nunca se mezclan) |
| `NoEvaluableReason` | `low_confidence`, `source_unavailable`, `source_pending`, `missing_dependency` (por qué una regla quedó `no_evaluable`) |
| `DocumentClassification` | `valid`, `invalid`, `inconsistent`, `to_check` |
| `ValidationStatus` | `pending`, `processing`, `completed`, `failed` (procesamiento del documento; no es su clasificación) |
| `RequiredAction` | `none`, `upload_new_version`, `wait_for_review`, `wait_for_external_validation`, `wait_for_processing`, `correct_data`, `contact_administration` |
| `CrossValidationOutcome` | `confirmed_match`, `confirmed_mismatch`, `insufficient_information`, `source_pending`, `source_unavailable`, `manual_review_required` |
| `CrossValidationSource` | los 5 tipos de documento, `application_data`, `banner`, `rui` |
| `SubmissionType` | `initial`, `resubmission` |

## Mapeo a lo que existe hoy

En `mapeo.ts` (exportado a `mapeo.json`). Las etiquetas son las que ve el usuario; los nombres en inglés no se muestran.

**Clasificación:**

| Hoy en `frontend/` | Hoy en `webapp/` | Contrato | Etiqueta |
|---|---|---|---|
| `valida` | `valida` | `valid` | Válido |
| `no-valida` | — | `invalid` | No válido |
| `inconsistente` | `inconsistente` | `inconsistent` | Inconsistente |
| `por-revisar`, `por_revisar` | `por_revisar` | `to_check` | Por revisar |

El `por_revisar` de `webapp/` se usaba tanto para "no se pudo leer" como para "el RUI no respondió". En los contratos, esos casos son reglas `no_evaluable` con su motivo (`low_confidence` o `source_unavailable`).

**Tipo documental:**

| Hoy | Contrato |
|---|---|
| `cedula` | `identification` |
| `banner` | `academic_evaluation` |
| `estampilla` | `estampilla_pro_cultura` |
| `biblioteca` | `paz_y_salvo_bib` |
| `saber-pro` | `saber_pro` |

`acta_grado` e `icfes` (de `structure.py`) son experimentales y no tienen equivalente.

## Documentos requeridos

`requiredDocuments(level)` (el `required_documents(level)` de la issue) devuelve una lista nueva en cada llamada:

| Nivel | Documentos |
|---|---|
| `pregrado` (5) | `identification`, `academic_evaluation`, `paz_y_salvo_bib`, `estampilla_pro_cultura`, `saber_pro` |
| `posgrado` (3) | `identification`, `paz_y_salvo_bib`, `estampilla_pro_cultura` |

## Transiciones

`transicionSolicitudPermitida(de, a)` y `transicionTrabajoPermitida(de, a)` solo consultan estas tablas. Un estado nunca pasa a sí mismo.

**Solicitud:**

| De | Puede pasar a |
|---|---|
| `queued` | `processing`, `closed` |
| `processing` | `awaiting_review`, `correction_required`, `ready_for_formal_submission`, `closed` |
| `awaiting_review` | `processing`, `correction_required`, `ready_for_formal_submission`, `closed` |
| `correction_required` | `queued`, `closed` |
| `ready_for_formal_submission` | `closed` |
| `closed` | ninguno (final) |

`closed` también es el cierre administrativo: desde cualquier estado no final. `ready_for_formal_submission` **no** es la aprobación oficial del grado.

**Trabajo:**

| De | Puede pasar a |
|---|---|
| `queued` | `processing` |
| `processing` | `completed`, `failed`, `retry_pending` |
| `retry_pending` | `queued` |
| `completed`, `failed` | ninguno (finales) |

## Esquemas

| Esquema | Archivo exportado | Para qué |
|---|---|---|
| `RuleEvaluation` | `rule-evaluation.schema.json` | Una regla aplicada: `rule`, `result`, `no_evaluable_reason`, `mandatory`, `message`, `timestamp`, `errors`. |
| `DocumentValidationResult` | `document-validation-result.schema.json` | Resultado de validar una versión de un documento. |
| `CrossValidationResult` | `cross-validation-result.schema.json` | Comparación de un dato entre al menos 2 fuentes distintas, con su evidencia, similitud, umbral y motivo. |
| `Submission` | `submission.schema.json` | Entrega inicial o de corrección, con su clave de idempotencia y fecha local. |
| `ResubmissionPolicy` | `resubmission-policy.schema.json` | Cupo diario de reenvíos del estudiante (`America/Bogota`). |
| `RequestResultResponse` | `request-result-response.schema.json` | Lo que consume el frontend para mostrar una solicitud. |

Los ejemplos válidos e inválidos de cada esquema están en `contratos/ejemplos/<esquema>/`. Cada inválido cambia un solo campo y su nombre dice qué regla prueba.

### Regla de reenvío

Aplica a `DocumentValidationResult` y a cada documento de `RequestResultResponse`. Va escrita como dos variantes del esquema (`oneOf` en el JSON Schema), así que se cumple igual en los dos lados:

| `resubmission_allowed` | `required_action` | `resubmission_reason` |
|---|---|---|
| `true` | solo `upload_new_version` | texto obligatorio |
| `false` | cualquiera **menos** `upload_new_version` | `null` |

### Motivo de `no_evaluable`

Una regla `no_evaluable` dice **por qué** no se pudo evaluar. Así "no se pudo leer" y "la fuente no respondió" nunca se mezclan, como pasaba con `por_revisar` en `webapp/`. También va en dos variantes:

| `result` | `no_evaluable_reason` |
|---|---|
| `no_evaluable` | obligatorio: `low_confidence` (no se pudo leer con confianza suficiente), `source_unavailable` (la fuente externa no respondió), `source_pending` (la fuente aún no está integrada, como Banner) o `missing_dependency` (falta otro documento o dato) |
| `cumple`, `no_cumple` | `null` |

### Datos extraídos

`extracted_data` es un objeto de campo → `{value, confidence}`. Los datos de identidad (`first_name`, `second_name`, `last_name`, `second_last_name`, `code_student`, número de identificación) van aquí, con su confianza.
- Si un dato no se pudo extraer: `{"value": null, "confidence": null}`. **Nunca se inventa un valor.**
- No puede haber valor sin confianza, ni confianza sin valor. `0` y `false` son valores válidos.

Ejemplo (`contratos/ejemplos/document-validation-result/validos/reenvio-permitido.json`, datos sintéticos):

```json
{
  "id_student": "9900112233",
  "type_document": "identification",
  "document_version": 1,
  "extracted_data": {
    "first_name": { "value": "Ana", "confidence": 0.93 },
    "last_name": { "value": "Prueba", "confidence": 0.93 },
    "code_student": { "value": "T00012345", "confidence": 0.93 },
    "identification_number": { "value": "9900112233", "confidence": 0.93 }
  },
  "rules": [
    {
      "rule": "identification_number_present",
      "result": "no_cumple",
      "no_evaluable_reason": null,
      "mandatory": true,
      "message": "No se encontró el número",
      "timestamp": "2026-10-14T09:30:00-05:00",
      "errors": ["Campo vacío"]
    }
  ],
  "errors": [],
  "document_classification": "invalid",
  "validation_status": "completed",
  "resubmission_allowed": true,
  "resubmission_reason": "La imagen no es legible; sube una versión escaneada.",
  "required_action": "upload_new_version",
  "validation_version": "reglas-2026.10",
  "timestamp": "2026-10-14T09:30:00-05:00"
}
```

### Sin tipos repetidos en una entrega

`Submission.documents` no admite dos documentos con el mismo `type_document`. `uniqueItems` no sirve, porque los elementos difieren en la versión. Por eso el JSON Schema lleva una cláusula por cada uno de los 5 tipos: a lo sumo un documento con ese tipo (`contains` + `maxContains: 1`). Zod y el JSON Schema rechazan lo mismo; la prueba de paridad no tiene excepciones.
