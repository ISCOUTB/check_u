# Tarea 41: módulo de notificaciones

Issue: https://github.com/ISCOUTB/check_u/issues/100. Base de esta entrega: `main`, commit `1babe3f`.

## Responsabilidad y alcance

Persistir y mostrar en el home del estudiante avisos de la oficina de grados, los análisis documentales y los plazos. La entrega no envía correo. Usa el usuario autenticado como destinatario; no recibe un estudiante arbitrario desde el navegador.

- `NotificacionesService.crear(...)` y la función SQL `crear_notificacion(...)` centralizan la creación. Las claves de evento evitan duplicar el mismo resultado, revisión o recordatorio diario.
- Cada validación documental nueva produce un aviso dentro de la misma transacción del análisis. Si falla otro documento o la transacción, también se revierten los avisos. Una corrección produce avisos para las versiones nuevas y conserva los anteriores.
- La clasificación determina título/tipo: Válido/success, No válido/error, Inconsistente/warning y Por revisar/info. El cuerpo incluye el documento, su versión y sus observaciones específicas.
- Biblioteca, que no tiene validación OCR integrada, conserva Por revisar y la explicación administrativa. Ese aviso se atribuye al sistema, no a una comprobación inexistente del motor.
- Las revisiones manuales quedan auditadas en `revisiones`. Su trigger crea la notificación también si otro módulo inserta una revisión directamente. Los documentos elegidos se guardan en `revisiones.documentos_ids`.
- El comentario completo se conserva en la revisión; el aviso contiene los primeros 15 caracteres y añade `…` únicamente si hay más. El recorte SQL respeta caracteres Unicode completos, incluidos emojis.
- El sistema crea un aviso por solicitud y día de Bogotá desde 15 días antes de `periodos_grado.fecha_fin`, incluido el día del cierre. No avisa después, para periodos cerrados, solicitudes sin periodo, solicitudes válidas ni cerradas. Esta fecha es el cierre de documentación, no la fecha de corte para nuevas asignaciones.
- Se revisan plazos al arrancar, cada 15 minutos y al consultar el listado del estudiante. La clave única protege contra procesos simultáneos y reintentos. Si el servidor estuvo apagado, al volver genera el aviso del día actual; no inventa avisos de días anteriores.
- El home consulta sus notificaciones reales independientemente de sus otros paneles. Muestra tipos con texto y color, actor, fecha/hora, estado vacío, error recuperable, tres avisos inicialmente y la opción de ver todos. Admite marcar como leída y cuenta las no leídas. La lectura solo cambia después de confirmación del servidor.

## Criterios de aceptación

| Criterio | Implementación y comprobación |
| --- | --- |
| Tabla y restricciones | Migración 007 y esquema inicial; tests de valores, destinatario y repetición. |
| Acciones de la funcionaria | Formulario real, API transaccional y trigger; info para aceptación/comentario, warning para recarga y error para anulación. Prueba integrada de las cuatro acciones. |
| OCR por documento | Un aviso por validación de cada documento/versión; título de clasificación y cuerpo con resultado/observaciones guardados. Tests de cuatro clasificaciones y rollback. |
| Plazo | Desde 15 días antes hasta el día de cierre, un aviso por solicitud/día, con días restantes; tests de bordes y repetición. |
| Comentario | Primeros 15 caracteres Unicode, más … si continúa; historial completo. |
| Privacidad | Destinatario obtenido de la sesión; una sesión de estudiante no accede a listado, revisión ni PDF de la funcionaria. |
| Canal | Solo home, sin correo. |

## Modelo y migración

`notificaciones` relaciona el destinatario con `usuarios`, cuya fila debe tener rol ESTUDIANTE; este proyecto no tiene una tabla separada de estudiantes. Opcionalmente relaciona solicitud, documento y revisión. Incluye tipo, título, mensaje, actor, lectura y clave de evento. `creado_en TIMESTAMPTZ` unifica fecha y hora; la API entrega también ambas por separado en America/Bogota. Los índices permiten recuperar por estudiante/fecha y contar no leídas.

Las instalaciones nuevas reciben el modelo desde `db/init/01-schema.sql`. Las bases existentes requieren **007-notificaciones.sql**. Reiniciar los contenedores no vuelve a ejecutar automáticamente los archivos de inicialización de un volumen existente.

No se borran documentos, revisiones ni avisos existentes. La migración es repetible. No se generan retrospectivamente avisos OCR de análisis anteriores a esta entrega: para comprobarlos, registrar un análisis o una corrección nuevos.

## API

Todas las rutas llevan el prefijo `/api`.

| Método/ruta | Rol | Comportamiento |
| --- | --- | --- |
| GET `/estudiante/notificaciones` | Estudiante | Solo propias, fecha descendente e ID descendente como desempate; responde `{notificaciones, noLeidas}`. |
| PATCH `/estudiante/notificaciones/:id/leida` | Estudiante | Marca una notificación propia; repetible. Una ajena o inexistente devuelve 404. |
| GET `/funcionario/solicitudes` | Funcionario | Listado real con estudiante, nivel, estado y periodo asociado. |
| GET `/funcionario/solicitudes/:id` | Funcionario | Perfil, documentos actuales e historial de la solicitud indicada. |
| GET `/funcionario/documentos/:id/original` | Funcionario | PDF privado, con el mismo plazo de conservación del estudiante. |
| POST `/funcionario/solicitudes/:id/revisiones` | Funcionario | Registra una acción manual y su aviso de manera atómica. |

Cuerpos del endpoint de revisiones:

```json
{"accion":"comentario","comentario":"Revisa los datos de tu documento de identidad."}
```

```json
{"accion":"recarga","documentos":[1,4],"comentario":"Adjunta versiones legibles."}
```

```json
{"accion":"aceptada"}
```

```json
{"accion":"anulada","comentario":"No cumple los requisitos del proceso."}
```

Los identificadores de recarga deben ser versiones actuales y pertenecer a la solicitud. No permite pedir una recarga de documentos que ya estén válidos. Aceptada registra APROBADA y cambia la solicitud a VALIDA; anulada registra RECHAZADA y la cambia a CERRADA; recarga registra CORRECCION_REQUERIDA y cambia a POR_REVISAR. Un comentario usa POR_REVISAR en la revisión, sin cambiar el estado de la solicitud. No permite aceptar, anular o pedir recarga de borradores ni de solicitudes ya válidas/cerradas.

**Integración de la funcionaria completada:** el dashboard consulta las solicitudes reales y filtra por su ID de periodo. El detalle respeta el ID de la URL, incluso si el estudiante tiene otra solicitud más reciente. Presenta perfil, resultados, PDF privado e historial reales. El formulario permite comentar, seleccionar documentos observados para corrección, aceptar y anular; solicita confirmación y espera la respuesta del servidor antes de anunciar éxito. Conserva los datos ante un error y exige actualizar la solicitud antes de repetir una operación cuyo resultado no pudo confirmarse. Los borradores y las solicitudes aceptadas/anuladas admiten comentarios; sus decisiones están bloqueadas también en el backend.

Los otros paneles del home (nivel, resumen y política) mantienen sus adaptadores previos; no se usan para construir las notificaciones. Las notificaciones y las pantallas de revisión de esta entrega usan datos persistidos.

## Aplicación local

Para una instalación sin ninguno de los parches anteriores, descargar `tarea41_notificaciones_completa.patch` en Descargas. Si ya aplicaste el parche anterior, usa únicamente `tarea41_conectar_funcionaria.patch` siguiendo el bloque siguiente. Conservar el backend/.env que ya conecta a la base local. No hay dependencias ni variables nuevas para ejecutar el módulo.

En PowerShell, con el repositorio limpio:

```powershell
cd C:\check_u
git switch main
if ($LASTEXITCODE -ne 0) { throw 'No se pudo cambiar a main.' }
git pull --ff-only
if ($LASTEXITCODE -ne 0) { throw 'No se pudo actualizar main.' }
if (git branch --list tarea41_notificaciones) {
    git switch tarea41_notificaciones
} else {
    git switch -c tarea41_notificaciones
}
if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar la rama de la tarea 41.' }
$parche = "$HOME\Downloads\tarea41_notificaciones_completa.patch"
git apply --check $parche
if ($LASTEXITCODE -ne 0) { throw 'El parche no coincide; revisa los cambios antes de continuar.' }
git apply $parche
if ($LASTEXITCODE -ne 0) { throw 'No se pudo aplicar el parche.' }
git diff --check
```

Si ya tienes aplicada la versión anterior de la tarea 41, no vuelvas a aplicar el parche completo. Aplica solo la ampliación (no cambia la migración):

```powershell
cd C:\check_u
git switch tarea41_notificaciones
if ($LASTEXITCODE -ne 0) { throw 'No se pudo seleccionar la rama.' }
$parche = "$HOME\Downloads\tarea41_conectar_funcionaria.patch"
git apply --check $parche
if ($LASTEXITCODE -ne 0) { throw 'No coincide con la versión anterior. Detente y revisa la salida.' }
git apply $parche
if ($LASTEXITCODE -ne 0) { throw 'No se pudo aplicar la ampliación.' }
git diff --check
```

Aplicar la migración al contenedor local, con Docker Desktop abierto:

```powershell
cd C:\check_u
docker compose -f docker-compose.local.yml up -d db
# Tarea 40 recién integrada: actualizar también su catálogo, sin borrar los datos.
docker cp db/migrations/006-opciones-campos.sql checku-db-local:/tmp/tarea40.sql
if ($LASTEXITCODE -ne 0) { throw 'No se pudo copiar la migración de opciones.' }
docker exec checku-db-local psql -v ON_ERROR_STOP=1 -U checku -d checku_local -f /tmp/tarea40.sql
if ($LASTEXITCODE -ne 0) { throw 'Falló la migración de opciones.' }
docker cp db/migrations/007-notificaciones.sql checku-db-local:/tmp/tarea41.sql
if ($LASTEXITCODE -ne 0) { throw 'No se pudo copiar la migración.' }
docker exec checku-db-local psql -v ON_ERROR_STOP=1 -U checku -d checku_local -f /tmp/tarea41.sql
if ($LASTEXITCODE -ne 0) { throw 'No se pudo aplicar la migración.' }
npm --prefix backend run build
```

Arrancar backend y frontend en terminales separadas; si ya estaban abiertos, reiniciar el backend:

```powershell
cd C:\check_u
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '5432'
$env:DB_USER = 'checku'
$env:DB_PASSWORD = 'checku_local_2026'
$env:DB_NAME = 'checku_local'
npm --prefix backend run start:dev
```

```powershell
cd C:\check_u\frontend
npm run dev -- --webpack
```

Para avisos de OCR, mantener el motor de la tarea 36 en el puerto 5001 y la configuración `MOTOR_URL` existente. Los comentarios de la funcionaria y los avisos de plazo no necesitan OCR.

| Servicio | Dirección |
| --- | --- |
| Dashboard de la funcionaria | http://localhost:3001/funcionario/dashboard |
| Home del estudiante | http://localhost:3001/estudiante/home |
| Listado autenticado | http://localhost:3000/api/estudiante/notificaciones |
| Backend | http://localhost:3000/api/health |
| Motor OCR | http://127.0.0.1:5001/salud |
| PostgreSQL local | localhost:5432 / checku_local |

## Prueba desde la interfaz de la funcionaria

1. Iniciar sesión como funcionaria con el usuario local de demostración. Abrir `http://localhost:3001/funcionario/dashboard` y seleccionar el periodo de la solicitud real. Pulsar Ver solicitud.
2. En Acciones de revisión, escribir un comentario largo, pulsar Enviar comentario y Confirmar acción. El historial debe conservar el texto completo. Al entrar como estudiante en el home debe aparecer Nuevo comentario, con sus primeros 15 caracteres y puntos suspensivos cuando corresponda.
3. Para una solicitud enviada, elegir Solicitar corrección y marcar únicamente los documentos observados. Confirmar. El aviso del estudiante debe enumerar los documentos seleccionados y tener tipo warning.
4. En solicitudes locales de prueba distintas, confirmar Aceptar solicitud y Anular solicitud. Verificar los estados y los avisos info/error respectivos. No usar solicitudes reales ni cambiar de estado solo para fabricar evidencias.
5. Probar Cancelar: no debe generar historial ni avisos. Marcar un aviso como leído y recargar el home: debe conservar la lectura.
6. Para OCR, enviar documentos nuevos o una corrección y comprobar un aviso por documento. Para plazos, usar un periodo local cuya fecha de cierre esté entre hoy y hoy + 15 días; al consultar el home debe aparecer el número de días restantes, sin duplicarse al recargar.

## Prueba manual sin volver a analizar todos los PDF

Esta prueba registra un comentario en la solicitud local de prueba y genera su aviso. Usar los usuarios de demostración que ya trae el proyecto; no realizarla sobre datos de un estudiante real.

```powershell
& {
    $ErrorActionPreference = 'Stop'
    $api = 'http://localhost:3000/api'
    $datosEstudiante = @{username='lizapata@utb.edu.co'; password='12345'} | ConvertTo-Json
    Invoke-RestMethod "$api/auth/login" -Method Post -ContentType 'application/json' -Body $datosEstudiante -SessionVariable sesionEstudiante -ErrorAction Stop | Out-Null
    $actual = Invoke-RestMethod "$api/estudiante/solicitud" -WebSession $sesionEstudiante -ErrorAction Stop
    if (-not $actual.tiene_solicitud) { throw 'Primero crea un borrador desde el formulario.' }
    $idSolicitud = $actual.solicitud.id_solicitud
    $datosFuncionaria = @{username='rmarriaga@utb.edu.co'; password='12345'} | ConvertTo-Json
    Invoke-RestMethod "$api/auth/login" -Method Post -ContentType 'application/json' -Body $datosFuncionaria -SessionVariable sesionFuncionaria -ErrorAction Stop | Out-Null
    $comentario = @{accion='comentario'; comentario='Prueba local del módulo de notificaciones.'} | ConvertTo-Json
    Invoke-RestMethod "$api/funcionario/solicitudes/$idSolicitud/revisiones" -Method Post -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($comentario)) -WebSession $sesionFuncionaria
    Invoke-RestMethod "$api/estudiante/notificaciones" -WebSession $sesionEstudiante | ConvertTo-Json -Depth 5
}
```

Entrar al home como estudiante, recargar y comprobar Nuevo comentario, su vista previa, el contador y Marcar como leída. Recargar otra vez para verificar persistencia. Para la recarga de documentos, usar IDs reales actuales devueltos por `/api/estudiante/solicitud/analisis`.

## Pruebas automatizadas

```powershell
cd C:\check_u
npm --prefix backend run test:e2e -- --no-file-parallelism
npm --prefix backend run test -- src/notificaciones/notificaciones-plazos.service.spec.ts
cd frontend
npx next typegen
npx tsc --noEmit
npx playwright test e2e/notificaciones.spec.ts e2e/detalle.spec.ts e2e/dashboard.spec.ts e2e/base.spec.ts e2e/opciones_formulario.spec.ts e2e/inicio.spec.ts e2e/solicitud_redireccion.spec.ts e2e/carga_preinscripcion.spec.ts e2e/completar_ocr.spec.ts e2e/analisis_preinscripcion.spec.ts e2e/periodo_inscripcion.spec.ts
```

Los tests HTTP/SQL usan PGlite (PostgreSQL embebido) con el esquema y triggers reales. Simulan el resultado del motor para controlar clasificaciones y fallos. Las pruebas del navegador controlan las respuestas HTTP para comprobar errores, esperas, estilos, accesibilidad y persistencia esperada por el cliente.

Para la prueba opcional, detener antes el backend y el frontend locales: el test arranca procesos temporales en los puertos 3000 y 3004 y necesita la carpeta de compilación libre.

Además existe una prueba opcional que arranca la API y el frontend reales contra PostgreSQL embebido, sin interceptar sus respuestas: crea avisos mediante el flujo documental y la API de revisiones, abre el home, marca lectura y verifica después de recargar. Solo el motor está simulado en esa prueba.

```powershell
cd C:\check_u
$env:NOTIFICACIONES_UI_REAL = '1'
npm --prefix backend run test:e2e -- test/notificaciones.e2e-spec.ts -t 'home con API' --no-file-parallelism
Remove-Item Env:NOTIFICACIONES_UI_REAL
```

## Un commit por archivo

Después de probar y revisar `git status --short`, desde `C:\check_u`:

```powershell
if ((git branch --show-current).Trim() -ne 'tarea41_notificaciones') { throw 'Rama incorrecta.' }
if (@(git diff --cached --name-only).Count -gt 0) { throw 'Hay archivos preparados previamente; revísalos antes de continuar.' }
$archivos = @(git -c core.quotepath=false ls-files --modified --others --exclude-standard | Sort-Object -Unique)
Write-Host "Se crearán $($archivos.Count) commits: uno por archivo."
foreach ($archivo in $archivos) {
    git add -- $archivo
    if ($LASTEXITCODE -ne 0) { throw "Error preparando $archivo" }
    git commit -m "feat(tarea41): actualizar $archivo" --only -- $archivo
    if ($LASTEXITCODE -ne 0) { throw "Error creando el commit de $archivo" }
}
git status
git push -u origin tarea41_notificaciones
```

Abrir PR hacia main con `Closes #100`. Revisar el listado antes del bucle para incluir exclusivamente archivos de la tarea y conservar los commits individuales al integrar.


## Compatibilidad y alcance final

Base `main` (`1babe3f`, PR #101 integrada). Se conservan OpcionesModule y el esquema de la tarea 40. La migración de notificaciones es 007. No hay paquetes ni variables nuevos. Los avisos se muestran en el home al cargar/recargar o reintentar la consulta; no se promete entrega push ni se envía correo. El temporizador genera el aviso del día actual al arrancar y cada 15 minutos; si estuvo apagado, no reconstruye avisos de días pasados.

Las cuatro acciones de la funcionaria están conectadas con datos reales, además del flujo OCR y los recordatorios. No queda una conexión pendiente de esas acciones. Las pruebas que simulan OCR controlan su clasificación; el motor Python real no se volvió a certificar en esta tarea. La configuración PostgreSQL de cada equipo sigue siendo necesaria: un 503 de conexión impide la prueba local aunque el código esté implementado.

## Verificación realizada en la implementación final

- 102 pruebas HTTP/SQL aprobadas en cinco archivos de la regresión del backend; dos pruebas opcionales omitidas en esa corrida.
- Incluyen las 30 pruebas HTTP/SQL propias de notificaciones: restricciones, roles, propiedad, acciones, comentarios, plazos, clasificaciones OCR, rollback, lectura, listado real, detalle histórico por ID y PDF privado.
- 15 pruebas unitarias aprobadas de controlador de solicitudes y generador periódico (arranque, reintento, no superposición y cierre).
- 91 pruebas seleccionadas del navegador aprobadas a lo largo de las corridas y sus comprobaciones posteriores: 32 de dashboard, 17 de detalle/revisiones y 42 de home/notificaciones, base y opciones. Incluyen accesibilidad en ambos temas, reflujo, confirmación/cancelación, errores y recuperación; no representan una certificación de todas las pantallas del proyecto.
- Una prueba opcional API + PostgreSQL embebido + frontend reales aprobada: entra como funcionaria, navega desde el listado real, comenta, solicita corrección, acepta y anula otras solicitudes de prueba; entra como estudiante, verifica los cuatro avisos manuales junto con OCR/plazo y conserva la lectura tras recargar. No intercepta las respuestas de la API. Solo el motor OCR está simulado en esa prueba.
- Compilación del backend, generación de tipos de Next, TypeScript del frontend, Oxlint y ESLint de los archivos modificados aprobados.

Estas verificaciones se ejecutaron en el entorno de implementación. Falta aplicar y probar el parche con los datos y configuración del equipo local del usuario antes de solicitar el merge.

## Archivos incluidos

- `backend/src/app.module.ts`
- `backend/src/notificaciones/notificaciones-plazos.service.spec.ts`
- `backend/src/notificaciones/notificaciones-plazos.service.ts`
- `backend/src/notificaciones/notificaciones.controller.ts`
- `backend/src/notificaciones/notificaciones.module.ts`
- `backend/src/notificaciones/notificaciones.service.ts`
- `backend/src/solicitudes/analisis-preinscripcion.service.ts`
- `backend/src/solicitudes/detalle-analisis.ts`
- `backend/src/solicitudes/reenvios.service.ts`
- `backend/src/solicitudes/solicitudes.controller.ts`
- `backend/src/solicitudes/solicitudes.module.ts`
- `backend/test/notificaciones.e2e-spec.ts`
- `db/init/01-schema.sql`
- `db/migrations/007-notificaciones.sql`
- `docs/tarea41_notificaciones.md`
- `frontend/app/estudiante/home/NotificacionesPanel.tsx`
- `frontend/app/estudiante/home/api.ts`
- `frontend/app/estudiante/home/home.module.css`
- `frontend/app/estudiante/home/page.tsx`
- `frontend/app/funcionario/dashboard/GraficoEstados.tsx`
- `frontend/app/funcionario/dashboard/dashboard.module.css`
- `frontend/app/funcionario/dashboard/datos.ts`
- `frontend/app/funcionario/dashboard/page.tsx`
- `frontend/app/funcionario/detalle_preinscripcion/[id]/detalle.module.css`
- `frontend/app/funcionario/detalle_preinscripcion/[id]/page.tsx`
- `frontend/app/funcionario/solicitudes-api.ts`
- `frontend/e2e/base.spec.ts`
- `frontend/e2e/dashboard.spec.ts`
- `frontend/e2e/detalle.spec.ts`
- `frontend/e2e/notificaciones.spec.ts`
- `frontend/e2e/soporte.ts`
