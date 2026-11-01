# Tarea 44: cancelar una preinscripción

Issue: https://github.com/ISCOUTB/check_u/issues/107. Relacionada con el listado de la tarea 45: https://github.com/ISCOUTB/check_u/issues/106.

Base: `main`, commit `c336ab9271c0149daec02b7eb5f6bbc9dc9aab2f`. Rama: `tarea44_cancelar_preinscripcion`.

## Resultado y alcance

El estudiante puede cancelar voluntariamente una preinscripción en estado `EN_PROCESO`. La confirmación identifica su periodo y muestra los días que quedan hasta `fecha_fin − 7`, calculados en el backend con la fecha de Bogotá. Confirmar cambia la solicitud a `CANCELADA`; conservar, cerrar o presionar Escape antes de confirmar no modifica la solicitud.

La operación no borra solicitudes, programas, entregas, documentos, rutas, validaciones ni observaciones. Se crea un único registro en `cancelaciones_preinscripcion`, con fecha, propietario, estado anterior y una instantánea del perfil del estudiante al cancelar. Esta instantánea evita que cambiar el perfil en otro periodo altere la consulta de la preinscripción cancelada. Los documentos y datos específicos ya están asociados a cada solicitud y conservan sus versiones.

La cancelada deja de ser activa, no admite reenvíos ni decisiones que la reactiven, no recibe nuevos recordatorios de plazo y sale del tablero operativo de la funcionaria. Se conserva en la base de datos, con consulta del detalle y de los resultados por ID. La vista de historial corresponde a #106. El acceso al PDF original mantiene la política de disponibilidad y conservación de la tarea 36: cancelar no lo elimina ni amplía indefinidamente su plazo.

No hay dependencias ni variables de entorno nuevas. No se modifica el motor OCR.

## Reglas implementadas

| Requisito | Comportamiento |
| --- | --- |
| Botón | `Cancelar preinscripción`, solo para `EN_PROCESO`. Se deshabilita mientras ese cliente está enviando correcciones o cancelando. |
| Confirmación | Incluye el texto de la issue, nombre del periodo, fecha límite y días restantes. Si venció, muestra cero días y lo explica. Sin periodo no inventa fechas. |
| Propiedad | El estudiante se obtiene de su sesión. Una solicitud ajena o inexistente devuelve 404. Un funcionario no puede usar el endpoint del estudiante. |
| Persistencia | Transacción que toma primero `KEY SHARE` del usuario y después `FOR UPDATE` de la solicitud, compatible con el guardado y las claves foráneas del análisis. Estado y auditoría se confirman juntos; si falla la auditoría, se revierte el estado. |
| Duplicados | Repetir una cancelación ya confirmada devuelve el mismo estado y fecha, sin otra auditoría ni una segunda transición. |
| Irreversibilidad | El backend rechaza decisiones/reenvíos de la cancelada. Un trigger impide cambiar su estado, propietario, nivel o periodo. La auditoría no se modifica ni elimina. |
| Consulta | El historial y el detalle por ID comprueban el propietario. El detalle predeterminado prioriza una solicitud activa. |
| Otra preinscripción | Puede crearse en otro periodo que resulte elegible. El selector automático omite los periodos en los que ese estudiante tiene una solicitud cancelada; no reactiva ni reutiliza la anterior. |
| Errores | No se anuncia éxito antes de la respuesta de la API. Una espera agotada informa que debe consultarse el estado. El diálogo ofrece actualizar la preinscripción. |

La cancelación se permite por estado; esta tarea no añade una prohibición de cancelar después de la fecha de corte. Ese plazo se informa en el mensaje solicitado. Las reglas previas de elegibilidad de los periodos se mantienen, excluyendo los periodos cancelados por el estudiante.

## Integración con tarea 45

La vista del historial corresponde a la tarea #106. Por revisión de la PR #110, esta entrega no muestra el bloque «Historial de preinscripciones» en home, bienvenida ni detalle. Se retiró el componente y sus estilos; estas pantallas no consultan el listado para construir ese bloque.

Se conservan los datos, la auditoría, los endpoints de consulta propios y el detalle por ID. Cancelar sigue mostrando la confirmación en el detalle y permite recargar esa URL. La tarea #106 podrá presentar el listado en su vista correspondiente.

Se conservan los nombres internos existentes: `NO_VALIDA` se presenta como Inválida y `CERRADA` como Anulada. `CANCELADA` es un estado distinto, exclusivo de la cancelación voluntaria. La navegación usa el contrato de la tarea 34 (`SIN_SOLICITUD`, `BORRADOR`, `ENVIADA`); una cancelada o anulada no cuenta como solicitud activa.

El detalle histórico utiliza `/estudiante/preinscripcion?solicitud=ID`. Verifica la sesión y consulta el ID propio sin aplicar la redirección de la solicitud activa. Esto permite revisar una cancelada aunque no haya otra solicitud o exista un borrador nuevo. Los parámetros de URL no permiten consultar solicitudes ajenas.

## API

Prefijo común: `/api`. Todas estas rutas requieren sesión de estudiante y devuelven `Cache-Control: private, no-store`.

| Método y ruta | Resultado |
| --- | --- |
| GET `/estudiante/solicitudes` | `{solicitudes:[…]}`, ordenado por creación e ID descendentes, incluyendo las canceladas. |
| GET `/estudiante/solicitudes/:id/analisis` | Detalle propio por ID, con documentos, resultados, periodo y datos de cancelación. |
| POST `/estudiante/solicitudes/:id/cancelacion` | Confirma la cancelación o devuelve la confirmación anterior si ya estaba cancelada. No recibe el estudiante ni un estado solicitado por el cliente. |

Ejemplo de respuesta de cancelación (POST 201):

```json
{"ok":true,"id":"1","estado":"CANCELADA","yaCancelada":false,"canceladaEn":"2026-10-31T15:00:00.000Z"}
```

El listado conserva `id`, `nivel`, `estado`, `activa`, `fechaSolicitud`, `fechaCreacion`, `canceladaEn` y `periodo` con ID/nombre/inicio/fin/corte. `fechaSolicitud` es la fecha de la entrega inicial; es null si no hubo envío. Las fechas sin periodo no se inventan.

El detalle añade `cancelacion` con `permitida`, `canceladaEn`, `fechaActual`, `nombrePeriodo`, `fechaCorte` y `diasRestantes`. Las fechas calendario se formatean sin convertirlas a otra zona horaria.

## Aplicar el parche en Windows

Descargar `tarea44_cancelar_preinscripcion.patch` en Descargas. Primero terminar y subir cualquier cambio pendiente de otra tarea; el bloque siguiente exige un árbol limpio. No usar el ZIP para sobrescribir archivos de una versión distinta.

```powershell
cd C:\check_u
& {
    if (@(git status --porcelain).Count -gt 0) { throw 'Hay cambios locales pendientes; consérvalos antes de cambiar de tarea.' }
    git switch main
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo seleccionar main.' }
    git pull --ff-only
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo actualizar main.' }
    if (git branch --list tarea44_cancelar_preinscripcion) {
        git switch tarea44_cancelar_preinscripcion
    } else {
        git switch -c tarea44_cancelar_preinscripcion
    }
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar la rama.' }
    $parche = "$HOME\Downloads\tarea44_cancelar_preinscripcion.patch"
    git apply --check $parche
    if ($LASTEXITCODE -ne 0) { throw 'El parche no coincide con esta versión. Detente y revisa la salida.' }
    git apply $parche
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo aplicar el parche.' }
    git diff --check
    if ($LASTEXITCODE -ne 0) { throw 'Revisar los espacios indicados por Git.' }
    git status --short
}
```

Si el parche ya se aplicó, no ejecutar de nuevo el bloque de aplicación. Comprobar `git status` y continuar con la migración y las pruebas.

## Migración de una base existente

Requiere la base correspondiente a main, con las migraciones anteriores hasta 007. La migración 008 es repetible y no elimina datos ni reconstruye la base.

Con Docker Desktop abierto, detener el backend antes de aplicar:

```powershell
cd C:\check_u
& {
    docker compose -f docker-compose.local.yml up -d db
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar PostgreSQL.' }
    docker exec checku-db-local pg_isready -U checku -d checku_local
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL todavía no está listo; vuelve a comprobarlo.' }
    docker cp db/migrations/008-cancelacion-preinscripcion.sql checku-db-local:/tmp/tarea44.sql
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo copiar la migración.' }
    docker exec checku-db-local psql -v ON_ERROR_STOP=1 -U checku -d checku_local -f /tmp/tarea44.sql
    if ($LASTEXITCODE -ne 0) { throw 'Falló la migración; no iniciar todavía el backend.' }
    npm.cmd --prefix backend run build
    if ($LASTEXITCODE -ne 0) { throw 'Falló la compilación del backend.' }
}
```

Para una instalación nueva y vacía, `db/init/01-schema.sql` ya incluye el cambio y después se ejecuta `db/init/02-userbase.sql`, como en el procedimiento local habitual. No hay que borrar el volumen de Docker para aplicar esta tarea.

## Arranque y prueba local

Backend, en una terminal (configuración del contenedor local del proyecto):

```powershell
cd C:\check_u
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '5432'
$env:DB_USER = 'checku'
$env:DB_PASSWORD = 'checku_local_2026'
$env:DB_NAME = 'checku_local'
$env:MOTOR_URL = 'http://127.0.0.1:5001'
npm.cmd --prefix backend run start:dev
```

Frontend, en otra terminal:

```powershell
cd C:\check_u\frontend
npm.cmd run dev -- --webpack
```

Para crear una solicitud mediante envío documental, iniciar también OCR:

```powershell
cd C:\check_u
docker compose -f docker-compose.local.yml up -d --build ocr
Invoke-RestMethod http://localhost:5001/salud
```

| Servicio | Dirección |
| --- | --- |
| Acceso | http://localhost:3001 |
| Detalle actual | http://localhost:3001/estudiante/preinscripcion |
| Detalle histórico | http://localhost:3001/estudiante/preinscripcion?solicitud=ID |
| Home | http://localhost:3001/estudiante/home |
| Dashboard de funcionaria | http://localhost:3001/funcionario/dashboard |
| Backend | http://localhost:3000/api/health |
| OCR | http://localhost:5001/salud |

Prueba manual:

1. Iniciar como funcionaria local (`rmarriaga@utb.edu.co`, contraseña `12345`). Preparar un periodo abierto, por ejemplo inicio hoy y cierre dentro de 10 días: el plazo documental informado será dentro de 3 días.
2. Como estudiante local (`lizapata@utb.edu.co`, contraseña `12345`), enviar una preinscripción de prueba. El botón de cancelación aparece cuando el estado persistido sea EN_PROCESO, no mientras sea borrador.
3. Pulsar Cancelar preinscripción. Comprobar el texto, nombre del periodo, fecha de cierre menos siete y días restantes. Pulsar Conservar preinscripción o Escape: no debe cambiar el estado.
4. Volver a abrir y confirmar. Debe aparecer Preinscripción cancelada, desaparecer el botón de cancelación y bloquearse las correcciones. No debe aparecer un bloque de historial redundante.
5. Recargar. Abrir el análisis de un documento y comprobar que sus datos/observaciones se conservan. El original puede verse mientras siga disponible según su plazo habitual.
6. Entrar al home: si no queda solicitud activa, se abre bienvenida sin el bloque de historial. El detalle cancelado sigue siendo consultable mediante su URL con `?solicitud=ID`, sin reactivarlo.
7. Si no hay otro periodo elegible, no debe poder guardarse una nueva preinscripción en el mismo periodo cancelado. Preparar otro periodo elegible y comprobar que el nuevo borrador obtiene otro ID/periodo; el detalle cancelado conserva sus datos anteriores.

Consultar la auditoría local, sin imprimir el perfil completo:

```powershell
docker exec checku-db-local psql -U checku -d checku_local -c "SELECT id_solicitud,id_estudiante,estado_anterior,fecha_cancelacion FROM cancelaciones_preinscripcion ORDER BY fecha_cancelacion DESC;"
```

## Pruebas automatizadas

Los tests HTTP usan PGlite (PostgreSQL embebido) con el SQL y triggers reales. No requieren el contenedor local. Las pruebas documentales simulan la clasificación OCR para controlar los escenarios. Para Playwright, mantener el frontend del paso anterior abierto en el puerto 3001 con Webpack; el runner lo reutiliza. Si falta el navegador, ejecutar `npx.cmd playwright install chromium` desde frontend.

```powershell
cd C:\check_u
npm.cmd --prefix backend run test:e2e -- test/cancelacion-preinscripcion.e2e-spec.ts --no-file-parallelism
npm.cmd --prefix backend run test:e2e -- --no-file-parallelism
npm.cmd --prefix backend run test -- src/solicitudes/solicitudes.service.spec.ts src/solicitudes/solicitudes.controller.spec.ts src/notificaciones/notificaciones-plazos.service.spec.ts
cd frontend
npx.cmd playwright test e2e/cancelacion_preinscripcion.spec.ts e2e/bienvenida.spec.ts e2e/solicitud_redireccion.spec.ts e2e/carga_preinscripcion.spec.ts e2e/completar_ocr.spec.ts e2e/inicio.spec.ts e2e/notificaciones.spec.ts
npm.cmd run build -- --webpack
```

Existe una prueba integrada opcional: arranca API, PostgreSQL embebido y frontend, cancela desde el navegador, verifica la auditoría y los documentos, recarga, consulta el detalle por ID y crea un borrador en otro periodo. Solo el motor OCR está simulado; no intercepta las respuestas de la API.

Para ejecutarla, detener antes los procesos locales de backend/frontend. Usa puertos 3000 y 3005 y necesita la carpeta `.next` libre. Playwright debe tener Chromium instalado (`npx.cmd playwright install chromium` desde frontend si falta).

```powershell
cd C:\check_u
& {
    $env:CANCELACION_UI_REAL = '1'
    try {
        npm.cmd --prefix backend run test:e2e -- test/cancelacion-preinscripcion.e2e-spec.ts -t 'cancelación desde el navegador' --no-file-parallelism
        if ($LASTEXITCODE -ne 0) { throw 'Falló la prueba integrada.' }
    } finally {
        Remove-Item Env:CANCELACION_UI_REAL -ErrorAction SilentlyContinue
    }
}
```

## Verificación de esta entrega

Las cifras siguientes registran la entrega inicial. La verificación del retiro del bloque de historial se detalla en `docs/tarea44_retirar_historial.md`.

- 28 pruebas HTTP/SQL específicas de cancelación aprobadas, con permisos, estados, propiedad, rollback, conservación, reintentos, fechas de Bogotá, historial, otro periodo y perfil histórico.
- Regresión HTTP del backend: 130 pruebas aprobadas en seis archivos; tres pruebas opcionales omitidas en esa corrida.
- 33 pruebas unitarias de solicitudes/controlador/recordatorios aprobadas.
- 87 casos distintos seleccionados del navegador aprobados entre las corridas y sus comprobaciones posteriores: 22 de cancelación y 65 de bienvenida, redirecciones, carga, correcciones, home y notificaciones. Incluyen accesibilidad y reflujo.
- Prueba integrada opcional aprobada con API y PostgreSQL embebido reales; solo OCR simulado.
- Compilación de producción del frontend con Webpack, compilación del backend y comprobaciones de tipos aprobadas. Oxlint y ESLint de los archivos de la entrega aprobados.

Las fixtures del navegador se actualizaron para el contrato `/solicitudes/estado` integrado en main por la tarea 34. No se agregó un modo de demostración a producción. Las verificaciones corresponden al entorno de implementación; aplicar y comprobar también en el equipo local antes del merge.

## Un commit por archivo

Después de probar y revisar que los archivos pendientes sean únicamente de esta tarea:

```powershell
cd C:\check_u
& {
    if ((git branch --show-current).Trim() -ne 'tarea44_cancelar_preinscripcion') { throw 'Rama incorrecta.' }
    if (@(git diff --cached --name-only).Count -gt 0) { throw 'Hay archivos preparados previamente; revísalos primero.' }
    $archivos = @(git -c core.quotepath=false ls-files --modified --others --exclude-standard | Sort-Object -Unique)
    Write-Host "Se crearán $($archivos.Count) commits: uno por archivo."
    foreach ($archivo in $archivos) {
        git --literal-pathspecs add -- "$archivo"
        if ($LASTEXITCODE -ne 0) { throw "Error preparando $archivo" }
        git --literal-pathspecs commit --only -m "feat(tarea44): actualizar $archivo" -- "$archivo"
        if ($LASTEXITCODE -ne 0) { throw "Error creando commit de $archivo" }
    }
    git status
    git push -u origin tarea44_cancelar_preinscripcion
}
```

PR hacia main, título sugerido: `feat: permitir cancelar una preinscripción en proceso`.

Descripción sugerida: permite al propietario cancelar una preinscripción en proceso con confirmación y plazo institucional. Persiste CANCELADA con auditoría, bloquea su reactivación y reenvíos, y conserva su consulta histórica al iniciar otro periodo. Validación: pruebas HTTP/SQL, navegador e integración documentadas arriba. `Closes #107`. Compatible con #106, que conserva su alcance propio.

Conservar los commits individuales al integrar, conforme al acuerdo del equipo.

## Archivos de la entrega

- `backend/src/notificaciones/notificaciones.service.ts`
- `backend/src/periodos/asignacion-periodo.ts`
- `backend/src/solicitudes/cancelaciones.controller.ts`
- `backend/src/solicitudes/cancelaciones.service.ts`
- `backend/src/solicitudes/detalle-analisis.ts`
- `backend/src/solicitudes/solicitudes.module.ts`
- `backend/src/solicitudes/solicitudes.service.ts`
- `backend/test/cancelacion-preinscripcion.e2e-spec.ts`
- `db/init/01-schema.sql`
- `db/migrations/008-cancelacion-preinscripcion.sql`
- `docs/tarea44_cancelar_preinscripcion.md`
- `frontend/app/estudiante/bienvenida/page.tsx`
- `frontend/app/estudiante/home/page.tsx`
- `frontend/app/estudiante/preinscripcion/CancelarPreinscripcion.tsx`
- `frontend/app/estudiante/preinscripcion/api.ts`
- `frontend/app/estudiante/preinscripcion/page.tsx`
- `frontend/app/estudiante/preinscripcion/preinscripcion.module.css`
- `frontend/app/estudiante/preinscripcion/types.ts`
- `frontend/app/funcionario/detalle_preinscripcion/[id]/page.tsx`
- `frontend/e2e/bienvenida.spec.ts`
- `frontend/e2e/cancelacion_preinscripcion.spec.ts`
- `frontend/e2e/solicitud_redireccion.spec.ts`
- `frontend/e2e/soporte.ts`
