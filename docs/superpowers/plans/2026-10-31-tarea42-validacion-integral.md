# Tarea 42: validación integral y dashboard — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que cada solicitud de preinscripción tenga un estado real, calculado de sus documentos (42a),
y que el dashboard de la funcionaria lo muestre en contadores, gráficas y listado (42b–42d).

**Architecture:** una configuración de documentos requeridos y una función pura de cálculo en el
backend; `recalcularEstado` las aplica dentro de la misma transacción del envío, del reenvío y de la
resolución manual. Paz y Salvo sale de un `BibliotecaService` simulado. Un servicio periódico
recalcula las filas viejas y anula al cierre. El dashboard consume los estados nuevos.

**Tech Stack:**
- Backend: NestJS 11 ESM, `pg`, vitest 4, y PGlite para las pruebas e2e con el SQL real.
- Frontend: Next.js 16 con Playwright y axe.
- Base: PostgreSQL ≥ 14.

**Spec:** `docs/superpowers/specs/2026-10-31-tarea42-validacion-integral-design.md`

## Global Constraints

- Ningún dato real en el repo: códigos, nombres y documentos de prueba son inventados. El único
  código conocido es `T00000001`, el de `02-userbase.sql`.
- Nunca merge a `main`. PR 1 (`tarea_42a_validacion_integral`, Tareas 1–9) y PR 2
  (`tarea_42bcd_dashboard`, apilada sobre la primera, Tareas 10–11).
- Las fechas institucionales se calculan en `America/Bogota`, en SQL con `AT TIME ZONE` o con
  `fechaInstitucional()` de `periodos/asignacion-periodo.ts`.
- Mensajes al usuario en español, con el tono de los existentes.
- Commits con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `npm ci` del backend con npm 11: `npx -y npm@11 ci`. Las pruebas del frontend necesitan
  `frontend/.env.local`, que es una copia de `.env.example` y no se sube.
- Cada cambio se referencia en un comentario aparte en #102. Héctor aprueba el texto antes de
  publicarlo.

## Review Focus

1. **El plazo cerca de la medianoche.** Un reenvío a las 23:30 de Bogotá del día `fecha_fin − 7` (en
   UTC ya es el día siguiente) debe permitirse. La prueba está en la Tarea 6, con `dentroDelPlazo`.
2. **Biblioteca falla o tarda.** Si la consulta lanza un error, Paz y Salvo queda `POR_REVISAR` y el
   envío no se revierte. La prueba está en la Tarea 4.
3. **La funcionaria resuelve una versión vieja mientras el estudiante reenvía.** La resolución
   bloquea la solicitud con `FOR UPDATE` y rechaza con 409 si el documento ya no es la versión
   actual. La prueba está en la Tarea 7.
4. **Filas viejas `EN_PROCESO` sin documentos o sin programas.** Al recalcularlas quedan
   `POR_REVISAR` sin lanzar error. La prueba está en la Tarea 8.
5. **La anulación al cierre se repite o alcanza otros estados.** Correr el barrido dos veces deja una
   sola notificación y no toca `POR_REVISAR`, `VALIDA` ni `ACEPTADA`. La prueba está en la Tarea 8.

---

## Archivos

| Archivo | Responsabilidad |
|---|---|
| `db/migrations/008-estado-solicitud.sql` (nuevo), `db/init/01-schema.sql` | CHECKs con `ACEPTADA`, `MANUAL` y `DOCUMENTO_RESUELTO`; rama nueva de `notificar_revision`. |
| `backend/src/solicitudes/requisitos-documentales.ts` (nuevo) | La configuración por tipo de solicitud y las claves de transporte. |
| `backend/src/solicitudes/estado-solicitud.ts` (nuevo) | `calcularEstadoSolicitud`, pura. |
| `backend/src/solicitudes/recalcular-estado.ts` (nuevo) | `recalcularEstado(client, id)`: lee, calcula y guarda. |
| `backend/src/biblioteca/*` (nuevo) | `BibliotecaService`, `BibliotecaDemoService`, `paz-y-salvo-demo.json` y el módulo. |
| `backend/src/solicitudes/plazos-solicitud.service.ts` (nuevo) | El barrido periódico: recalcular las filas viejas y anular al cierre. |
| `backend/src/solicitudes/resoluciones.service.ts` (nuevo) | La resolución manual de un documento por revisar. |
| `backend/test/validacion-integral.e2e-spec.ts` (nuevo) | Las pruebas de integración de la Tarea 42 sobre PGlite. |

---

## PR 1: 42a

### Task 1: Migración 008

**Files:**
- Create: `db/migrations/008-estado-solicitud.sql`
- Modify: `db/init/01-schema.sql` (`chk_estado_solicitud` en la línea 53, `chk_validacion_tipo` en
  la 220, `chk_revision_resultado` en la 261, `notificar_revision()` en las 708–733), `db/README.md`,
  `db/tests/aceptacion.sql`, `backend/test/soporte/db-borrador.ts`
- Test: `backend/test/validacion-integral.e2e-spec.ts`

**Interfaces:**
- Produces:
  - `solicitud_grado.estado` admite `'ACEPTADA'`;
  - `validaciones.tipo_validacion` admite `'MANUAL'`;
  - `revisiones.resultado` admite `'DOCUMENTO_RESUELTO'`;
  - un `INSERT` en `revisiones` con `DOCUMENTO_RESUELTO` y un solo documento crea la notificación.

- [ ] **Step 1: Write the failing test.** En el `describe('Tarea 42: esquema')` de
  `validacion-integral.e2e-spec.ts`, con `crearDbBorrador()`:
  - `it('acepta ACEPTADA y rechaza un estado desconocido')`: el `INSERT` con `'ACEPTADA'` funciona;
    con `'APROBADA'`, `rejects.toThrow(/chk_estado_solicitud/)`.
  - `it('una resolución manual notifica al estudiante')`: crea una solicitud, un documento
    `identification` con estado `VALIDO` y una entrega. Inserta una revisión
    `('DOCUMENTO_RESUELTO', 'Revisado contra el original', ARRAY[id_documento])` con el funcionario
    2. Espera una notificación del estudiante 1 con `tipo='success'`,
    `titulo='Documento validado'`, `generado_por='funcionario'` y un `msg` que contiene
    `Documento de identidad`.
  - Con el documento en `NO_VALIDO`, espera `tipo='error'` y `titulo='Documento no válido'`.
  - Si la revisión no trae exactamente un documento: `rejects.toThrow(/un documento/)`.
- [ ] **Step 2: Run it.** `cd backend && npx vitest run --config ./vitest.config.e2e.ts test/validacion-integral.e2e-spec.ts`.
  Expected: FAIL por `chk_estado_solicitud`.
- [ ] **Step 3: Implement.**
  - **008:** idempotente, entre `BEGIN; … COMMIT;`, como 007. Hace `DROP CONSTRAINT IF EXISTS` y
    `ADD CONSTRAINT` de los tres CHECK, y `CREATE OR REPLACE FUNCTION notificar_revision()`.
  - **La rama nueva de `notificar_revision()`:**
    - con `cardinality(documentos_ids) <> 1`, `RAISE EXCEPTION 'La resolución debe indicar un
      documento'`;
    - toma `d.estado` y `nombre_documento_notificacion(d.tipo_documento, d.orden)`;
    - si el estado es `VALIDO`: `success`, «Documento validado», mensaje «La funcionaria validó:
      {nombre}.»;
    - si no: `error`, «Documento no válido», mensaje «La funcionaria marcó como no válido: {nombre}.
      {comentario}».
  - **`01-schema.sql`:** el mismo cambio, para que una instalación nueva quede igual.
  - **`db-borrador.ts`:** ejecuta 008 después de 02, para probar que se puede repetir.
  - **`aceptacion.sql`:** agrega los nuevos valores válidos y un rechazo.
  - **`db/README.md`:** lista 007 y 008.
- [ ] **Step 4: Run it.** Mismo comando. Expected: PASS. Corre también la suite e2e completa
  (`npx vitest run --config ./vitest.config.e2e.ts`). Expected: 102 pasan.
- [ ] **Step 5: Commit** «Tarea 42a: estados ACEPTADA y resolución manual en la base».

### Task 2: Configuración de documentos requeridos

**Files:**
- Create: `backend/src/solicitudes/requisitos-documentales.ts`, `…/requisitos-documentales.spec.ts`
- Modify:
  - `backend/src/solicitudes/solicitudes.service.ts`: borra `DOCUMENTOS_REQUERIDOS_*` (40–52) y usa
    la configuración en `enviarPreinscripcion` (154–175), en `validarRequisitosCompletos` (777–815)
    y en `normalizarTipoDocumento`;
  - `backend/src/solicitudes/analisis-preinscripcion.service.ts`: `validarArchivos` (30–63);
  - `backend/src/solicitudes/reenvios.service.ts:73`;
  - `backend/src/solicitudes/solicitudes.controller.ts:74,153`: `FilesInterceptor('documentos', 7, …)`;
  - `backend/src/documentos/validar-solicitud.ts` y su uso en `analisis-documental.service.ts`.

**Interfaces:**
- Produces (en `requisitos-documentales.ts`):
  ```ts
  export type TipoSolicitud = 'PREGRADO_UN_PROGRAMA' | 'PREGRADO_DOBLE_PROGRAMA' | 'POSGRADO';
  export interface DocumentoRequerido { tipo: TypeDocument; orden: 1 | 2 }
  export const DOCUMENTOS_POR_TIPO: Readonly<Record<TipoSolicitud, readonly DocumentoRequerido[]>>;
  export const MAXIMO_DOCUMENTOS: number; // 7: el mayor total
  export function tipoSolicitud(nivel: string, doblePrograma: boolean): TipoSolicitud; // lanza BadRequestException si el nivel no es PREGRADO/POSGRADO
  export function documentosRequeridos(nivel: string, doblePrograma: boolean): readonly DocumentoRequerido[];
  export function claveDocumento(d: { tipo: string; orden: number }): string; // orden 2 → `${tipo}-2`
  export function leerClave(clave: string): { tipo: string; orden: 1 | 2 } | null;
  export function admiteSegundo(tipo: string): boolean; // true solo para academic_evaluation y estampilla_pro_cultura
  ```
  `doblePrograma` no tiene efecto en `POSGRADO`.

- [ ] **Step 1: Write the failing tests** en `requisitos-documentales.spec.ts`:
  - `it('pregrado de un programa pide 5, doble programa 7 y posgrado 3')`: compara
    `documentosRequeridos(...).map(claveDocumento)` con los arreglos exactos de la tabla del
    spec §4.1, en ese orden. Doble programa:
    `['identification','academic_evaluation','academic_evaluation-2','paz_y_salvo_bib','estampilla_pro_cultura','estampilla_pro_cultura-2','saber_pro']`.
  - `it('posgrado ignora el doble programa')`.
  - `it('leerClave reconoce -2 solo en los tipos que admiten segundo')`: `saber_pro-2` → `null`.
  - En el `describe('validarArchivos')` del mismo archivo (lo importa de
    `analisis-preinscripcion.service.ts`):
    - acepta 7 PDF del doble programa;
    - rechaza `saber_pro-2` y 8 archivos con «Tipos documentales inválidos o repetidos.» y «Adjunta
      nuevamente…» respectivamente.
- [ ] **Step 2: Run it.** `cd backend && npx vitest run src/solicitudes/requisitos-documentales.spec.ts`.
  Expected: FAIL (el módulo no existe).
- [ ] **Step 3: Implement.**
  - `validarArchivos` usa `leerClave` y `MAXIMO_DOCUMENTOS`, y conserva sus mensajes.
  - `enviarPreinscripcion` calcula `esperados` con
    `documentosRequeridos(datos.nivel, datos.nivel === 'PREGRADO' && datos.segundoPrograma === true).map(claveDocumento)`.
  - `validarRequisitosCompletos` exige cada `{tipo, orden}` requerido. El doble programa sale de
    `hayPrograma2`, como hoy. Por cada faltante de orden 2 el mensaje dice
    `'{tipo} (segundo programa)'`.
  - `normalizarTipoDocumento` acepta `academic_evaluation-2`.
  - `reenvios.service.ts` limita a `MAXIMO_DOCUMENTOS`.
  - `validar-solicitud.ts` traduce sus nombres de formulario viejos (`cedula`, `evaluacion_grado`,
    `paz_y_salvo`, `estampilla`, `saber_pro`) desde `documentosRequeridos(nivel, false)`. Así
    pregrado pide 5, incluido `paz_y_salvo`.
- [ ] **Step 4: Run it.** `cd backend && npx vitest run`. Expected: todo pasa. Las pruebas de
  `solicitudes.service.spec.ts` o del controlador que esperaban 4 documentos de pregrado en
  `/documentos/analizar` se ajustan a 5 en este mismo paso.
- [ ] **Step 5: Commit** «Tarea 42a: una sola configuración de documentos requeridos».

### Task 3: Cálculo del estado

**Files:**
- Create: `backend/src/solicitudes/estado-solicitud.ts`, `…/estado-solicitud.spec.ts`,
  `backend/src/solicitudes/recalcular-estado.ts`

**Interfaces:**
- Consumes: `documentosRequeridos`, `DocumentoRequerido` (Tarea 2).
- Produces:
  ```ts
  // estado-solicitud.ts
  export type EstadoCalculado = 'VALIDA' | 'NO_VALIDA' | 'INCONSISTENTE' | 'POR_REVISAR';
  export interface DocumentoActual { tipo: string; orden: number; version: number; estado: string }
  export function calcularEstadoSolicitud(requeridos: readonly DocumentoRequerido[], documentos: readonly DocumentoActual[]): EstadoCalculado;
  // recalcular-estado.ts
  export const ESTADOS_FINALES: readonly string[]; // ['ACEPTADA', 'CERRADA']
  export async function recalcularEstado(client: PoolClient, idSolicitud: number): Promise<string>;
  ```
  `calcularEstadoSolicitud` toma la mayor `version` por (tipo, orden) e ignora lo que no es
  requerido. `recalcularEstado` hace lo siguiente:
  1. lee la solicitud con `FOR UPDATE`;
  2. si está en `BORRADOR` o en un estado final, la devuelve sin cambios;
  3. lee `tipo_solicitud` y si existe un programa de orden 2, y con eso arma
     `documentosRequeridos(tipo, doble)`;
  4. lee los documentos con `id_entrega IS NOT NULL`;
  5. hace `UPDATE estado, fecha_actualizacion` y devuelve el estado nuevo.

- [ ] **Step 1: Write the failing tests** (`estado-solicitud.spec.ts`), con `it.each` sobre los
  casos de la issue. `doc(tipo, estado, orden=1, version=1)` es un ayudante local.

  | Caso | Documentos | Esperado |
  |---|---|---|
  | Posgrado, 3 válidos | `identification`, `paz_y_salvo_bib`, `estampilla_pro_cultura` VALIDO | `VALIDA` |
  | Posgrado sin estampilla | los dos primeros VALIDO | `POR_REVISAR` |
  | Pregrado 1, Saber Pro con 95 | los 5 VALIDO salvo `saber_pro` NO_VALIDO | `NO_VALIDA` |
  | Pregrado 1, cédula inconsistente | `identification` INCONSISTENTE, el resto VALIDO | `INCONSISTENTE` |
  | Pregrado 2, programa 2 con requisito faltante | los 7 VALIDO salvo `academic_evaluation` orden 2 NO_VALIDO | `NO_VALIDA` |
  | Pregrado 2, prioridad | `paz_y_salvo_bib` NO_VALIDO, `identification` INCONSISTENTE | `NO_VALIDA` |
  | Versión vieja | `saber_pro` v1 NO_VALIDO y v2 VALIDO, el resto VALIDO | `VALIDA` |
  | No requerido | posgrado con 3 VALIDO más `saber_pro` NO_VALIDO | `VALIDA` |
  | Aún analizando | un requerido `POR_VALIDAR` | `POR_REVISAR` |

- [ ] **Step 2: Run it.** `cd backend && npx vitest run src/solicitudes/estado-solicitud.spec.ts`.
  Expected: FAIL.
- [ ] **Step 3: Implement** las dos funciones. `recalcularEstado` se prueba en la Tarea 5.
- [ ] **Step 4: Run it.** Mismo comando. Expected: PASS (9).
- [ ] **Step 5: Commit** «Tarea 42a: cálculo del estado de la solicitud».

### Task 4: Paz y Salvo con BibliotecaService

**Files:**
- Create:
  - `backend/src/biblioteca/biblioteca.service.ts`: la clase abstracta y `BibliotecaDemoService`;
  - `backend/src/biblioteca/paz-y-salvo-demo.json`: `{"codigos": ["T00000001", "T00000101", "T00000102"]}`;
  - `backend/src/biblioteca/biblioteca.module.ts`;
  - `backend/src/biblioteca/biblioteca.service.spec.ts`.
- Modify:
  - `backend/src/solicitudes/solicitudes.module.ts`: importa `BibliotecaModule`;
  - `backend/src/solicitudes/analisis-preinscripcion.service.ts:142-153`: inyecta `BibliotecaService`;
  - `backend/src/solicitudes/observaciones-documento.ts`;
  - `backend/src/solicitudes/progreso-envio.ts:13`.

**Interfaces:**
- Produces:
  ```ts
  export type RespuestaPazYSalvo = 'paz_y_salvo' | 'con_deuda' | 'sin_respuesta';
  export abstract class BibliotecaService { abstract consultarPazYSalvo(codigoEstudiante: string): Promise<RespuestaPazYSalvo> }
  export class BibliotecaDemoService extends BibliotecaService {}
  ```
  `BibliotecaModule` exporta `{ provide: BibliotecaService, useClass: BibliotecaDemoService }`.
- El `detalle` de Paz y Salvo queda así:
  `{ fuente: 'biblioteca_demo', respuesta, extracted_data: {}, rules: [], errors: [], mensaje }`.

  | Respuesta | Estado | Mensaje |
  |---|---|---|
  | `paz_y_salvo` | `VALIDO` | «Biblioteca confirmó que estás a paz y salvo.» |
  | `con_deuda` | `NO_VALIDO` | «Biblioteca reporta pendientes a tu nombre. Ponte a paz y salvo y vuelve a subir el documento.» |
  | `sin_respuesta` o un error lanzado | `POR_REVISAR` | «No fue posible consultar a Biblioteca. Una funcionaria lo revisará.» |

- [ ] **Step 1: Write the failing tests.**
  - `biblioteca.service.spec.ts`:
    - `T00000001` → `paz_y_salvo`;
    - `T00099999` → `con_deuda`;
    - `''` → `con_deuda`.
  - En `validacion-integral.e2e-spec.ts`, `describe('Tarea 42: Paz y Salvo')`, con el envío de 5
    documentos, el motor simulado `valid` y `.overrideProvider(BibliotecaService)`:
    - con `paz_y_salvo`, el documento `paz_y_salvo_bib` queda `VALIDO`;
    - con `con_deuda`, queda `NO_VALIDO`;
    - con un `consultarPazYSalvo` que lanza un error, queda `POR_REVISAR` y el envío responde 201.

    El motor no recibe ninguna llamada con `tipos=paz_y_salvo_bib`.
- [ ] **Step 2: Run them.** `npx vitest run src/biblioteca` y el e2e. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `BibliotecaDemoService` lee el JSON una vez con `readFile(new URL('./paz-y-salvo-demo.json', import.meta.url))`.
    Revisa que `nest build` lo copie a `dist`; si no lo copia, agrega `assets` en `nest-cli.json`.
  - `observacionesDocumento` devuelve `[{ estado, mensaje: detalle.mensaje }]` cuando
    `detalle.fuente === 'biblioteca_demo'`.
  - `etapaDocumento` dice «Verificando paz y salvo con Biblioteca.».
  - El código de estudiante es `u.codigo_estudiante`, el que ya se consulta en `procesar`.
- [ ] **Step 4: Run them.** `npx vitest run`, la suite e2e y `npx nest build`. Expected: todo pasa.
  Las pruebas existentes que esperaban `pendiente_integracion` se ajustan en este mismo paso.
- [ ] **Step 5: Commit** «Tarea 42a: Paz y Salvo con un servicio de Biblioteca simulado».

### Task 5: El envío y el reenvío calculan el estado; doble programa con 7

**Files:**
- Modify:
  - `backend/src/solicitudes/solicitudes.service.ts:269-283`: el `UPDATE … EN_PROCESO` pasa a ser
    `recalcularEstado`, y la respuesta lleva `estado` con el estado calculado;
  - `backend/src/solicitudes/solicitudes.types.ts`: `RespuestaEnvioPreinscripcion.estado: string`;
  - `backend/src/solicitudes/reenvios.service.ts:197-207`: también usa `recalcularEstado` y
    devuelve `estado`;
  - `backend/src/solicitudes/progreso-envio.ts:9-23`: `etapaDocumento` nombra la evaluación del
    programa 1 y la del 2;
  - `frontend/app/estudiante/documentos-requeridos.ts:60`: `academic_evaluation` lleva
    `unoPorPrograma: true`;
  - pruebas viejas que esperan `EN_PROCESO` después del envío:
    `test/analisis-preinscripcion.e2e-spec.ts:172` y `test/completar-ocr.e2e-spec.ts:185`.
- Test: `backend/test/validacion-integral.e2e-spec.ts`, `frontend/e2e/documentos_requeridos.spec.ts`.

**Interfaces:**
- Consumes: `recalcularEstado` (Tarea 3), `documentosRequeridos` y `claveDocumento` (Tarea 2).
- Produces: `POST /solicitudes/enviar` y `POST /solicitudes/:id/correcciones` responden
  `{ ok, id_solicitud, id_entrega, estado, mensaje }`, con `estado` en `VALIDA`, `NO_VALIDA`,
  `INCONSISTENTE` o `POR_REVISAR`.

- [ ] **Step 1: Write the failing tests** en `describe('Tarea 42: estado tras el envío')`. El motor
  simulado lleva una clasificación por tipo (`Record<string, 'valid'|'invalid'|'inconsistent'>`) y
  la biblioteca responde `paz_y_salvo`.
  - `it('pregrado con 5 válidos queda VALIDA')`: verifica `envio.body.estado` y la fila.
  - `it('Saber Pro con 95 deja NO_VALIDA; corregirlo con un archivo válido deja VALIDA')`: hace el
    reenvío del documento `saber_pro`.
  - `it('Saber Pro reenviado igual sigue NO_VALIDA')`.
  - `it('un reenvío con 3 documentos cuenta como 1 de 3')`: `politicaReenvios.usados === 1` en
    `GET /estudiante/solicitud/analisis`.
  - `it('doble programa exige 7 documentos y la evaluación 2 se analiza con su orden')`:
    - `DATOS` con `segundoPrograma: true` y dos programas;
    - con 6 archivos responde 400;
    - con 7 responde 201, y existen `documentos` con `academic_evaluation` en orden 1 y 2;
    - si la evaluación 2 es `invalid`, queda `NO_VALIDA`.
  - `it('el estado se calcula una sola vez por envío')`: espía `client.query` con un envoltorio de
    `base.servicio` y cuenta un solo `UPDATE solicitud_grado SET estado` por envío.
  - Frontend: en `documentos_requeridos.spec.ts`, el doble programa de pregrado da 7 ids, incluido
    `academic_evaluation-2`.
- [ ] **Step 2: Run them.** El e2e del backend y
  `cd frontend && npx playwright test e2e/documentos_requeridos.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** según los archivos de arriba.
- [ ] **Step 4: Run them.** `npx vitest run`, la suite e2e completa, y
  `npx playwright test e2e/documentos_requeridos.spec.ts e2e/iniciar_preinscripcion.spec.ts e2e/preinscripcion_validacion.spec.ts`.
  Expected: todo pasa.
- [ ] **Step 5: Commit** «Tarea 42a: el envío calcula el estado y el doble programa pide 7
  documentos».

### Task 6: Plazo de los reenvíos

**Files:**
- Modify:
  - `backend/src/periodos/asignacion-periodo.ts`: agrega `dentroDelPlazoCorreccion`;
  - `backend/src/solicitudes/reenvios.service.ts:119-126`: lee `p.fecha_fin` del periodo en la
    misma consulta `FOR UPDATE`;
  - `backend/src/solicitudes/detalle-analisis.ts:45-50`.
- Test: `backend/src/periodos/asignacion-periodo.spec.ts`, `backend/test/validacion-integral.e2e-spec.ts`.

**Interfaces:**
- Produces:
  `export function dentroDelPlazoCorreccion(fechaFin: string, hoy = fechaInstitucional()): boolean`,
  que es `hoy <= fechaFin − 7 días`, comparando `YYYY-MM-DD` sin zona horaria.
  `detalleAnalisis` devuelve `fechaCorteCorreccion: string | null` y su `admite` lo tiene en cuenta.

- [ ] **Step 1: Write the failing tests.**
  - Unitarias, con `fechaFin = '2026-11-30'`:
    - `'2026-11-23'` → `true`;
    - `'2026-11-24'` → `false`;
    - `fechaInstitucional(new Date('2026-11-24T04:30:00Z'))` es `'2026-11-23'`, así que da `true`.
  - E2E:
    - con el periodo `fecha_fin = CURRENT_DATE + 7` (`fecha_fin − 7` es hoy), el reenvío responde 201;
    - con `fecha_fin = CURRENT_DATE + 6`, responde 409 «El plazo para corregir documentos terminó el
      {YYYY-MM-DD}.» y no crea entrega.

    La fecha de hoy se toma como `(CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date` al
    insertar el periodo.
  - También en el e2e:
    - el 4.º reenvío del día responde 409 con el mensaje existente «Alcanzaste los tres reenvíos de
      hoy…»;
    - un reenvío de un documento `VALIDO` responde 403;
    - un reenvío de un documento `POR_REVISAR` responde 201;
    - un error del motor en el reenvío (`fetch` que responde 500) no consume intento.
- [ ] **Step 2: Run them.** Expected: FAIL las del plazo y PASS las de reglas que ya existían. Esas
  quedan como pruebas de regresión.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them.** La suite unitaria y la e2e. Expected: todo pasa.
- [ ] **Step 5: Commit** «Tarea 42a: el reenvío se permite hasta fecha_fin − 7».

### Task 7: Decisiones de la funcionaria

**Files:**
- Create:
  - `backend/src/solicitudes/resoluciones.service.ts`;
  - la ruta `POST funcionario/documentos/:id/resolucion` en `solicitudes.controller.ts`, con la
    misma protección de rol que `funcionario/documentos/:id/original`.
- Modify:
  - `backend/src/notificaciones/notificaciones.service.ts:192-242`:
    - `aceptada` → `ACEPTADA`, solo desde `VALIDA`;
    - la lista de estados que bloquean `recarga`, `aceptada` y `anulada` pasa a
      `['BORRADOR', 'ACEPTADA', 'CERRADA']`;
  - `backend/src/solicitudes/detalle-analisis.ts`: cada documento lleva `estado` (el valor de la
    base);
  - `backend/src/solicitudes/observaciones-documento.ts`: la rama `detalle.fuente === 'revision_manual'`;
  - `backend/test/notificaciones.e2e-spec.ts:236,273,402`: esperan `ACEPTADA` y crean la solicitud
    en `VALIDA` antes de aceptar.

**Interfaces:**
- Produces:
  - `ResolucionesService.resolver(idFuncionario: number, idDocumento: number, body: { resultado?: unknown; comentario?: unknown }): Promise<{ ok: true; estadoSolicitud: string }>`.
  - Responde 400 si:
    - `resultado` no es `VALIDO` ni `NO_VALIDO`;
    - el comentario falta en `NO_VALIDO`;
    - el comentario supera 5000 caracteres.
  - Responde 404 si el documento no existe o no tiene entrega.
  - Responde 409 con «El documento ya no está por revisar o no es la versión actual.» si no está
    `POR_REVISAR` o no es la versión actual.
  - Responde 409 con «La solicitud ya fue decidida.» si la solicitud está en un estado final.
  - Lo que se guarda, en ese orden y en una transacción:
    1. la solicitud con `FOR UPDATE`;
    2. el documento: `UPDATE estado`;
    3. una `validaciones` (`'MANUAL'`, el resultado, el mensaje y
       `detalle = { fuente: 'revision_manual', funcionario: nombre, comentario }`);
    4. su `historial_validaciones` (`'PENDIENTE' → resultado`);
    5. una `revisiones` (`'DOCUMENTO_RESUELTO'`, el comentario, `[idDocumento]`);
    6. `recalcularEstado`.

- [ ] **Step 1: Write the failing tests** (e2e, `describe('Tarea 42: funcionaria')`):
  - `it('aceptar una solicitud que no es VALIDA responde 409 y no crea revisión')`. Con
    `NO_VALIDA` el mensaje es «Solo se puede aceptar una solicitud válida.».
  - `it('aceptar una VALIDA la deja ACEPTADA y bloquea reenvíos')`: el reenvío responde 409 «La
    solicitud no admite correcciones en su estado actual.».
  - `it('marcar válido el único documento por revisar deja la solicitud VALIDA y avisa')`: usa la
    biblioteca `sin_respuesta`; verifica la notificación `success` y el `estado` del documento en el
    detalle.
  - `it('marcar no válido exige comentario y deja NO_VALIDA')`.
  - `it('resolver una versión vieja o un documento VALIDO responde 409')`.
  - `it('un estudiante no puede resolver documentos')` → 403.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** El nombre de la funcionaria sale de `usuarios`. El mensaje de
  `validaciones` es «Revisado por la funcionaria.» o «Marcado como no válido por la funcionaria.».
- [ ] **Step 4: Run them.** Las suites unitaria y e2e. Expected: todo pasa.
- [ ] **Step 5: Commit** «Tarea 42a: aceptar solo solicitudes válidas y resolver documentos por
  revisar».

### Task 8: Barrido de plazos

**Files:**
- Create: `backend/src/solicitudes/plazos-solicitud.service.ts`, `…/plazos-solicitud.service.spec.ts`
- Modify: `backend/src/solicitudes/solicitudes.module.ts` (provider),
  `backend/src/notificaciones/notificaciones.service.ts` (exporta el método `crear`, que ya existe).

**Interfaces:**
- Produces:
  `PlazosSolicitudService implements OnModuleInit, OnModuleDestroy`, con `ejecutar(hoy?: string): Promise<{ recalculadas: number; anuladas: number }>`.
  Usa el mismo patrón de `NotificacionesPlazosService`: un intervalo de 15 minutos con `unref()`,
  sin ejecuciones superpuestas y con el error registrado en el log.
  - **Recalcula:** cada `id_solicitud` en `EN_PROCESO`, con `recalcularEstado` en su propia
    transacción.
  - **Anula:** en una transacción por solicitud, las `NO_VALIDA` o `INCONSISTENTE` cuyo periodo
    cumple `p.fecha_fin - 7 < hoy`, con hoy en Bogotá o el `hoy` recibido. Para cada una:
    1. `UPDATE estado='CERRADA'`;
    2. `crear(client, { estudianteId, tipo: 'error', titulo: 'Solicitud anulada', msg: 'El plazo para corregir terminó y tu solicitud tenía documentos sin corregir. Puedes inscribirte en un nuevo periodo.', generadoPor: 'system', clave: 'anulacion:' + id, solicitudId: id })`.

- [ ] **Step 1: Write the failing tests.**
  - Unitaria: `ejecutar` sin ejecuciones superpuestas, y un error registrado sin lanzarse, igual
    que `notificaciones-plazos.service.spec.ts`.
  - E2E:
    - una solicitud `EN_PROCESO` con sus 5 documentos `VALIDO` queda `VALIDA`;
    - una `EN_PROCESO` sin documentos ni programas queda `POR_REVISAR`;
    - con el periodo vencido (`fecha_fin = hoy + 6`), una `NO_VALIDA` y una `INCONSISTENTE` quedan
      `CERRADA` con una notificación `error` cada una;
    - `POR_REVISAR`, `VALIDA` y `ACEPTADA` no cambian;
    - correr `ejecutar()` dos veces deja una notificación por solicitud;
    - con `fecha_fin = hoy + 7` no se anula nada.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them.** Las suites unitaria y e2e, y `npx nest build`. Expected: todo pasa.
- [ ] **Step 5: Commit** «Tarea 42a: recalcular solicitudes viejas y anular al cierre del plazo».

### Task 9: Detalle de la funcionaria (frontend) y cierre del PR 1

**Files:**
- Modify:
  - `frontend/app/funcionario/solicitudes-api.ts`:
    - `ESTADOS` agrega `ACEPTADA: ['valido', 'Aceptada']` y pone `VALIDA: ['valido', 'Válida']`.
      Es temporal; la Tarea 11 crea los grupos.
    - `resolverDocumento(id: string, resultado: 'VALIDO' | 'NO_VALIDO', comentario: string)`.
  - `frontend/app/funcionario/detalle_preinscripcion/[id]/page.tsx`:
    - `ESTADOS` (27–30): `VALIDA: 'Válida'`, `ACEPTADA: 'Aceptada'`;
    - `admiteDecision` excluye `ACEPTADA` en lugar de `VALIDA`;
    - la opción «Aceptar solicitud» solo se habilita con `estadoSolicitud === 'VALIDA'`, y si no,
      muestra el texto «Solo se puede aceptar una solicitud válida.»;
    - cada documento con `estado === 'POR_REVISAR'` muestra «Marcar válido» y «Marcar no válido».
      Las dos abren el `Dialog` de confirmación, con el comentario obligatorio en «no válido»; al
      confirmar se actualiza el detalle.
  - El tipo `DocumentoSolicitud` en `frontend/app/estudiante/preinscripcion/types.ts` gana
    `estado?: string`.
  - `frontend/e2e/soporte.ts` (`DETALLE_FUNCIONARIA`) y `frontend/e2e/detalle.spec.ts:32-62`.
  - `docs/tarea42_validacion_integral.md` (nuevo): qué cambió, cómo probarlo en local, y los avisos
    «fuera de alcance» del spec §2.
- Test: `frontend/e2e/detalle.spec.ts`.

- [ ] **Step 1: Write the failing tests.**
  - `aceptada` lleva el detalle a `ACEPTADA`.
  - Con el detalle en `NO_VALIDA`, «Aceptar solicitud» está deshabilitada y se ve el texto de
    ayuda.
  - Un documento `POR_REVISAR` muestra «Marcar válido». Al confirmarlo hace un POST a
    `/funcionario/documentos/{id}/resolucion` con `{resultado: 'VALIDO'}`.
  - «Marcar no válido» sin comentario muestra «Escribe el motivo.» y no hace POST.
  - axe y desbordes en los anchos que ya cubre `detalle.spec.ts`.
- [ ] **Step 2: Run them.** `cd frontend && npx playwright test e2e/detalle.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run everything.**
  - Backend: `npx vitest run`, la suite e2e y `npx nest build`.
  - Frontend: `npx playwright test`, la suite completa.
  - Base: `db/tests/verificar.ps1`, si hay `psql`; si no, se dice en el PR.

  Expected: todo pasa. Cualquier fallo se reporta por nombre.
- [ ] **Step 5: Commit** «Tarea 42a: decisiones y resolución de documentos en el detalle». Después
  vienen la revisión final, el push, el PR 1 y los comentarios en #102, todo con la aprobación de
  Héctor.

## PR 2: 42b–42d (rama `tarea_42bcd_dashboard` desde `tarea_42a_validacion_integral`)

### Task 10: Listado del backend para el dashboard

**Files:**
- Modify: `backend/src/notificaciones/notificaciones.service.ts:39-46` (`solicitudesFuncionaria`),
  `backend/test/notificaciones.e2e-spec.ts:165-175`.

**Interfaces:**
- Produces: cada fila es `{ id, periodId, nivel, estado, fechaRegistro, estudiante, fechaEnvio, envioEn }`.
  - `fechaEnvio` es `(e.fecha_entrega AT TIME ZONE 'America/Bogota')::date::text` de la entrega
    `INICIAL`.
  - `envioEn` es su instante ISO UTC, con el mismo `to_char` de `CAMPOS`.
  - Se excluyen las filas `BORRADOR`.
  - El orden es `envioEn DESC, id DESC`.

- [ ] **Step 1: Write the failing test.**
  - El listado no incluye la solicitud `BORRADOR`.
  - Una entrega con `fecha_entrega = '2026-11-01T01:00:00Z'` da `fechaEnvio = '2026-10-31'`.
  - Ajusta la prueba existente, que esperaba ver el borrador.
- [ ] **Step 2: Run it.** El e2e. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run it.** La suite e2e. Expected: PASS.
- [ ] **Step 5: Commit** «Tarea 42b: el listado excluye borradores y trae la fecha de envío».

### Task 11: Dashboard con seis grupos y fechas en Bogotá

**Files:**
- Modify:
  - `frontend/app/funcionario/dashboard/datos.ts`: `EstadoSolicitud` suma `'aceptada' | 'anulada'`,
    y `ESTADOS_SOLICITUD` y las etiquetas cubren los seis;
  - `frontend/app/components/ui/StatusBadge.tsx` y su CSS: los estados visibles `aceptada` y
    `anulada`, con `Icono` existente o nuevo;
  - los tokens de color en el CSS global: `--status-accepted-*` y `--status-cancelled-*`, en tema
    claro y oscuro;
  - `GraficoEstados.tsx`: `TOKEN_MARCA`;
  - `solicitudes-api.ts`: el mapeo final de la tabla del spec §10, y `fechaEnvio`/`envioEn` en
    `ResumenFuncionaria`;
  - `page.tsx:130-137`: el rango se compara con `s.fechaEnvio` y la columna muestra `envioEn`;
  - `dashboard.module.css`: la rejilla de contadores con seis;
  - `frontend/e2e/soporte.ts:82` (`SOLICITUDES_FUNCIONARIA`), `frontend/e2e/dashboard.spec.ts` y
    `colores.spec.ts`.

**Interfaces:**
- Consumes: el listado de la Tarea 10.
- Produces: `ESTADOS_SOLICITUD = ['valido','no_valido','inconsistente','por_revisar','aceptada','anulada']`.

- [ ] **Step 1: Write the failing tests.** `SOLICITUDES_FUNCIONARIA` trae una solicitud de cada uno
  de los seis estados de la base, más una `EN_PROCESO`.
  - Seis contadores con «Aceptadas» y «Anuladas». «Por revisar» cuenta 2: `POR_REVISAR` y
    `EN_PROCESO`.
  - Los gráficos tienen alternativa en texto con «Aceptadas: 1» y «Anuladas: 1».
  - Una solicitud con `envioEn = '2026-11-01T01:00:00Z'` y `fechaEnvio = '2026-10-31'` aparece al
    filtrar del 31/10 al 31/10.
  - «Ver solicitud» lleva a `/funcionario/detalle_preinscripcion/{id}` (42d).
  - `colores.spec`: contraste AA de los chips nuevos en los dos temas, y ningún color fijo en
    `dashboard.module.css`.
  - axe y desbordes en 320, 360, 768 y 1280 px.
- [ ] **Step 2: Run them.** `npx playwright test e2e/dashboard.spec.ts e2e/colores.spec.ts`.
  Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run everything.** `npx playwright test` y la suite e2e del backend. Expected: todo
  pasa.
- [ ] **Step 5: Commit** «Tarea 42b–d: dashboard con estados reales, seis grupos y fechas en
  Bogotá». Después vienen la revisión final, el push, el PR 2 (base: la rama del PR 1) y los
  comentarios en #102, con la aprobación de Héctor.
