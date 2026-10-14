# Contratos de datos y enumeraciones (Tarea 02)

**Fecha:** 14/10/2026 · **Autor:** Héctor Cabarcas · **Issue:** ISCOUTB/check_u#6 · **Rama:** `tarea_02_contratos`

Contexto obligatorio: `docs/PROMPT_BASE.md` (en el PR de la Tarea 01). Decisión D1 de `docs/gap_analysis.md`: NestJS es la aplicación y el motor de Python corre como proceso trabajador del mismo despliegue.

## 1. Objetivo y éxito

Escribir en código los contratos que van a compartir la API (NestJS), el trabajador de Python (tareas 06 y 07) y el frontend (Tarea 12):
- los enums;
- los esquemas;
- la función pura `required_documents(nivel)`;
- las tablas de transiciones permitidas.

**Sin lógica de negocio**: decidir clasificaciones, estados o permisos es trabajo de las tareas 08 a 11.

**Criterios de aceptación** (los de la issue):
- [ ] Esquemas y enums creados.
- [ ] `required_documents("pregrado")` devuelve 5 documentos y `required_documents("posgrado")` devuelve 3.
- [ ] Tabla de transiciones documentada.
- [ ] Pruebas unitarias en verde.
- [ ] Resumen final de lo verificado frente a lo simulado o pendiente.

## 2. Decisiones

| # | Tema | Decisión |
|---|---|---|
| 1 | Mecanismo (D5) | **Zod 4 en TypeScript como fuente única**, exportado a **JSON Schema** (draft 2020-12) para el lado de Python. |
| 2 | Lado de Python | En esta tarea solo se generan y se prueban los JSON Schema (con ajv, desde TypeScript). Python empieza a usarlos cuando exista el trabajador (Tarea 06); hoy no se agrega nada a Python. |
| 3 | Ubicación | Fuente en `backend/src/contratos/`. JSON Schema y ejemplos en `contratos/` en la raíz del repo, para que los lea el trabajador. |
| 4 | Nombres | Campos del JSON en inglés y snake_case, como en `document_strc.py`. Valores tal cual los dan `PROMPT_BASE` y las tareas. Comentarios y documentación en español. |
| 5 | `validation_status` | `pending`, `processing`, `completed`, `failed`. Es el procesamiento del documento; los reintentos pertenecen al trabajo (`JobStatus`). |
| 6 | Cierre de solicitudes | `closed` se alcanza desde `ready_for_formal_submission` y, como **cierre administrativo**, desde cualquier estado no final. |
| 7 | Regla de reenvío | `resubmission_allowed = true` ⇒ `required_action = upload_new_version`, con `resubmission_reason` obligatorio. `false` ⇒ cualquier acción **menos** `upload_new_version`, con `resubmission_reason = null`. |
| 8 | Identidad del estudiante | Los nombres y `code_student` van **dentro de `extracted_data`**, con su confianza, como cualquier dato leído. |
| 9 | Identificadores | **Texto** (opacos): `id_student`, `request_id`, `idempotency_key`. La Tarea 03 decide cómo se guardan. |

## 3. Archivos

```
backend/src/contratos/
├── enums.ts                  # todos los valores fijos (sección 4)
├── documentos.ts             # niveles, required_documents(nivel)
├── transiciones.ts           # tablas de transiciones + transicionPermitida()
├── comunes.ts                # fecha con zona, fecha local, confianza, identificadores
├── resultado-documento.ts    # RuleEvaluation, ExtractedValue, DocumentValidationResult
├── validacion-cruzada.ts     # CrossValidationResult
├── entrega.ts                # Submission, ResubmissionPolicy
├── respuesta-frontend.ts     # RequestResultResponse
├── exportar.ts               # escribe contratos/esquemas/*.json
└── index.ts                  # lo que importan los demás módulos
backend/src/contratos/*.spec.ts            # pruebas unitarias (Vitest)
contratos/esquemas/*.json     # JSON Schema exportados (generados, versionados)
contratos/ejemplos/<esquema>/{validos,invalidos}/*.json   # ejemplos compartidos
docs/contratos.md             # documentación de enums, esquemas y transiciones
```

- **Dependencias nuevas del backend:**
  - `zod` (4.x), como dependencia;
  - `ajv` (8.x) y `ajv-formats` (3.x), solo como dependencias de desarrollo, para las pruebas.
- **Comando nuevo:** `npm run contratos:exportar`, que regenera `contratos/esquemas/`.

## 4. Enums

| Enum | Valores |
|---|---|
| `TypeDocument` | `identification`, `academic_evaluation`, `paz_y_salvo_bib`, `estampilla_pro_cultura`, `saber_pro` |
| `AcademicLevel` | `pregrado`, `posgrado` |
| `JobStatus` | `queued`, `processing`, `completed`, `failed`, `retry_pending` |
| `RequestStatus` | `queued`, `processing`, `awaiting_review`, `correction_required`, `ready_for_formal_submission`, `closed` |
| `RuleResult` | `cumple`, `no_cumple`, `no_evaluable` |
| `DocumentClassification` | `valid`, `invalid`, `inconsistent`, `to_check` |
| `ValidationStatus` | `pending`, `processing`, `completed`, `failed` |
| `RequiredAction` | `none`, `upload_new_version`, `wait_for_review`, `wait_for_external_validation`, `wait_for_processing`, `correct_data`, `contact_administration` |
| `CrossValidationOutcome` | `confirmed_match`, `confirmed_mismatch`, `insufficient_information`, `source_pending`, `source_unavailable`, `manual_review_required` |
| `CrossValidationSource` | los 5 valores de `TypeDocument`, `application_data`, `banner`, `rui` |
| `SubmissionType` | `initial`, `resubmission` |

**`required_documents(nivel)`:** función pura y sin efectos. Devuelve una lista nueva cada vez, en este orden:
- `pregrado`: `identification`, `academic_evaluation`, `paz_y_salvo_bib`, `estampilla_pro_cultura`, `saber_pro`;
- `posgrado`: `identification`, `paz_y_salvo_bib`, `estampilla_pro_cultura`.

Un nivel que no exista es un error de validación, no una lista vacía.

## 5. Transiciones

Son **datos**: dicen qué cambio está permitido, no cuándo hacerlo. `transicionPermitida(de, a)` solo consulta la tabla. Una transición de un estado a sí mismo no está permitida.

**Solicitud (`RequestStatus`):**

| De | A |
|---|---|
| `queued` | `processing`, `closed` |
| `processing` | `awaiting_review`, `correction_required`, `ready_for_formal_submission`, `closed` |
| `awaiting_review` | `processing`, `correction_required`, `ready_for_formal_submission`, `closed` |
| `correction_required` | `queued`, `closed` |
| `ready_for_formal_submission` | `closed` |
| `closed` | ninguno (final) |

`ready_for_formal_submission` **no** es la aprobación oficial del grado (Tarea 10).

**Trabajo (`JobStatus`):**

| De | A |
|---|---|
| `queued` | `processing` |
| `processing` | `completed`, `failed`, `retry_pending` |
| `retry_pending` | `queued` |
| `completed`, `failed` | ninguno (finales) |

Las dos tablas también se exportan como JSON (`contratos/esquemas/transiciones.json`) para el trabajador.

## 6. Esquemas

**Tipos comunes:**
- **Fecha y hora:** ISO 8601 **con zona horaria** (`2026-10-14T09:30:00-05:00`).
- **Fecha local:** `AAAA-MM-DD`.
- **Confianza:** número entre 0 y 1.
- **Identificadores:** texto no vacío.
- **Todos los objetos son estrictos:** un campo desconocido es un error.

**`RuleEvaluation`:** `rule` · `result` (`RuleResult`) · `mandatory` (booleano) · `message` · `timestamp` · `errors[]` (texto).

**`ExtractedValue`:** `{ value: texto | número | booleano | null, confidence: confianza | null }`.
- Si el dato no se pudo extraer, `value` y `confidence` son `null`; nunca se inventa un valor (PROMPT_BASE).
- No puede haber `value` sin `confidence`, ni `confidence` sin `value`.

**`DocumentValidationResult`:**
- `id_student`, `type_document`, `document_version` (entero ≥ 1);
- `extracted_data`: un objeto de campo → `ExtractedValue`, donde se incluyen `first_name`, `second_name`, `last_name`, `second_last_name`, `code_student` y el número de identificación cuando aplique;
- `rules[]`, `errors[]`, `document_classification`, `validation_status`;
- `resubmission_allowed`, `resubmission_reason`, `required_action` (con la regla de la decisión 7);
- `validation_version` (versión del conjunto de reglas) y `timestamp`.

  La regla de reenvío se escribe como **dos variantes** del esquema, una por cada valor de `resubmission_allowed`. Así viaja dentro del JSON Schema (`oneOf` con `const`) y no depende de una función que el JSON Schema no puede llevar.

**`CrossValidationResult`:**
- `rule`, `rule_version`;
- `sources[]` (`CrossValidationSource`, al menos 2, sin repetidos) y `fields[]` (al menos 1);
- `outcome` (`CrossValidationOutcome`);
- `evidence[]`: `{source, field, value: texto | null, normalized_value: texto | null, document_version: entero ≥ 1 | null}`;
- `similarity` y `threshold` (confianza o `null`), `reason` (texto no vacío) y `evaluated_at`.

**`Submission`:**
- `idempotency_key`, `id_student`, `request_id`, `submission_type`;
- `submission_number` (entero ≥ 1);
- `resubmission_number`: 0 si es `initial`, ≥ 1 si es `resubmission` (dos variantes, igual que la regla de reenvío);
- `local_submission_date`, `submitted_at`;
- `documents[]`: `{type_document, document_version}`, al menos 1 y sin tipos repetidos.

El tope diario (3 reenvíos) es política de la Tarea 11 y no va en el esquema.

**`ResubmissionPolicy`:** `daily_limit`, `used_today` y `remaining_today` (enteros ≥ 0), `timezone` (solo `America/Bogota`), `local_date` y `next_available_date` (fecha local o `null`).

**`RequestResultResponse`** (lo que consume el frontend, Tarea 12):
- `request_id`, `id_student`, `level`, `status`, `status_reason` (texto o `null`);
- `processing`: `{status: JobStatus | null, updated_at: fecha y hora | null}`;
- `documents[]`, cada uno con:
  - `type_document`, `required`, `current_version` (entero ≥ 1 o `null`);
  - `classification` (o `null` si aún no hay resultado), `validation_status`;
  - `required_action`, `resubmission_allowed` y `resubmission_reason` (misma regla de la decisión 7);
  - `rules[]`, `errors[]` y `versions[]` (`{version, submitted_at}`);
- `comments[]`: `{author_role: "funcionario", text, created_at}`;
- `resubmission_policy` y `generated_at`.

## 7. Exportación y ejemplos compartidos

- **`npm run contratos:exportar`:** con `z.toJSONSchema()` escribe un archivo por esquema en `contratos/esquemas/`, más `enums.json`, `documentos-requeridos.json` y `transiciones.json`. Los archivos llevan `$id` y `title`, y se escriben en un orden estable para que el diff sea legible.
- **Prueba de desalineación:** genera los JSON Schema en memoria y los compara con los del repo. Si alguien cambia Zod sin exportar (o edita un `.json` a mano), falla.
- **Ejemplos:**
  - en `contratos/ejemplos/<esquema>/validos/` y `/invalidos/`, cada uno con un nombre que dice qué prueba (por ejemplo, `reenvio-permitido-sin-upload.json`);
  - todos son **datos sintéticos**, sin cédulas ni nombres reales.

## 8. Pruebas (Vitest, en `backend/`)

1. **Enums:** cada enum tiene exactamente los valores de la sección 4.
2. **`required_documents`:**
   - pregrado da 5 y posgrado da 3, en el orden indicado;
   - devuelve una copia (modificarla no afecta la siguiente llamada);
   - un nivel inválido falla.
3. **Transiciones:**
   - cada par permitido de las dos tablas da verdadero;
   - todo par no listado da falso, incluido un estado hacia sí mismo y cualquier salida de un estado final;
   - todo estado del enum aparece en la tabla.
4. **Esquemas:** cada ejemplo válido pasa con Zod y cada inválido falla. Casos obligatorios:
   - la regla de reenvío en sus dos sentidos;
   - `resubmission_reason` en las dos variantes;
   - un valor sin confianza;
   - una fecha sin zona horaria;
   - un campo desconocido;
   - `resubmission_number` contra `submission_type`;
   - fuentes repetidas en la validación cruzada.
5. **Paridad con JSON Schema:** los mismos ejemplos validados con **ajv** (`Ajv2020` + `ajv-formats`) contra los `.json` exportados dan **el mismo resultado** que Zod.
6. **Desalineación:** lo exportado coincide con `contratos/esquemas/`.

Las pruebas que ya existen en el backend no se tocan. Tres de ellas fallan desde antes (P2 del análisis); se reporta, no se arregla aquí.

## 9. Entrega

- Rama `tarea_02_contratos`, creada desde `main`.
- PR contra `main` con `Closes #6` y el resumen "verificado / simulado / pendiente".
- `docs/contratos.md` con los enums, los esquemas, un ejemplo válido de cada uno y las dos tablas de transiciones.

## 10. Fuera de alcance

- Decidir clasificaciones, estados o permisos: tareas 08 a 11.
- Usar los contratos en endpoints de NestJS (pipes de validación): Tarea 05 en adelante.
- Validar desde Python: Tarea 06.
- La base de datos: Tarea 03.
- Arreglar P1 a P6 del análisis.

## 11. Riesgos

- **`z.toJSONSchema` y las variantes:** las uniones discriminadas se exportan como `oneOf` o `anyOf`. La prueba de paridad con ajv comprueba que la regla de reenvío sobrevive a la exportación.
- **Instalación:** el lockfile del backend está desincronizado (P1), así que `npm ci` falla. Agregar dependencias con `npm install` regenera `package-lock.json`, y ese cambio va en este PR, explicado. Eso también corrige P1 como efecto colateral.
- **ESM:** el backend es `"type": "module"`. Los imports llevan la extensión `.js`, como en el código de Lisandro.
