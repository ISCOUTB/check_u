# Tarea 50: Paz y Salvo por consulta simulada a ALMA — Diseño

Issue: ISCOUTB/check_u#125. Parte de `main` en `3ebb648`. Restricción de la issue: **sin commits**. Los
cambios quedan en la rama local `tarea_50_paz_y_salvo_alma` para que Héctor los revise y los suba.

## 1. Objetivo

El estudiante ya no sube el Paz y Salvo de Biblioteca. El sistema lo consulta en ALMA y, por
ahora, la consulta es una simulación que lee un JSON con la forma de la API real. Ese JSON está
fuera del repositorio. El resultado se muestra en una tabla, igual en todas las vistas.

## 2. Punto de partida

- `modules/validadores/fuentes/alma` (Tarea 21) tiene:
  - `AlmaCliente`, con `loans`, `fees` y `requests` de `/almaws/v1/users/{id}`;
  - los criterios;
  - la consolidación.

  Las solicitudes no se evalúan como pendientes: alimentan el criterio «opción de grado», que
  siempre da `no_evaluable` (`source_pending`). Por eso la consolidación nunca da `cumple`.
- En el backend (Tarea 42), Paz y Salvo es una fila de `documentos` con un PDF subido, y su estado
  sale de `BibliotecaService` (un demo con una lista de códigos), con un límite de 5 s
  (`consultarConLimite`).
- `documentos` exige archivo: `nombre_original` y `mime_type` NOT NULL, y `tamano_bytes > 0`.
- `levantar.ps1` aplica solo `01-schema.sql` y `02-userbase.sql`, así que todo cambio de esquema
  va también al final de `01-schema.sql`.

## 3. Decisiones (Héctor, 04/11/2026)

| Tema | Decisión |
|---|---|
| Entrega | Sin commits: rama local, Héctor revisa con `git diff` y sube. |
| Dónde vive la simulación | En Python, reutilizando `fuentes/alma`. El motor expone el endpoint y el backend lo consume. |
| Solicitudes | Criterio nuevo `solicitudes` (pendientes). «Opción de grado» sale de la consolidación. |
| Modelo | Paz y Salvo sigue siendo un requisito en `documentos`, pero **sin archivo** (`origen = 'CONSULTA'`). |
| Contraste con la BD | Se busca el usuario de ALMA por el código del estudiante y se comparan su documento y su nombre con los guardados. |
| Reconsulta | Botón «Consultar de nuevo»: para el estudiante cuenta como reenvío (3 por día, hasta `fecha_fin − 7`); la funcionaria también puede consultar de nuevo. |
| JSON | `ALMA_SIMULACION_ARCHIVO`, en `checku_datos_locales`. Se agrega un patrón a `.gitignore`. Las pruebas generan su propio JSON. |
| Tabla | Un solo componente en `estudiante/home`, `estudiante/preinscripcion` y el detalle de la funcionaria. |

## 4. Motor (Python)

### 4.1 Cliente simulado

Nuevo `modules/validadores/fuentes/alma/simulado.py`, con `AlmaClienteSimulado`. Tiene la misma
interfaz pública que `AlmaCliente`:
- `prestamos(user_id)`, `multas(user_id)` y `solicitudes(user_id)` devuelven `ListaAlma`;
- `usuario(user_id)` devuelve `dict | None`. Es nuevo y también se agrega a `AlmaCliente`, con
  `GET /almaws/v1/users/{id}`.

Lee el JSON de `ALMA_SIMULACION_ARCHIVO` y reproduce las respuestas de la API, sin inventar campos:

```json
{
  "usuarios": {
    "T00000001": {
      "user": { "primary_id": "T00000001", "first_name": "…", "last_name": "…",
                "user_identifier": [{ "id_type": { "value": "CC" }, "value": "1000000001" }] },
      "loans":    { "item_loan": [ … ], "total_record_count": 0 },
      "fees":     { "fee": [ … ], "total_record_count": 0, "total_sum": 0, "currency": "COP" },
      "requests": { "user_request": [ … ], "total_record_count": 0 }
    }
  }
}
```

Comportamiento:
- **Usuario que no está en el archivo:** `usuario()` devuelve `None`, y los listados lanzan
  `AlmaClienteError(codigo_http=404)`, igual que la API.
- **Falta la variable, o el archivo no existe o no es JSON:** lanza `AlmaClienteError`. La
  consulta queda `no_evaluable` / `source_unavailable`.
- Cada listado pasa por la misma extracción de `cliente.py` (`_extraer_items`,
  `_total_reportado`), así que un listado mal formado se marca incompleto igual que con la API real.

**Selección del cliente.** `crear_cliente()`, en `config.py`, decide según `ALMA_MODO`:
- `simulado` (por defecto) usa `AlmaClienteSimulado`;
- `real` usa `AlmaCliente`.

Cambiar a la API real es cambiar esa variable: nada que consuma el resultado se modifica.

### 4.2 Criterios

- **Nuevo `evaluar_solicitudes(lista)`.** Cuenta como pendiente toda solicitud cuyo
  `request_status` (o `status`) no sea final.
  - Pendientes: `NOT_STARTED`, `IN_PROCESS`, `ON_HOLD_SHELF`, `ACTIVE`, `PENDING`.
  - Finales: `COMPLETED`, `CANCELED`, `CANCELLED`, `HISTORY`.
  - Un estado desconocido o un listado incompleto dan `no_evaluable` / `incomplete_data`.
  - El mensaje es «Tiene N solicitud(es) pendiente(s) en Biblioteca.».
- **`consolidar_estado`, `acciones_requeridas` y `mensaje_general`** usan préstamos, multas y
  solicitudes. La acción para las solicitudes es «Cerrar o cancelar las solicitudes pendientes en
  Biblioteca.».
- **`criterio_a_dict("solicitudes", …)`** incluye `pendientes`.
- **«Opción de grado»** se sigue informando en `criterios.opcion_grado`, pero no entra en la
  consolidación. Se agrega `"informativo": true`.

### 4.3 Contraste de identidad y endpoint

Nuevo `consultar_para_checku(user_id, identidad, *, cliente=None)`, en `consultar.py`. `identidad`
es `{numero_documento, nombres, apellidos}` y sale de la BD.

1. `usuario = cliente.usuario(user_id)`.
   - Si es `None`, el estado es `no_encontrado` y no se consultan los listados.
   - Si lanza un error, el estado es `no_evaluable`.
2. Coincide si el documento coincide exactamente con algún `user_identifier.value` (comparando solo
   letras y dígitos) **y** el nombre coincide sin tildes, mayúsculas ni espacios de más.
   - Si no coincide, el estado es `inconsistente` y no se consultan los listados.
3. Si coincide, se llama a `consultar_paz_y_salvo` y el resultado se devuelve con
   `identidad: {coincide: true}`.

La salida mantiene la forma de `consultar_paz_y_salvo`, más estos campos:
- `fuente`: `"alma_simulada"` o `"alma"`;
- `identidad`: `{ "coincide": bool | null, "campos_distintos": [...] }`;
- `estado`: ahora también puede ser `"no_encontrado"` o `"inconsistente"`.

Nunca devuelve el nombre ni el documento que tiene ALMA, solo si coinciden.

**Endpoint.** Nuevo `POST /biblioteca/paz-y-salvo` en `modules/api/app.py`.
- Recibe JSON: `{ "id_student": "T…", "identidad": { … } }`.
- Responde 200 con el resultado; 400 si falta `id_student`.
- No usa archivos.

## 5. Base de datos (`010-paz-y-salvo-consulta.sql`, también al final de `01-schema.sql`)

- `documentos.origen VARCHAR(10) NOT NULL DEFAULT 'ARCHIVO'`, con CHECK `IN ('ARCHIVO','CONSULTA')`.
- `nombre_original`, `mime_type` y `tamano_bytes` pasan a admitir NULL. Un CHECK nuevo exige
  `origen='CONSULTA' OR (nombre_original IS NOT NULL AND mime_type IS NOT NULL AND tamano_bytes > 0)`.
  `chk_documento_tamano` pasa a `tamano_bytes IS NULL OR tamano_bytes > 0`.
- La migración se puede repetir. Los Paz y Salvo con PDF que ya existen quedan como histórico
  (`ARCHIVO`).

## 6. Backend

- **`requisitos-documentales.ts`:** cada requisito lleva `origen: 'archivo' | 'consulta'`.
  `paz_y_salvo_bib` es `consulta`. Agrega `documentosASubir(nivel, doble)`, que filtra los de
  `archivo`. Los subidos son 4, 6 o 2; el total de requisitos sigue en 5, 7 o 3.
- **Archivos:** el envío, `validarArchivos`, `validarRequisitosCompletos`, los reenvíos y el
  borrador usan `documentosASubir`. Un PDF de `paz_y_salvo_bib` se rechaza con «Paz y Salvo se
  consulta automáticamente con Biblioteca; no se sube.».
- **`BibliotecaService`:**
  - pasa a `consultar(estudiante: { codigo, numeroDocumento, nombres, apellidos }): Promise<ResultadoBiblioteca>`;
  - `ResultadoBiblioteca` es la salida del motor (§4.3), validada con zod;
  - la implementación nueva es `BibliotecaMotorService`, que hace `POST {MOTOR_URL}/biblioteca/paz-y-salvo`;
  - se mantiene `consultarConLimite` (5 s, errores y respuestas desconocidas);
  - si no hay respuesta, `{estado:'no_evaluable', motivo:'source_unavailable'}`;
  - se borran el demo (`BibliotecaDemoService`, `paz-y-salvo-demo.ts`).
- **Estado del documento:**

  | `estado` | Documento |
  |---|---|
  | `cumple` | VALIDO |
  | `no_cumple` | NO_VALIDO |
  | `inconsistente` | INCONSISTENTE |
  | `no_evaluable` / `no_encontrado` / sin respuesta | POR_REVISAR |
- **Envío inicial:** después de crear la entrega, el sistema inserta la fila `paz_y_salvo_bib`
  (`origen='CONSULTA'`, sin archivo ni ruta), consulta y guarda una `validaciones`
  (`tipo_validacion='REQUISITOS'`) con `detalle = { fuente, resultado }`.
- **Reconsulta del estudiante:** `POST /estudiante/solicitudes/:id/paz-y-salvo/consulta`, con
  `clave` de idempotencia.
  - Sigue las mismas reglas que un reenvío: estado que admite correcciones, 3 por día y
    `fecha_fin − 7`.
  - Crea una entrega `CORRECCION` y una versión nueva del documento (`CONSULTA`), y recalcula una
    vez.
  - Si el Paz y Salvo actual ya es VALIDO, responde 403 con el mensaje de siempre.
- **Reconsulta de la funcionaria:** `POST /funcionario/solicitudes/:id/paz-y-salvo/consulta`.
  - No consume intentos del estudiante.
  - Agrega una `validaciones` a la versión actual, actualiza su estado y recalcula.
  - No aplica en estados finales.
- **Detalle y observaciones:** `detalle-analisis` expone `origen` y `bibliotecaResultado` (el
  `resultado` del motor) por documento. `observacionesDocumento` usa el `mensaje` del resultado.
  Un documento `CONSULTA` no tiene «archivo original».
- **Progreso:** «Consultando Paz y Salvo en Biblioteca.».

## 7. Frontend

- **`documentos-requeridos.ts`:** `paz_y_salvo_bib` pasa de `retirando: true` a `consulta: true`.
  - `documentosRequeridos()`, la lista del formulario, ya no lo incluye: quedan 4, 6 o 2 zonas de
    carga.
  - La bienvenida lo muestra como «Paz y Salvo de Biblioteca (se consulta automáticamente)».
  - El resumen del inicio (`construirRequisitos`) sigue contando 5, 7 o 3 requisitos.
- **Nuevo `TablaPazYSalvo`** (`app/components/biblioteca/`):
  - columnas: Tipo de obligación · Detalle · Cantidad · Estado;
  - filas: Préstamos activos, Multas (con valor total y moneda), Solicitudes pendientes, y la fila
    informativa Opción de grado;
  - arriba, el estado general y el mensaje;
  - si el resultado es `inconsistente` o `no_encontrado`, el motivo en lugar de las filas;
  - tabla accesible (caption, encabezados) y responsive, con los tokens de color existentes.
- **Dónde se usa:**
  - `estudiante/home` (`TarjetaSolicitudReciente`): bajo el requisito Paz y Salvo, con el botón
    «Consultar de nuevo» en lugar de «Volver a subir»;
  - `estudiante/preinscripcion`: dentro de `DocumentAnalysis` para ese documento, con el mismo botón;
  - `funcionario/detalle_preinscripcion/[id]`: dentro del documento y de su análisis, con el botón
    «Consultar de nuevo» de la funcionaria.

  Las tres vistas leen el mismo `bibliotecaResultado` del backend.

## 8. Datos de prueba (fuera del repositorio)

- **Archivo:** `C:\Users\hectr\OneDrive\Documentos\UTB\checku_datos_locales\alma\alma_simulacion.json`.
  Solo datos inventados.
- **Usuarios** (nombres y documentos inventados):

  | Usuario | Caso |
  |---|---|
  | `T00000001` | Paz y salvo. Es el estudiante de prueba de `02-userbase.sql`, con el documento que tenga en la BD local. |
  | `T00000101` | Con préstamos |
  | `T00000102` | Con solicitudes |
  | `T00000103` | Con multas |
  | `T00000104` | Combinado |
  | `T00000105` | Documento distinto (inconsistente) |

  Un código que no está en el archivo da «no encontrado».

  Para ver otro escenario con el usuario de prueba, se copia el bloque de ese escenario bajo
  `T00000001` en el JSON. La documentación lo explica.
- **`.gitignore`:** `alma_simulacion*.json` y `**/datos_locales/`.
- **Documentación** (`docs/tarea50_paz_y_salvo_alma.md`): cómo crear el archivo, con un ejemplo
  mínimo en la documentación pero sin datos personales; cómo apuntar la variable en local; cómo
  montarlo en Docker con un volumen de solo lectura en el servicio del motor.

## 9. Pruebas

**Python (pytest), con JSON temporales generados en la prueba:**
- el cliente simulado: listados, paginación, 404, archivo ausente o inválido;
- `evaluar_solicitudes`;
- la consolidación de los **5 escenarios** de la issue;
- el contraste de identidad (coincide, documento distinto, nombre con tildes);
- el endpoint Flask.

**Backend:**
- unitarias de `requisitos-documentales` (4/6/2 a subir, 5/7/3 requeridos) y del mapeo de estados;
- e2e con PGlite y el motor simulado:
  - el envío sin PDF de Paz y Salvo crea el documento `CONSULTA` con su resultado;
  - se rechaza un PDF de Paz y Salvo;
  - los cinco escenarios y el inconsistente dan el estado de documento y de solicitud esperados;
  - la reconsulta del estudiante cuenta como reenvío y respeta el plazo;
  - la reconsulta de la funcionaria no consume intentos;
  - el esquema base solo admite documentos `CONSULTA`.

**Frontend (Playwright):**
- el formulario ya no muestra la zona de Paz y Salvo;
- `TablaPazYSalvo` en las tres vistas, con axe en los dos temas y sin desbordes;
- «Consultar de nuevo».

## 10. Fuera de alcance

- La conexión real con ALMA. Solo queda lista para activarse con `ALMA_MODO=real`.
- La fuente de «opción de grado», que sigue sin definir.
