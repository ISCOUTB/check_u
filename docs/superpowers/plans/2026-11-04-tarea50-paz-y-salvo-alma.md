# Tarea 50: Paz y Salvo por consulta simulada a ALMA — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el Paz y Salvo deje de subirse y se consulte en ALMA. La consulta es simulada con un
JSON externo, con la misma forma de la API real, y su resultado se muestra en una tabla en tres
vistas.

**Architecture:**
- El motor Python reutiliza `fuentes/alma`: un cliente simulado, un criterio nuevo de solicitudes, el
  contraste de identidad y el endpoint `POST /biblioteca/paz-y-salvo`.
- El backend NestJS lo consume a través de `BibliotecaService` y guarda el Paz y Salvo como documento
  sin archivo (`origen='CONSULTA'`).
- El frontend muestra `TablaPazYSalvo` y el botón «Consultar de nuevo».

**Tech Stack:** Python 3.11 con pytest y Flask; NestJS 11 con vitest y PGlite; Next.js 16 con
Playwright y axe.

**Spec:** `docs/superpowers/specs/2026-11-04-tarea50-paz-y-salvo-alma-design.md`

## Global Constraints

- **Sin commits** (restricción de la issue). Cada «punto de control» es correr las pruebas y
  `git status --short`. Nada se sube sin la aprobación de Héctor.
- Ningún dato real, en el repo ni en las pruebas. El JSON de simulación vive en
  `C:\Users\hectr\OneDrive\Documentos\UTB\checku_datos_locales\alma\alma_simulacion.json` y
  `.gitignore` lo bloquea. Las pruebas generan su propio JSON en `tmp_path`.
- Variables de entorno: `ALMA_MODO` (`simulado` por defecto, o `real`) y `ALMA_SIMULACION_ARCHIVO`.
- Todo cambio de esquema va en `db/migrations/010-paz-y-salvo-consulta.sql` **y** al final de
  `db/init/01-schema.sql`, porque `levantar.ps1` aplica solo `01` y `02`.
- Estado de documento según el resultado:

  | `estado` | Documento |
  |---|---|
  | `cumple` | VALIDO |
  | `no_cumple` | NO_VALIDO |
  | `inconsistente` | INCONSISTENTE |
  | `no_evaluable`, `no_encontrado` o sin respuesta | POR_REVISAR |
- Requisitos: 5, 7 y 3 en total; documentos para subir, 4, 6 y 2.
- Textos fijos:
  - «Paz y Salvo se consulta automáticamente con Biblioteca; no se sube.»
  - «Consultando Paz y Salvo en Biblioteca.»
  - «Consultar de nuevo»
- Comandos:
  - Python: `venv/Scripts/python.exe -m pytest modules/validadores/fuentes/alma -q` desde la raíz.
  - Backend: `cd backend && npx vitest run` y `npx vitest run --config ./vitest.config.e2e.ts`.
  - Frontend: `cd frontend && npx playwright test <archivo>`.

## Review Focus

1. **Sin JSON o sin la variable** (el Docker de otro compañero): el envío se completa y el Paz y
   Salvo queda Por revisar. Prueba en la Tarea 6.
2. **Doble clic en «Consultar de nuevo»:** con la misma `clave` se crea una sola entrega. Prueba en
   la Tarea 7.
3. **Borrador viejo con un PDF de Paz y Salvo guardado:** el envío no falla y el PDF viejo se
   descarta. Prueba en la Tarea 5.
4. **Estudiante sin número de documento en el perfil:** no se puede contrastar, así que queda Por
   revisar y no Inconsistente. Prueba en la Tarea 3.
5. **El motor responde una forma inesperada:** zod la rechaza y queda Por revisar sin romper el
   envío. Prueba en la Tarea 6.

---

### Task 1: Cliente simulado de ALMA

**Files:**
- Create: `modules/validadores/fuentes/alma/simulado.py`, `modules/validadores/fuentes/alma/tests/test_simulado.py`
- Modify:
  - `modules/validadores/fuentes/alma/cliente.py`: agrega `AlmaCliente.usuario(user_id)` con
    `GET /almaws/v1/users/{id}`; un 404 devuelve `None`;
  - `modules/validadores/fuentes/alma/config.py`: agrega `crear_cliente()`;
  - `modules/validadores/fuentes/alma/__init__.py`: exporta lo nuevo.

**Interfaces:**
- Produces:
  ```python
  class AlmaClienteSimulado:
      def __init__(self, ruta: str | Path | None = None) -> None  # None → env ALMA_SIMULACION_ARCHIVO
      def usuario(self, user_id: str) -> dict | None
      def prestamos(self, user_id: str) -> ListaAlma
      def multas(self, user_id: str) -> ListaAlma
      def solicitudes(self, user_id: str) -> ListaAlma
  def crear_cliente() -> AlmaCliente | AlmaClienteSimulado  # ALMA_MODO: "simulado" (defecto) | "real"
  ```
  - Forma del JSON: spec §4.1.
  - Los listados usan `_extraer_items` y `_total_reportado` de `cliente.py` y marcan
    `completo=False` cuando falta `total_record_count`.
  - Un usuario ausente hace que los listados lancen `AlmaClienteError(codigo_http=404)`.
  - Un archivo ausente, ilegible o que no es JSON lanza `AlmaClienteError` con «No se encontró el
    archivo de simulación de ALMA.» o «El archivo de simulación de ALMA no es JSON válido.».
  - `ALMA_MODO` desconocido lanza `AlmaConfigError`.

- [ ] **Step 1: Write the failing tests** (`test_simulado.py`). Un fixture `archivo(tmp_path, datos)`
  escribe el JSON y devuelve la ruta.
  - `test_lista_prestamos_como_la_api`: dos `item_loan` con `total_record_count` 2 dan
    `total == 2`, `completo` y 2 items.
  - `test_sin_total_queda_incompleto`.
  - `test_usuario_existente_y_ausente`: `usuario("X")` es `None` y `prestamos("X")` lanza un error
    con `codigo_http == 404`.
  - `test_archivo_ausente_o_invalido`.
  - `test_variable_de_entorno`, con `monkeypatch.setenv("ALMA_SIMULACION_ARCHIVO", …)`.
  - `test_crear_cliente_por_modo`: sin `ALMA_MODO` da `AlmaClienteSimulado`; con `"real"` da
    `AlmaCliente`, con la configuración inyectada vía env `ALMA_API_KEY` y `ALMA_BASE_URL`; con
    `"otro"` da `AlmaConfigError`.
  - `test_cliente_real_usuario` en `test_cliente.py`: con una sesión mock, 200 devuelve el dict y
    404 devuelve `None`.
- [ ] **Step 2: Run.** Expected: FAIL (`ModuleNotFoundError: simulado`).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** `venv/Scripts/python.exe -m pytest modules/validadores/fuentes/alma -q`.
  Expected: todo pasa.
- [ ] **Step 5: Punto de control.** `git status --short`.

### Task 2: Criterio de solicitudes y consolidación

**Files:**
- Modify:
  - `modules/validadores/fuentes/alma/criterios.py`: agrega `evaluar_solicitudes`;
    `evaluar_opcion_grado` no cambia;
  - `modules/validadores/fuentes/alma/consolidar.py`;
  - `modules/validadores/fuentes/alma/consultar.py`;
  - `modules/validadores/fuentes/alma/tests/test_criterios.py`, `test_consultar.py`. Ajusta
    `test_consultar_estructura_sin_incumplimiento`, que esperaba `no_evaluable` por
    `source_pending`.

**Interfaces:**
- Produces:
  - `evaluar_solicitudes(lista: ListaAlma) -> Criterio`. Las listas de pendientes y finales están en
    spec §4.2; la comparación ignora mayúsculas.
  - `consolidar_estado(prestamos, multas, solicitudes)`, `acciones_requeridas(...)` y
    `mensaje_general(estado, prestamos, multas, solicitudes)`.
  - En la salida de `consultar_paz_y_salvo`, `criterios` trae `prestamos`, `multas`, `solicitudes`
    (con `pendientes`) y `opcion_grado` (con `"informativo": True`).

- [ ] **Step 1: Write the failing tests.**
  - `test_consultar.py`, con un cliente MagicMock como el existente. Un `it` por escenario de la
    issue:
    - `test_escenario_paz_y_salvo`: listados vacíos dan `estado == "cumple"` y
      `paz_y_salvo is True`;
    - `test_escenario_con_prestamos`: un `loan_status: "ACTIVE"` da `no_cumple`, con
      `criterios.prestamos.pendientes == 1`;
    - `test_escenario_con_solicitudes`: un `request_status: "IN_PROCESS"` da `no_cumple`, con la
      acción «Cerrar o cancelar las solicitudes pendientes en Biblioteca.»;
    - `test_escenario_con_multas`: `status: "ACTIVE"` con `balance: 15000` da `no_cumple`, con
      `valor_total == 15000.0`;
    - `test_escenario_combinado`: los tres dan `no_cumple`, con 3 acciones;
    - `test_opcion_grado_es_informativa`: `criterios.opcion_grado.informativo is True` y no impide
      `cumple`.
  - `test_criterios.py`:
    - estados finales (`COMPLETED`, `CANCELED`) cumplen;
    - un estado desconocido da `no_evaluable` / `incomplete_data`;
    - un listado incompleto da `no_evaluable`.
- [ ] **Step 2: Run.** Expected: FAIL (`ImportError evaluar_solicitudes`).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** pytest de `alma`. Expected: todo pasa.
- [ ] **Step 5: Punto de control.**

### Task 3: Contraste de identidad y endpoint del motor

**Files:**
- Modify: `modules/validadores/fuentes/alma/consultar.py` (agrega `consultar_para_checku`), `modules/api/app.py`
- Create: `modules/validadores/fuentes/alma/tests/test_checku.py`, `modules/validadores/fuentes/alma/tests/test_endpoint.py`

**Interfaces:**
- Consumes: `crear_cliente()` (Tarea 1) y `consultar_paz_y_salvo` (Tarea 2).
- Produces:
  ```python
  def consultar_para_checku(user_id: str, identidad: dict, *, cliente=None) -> dict
  # identidad = {"numero_documento": str, "nombres": str, "apellidos": str}
  ```
  - Devuelve la salida de `consultar_paz_y_salvo` más
    `fuente: "alma_simulada" | "alma"` e `identidad: {coincide, campos_distintos}`.
  - `estado` puede ser también `no_encontrado` o `inconsistente`; en esos dos casos `criterios` es
    `{}` y `paz_y_salvo` es `None`.
  - Si `numero_documento` viene vacío, `estado == "no_evaluable"` con
    `identidad.coincide is None` y `campos_distintos == []`.
  - La comparación normaliza: el documento queda solo con letras y dígitos; el nombre se pasa a
    minúsculas, sin tildes, con espacios colapsados y como `nombres + " " + apellidos` contra
    `first_name + " " + last_name`.
  - Nunca devuelve el nombre ni el documento que tiene ALMA.
- Endpoint `POST /biblioteca/paz-y-salvo`, con JSON `{id_student, identidad}`: responde 200 con el
  dict y 400 con `{"error": "estudiante.id_student es obligatorio."}`.

- [ ] **Step 1: Write the failing tests.**
  - `test_checku.py`, con `AlmaClienteSimulado` sobre un JSON en `tmp_path`:
    - `test_coincide_y_evalua`;
    - `test_documento_distinto_es_inconsistente`: `campos_distintos == ["numero_documento"]` y no
      llama a los listados;
    - `test_nombre_con_tildes_y_mayusculas_coincide`;
    - `test_no_encontrado`;
    - `test_sin_documento_en_perfil_no_evaluable`;
    - `test_archivo_ausente_no_evaluable`;
    - `test_no_expone_datos_de_alma`: el JSON de salida no contiene el apellido ni el documento del
      archivo.
  - `test_endpoint.py`, con `app.test_client()` y `ALMA_SIMULACION_ARCHIVO` vía monkeypatch:
    200 con `estado == "cumple"`, y 400 sin `id_student`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** `venv/Scripts/python.exe -m pytest -q` (la suite completa de Python).
  Expected: todo pasa.
- [ ] **Step 5: Punto de control.**

### Task 4: Base de datos — documento sin archivo

**Files:**
- Create: `db/migrations/010-paz-y-salvo-consulta.sql`
- Modify:
  - `db/init/01-schema.sql`: el mismo bloque al final, con un comentario de por qué;
  - `db/tests/aceptacion.sql`;
  - `db/README.md`;
  - `backend/test/soporte/db-borrador.ts`: ejecuta 010 después de 009;
  - `backend/test/validacion-integral.e2e-spec.ts`: amplía la prueba «el esquema base solo, como
    lo aplica levantar.ps1».

**Interfaces:**
- Produces:
  - `documentos.origen` (`'ARCHIVO' | 'CONSULTA'`, por defecto `'ARCHIVO'`);
  - un documento `CONSULTA` admite `nombre_original`, `mime_type` y `tamano_bytes` NULL;
  - un documento `ARCHIVO` los sigue exigiendo.

  Constraints: `chk_documento_origen`, `chk_documento_archivo` y `chk_documento_tamano`
  (`tamano_bytes IS NULL OR tamano_bytes > 0`).

- [ ] **Step 1: Write the failing test.** En la prueba de `levantar.ps1`:
  - insertar un `paz_y_salvo_bib` con `origen='CONSULTA'` y sin archivo funciona;
  - insertar uno `ARCHIVO` sin `nombre_original` da `rejects.toThrow(/chk_documento_archivo|null value/)`.

  En `aceptacion.sql`, el mismo rechazo con `debe_rechazar`.
- [ ] **Step 2: Run** el e2e. Expected: FAIL (no existe la columna `origen`).
- [ ] **Step 3: Implement.** El orden en SQL es:
  1. `ADD COLUMN IF NOT EXISTS origen`;
  2. `ALTER COLUMN … DROP NOT NULL`;
  3. `DROP/ADD CONSTRAINT`.
- [ ] **Step 4: Run.**
  - La suite e2e completa.
  - `aceptacion.sql` sobre PGlite, de las dos formas que se usaron en la Tarea 42: solo
    `01 + 02 + 01`, y `01 + 02 + 008 + 009 + 010`.

  Expected: ACEPTACION OK y todo pasa.
- [ ] **Step 5: Punto de control.**

### Task 5: Requisitos — Paz y Salvo ya no se sube

**Files:**
- Modify:
  - `backend/src/solicitudes/requisitos-documentales.ts` (+ spec);
  - `backend/src/solicitudes/analisis-preinscripcion.service.ts` (`validarArchivos`);
  - `backend/src/solicitudes/solicitudes.service.ts`: `esperados`, `validarRequisitosCompletos` y el
    borrador;
  - `backend/src/solicitudes/reenvios.service.ts`;
  - `backend/src/documentos/validar-solicitud.ts`;
  - las pruebas e2e que adjuntaban `paz_y_salvo_bib`: `analisis-preinscripcion`, `completar-ocr`,
    `notificaciones`, `cancelacion` y `test/soporte/flujo-tarea42.ts`.

**Interfaces:**
- Produces:
  - `DocumentoRequerido` gana `origen: 'archivo' | 'consulta'`;
  - `documentosASubir(nivel: string, doblePrograma: boolean): readonly DocumentoRequerido[]`;
  - `documentosRequeridos` sigue devolviendo todos;
  - `MAXIMO_DOCUMENTOS` queda en 6 (el mayor de los de subir);
  - `validarArchivos` rechaza `paz_y_salvo_bib` con el texto fijo de Global Constraints;
  - el envío y el borrador ignoran o borran un `paz_y_salvo_bib` `CARGADO` que haya quedado en un
    borrador viejo.

- [ ] **Step 1: Write the failing tests.**
  - `requisitos-documentales.spec.ts`:
    - `documentosASubir` da 4, 6 y 2 claves, sin `paz_y_salvo_bib`;
    - `documentosRequeridos` sigue dando 5, 7 y 3;
    - `validarArchivos([pdf('paz_y_salvo_bib')])` lanza el texto fijo;
    - `MAXIMO_DOCUMENTOS === 6`.
  - e2e en `validacion-integral`:
    - `it('un borrador viejo con PDF de Paz y Salvo se envía sin él')`: guardar un borrador con
      `paz_y_salvo_bib` en `documentos` y enviar 4 PDF da 201;
    - adjuntar el PDF de Paz y Salvo da 400.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** También actualiza las pruebas e2e viejas para que envíen solo los
  documentos de `documentosASubir`.
- [ ] **Step 4: Run** las suites unitaria y e2e. Expected: todo pasa, salvo las pruebas de Paz y
  Salvo, que se rehacen en la Tarea 6. Si alguna falla por eso, se ledgerea y se deja para la
  Tarea 6 en el mismo punto de control.
- [ ] **Step 5: Punto de control.**

### Task 6: BibliotecaService consulta al motor y el documento CONSULTA

**Files:**
- Modify:
  - `backend/src/biblioteca/biblioteca.service.ts` (+ spec);
  - `backend/src/biblioteca/biblioteca.module.ts`;
  - `backend/src/solicitudes/analisis-preinscripcion.service.ts`;
  - `backend/src/solicitudes/solicitudes.service.ts`: crea el documento CONSULTA en el envío;
  - `backend/src/solicitudes/observaciones-documento.ts`;
  - `backend/src/solicitudes/detalle-analisis.ts`;
  - `backend/src/solicitudes/progreso-envio.ts`;
  - `backend/src/notificaciones/notificaciones.service.ts`: actor `system` para la fuente
    `alma_simulada` / `alma`;
  - `backend/test/soporte/flujo-tarea42.ts`: el fake de Biblioteca devuelve `ResultadoBiblioteca`.
- Delete: `backend/src/biblioteca/paz-y-salvo-demo.ts`

**Interfaces:**
- Produces:
  ```ts
  export const ResultadoBiblioteca: z.ZodType  // estado, paz_y_salvo, mensaje, fuente, identidad, criterios, acciones_requeridas, consultado_en
  export type ResultadoBiblioteca = z.infer<typeof ResultadoBiblioteca>
  export interface EstudianteBiblioteca { codigo: string; numeroDocumento: string; nombres: string; apellidos: string }
  export abstract class BibliotecaService { abstract consultar(e: EstudianteBiblioteca): Promise<unknown> }
  export class BibliotecaMotorService extends BibliotecaService  // POST {MOTOR_URL}/biblioteca/paz-y-salvo
  export function consultarConLimite(b: BibliotecaService, e: EstudianteBiblioteca, limiteMs = 5000): Promise<ResultadoBiblioteca>
  //   sin respuesta / error / zod inválido → SIN_RESPUESTA = {estado:'no_evaluable', paz_y_salvo:null, fuente:'sin_respuesta', mensaje:'No fue posible consultar a Biblioteca. Una funcionaria lo revisará.', criterios:{}, acciones_requeridas:[], identidad:{coincide:null,campos_distintos:[]}, consultado_en:null}
  export function estadoDocumentoBiblioteca(r: ResultadoBiblioteca): 'VALIDO'|'NO_VALIDO'|'INCONSISTENTE'|'POR_REVISAR'
  export async function registrarConsultaBiblioteca(client: PoolClient, biblioteca: BibliotecaService, idDocumento: number, estudiante: EstudianteBiblioteca): Promise<string /* estado del documento */>
  //   UPDATE documentos.estado + INSERT validaciones('REQUISITOS', resultado, mensaje, detalle={fuente, resultado}) + historial + notificaciones.porDocumento
  ```
  - En el envío, después de crear la entrega, se inserta `paz_y_salvo_bib`
    (`origen='CONSULTA'`, `version=1`) y se llama a `registrarConsultaBiblioteca`, antes de
    `recalcularEstado`.
  - `detalle-analisis` agrega `origen` y `bibliotecaResultado` (el `detalle.resultado` de la
    validación) a cada documento.
  - Un documento `CONSULTA` tiene `archivoDisponible: false`.

- [ ] **Step 1: Write the failing tests.**
  - `biblioteca.service.spec.ts`:
    - el mapeo de estados: `cumple` da VALIDO, `no_cumple` NO_VALIDO, `inconsistente`
      INCONSISTENTE, y `no_evaluable` / `no_encontrado` dan POR_REVISAR;
    - `consultarConLimite` con una respuesta de forma inválida da `SIN_RESPUESTA`;
    - se mantienen las pruebas de timeout, throw síncrono y respuesta desconocida;
    - `BibliotecaMotorService` con un `fetch` stub verifica la URL, el cuerpo
      `{id_student, identidad:{numero_documento,nombres,apellidos}}` y el resultado parseado.
  - e2e:
    - el envío sin PDF crea `paz_y_salvo_bib` con `origen CONSULTA`, `nombre_original NULL` y una
      validación con `detalle.resultado.estado`;
    - por cada `estado` del fake (`cumple`, `no_cumple`, `inconsistente`, `no_encontrado`,
      `no_evaluable`), el documento y la solicitud quedan como dice la tabla de Global Constraints;
    - el fake lanza un error o devuelve `{foo:1}`: 201 y Por revisar (Review Focus 1 y 5);
    - el detalle trae `bibliotecaResultado`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Las pruebas e2e de Paz y Salvo de la Tarea 42 se rehacen sobre el fake
  nuevo.
- [ ] **Step 4: Run** las suites unitaria y e2e, y `npx nest build`. Expected: todo pasa.
- [ ] **Step 5: Punto de control.**

### Task 7: «Consultar de nuevo»

**Files:**
- Create: `backend/src/biblioteca/reconsulta.service.ts`
- Modify:
  - `backend/src/solicitudes/solicitudes.controller.ts`: ruta del estudiante;
  - `backend/src/notificaciones/notificaciones.controller.ts`: ruta de la funcionaria;
  - `backend/src/solicitudes/solicitudes.module.ts`.

**Interfaces:**
- Consumes: `registrarConsultaBiblioteca` (Tarea 6), `recalcularEstado`, `dentroDelPlazoCorreccion`
  y el conteo diario de reenvíos.
- Produces:
  - **`POST /api/estudiante/solicitudes/:id/paz-y-salvo/consulta`**, con body `{clave}`:
    - aplica las mismas validaciones y mensajes que `ReenviosService.reenviar`: propiedad, estado
      que admite correcciones, plazo y 3 por día;
    - es idempotente por `(id_solicitud, clave)`;
    - inserta una entrega `CORRECCION` y una versión nueva `CONSULTA`;
    - si el Paz y Salvo actual es VALIDO, responde 403 con «No se permite reemplazar un documento
      válido.»;
    - responde `{ok, id_solicitud, id_entrega, estado}`.
  - **`POST /api/funcionario/solicitudes/:id/paz-y-salvo/consulta`**:
    - requiere el rol funcionario y un estado no final;
    - consulta sobre la versión actual (nueva validación y estado) y recalcula;
    - no crea entrega;
    - responde `{ok, estadoSolicitud}`.

- [ ] **Step 1: Write the failing tests** (e2e):
  - la reconsulta del estudiante después de «ponerse al día» (el fake cambia de `no_cumple` a
    `cumple`) deja la solicitud VALIDA y `politicaReenvios.usados == 1`;
  - con la misma clave dos veces, una sola entrega (Review Focus 2);
  - la 4.ª del día da 409;
  - desde `fecha_fin − 6` da 409;
  - con Paz y Salvo VALIDO da 403;
  - la reconsulta de la funcionaria no suma intentos;
  - un estudiante en la ruta de la funcionaria da 403.
- [ ] **Step 2: Run.** Expected: FAIL (404).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** las suites y el build. Expected: todo pasa.
- [ ] **Step 5: Punto de control.**

### Task 8: Formulario y requisitos del estudiante

**Files:**
- Modify:
  - `frontend/app/estudiante/documentos-requeridos.ts`: `consulta: true` en `paz_y_salvo_bib` (en
    lugar de `retirando`); `documentosRequeridos()` deja de incluirlo; agrega
    `requisitosSolicitud(nivel, doble)` con los 5, 7 o 3;
  - `frontend/app/estudiante/home/resumen.ts`: `construirRequisitos` usa `requisitosSolicitud`;
  - la bienvenida: «Paz y Salvo de Biblioteca (se consulta automáticamente)»;
  - las pruebas de `documentos_requeridos`, `iniciar_preinscripcion`, `preinscripcion_validacion`,
    `resumen_solicitud` y `bienvenida`.

- [ ] **Step 1: Write the failing tests:**
  - el formulario de pregrado tiene 4 zonas y ninguna `#documento-paz_y_salvo_bib`;
  - con doble programa, 6;
  - en posgrado, 2;
  - el contador es «0 de 4 documentos cargados»;
  - el resumen del inicio sigue diciendo «de 5 requisitos válidos»;
  - la bienvenida muestra el texto de consulta automática.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** esos archivos. Expected: todo pasa.
- [ ] **Step 5: Punto de control.**

### Task 9: TablaPazYSalvo en las tres vistas

**Files:**
- Create: `frontend/app/components/biblioteca/TablaPazYSalvo.tsx`, `TablaPazYSalvo.module.css`,
  `frontend/app/components/biblioteca/tipos.ts` (el tipo `ResultadoBiblioteca`)
- Modify:
  - `frontend/app/estudiante/home/TarjetaSolicitudReciente.tsx` (+ `resumen.ts`: el requisito lleva
    `biblioteca?: ResultadoBiblioteca`);
  - `frontend/app/estudiante/preinscripcion/page.tsx`;
  - `frontend/app/funcionario/detalle_preinscripcion/[id]/page.tsx`;
  - `frontend/app/funcionario/solicitudes-api.ts`: agrega `reconsultarPazYSalvo(id)`;
  - el api del estudiante: agrega `reconsultarPazYSalvo(id, clave)`;
  - `frontend/app/estudiante/preinscripcion/types.ts`: agrega `origen` y `bibliotecaResultado`;
  - `frontend/e2e/soporte.ts`: los fixtures llevan `bibliotecaResultado`.
- Test: `frontend/e2e/tabla_paz_y_salvo.spec.ts` (nuevo)

**Interfaces:**
- Produces:
  - `<TablaPazYSalvo resultado={ResultadoBiblioteca} />`, con caption «Consulta de Paz y Salvo en
    Biblioteca».
  - Las filas, en orden: «Préstamos activos», «Multas», «Solicitudes pendientes» y «Opción de grado
    (informativo)».
  - Las columnas son «Tipo de obligación», «Detalle», «Cantidad» y «Estado». El Estado usa
    `StatusBadge`: cumple da valido, no_cumple no_valido y no_evaluable por_revisar.
  - Las multas muestran «$15.000 COP» con `Intl.NumberFormat('es-CO')`.
  - Con `inconsistente` o `no_encontrado` no hay tabla, solo el mensaje.
  - El botón «Consultar de nuevo»:
    - el del estudiante (home y preinscripción) solo aparece si `resubmission_allowed` y usa una
      clave nueva por clic;
    - el de la funcionaria aparece si el estado no es final;
    - los dos refrescan los datos al terminar.

- [ ] **Step 1: Write the failing tests** (`tabla_paz_y_salvo.spec.ts`):
  - el home con `bibliotecaResultado` del escenario combinado muestra las 4 filas, «$15.000 COP» y
    el botón; al pulsarlo hace un POST a `/estudiante/solicitudes/1/paz-y-salvo/consulta` con
    `clave`;
  - el detalle de la funcionaria muestra la misma tabla, y su botón hace un POST a la ruta de la
    funcionaria;
  - `estudiante/preinscripcion` muestra la tabla en el análisis de Paz y Salvo;
  - un resultado `inconsistente` muestra el mensaje y no la tabla;
  - axe y desbordes a 320 y 1280 px, en los dos temas.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** el archivo nuevo y `npx playwright test` completo. Expected: las fallas de la
  suite completa coinciden con las de `main` en el mismo checkout (comparar como en la Tarea 42).
- [ ] **Step 5: Punto de control.**

### Task 10: Datos locales, documentación y verificación final

**Files:**
- Create (fuera del repo):
  `C:\Users\hectr\OneDrive\Documentos\UTB\checku_datos_locales\alma\alma_simulacion.json`, con los
  6 usuarios de spec §8.
- Create: `docs/tarea50_paz_y_salvo_alma.md`
- Modify:
  - `.gitignore`: `alma_simulacion*.json` y `**/datos_locales/`;
  - `modules/validadores/README.md` (sección ALMA);
  - `docker-compose.yml`: comentario o variable para montar el JSON en el servicio `ocr` con
    `ALMA_SIMULACION_ARCHIVO`; solo si se puede sin romper a quien no tiene el archivo.

- [ ] **Step 1:** Crear el JSON y verificar los 5 escenarios y el inconsistente contra él:
  `venv/Scripts/python.exe -m modules.validadores.fuentes.alma <codigo>`, o un script de una línea
  con `consultar_para_checku`. Expected: `cumple`, `no_cumple` ×4 e `inconsistente`.
- [ ] **Step 2:** Verificar que git no lo ve: `git check-ignore -v` sobre una copia en
  `db/datos_locales/alma_simulacion.json`. Expected: lo ignora. Después se borra la copia.
- [ ] **Step 3:** Escribir la documentación: cómo crear el JSON, con un ejemplo mínimo inventado;
  las variables; Docker; cómo cambiar a `ALMA_MODO=real`; y el aviso para Jorge sobre la
  consolidación.
- [ ] **Step 4:** Correr todo:
  - pytest completo;
  - vitest unitario y e2e;
  - `nest build`;
  - `aceptacion.sql` de las dos formas;
  - Playwright completo, comparado con `main`.

  Expected: todo pasa (o las mismas fallas de `main`).
- [ ] **Step 5: Punto de control final:** `git status --short` y `git diff --stat`, para que Héctor
  revise.
