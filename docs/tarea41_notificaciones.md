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

**Límite de integración existente:** la pantalla de detalle de la funcionaria en `main` aún trabaja con datos de demostración; sus botones anteriores no persisten acciones. Esta entrega incluye el endpoint real anterior para registrar las cuatro acciones y conectarlo al módulo de revisión. No añade decisiones reales sobre una pantalla de estudiantes ficticios. El nivel, el resumen documental y la política del home mantienen sus adaptadores de demostración previos: el cambio de esta tarea sustituye específicamente las notificaciones por datos persistidos.

## Aplicación local

Descargar `tarea41_notificaciones_actualizada.patch` en Descargas. Conservar el backend/.env que ya conecta a la base local. No hay dependencias ni variables nuevas para ejecutar el módulo.

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
$parche = "$HOME\Downloads\tarea41_notificaciones_actualizada.patch"
git apply --check $parche
if ($LASTEXITCODE -ne 0) { throw 'El parche no coincide; revisa los cambios antes de continuar.' }
git apply $parche
if ($LASTEXITCODE -ne 0) { throw 'No se pudo aplicar el parche.' }
git diff --check
```

Aplicar la migración al contenedor local, con Docker Desktop abierto:

```powershell
cd C:\check_u
docker compose -f docker-compose.local.yml up -d db
docker cp db/migrations/007-notificaciones.sql checku-db-local:/tmp/tarea41.sql
if ($LASTEXITCODE -ne 0) { throw 'No se pudo copiar la migración.' }
docker exec checku-db-local psql -v ON_ERROR_STOP=1 -U checku -d checku_local -f /tmp/tarea41.sql
if ($LASTEXITCODE -ne 0) { throw 'No se pudo aplicar la migración.' }
npm --prefix backend run build
```

Arrancar backend y frontend en terminales separadas; si ya estaban abiertos, reiniciar el backend:

```powershell
cd C:\check_u
npm --prefix backend run start:dev
```

```powershell
cd C:\check_u\frontend
npm run dev -- --webpack
```

Para avisos de OCR, mantener el motor de la tarea 36 en el puerto 5001 y la configuración `MOTOR_URL` existente. Los comentarios de la funcionaria y los avisos de plazo no necesitan OCR.

| Servicio | Dirección |
| --- | --- |
| Home del estudiante | http://localhost:3001/estudiante/home |
| Listado autenticado | http://localhost:3000/api/estudiante/notificaciones |
| Backend | http://localhost:3000/api/health |
| Motor OCR | http://127.0.0.1:5001/salud |
| PostgreSQL local | localhost:5432 / checku_local |

## Prueba manual sin volver a analizar todos los PDF

Esta prueba registra un comentario en la solicitud local de prueba y genera su aviso. Usar los usuarios de demostración que ya trae el proyecto; no realizarla sobre datos de un estudiante real.

```powershell
$api = 'http://localhost:3000/api'
$datosEstudiante = @{username='lizapata@utb.edu.co'; password='12345'} | ConvertTo-Json
Invoke-RestMethod "$api/auth/login" -Method Post -ContentType 'application/json' -Body $datosEstudiante -SessionVariable sesionEstudiante | Out-Null
$actual = Invoke-RestMethod "$api/estudiante/solicitud" -WebSession $sesionEstudiante
if (-not $actual.tiene_solicitud) { throw 'Primero crea un borrador desde el formulario.' }
$idSolicitud = $actual.solicitud.id_solicitud
$datosFuncionaria = @{username='rmarriaga@utb.edu.co'; password='12345'} | ConvertTo-Json
Invoke-RestMethod "$api/auth/login" -Method Post -ContentType 'application/json' -Body $datosFuncionaria -SessionVariable sesionFuncionaria | Out-Null
$comentario = @{accion='comentario'; comentario='Prueba local del módulo de notificaciones.'} | ConvertTo-Json
Invoke-RestMethod "$api/funcionario/solicitudes/$idSolicitud/revisiones" -Method Post -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($comentario)) -WebSession $sesionFuncionaria
Invoke-RestMethod "$api/estudiante/notificaciones" -WebSession $sesionEstudiante | ConvertTo-Json -Depth 5
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
npx playwright test e2e/notificaciones.spec.ts e2e/inicio.spec.ts e2e/solicitud_redireccion.spec.ts e2e/carga_preinscripcion.spec.ts e2e/completar_ocr.spec.ts e2e/analisis_preinscripcion.spec.ts e2e/periodo_inscripcion.spec.ts
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


## Actualización compatible con tarea 40

Este parche se regeneró sobre `main` (`1babe3f`, PR #101 integrada). Conserva OpcionesModule, su esquema y los mocks existentes. La migración pasa a 007 porque la tarea 40 ocupa 006. Tras la actualización se verificaron compilación backend, 28 pruebas HTTP/SQL de notificaciones, 14 pruebas unitarias de opciones y recordatorios, y TypeScript del frontend. Los resultados amplios siguientes corresponden a la implementación original.

## Verificación realizada en la implementación

- 100 pruebas HTTP/SQL aprobadas en la regresión completa del backend; dos pruebas opcionales omitidas en esa corrida.
- Las 28 pruebas HTTP/SQL propias de este módulo también se ejecutaron por separado, con el esquema, claves, trigger, permisos, transacciones, límite diario y variantes OCR.
- 3 pruebas del generador periódico: arranque, reintento tras fallo, no superposición y cierre del temporizador.
- 61 pruebas seleccionadas del navegador aprobadas, incluidas las 11 nuevas del módulo, home, redirecciones, carga del detalle, periodos, análisis y correcciones.
- Una prueba opcional API + PostgreSQL embebido + frontend reales aprobada por separado. Solo el motor fue simulado.
- Compilación del backend, generación de tipos de Next, TypeScript del frontend, Oxlint del módulo y ESLint de los archivos del frontend aprobados.

Estas verificaciones se ejecutaron en el entorno de implementación. Falta aplicar y probar el parche con los datos y configuración del equipo local del usuario antes de solicitar el merge.

## Archivos incluidos

- `backend/src/app.module.ts`
- `backend/src/notificaciones/notificaciones-plazos.service.spec.ts`
- `backend/src/notificaciones/notificaciones-plazos.service.ts`
- `backend/src/notificaciones/notificaciones.controller.ts`
- `backend/src/notificaciones/notificaciones.module.ts`
- `backend/src/notificaciones/notificaciones.service.ts`
- `backend/src/solicitudes/analisis-preinscripcion.service.ts`
- `backend/src/solicitudes/solicitudes.module.ts`
- `backend/test/notificaciones.e2e-spec.ts`
- `db/init/01-schema.sql`
- `db/migrations/007-notificaciones.sql`
- `docs/tarea41_notificaciones.md`
- `frontend/app/estudiante/home/NotificacionesPanel.tsx`
- `frontend/app/estudiante/home/api.ts`
- `frontend/app/estudiante/home/home.module.css`
- `frontend/app/estudiante/home/page.tsx`
- `frontend/e2e/notificaciones.spec.ts`
- `frontend/e2e/soporte.ts`
