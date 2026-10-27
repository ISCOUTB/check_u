# Tarea 36 — Envío real y persistencia del análisis documental

Issue: https://github.com/ISCOUTB/check_u/issues/84

## Flujo y contratos

El formulario conserva cada `File` en memoria durante la visita. El envío real usa
`POST /api/solicitudes/enviar` con `multipart/form-data`: `datos` (JSON del formulario),
`tipos` (claves de las zonas de carga) y `documentos` (PDF en el mismo orden).
Guardar un borrador sigue siendo JSON y no guarda bytes del PDF. Después de recargar
un borrador hay que seleccionar nuevamente sus PDF; la interfaz lo explica y evita
enviar únicamente nombres de archivo. No se anuncian éxitos simulados en errores de red.

El controlador autentica al estudiante antes de procesar los datos; el identificador
de usuario procede de la sesión. El backend comprueba tipos, nivel, número de archivos,
orden de segunda estampilla, MIME, encabezado PDF y límites de tamaño. El máximo es
25 MB por PDF y 50 MB para el conjunto. MIME y encabezado son controles de entrada,
no prueban que el contenido documental sea válido: eso corresponde al motor.

Se reutiliza `DocumentosService`, el mismo cliente de `POST /api/documentos/analizar`
de las tareas previas. No se crea otro endpoint de análisis ni otro cliente HTTP;
tampoco se hace una llamada HTTP del servidor a sí mismo. El contrato con el motor
continúa siendo `estudiante`, `tipos`, `documentos`. Se usa `MOTOR_URL`, cuyo servicio
Python correcto es `modules.api.app`, no la integración antigua `motor_ocr.app`.

Se transmite un documento por llamada al motor. Así cada respuesta queda ligada de
forma inequívoca al documento de esa llamada, incluso cuando hay dos estampillas.
El validador individual de estampilla devuelve `document_order=1`; la posición final
1/2 se toma de la zona de carga y se persiste junto a la respuesta. No se implementan
reglas OCR nuevas ni comparaciones cruzadas adicionales en esta tarea.

Tipos por nivel:

| Nivel | Documentos |
| --- | --- |
| PREGRADO | identification, academic_evaluation, paz_y_salvo_bib, estampilla_pro_cultura, saber_pro |
| POSGRADO | identification, paz_y_salvo_bib, estampilla_pro_cultura |
| PREGRADO con segundo programa | Los anteriores y estampilla_pro_cultura-2 |

`academic_evaluation` se ejecuta en el motor existente. Paz y Salvo aún no está en
`modules.api.validacion.VALIDADORES`: se conserva su archivo y se registra expresamente
`POR_REVISAR` / validación `PENDIENTE`, sin inventar una lectura ni declararlo válido.

## Consistencia y persistencia

Primero se guarda el borrador; después se bloquea la solicitud y se ejecuta la entrega
con el análisis y su registro dentro de una transacción. Si la comunicación falla,
vence el timeout, el motor devuelve JSON inválido, un error de ejecución o un resultado
incompatible con el contrato, se revierte la entrega y se conserva el borrador.
Los archivos creados durante la transacción fallida se eliminan; los huérfanos que
pueda dejar una caída de proceso se recuperan mediante limpieza posterior.

Cada resultado se valida con `DocumentValidationResult` de Zod y se comprueban identidad,
tipo y versión. Un `valid` sin reglas obligatorias cumplidas o con errores no produce
`VALIDO`. Los estados pendientes/fallidos quedan `POR_REVISAR`, sin tratar problemas de
lectura como evidencia de falsedad. El timeout abarca también la lectura de la respuesta.
Los errores HTTP del motor no se propagan con rutas internas ni detalles de excepciones.

Se usan las tablas existentes:

- `solicitud_grado` y `entregas`: estudiante, periodo y entrega inicial.
- `documentos`: tipo, orden, tamaño real, SHA-256, versión y estado documental.
- `validaciones`: resultado y `detalle JSONB` con datos extraídos, reglas y respuesta documental.
- `historial_validaciones`: evento inicial del resultado de cada validación.
- `rutas`: clave privada del archivo, expiración y estado/errores de limpieza.

No se agregan tablas. La migración `004-analisis-preinscripcion.sql` añade solamente
las columnas necesarias a `validaciones` y `rutas`, y un índice. Es repetible y no borra
registros. No se guardan eventos automáticos como revisiones de un funcionario.
Los documentos ya entregados y sus validaciones históricas se conservan. El envío
inicial mantiene la regla actual de aceptar solo solicitudes `BORRADOR`; un segundo
intento después de confirmar la transacción recibe 409 y no repite el análisis.

## Consulta y presentación

`GET /api/estudiante/solicitud/analisis` consulta la solicitud más reciente del
estudiante autenticado en un snapshot de PostgreSQL. No acepta un identificador
ajeno como selector. Devuelve estado, perfil y resultados persistidos. Recargar o
iniciar otra sesión no vuelve a ejecutar el OCR.

La página `/estudiante/preinscripcion` utiliza esta consulta y elimina sus datos de
demostración. El modal muestra campos y reglas de `validaciones.detalle`; se retiró
su antigua vista previa de PDF con datos inventados. Las reglas `no_evaluable` se
muestran como «No evaluable», diferenciadas de «No cumple». Sin resultados se muestra
«Análisis documental pendiente», nunca una aprobación por tener una lista vacía.

El reenvío de correcciones no está implementado por el backend actual: no se conserva
el antiguo botón que simulaba éxito. No se habilita ni promete un reenvío en esta tarea.
Tampoco se expone una descarga pública de los PDF; la vista original se anuncia como
no disponible. Los datos extraídos y las observaciones sí pueden consultarse.

## Conservación de archivos

`DOCUMENTOS_TEMP_DIR` configura una carpeta privada fuera del repositorio y sin
publicación estática. Por defecto se usa `checku-documentos` bajo el temporal del SO.
En producción debe configurarse en un volumen privado que sobreviva a reinicios y
reemplazos del contenedor. Se generan claves UUID y se evitan rutas de usuario.

El modelo distingue `fecha_fin` (cierre de inscripción) de `fecha_graduacion` (ceremonia).
La política de esta tarea usa `fecha_fin`: se conservan completos los 15 días calendario
adicionales y el archivo vence a las 00:00 de Bogotá del día `fecha_fin + 16`.

La limpieza consulta PostgreSQL al iniciar y cada hora. Recalcula la expiración desde
el periodo asociado, respeta extensiones del periodo, elimina únicamente archivos
vencidos y marca su ruta inactiva. No borra documentos, validaciones ni historial.
La ausencia física de un archivo vencido permite completar la limpieza; los demás
errores quedan registrados y se reintentan. Los UUID sin referencia SQL de más de 24 h
se eliminan como huérfanos. No depende de temporizadores individuales que se pierdan
al reiniciar. Una aplicación detenida recupera los vencimientos al volver a arrancar.

## Aplicación local en Windows

Desde `C:\check_u`, aplicar la migración a la base local existente sin eliminar el volumen:

```powershell
docker cp db/migrations/004-analisis-preinscripcion.sql checku-db-local:/tmp/tarea36.sql
docker exec checku-db-local psql -v ON_ERROR_STOP=1 -U checku -d checku_local -f /tmp/tarea36.sql
```

Configurar `backend/.env`:

```dotenv
MOTOR_URL=http://127.0.0.1:5001
MOTOR_TIMEOUT_MS=60000
DOCUMENTOS_TEMP_DIR=C:/checku-datos-temporales
```

Arrancar el motor desde la raíz, con el Python que tiene sus dependencias y Tesseract
con idiomas español e inglés. `Flask` debe estar disponible en ese entorno:

```powershell
python -m modules.api.app
```

Reiniciar el backend y frontend con sus comandos habituales. La base debe conservar
el esquema compatible de las tareas previas y un periodo de inscripción elegible.

## Pruebas reproducibles

```powershell
npm --prefix backend run build
npm --prefix backend run test:e2e -- --no-file-parallelism
cd frontend
npx next typegen
npx tsc --noEmit
npx playwright test e2e/analisis_preinscripcion.spec.ts e2e/periodo_inscripcion.spec.ts e2e/preinscripcion_api.spec.ts
```

La prueba opcional con motor real requiere el motor iniciado en 5001 y sus dependencias.
Genera un PDF sintético sin documentos personales reales. Desde la raíz:

```powershell
$env:OCR_REAL_TEST = "1"
$env:OCR_TEST_PYTHON = "python"
$env:EVIDENCIAS_DIR = "$PWD/docs/evidencias-tarea36"
npm --prefix backend run test:e2e -- test/analisis-preinscripcion.e2e-spec.ts -t "motor real" --no-file-parallelism
```

Para incluir navegador conectado al backend real y captura de la interfaz, instalar
Chromium desde `frontend` (`npx playwright install chromium`), liberar puertos 3000 y
3004, y añadir `$env:CAPTURAR_UI_REAL = "1"`. La prueba arranca su propio NestJS,
PostgreSQL embebido y Next.js, consulta por HTTP y recarga la página. No utiliza la base
local ni sus solicitudes. El motor real de 5001 permanece externo a esa prueba.

Los PDF sintéticos permiten demostrar el transporte, la ejecución del motor, el registro
SQL y la consulta. No demuestran que un documento institucional real deba aprobar:
pueden producir estados no válidos o por revisar, que se conservan tal como corresponde.

## Consultas de evidencia

```sql
SELECT id_solicitud, id_estudiante, id_periodo, estado FROM solicitud_grado;
SELECT d.id_documento, d.id_solicitud, d.id_entrega, d.tipo_documento, d.orden,
       d.estado, v.id_validacion, v.resultado, v.detalle
FROM documentos d JOIN validaciones v USING (id_documento)
ORDER BY d.id_solicitud, d.id_documento, v.id_validacion;
SELECT r.id_documento, r.expira_en, r.activa, r.eliminado_en, r.error_limpieza
FROM rutas r;
SELECT * FROM historial_validaciones ORDER BY id_historial;
```

## Evidencias y límites de la verificación

`evidencias-tarea36/motor-real.json`, `persistencia-real.json` y `consulta-real.json`
proceden de una ejecución con el motor Flask real y PostgreSQL embebido.
`interfaz-real.png` se capturó con Next.js conectado por HTTP a ese backend, sin
interceptar sus consultas. La misma prueba recargó la página y comprobó los cinco
documentos. Los datos pertenecen a las fixtures de prueba del proyecto; los PDF son
sintéticos. No se incluyen archivos personales ni sus bytes originales.

Verificación realizada: compilación del backend y tipos del frontend; 57 pruebas de
API aprobadas, con una prueba opcional omitida que se ejecutó y aprobó por separado
con el motor real y captura de navegador; 10 pruebas de navegador aprobadas, incluidas
las cinco de la tarea 35 y accesibilidad en ambos temas. También aprobaron las 32
pruebas del cliente de preinscripción.

La suite unitaria general del backend conserva cinco fallas anteriores a esta tarea:
una del JSON Schema exportado desactualizado (`contratos/exportar.spec.ts`) y cuatro
mocks de segundo programa en `solicitudes.service.spec.ts`. El flujo de segundo
programa sí se verifica con SQL real en las pruebas de integración. No se reporta la
suite unitaria general como aprobada. Las doce pruebas del controlador afectado pasan.
