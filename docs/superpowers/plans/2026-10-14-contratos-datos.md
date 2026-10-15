# Contratos de datos y enumeraciones (Tarea 02) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** contratos de CheckU en Zod 4 (enums, esquemas, `requiredDocuments`, tablas de transiciones), exportados a JSON Schema y probados con Vitest y ajv.

**Architecture:**
- **Fuente única:** `backend/src/contratos/` (Zod).
- **Exportación:** `generarEsquemas()` arma los JSON Schema y un comando los escribe en `contratos/esquemas/`, en la raíz.
- **Ejemplos:** los ejemplos válidos e inválidos de `contratos/ejemplos/` se validan con Zod y con ajv, y los dos tienen que coincidir.
- **Desalineación:** una prueba compara lo exportado con lo que está en el repo.

**Tech Stack:** NestJS 12 (ESM, `nodenext`), TypeScript, Zod 4.6, Vitest 4, ajv 8.20 (`Ajv2020`), ajv-formats 3.0.

**Spec:** `docs/superpowers/specs/2026-10-14-contratos-datos-design.md`

## Global Constraints

- **Dependencias:**
  - `zod` `^4.6.7` como dependencia;
  - `ajv` `^8.20.0` y `ajv-formats` `^3.0.1` solo en `devDependencies`;
  - ninguna otra dependencia.
- **ESM:** los imports relativos llevan extensión `.js` (`./enums.js`), como en el resto del backend.
- **Nombres en el JSON:** campos en inglés y snake_case. Valores copiados tal cual del spec (sección 4); los de `RuleResult` en español: `cumple`, `no_cumple`, `no_evaluable`.
- **Esquemas:**
  - todos los objetos son estrictos (`z.strictObject`): un campo desconocido es un error;
  - fecha y hora: `z.iso.datetime({ offset: true })` (acepta `Z` y `±HH:MM`, rechaza la hora sin zona);
  - fecha local: `z.iso.date()`;
  - confianza: número entre 0 y 1;
  - identificadores: `z.string().min(1)`;
  - `timezone`: solo `"America/Bogota"`.
- **Patrón de nombres:** constante de Zod y tipo inferido con el mismo nombre (`export const TypeDocument = z.enum([...]); export type TypeDocument = z.infer<typeof TypeDocument>;`).
- **Comentarios y documentación** en español.
- **Lo que no se toca:** `webapp/`, `modules/`, `firma_electronica/`, Python, y las pruebas que ya existen en el backend.
- **Ejemplos sintéticos:** sin cédulas, nombres ni datos reales.
- **Comandos:** todos se ejecutan desde `backend/`.

## Review Focus

1. **Confianza en los bordes:** `0` y `1` son válidos; `-0.1` y `1.2` no. Se prueba en la Tarea 3.
2. **Valores "falsos" extraídos:** `{value: 0, confidence: 0.9}` y `{value: false, confidence: 0.9}` son válidos; no se confunden con "no extraído". Tarea 3.
3. **Fechas:** `2026-10-14T14:30:00Z` y `2026-10-14T09:30:00-05:00` son válidas; `2026-10-14T09:30:00` (sin zona) no. Tarea 3.
4. **Texto vacío:** `id_student: ""` y `resubmission_reason: ""` (con reenvío permitido) son inválidos. Tarea 3.
5. **Copias de `requiredDocuments`:** modificar la lista devuelta no altera la siguiente llamada. Tarea 1.

---

### Task 1: Dependencias, enums y `requiredDocuments`

**Files:**
- Modify: `backend/package.json`, `backend/package-lock.json` (con `npm install zod@^4.6.7`)
- Create: `backend/src/contratos/enums.ts`, `backend/src/contratos/documentos.ts`
- Test: `backend/src/contratos/enums.spec.ts`, `backend/src/contratos/documentos.spec.ts`

**Interfaces:**
- Produces, desde `enums.ts`: `TypeDocument`, `AcademicLevel`, `JobStatus`, `RequestStatus`, `RuleResult`, `DocumentClassification`, `ValidationStatus`, `RequiredAction`, `CrossValidationOutcome`, `CrossValidationSource`, `SubmissionType`. Cada uno es una constante `z.enum([...])` más su tipo inferido.
- Produces, desde `documentos.ts`: `requiredDocuments(level: AcademicLevel): TypeDocument[]` (el `required_documents(level)` de la issue) y `DOCUMENTOS_POR_NIVEL: Readonly<Record<AcademicLevel, readonly TypeDocument[]>>`.

- [ ] **Step 1: Instalar Zod**

Run: `npm install zod@^4.6.7`
Expected: `zod` aparece en `dependencies` y `npm ci` sigue funcionando.

- [ ] **Step 2: Escribir las pruebas que fallan**

`enums.spec.ts`: un `it` por enum que compara `X.options` con la lista exacta de la sección 4 del spec, en ese orden. Por ejemplo:

```ts
expect(RequestStatus.options).toEqual(['queued', 'processing', 'awaiting_review', 'correction_required', 'ready_for_formal_submission', 'closed']);
expect(CrossValidationSource.options).toEqual(['identification', 'academic_evaluation', 'paz_y_salvo_bib', 'estampilla_pro_cultura', 'saber_pro', 'application_data', 'banner', 'rui']);
```

`documentos.spec.ts`:

```ts
it('pregrado pide 5 documentos en el orden del spec', () =>
  expect(requiredDocuments('pregrado')).toEqual(['identification', 'academic_evaluation', 'paz_y_salvo_bib', 'estampilla_pro_cultura', 'saber_pro']));
it('posgrado pide 3', () =>
  expect(requiredDocuments('posgrado')).toEqual(['identification', 'paz_y_salvo_bib', 'estampilla_pro_cultura']));
it('devuelve una copia: modificarla no cambia la siguiente llamada', () => {
  requiredDocuments('posgrado').push('saber_pro');
  expect(requiredDocuments('posgrado')).toHaveLength(3);
});
it('un nivel inválido es un error', () =>
  expect(() => requiredDocuments('doctorado' as AcademicLevel)).toThrow());
```

- [ ] **Step 3: Verificar que fallan**

Run: `npx vitest run src/contratos`
Expected: FAIL, porque no existen `./enums.js` ni `./documentos.js`.

- [ ] **Step 4: Implementar `enums.ts` y `documentos.ts`**

`requiredDocuments` valida el nivel con `AcademicLevel.parse(level)` y devuelve `[...DOCUMENTOS_POR_NIVEL[level]]`.

- [ ] **Step 5: Verificar que pasan**

Run: `npx vitest run src/contratos`
Expected: PASS.

- [ ] **Step 6: Commit**

`git add backend/package.json backend/package-lock.json backend/src/contratos/` · mensaje: `Tarea 02: enums y requiredDocuments` (con `Refs #6` y la línea Co-Authored-By del repo).

### Task 2: Tablas de transiciones

**Files:**
- Create: `backend/src/contratos/transiciones.ts`
- Test: `backend/src/contratos/transiciones.spec.ts`

**Interfaces:**
- Consumes: `RequestStatus`, `JobStatus` (Tarea 1).
- Produces:
  - `TRANSICIONES_SOLICITUD: Readonly<Record<RequestStatus, readonly RequestStatus[]>>`
  - `TRANSICIONES_TRABAJO: Readonly<Record<JobStatus, readonly JobStatus[]>>`
  - `transicionSolicitudPermitida(de: RequestStatus, a: RequestStatus): boolean`
  - `transicionTrabajoPermitida(de: JobStatus, a: JobStatus): boolean`

- [ ] **Step 1: Escribir las pruebas que fallan**

- **Tabla completa:** los pares permitidos son exactamente los de la sección 5 del spec. Para cada tabla, `it.each` sobre todos los pares (de, a) del producto cartesiano del enum consigo mismo, y se espera `true` solo si el par está en esta lista:

```ts
const PERMITIDAS_SOLICITUD = {
  queued: ['processing', 'closed'],
  processing: ['awaiting_review', 'correction_required', 'ready_for_formal_submission', 'closed'],
  awaiting_review: ['processing', 'correction_required', 'ready_for_formal_submission', 'closed'],
  correction_required: ['queued', 'closed'],
  ready_for_formal_submission: ['closed'],
  closed: [],
};
const PERMITIDAS_TRABAJO = {
  queued: ['processing'],
  processing: ['completed', 'failed', 'retry_pending'],
  retry_pending: ['queued'],
  completed: [],
  failed: [],
};
```

- **Cobertura:** `Object.keys(TRANSICIONES_SOLICITUD)` contiene todos los `RequestStatus.options`, e igual para el trabajo.
- **Sin transición a sí mismo:** ningún estado aparece en su propia lista.

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run src/contratos/transiciones.spec.ts`
Expected: FAIL, porque no existe el módulo.

- [ ] **Step 3: Implementar `transiciones.ts`**

Las tablas como objetos congelados (`Object.freeze`). Las funciones solo consultan `tabla[de].includes(a)`.

- [ ] **Step 4: Verificar que pasan**

Run: `npx vitest run src/contratos/transiciones.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Mensaje: `Tarea 02: tablas de transiciones de solicitud y trabajo`.

### Task 3: Tipos comunes, regla de reenvío y `DocumentValidationResult`

**Files:**
- Create:
  - `backend/src/contratos/comunes.ts`
  - `backend/src/contratos/resultado-documento.ts`
  - `backend/test/soporte/ejemplos.ts`
  - `contratos/ejemplos/document-validation-result/{validos,invalidos}/*.json`
  - `contratos/ejemplos/rule-evaluation/{validos,invalidos}/*.json`
- Test: `backend/src/contratos/resultado-documento.spec.ts`

**Interfaces:**
- Consumes: los enums (Tarea 1).
- Produces:
  - **En `comunes.ts`:** `FechaHora` (`z.iso.datetime({offset:true})`), `FechaLocal` (`z.iso.date()`), `Confianza` (`z.number().min(0).max(1)`), `Identificador` (`z.string().min(1)`), `TextoNoVacio` (`z.string().trim().min(1)`), y `sinRepetidos<T extends z.ZodArray>(arreglo: T): T`. Esta última agrega un `refine` de unicidad y registra el esquema en el `Set` exportado `ESQUEMAS_SIN_REPETIDOS`, para que la exportación ponga `uniqueItems: true`.
  - **En `comunes.ts`:** `conReglaDeReenvio<S extends z.ZodRawShape>(base: S)`, que devuelve `z.discriminatedUnion('resubmission_allowed', [...])` con dos variantes estrictas sobre `base`:
    - `{resubmission_allowed: true, required_action: 'upload_new_version', resubmission_reason: TextoNoVacio}`;
    - `{resubmission_allowed: false, required_action: RequiredAction.exclude(['upload_new_version']), resubmission_reason: null}`.
  - **En `resultado-documento.ts`:** `RuleEvaluation`, `ExtractedValue`, `DocumentValidationResult` (constantes Zod con su tipo).
    - `ExtractedValue` es la unión de `{value: null, confidence: null}` y `{value: string | number | boolean, confidence: Confianza}`.
    - `extracted_data` es `z.record(z.string().min(1), ExtractedValue)`.
  - **En `backend/test/soporte/ejemplos.ts`:** `cargarEjemplos(esquema: string): { validos: Ejemplo[]; invalidos: Ejemplo[] }`, con `type Ejemplo = { archivo: string; datos: unknown }`. Lee `contratos/ejemplos/<esquema>/` desde la raíz del repo con `fileURLToPath(new URL('../../../contratos/ejemplos/', import.meta.url))`.

- [ ] **Step 1: Crear los ejemplos (datos sintéticos)**

**`rule-evaluation/validos/`:**
- `cumple.json`: `{"rule":"identification_number_present","result":"cumple","mandatory":true,"message":"Número leído","timestamp":"2026-10-14T09:30:00-05:00","errors":[]}`.
- `no-evaluable-con-error.json`.

**`rule-evaluation/invalidos/`:**
- `resultado-desconocido.json`, con `"result":"aprobada"`;
- `fecha-sin-zona.json`, con `"2026-10-14T09:30:00"`;
- `campo-extra.json`.

**`document-validation-result/validos/`:**
- `valido-sin-reenvio.json`: `resubmission_allowed:false`, `required_action:"none"`, `resubmission_reason:null`, `extracted_data` con `first_name`, `last_name` y `code_student` de nombres inventados, y `confidence` 0.93;
- `reenvio-permitido.json`: `true` + `upload_new_version` + motivo;
- `dato-no-extraido.json`: un campo con `{"value":null,"confidence":null}`;
- `valores-falsos-con-confianza.json`: `{"value":0,"confidence":0.9}` y `{"value":false,"confidence":0.9}`;
- `confianza-en-bordes.json`: confianzas 0 y 1;
- `fecha-utc.json`: `timestamp` con `Z`.

**`document-validation-result/invalidos/`:**
- `reenvio-sin-upload.json`: `true` + `none`;
- `upload-sin-reenvio.json`: `false` + `upload_new_version`;
- `reenvio-sin-motivo.json`: `true` + `resubmission_reason:""`;
- `no-reenvio-con-motivo.json`: `false` + motivo de texto;
- `valor-sin-confianza.json`: `{"value":"Ana","confidence":null}`;
- `confianza-sin-valor.json`: `{"value":null,"confidence":0.5}`;
- `confianza-fuera-de-rango.json`: 1.2;
- `confianza-negativa.json`: -0.1;
- `id-vacio.json`: `id_student:""`;
- `version-cero.json`: `document_version:0`;
- `clasificacion-desconocida.json`;
- `fecha-sin-zona.json`;
- `campo-extra.json`.

- [ ] **Step 2: Escribir las pruebas que fallan**

```ts
for (const [nombre, esquema] of [['rule-evaluation', RuleEvaluation], ['document-validation-result', DocumentValidationResult]] as const) {
  const { validos, invalidos } = cargarEjemplos(nombre);
  it.each(validos)(`${nombre} acepta $archivo`, ({ datos }) => expect(esquema.safeParse(datos).success).toBe(true));
  it.each(invalidos)(`${nombre} rechaza $archivo`, ({ datos }) => expect(esquema.safeParse(datos).success).toBe(false));
}
it('cada carpeta tiene al menos un válido y un inválido', ...);
```

- [ ] **Step 3: Verificar que fallan**

Run: `npx vitest run src/contratos/resultado-documento.spec.ts`
Expected: FAIL, porque no existe el módulo.

- [ ] **Step 4: Implementar `comunes.ts` y `resultado-documento.ts`**

`DocumentValidationResult = conReglaDeReenvio({...})`, con estos campos de la sección 6 del spec:
- `id_student`, `type_document`, `document_version` (`z.number().int().min(1)`), `extracted_data`;
- `rules` (`z.array(RuleEvaluation)`), `errors` (`z.array(z.string())`);
- `document_classification`, `validation_status`, `validation_version` (`Identificador`) y `timestamp`.

- [ ] **Step 5: Verificar que pasan**

Run: `npx vitest run src/contratos`
Expected: PASS.

- [ ] **Step 6: Commit**

Mensaje: `Tarea 02: DocumentValidationResult con la regla de reenvío`.

### Task 4: Validación cruzada, entrega y política de reenvíos

**Files:**
- Create:
  - `backend/src/contratos/validacion-cruzada.ts`, `backend/src/contratos/entrega.ts`
  - los ejemplos en `contratos/ejemplos/{cross-validation-result,submission,resubmission-policy}/`
- Test: `backend/src/contratos/validacion-cruzada.spec.ts`, `backend/src/contratos/entrega.spec.ts`

**Interfaces:**
- Consumes: los enums (Tarea 1); `FechaHora`, `FechaLocal`, `Confianza`, `Identificador`, `TextoNoVacio`, `sinRepetidos` (Tarea 3); `cargarEjemplos` (Tarea 3).
- Produces: `CrossValidationResult`, `Submission` y `ResubmissionPolicy` (constantes Zod con su tipo).
  - **`Submission`:** `z.discriminatedUnion('submission_type', ...)`.
    - Las dos variantes: `initial` con `resubmission_number: z.literal(0)`, y `resubmission` con `z.number().int().min(1)`.
    - `documents`: al menos 1, con un `refine` que no admite `type_document` repetidos.
  - **`CrossValidationResult.sources`:** `sinRepetidos(z.array(CrossValidationSource).min(2))`.

- [ ] **Step 1: Crear los ejemplos**

**`cross-validation-result`:**
- válidos: `coincidencia.json`, `fuente-pendiente.json` (Banner `source_pending`, con `similarity:null`);
- inválidos:
  - `fuentes-repetidas.json`, con `["identification","identification"]`;
  - `una-sola-fuente.json`;
  - `sin-campos.json`;
  - `motivo-vacio.json`;
  - `resultado-desconocido.json`.

**`submission`:**
- válidos: `entrega-inicial.json` (`resubmission_number:0`), `reenvio.json` (`resubmission_number:2`);
- inválidos:
  - `inicial-con-reenvio.json` (`initial` con 1);
  - `reenvio-cero.json` (`resubmission` con 0);
  - `sin-documentos.json`;
  - `documentos-repetidos.json` (dos `identification`);
  - `fecha-local-invalida.json` (`"14/10/2026"`).

**`resubmission-policy`:**
- válidos: `con-cupo.json` (3/1/2), `agotado.json` (`remaining_today:0`, con `next_available_date`);
- inválidos: `otra-zona.json` (`"America/Lima"`), `negativo.json`.

- [ ] **Step 2: Escribir las pruebas que fallan**

El mismo patrón de `it.each` de la Tarea 3, para los tres esquemas.

- [ ] **Step 3: Verificar que fallan**

Run: `npx vitest run src/contratos`
Expected: FAIL, porque no existen los módulos.

- [ ] **Step 4: Implementar `validacion-cruzada.ts` y `entrega.ts`**

Campos según la sección 6 del spec. `evidence[]` es estricto: `{source, field, value: string | null, normalized_value: string | null, document_version: entero ≥ 1 | null}`.

- [ ] **Step 5: Verificar que pasan**

Run: `npx vitest run src/contratos`
Expected: PASS.

- [ ] **Step 6: Commit**

Mensaje: `Tarea 02: validación cruzada, entrega y política de reenvíos`.

### Task 5: Respuesta para el frontend e `index.ts`

**Files:**
- Create:
  - `backend/src/contratos/respuesta-frontend.ts`, `backend/src/contratos/index.ts`
  - los ejemplos en `contratos/ejemplos/request-result-response/`
- Test: `backend/src/contratos/respuesta-frontend.spec.ts`

**Interfaces:**
- Consumes: `conReglaDeReenvio`, `RuleEvaluation`, `ResubmissionPolicy`, los enums y los tipos comunes.
- Produces: `RequestResultResponse`. `index.ts` reexporta todo lo público de `enums`, `documentos`, `transiciones`, `comunes`, `resultado-documento`, `validacion-cruzada`, `entrega` y `respuesta-frontend`.

- [ ] **Step 1: Crear los ejemplos**

**Válidos:**
- `en-revision.json`: pregrado, 5 documentos, uno con `classification:null` y `validation_status:"processing"`;
- `correccion-requerida.json`: un documento con reenvío permitido, `comments` y la política con cupo.

**Inválidos:**
- `documento-con-upload-sin-reenvio.json`;
- `estado-desconocido.json`;
- `comentario-de-estudiante.json` (`author_role:"estudiante"`);
- `sin-politica.json`.

- [ ] **Step 2: Escribir las pruebas que fallan**

El patrón de `it.each`, más una prueba que importa desde `./index.js` y comprueba que exporta `requiredDocuments`, `transicionSolicitudPermitida`, `DocumentValidationResult` y `RequestResultResponse`.

- [ ] **Step 3: Verificar que fallan**

Run: `npx vitest run src/contratos`
Expected: FAIL.

- [ ] **Step 4: Implementar `respuesta-frontend.ts` e `index.ts`**

Cada elemento de `documents` es `conReglaDeReenvio({...})` con los campos de la sección 6. `comments[].author_role` es `z.literal('funcionario')`.

- [ ] **Step 5: Verificar que pasan**

Run: `npx vitest run src/contratos`
Expected: PASS.

- [ ] **Step 6: Commit**

Mensaje: `Tarea 02: contrato de respuesta para el frontend`.

### Task 6: Exportación a JSON Schema, paridad con ajv y desalineación

**Files:**
- Modify: `backend/package.json`:
  - devDependencies `ajv@^8.20.0` y `ajv-formats@^3.0.1`;
  - script `"contratos:exportar": "nest build && node dist/contratos/exportar-cli.js"`.
- Create:
  - `backend/src/contratos/exportar.ts`, `backend/src/contratos/exportar-cli.ts`
  - `contratos/esquemas/*.json` (generados)
- Test: `backend/src/contratos/exportar.spec.ts`

**Interfaces:**
- Consumes: todos los esquemas y las tablas (Tareas 1-5), `ESQUEMAS_SIN_REPETIDOS` (Tarea 3) y `cargarEjemplos` (Tarea 3).
- Produces:
  - `ESQUEMAS_CONTRATO: Readonly<Record<string, z.ZodType>>`, con las claves `rule-evaluation`, `document-validation-result`, `cross-validation-result`, `submission`, `resubmission-policy` y `request-result-response`. Son las mismas que las carpetas de ejemplos.
  - `generarEsquemas(): Record<string, unknown>`, cuyas claves son nombres de archivo:
    - `<clave>.schema.json`: `z.toJSONSchema(esquema, { override })` con `$id: "https://checku.iscoutb.dev/contratos/<clave>.schema.json"` y `title`; el `override` pone `uniqueItems: true` en los esquemas de `ESQUEMAS_SIN_REPETIDOS`;
    - `enums.json`: nombre del enum → valores;
    - `documentos-requeridos.json`: `{pregrado: [...], posgrado: [...]}`;
    - `transiciones.json`: `{solicitud: {...}, trabajo: {...}}`.
  - `exportar-cli.ts` escribe cada entrada con `JSON.stringify(valor, null, 2) + '\n'` en `<raíz del repo>/contratos/esquemas/`. La ruta sale de `process.cwd()`, que es `backend/`, más `..`.

- [ ] **Step 1: Instalar ajv**

Run: `npm install -D ajv@^8.20.0 ajv-formats@^3.0.1`
Expected: los dos quedan en `devDependencies` y `npm ci` sigue funcionando.

- [ ] **Step 2: Escribir las pruebas que fallan**

**Desalineación:** para cada clave de `generarEsquemas()`, el archivo `contratos/esquemas/<clave>` existe y su JSON es `toEqual` al generado. Además, la carpeta no tiene archivos que `generarEsquemas()` no produzca.

**Paridad:** para cada clave de `ESQUEMAS_CONTRATO` y cada ejemplo de `cargarEjemplos(clave)`, compilar el JSON Schema exportado y comparar:

```ts
const ajv = new Ajv2020({ strict: true, allErrors: true }); addFormats(ajv);
// Lo que JSON Schema no puede expresar ("sin tipos repetidos" en documentos que difieren en la versión):
const SOLO_ZOD = new Set(['submission/invalidos/documentos-repetidos.json']);
expect(validarAjv(datos)).toBe(SOLO_ZOD.has(ruta) ? true : zod.safeParse(datos).success);
```

**Regla de reenvío exportada:** `document-validation-result.schema.json` tiene `oneOf` con 2 variantes.

**Imports con ESM** (comprobados): `import { Ajv2020 } from 'ajv/dist/2020.js'`. `ajv-formats` se toma de su `default` (`import * as m from 'ajv-formats'`, y luego `m.default.default ?? m.default`). Si TypeScript se queja de los tipos, se usa un `createRequire`.

- [ ] **Step 3: Verificar que fallan**

Run: `npx vitest run src/contratos/exportar.spec.ts`
Expected: FAIL, porque no existen `./exportar.js` ni `contratos/esquemas/`.

- [ ] **Step 4: Implementar `exportar.ts` y `exportar-cli.ts`, y generar los archivos**

Run: `npm run contratos:exportar`
Expected: crea `contratos/esquemas/` con 6 archivos `.schema.json` más `enums.json`, `documentos-requeridos.json` y `transiciones.json`.

- [ ] **Step 5: Verificar que pasan**

Run: `npx vitest run src/contratos`
Expected: PASS. Si un ejemplo da distinto en Zod y ajv y no está en `SOLO_ZOD`, se corrige el esquema, no la prueba.

- [ ] **Step 6: Commit**

Mensaje: `Tarea 02: exportación a JSON Schema y paridad con ajv`.

### Task 7: Documentación y verificación completa

**Files:**
- Create: `docs/contratos.md`
- Modify: `backend/README.md`, para agregar la sección "Contratos" con el comando `npm run contratos:exportar` y la regla de exportar después de cambiar Zod.

**Interfaces:**
- Consumes: todo lo anterior.

- [ ] **Step 1: Escribir `docs/contratos.md`**

Debe tener:
- los enums con sus valores;
- un resumen de cada esquema, con un ejemplo válido sacado de `contratos/ejemplos/`;
- las dos tablas de transiciones;
- la regla de reenvío;
- la excepción `SOLO_ZOD` y la obligación del trabajador de Python de comprobarla;
- cómo se exporta y por qué falla la prueba de desalineación.

- [ ] **Step 2: Verificación completa**

Run: `npm ci && npm test && npm run test:e2e && npm run lint && npm run build`
Expected: todo con código 0. Las pruebas de `src/contratos` se suman a las 13 unitarias que ya existían, y las 6 e2e siguen en verde.

- [ ] **Step 3: Commit**

Mensaje: `Tarea 02: documentación de los contratos`.
