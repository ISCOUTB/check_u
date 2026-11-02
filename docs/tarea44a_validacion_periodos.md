# Tarea 44a: validar periodos de grado

Issue: https://github.com/ISCOUTB/check_u/issues/113.
Base: main, commit `50d28fadb10a9297b56114a4c798c44b42d57986`.
Rama: `tarea44a_validacion_periodos`.

## Contenido del paquete

- `tarea44a_validacion_periodos.patch`: aplicar sobre main mediante Git.
- Esta guía: preparación, migración, prueba y commits.
- `archivos_completos/`: los once archivos completos para revisión. Usar el parche para instalar, en lugar de copiar todo sobre una versión diferente.

Este paquete se reconstruyó porque los enlaces anteriores no contenían archivos disponibles. Mantiene el alcance de la entrega: fechas, duplicados, mensajes y pruebas. Si algún parche anterior ya se aplicó, no aplicar de nuevo: comprobar primero `git status`.

## Reglas implementadas

- Inicio estrictamente anterior al cierre; no admite que sean iguales.
- Graduación estrictamente posterior al cierre, tanto al crear como al editar, incluso en PATCH parcial.
- Fechas calendario válidas, campos obligatorios y nombre de hasta 120 caracteres.
- Duplicado: mismo par fechaInicio/fechaFin, aunque cambien nombre, estado o ceremonia. Editar el propio registro no se considera duplicado. Los rangos distintos pueden compartir nombre o ceremonia; no se añade una prohibición general de solapamientos.
- Frontend y backend validan las reglas. El formulario anuncia el error, enfoca el campo y conserva lo escrito. El backend devuelve 400 por datos inválidos y 409 por duplicados.
- El índice SQL único evita duplicados incluso con dos peticiones concurrentes. El error del índice se convierte en un conflicto descriptivo, también cuando DatabaseService lo envuelve como error de servicio.

Sin paquetes ni variables nuevas. Las reglas de fechas están en la API y el formulario; el índice SQL protege la unicidad. No se cambian las fechas antiguas ni se eliminan registros.

## 1. Aplicar en Windows

Extraer el ZIP en Descargas. Si Windows crea la carpeta `Tarea44a_paquete_completo`, el bloque siguiente también busca el parche allí. Conservar y confirmar los cambios pendientes antes de cambiar de rama.

```powershell
cd C:\check_u
& {
    if (@(git status --porcelain).Count -gt 0) { throw 'Hay cambios pendientes. Consérvalos y confírmalos antes de cambiar de tarea.' }
    git switch main
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo seleccionar main.' }
    git pull --ff-only
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo actualizar main.' }
    if (git branch --list tarea44a_validacion_periodos) {
        git switch tarea44a_validacion_periodos
    } else {
        git switch -c tarea44a_validacion_periodos
    }
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar la rama.' }
    $parche = "$HOME\Downloads\tarea44a_validacion_periodos.patch"
    if (-not (Test-Path $parche)) { $parche = "$HOME\Downloads\Tarea44a_paquete_completo\tarea44a_validacion_periodos.patch" }
    if (-not (Test-Path $parche)) { throw 'Extrae el ZIP en Descargas o corrige la ruta del parche.' }
    git apply --check $parche
    if ($LASTEXITCODE -ne 0) { throw 'El parche no coincide. Conserva tus cambios y comparte la salida.' }
    git apply $parche
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo aplicar el parche.' }
    git diff --check
    if ($LASTEXITCODE -ne 0) { throw 'Revisa los espacios indicados por Git.' }
    git status --short
}
```

## 2. Migración 009

Con Docker Desktop y el contenedor local abiertos, detener el backend antes de aplicar. Se revisan duplicados y se aplica la migración sin reconstruir la base.

```powershell
cd C:\check_u
& {
    $duplicados = docker exec checku-db-local psql -U checku -d checku_local -tAc "SELECT COUNT(*) FROM (SELECT fecha_inicio, fecha_fin FROM periodos_grado GROUP BY fecha_inicio, fecha_fin HAVING COUNT(*) > 1) d;"
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo revisar la tabla de periodos.' }
    if ([int](($duplicados | Out-String).Trim()) -gt 0) {
        docker exec checku-db-local psql -U checku -d checku_local -c "SELECT fecha_inicio, fecha_fin, array_agg(id) AS ids, array_agg(nombre) AS nombres FROM periodos_grado GROUP BY fecha_inicio, fecha_fin HAVING COUNT(*) > 1;"
        throw 'Hay rangos repetidos. Conserva los datos y comparte el listado para revisar las convocatorias reales antes de migrar.'
    }
    docker cp db/migrations/009-validacion-periodos.sql checku-db-local:/tmp/009-validacion-periodos.sql
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo copiar la migración.' }
    docker exec checku-db-local psql -v ON_ERROR_STOP=1 -U checku -d checku_local -f /tmp/009-validacion-periodos.sql
    if ($LASTEXITCODE -ne 0) { throw 'La migración falló. Revisa la salida.' }
}
```

La migración es repetible y transaccional. Si ya hay duplicados, se detiene sin borrar ni fusionar datos. Revisar esos registros con información real antes de migrar. El esquema de instalación nueva incluye el mismo índice. En servidor, aplicar la migración a la base correspondiente antes de publicar el backend; una base antigua con duplicados también necesita resolverlos antes de ejecutar el esquema actualizado.

## 3. Ejecutar y probar

En dos terminales independientes:

```powershell
cd C:\check_u
npm.cmd --prefix backend run start:dev
```

```powershell
cd C:\check_u
npm.cmd --prefix frontend run dev -- --webpack
```

Abrir http://localhost:3001, entrar como funcionaria local (`rmarriaga@utb.edu.co`, contraseña `12345`) y abrir http://localhost:3001/funcionario/dashboard. Pulsar Gestionar periodos.

1. Rango 23/10/2026–30/11/2026, graduación 15/11/2026: rechaza. También rechaza graduación igual al cierre e inicio igual o posterior al cierre.
2. Corregir la graduación a 05/12/2026: guarda si ese rango no existe; si existe, editar el registro correspondiente.
3. Intentar otro registro con las mismas fechas de recepción, otro nombre y otra ceremonia: rechaza por duplicado.
4. Editar el propio nombre o estado: permite. Cambiarlo al rango de otro periodo: rechaza.
5. Ante un error del servidor, conserva los datos y permite reintentar. Ante éxito, actualiza el listado.

```powershell
cd C:\check_u
npm.cmd --prefix backend run build
npm.cmd --prefix backend run test:e2e -- test/validacion-periodos.e2e-spec.ts test/periodo-inscripcion.e2e-spec.ts --no-file-parallelism
cd C:\check_u\frontend
npx.cmd playwright test e2e/validacion_periodos.spec.ts e2e/dashboard.spec.ts
```

La prueba integrada opcional arranca API Nest, frontend y PostgreSQL embebido PGlite, crea y edita desde Chromium y provoca un conflicto con un catálogo desactualizado. No intercepta HTTP ni simula el servicio de periodos. Requiere Chromium de Playwright y los puertos 3000 y 3005 libres:

```powershell
cd C:\check_u
$env:PERIODOS_UI_REAL = '1'
npm.cmd --prefix backend run test:e2e -- test/validacion-periodos-ui.e2e-spec.ts --no-file-parallelism
Remove-Item Env:PERIODOS_UI_REAL
```

Las pruebas Playwright del frontend usan respuestas API de prueba. Las pruebas HTTP/SQL usan PGlite, que ejecuta el SQL y el índice. La prueba de carrera sincroniza ambas consultas previas para comprobar que el índice evita una doble inserción. La regresión del dashboard fija la fecha dentro de octubre para independizarse del día de ejecución. La regresión de asignación usa rangos solapados distintos porque ya no se permiten rangos idénticos.

## 4. Commits: uno por archivo

Revisar que los pendientes sean exclusivamente de esta tarea; deben ser once archivos.

```powershell
cd C:\check_u
& {
    if ((git branch --show-current).Trim() -ne 'tarea44a_validacion_periodos') { throw 'Rama incorrecta.' }
    if (@(git diff --cached --name-only).Count -gt 0) { throw 'Revisa los archivos preparados previamente.' }
    $archivos = @(git -c core.quotepath=false ls-files --modified --others --exclude-standard | Sort-Object -Unique)
    Write-Host "Se crearán $($archivos.Count) commits, uno por archivo."
    foreach ($archivo in $archivos) {
        git --literal-pathspecs add -- "$archivo"
        if ($LASTEXITCODE -ne 0) { throw "Error preparando $archivo" }
        git --literal-pathspecs commit --only -m "fix(tarea44a): validar periodos - $archivo" -- "$archivo"
        if ($LASTEXITCODE -ne 0) { throw "Error creando commit de $archivo" }
    }
    git push -u origin tarea44a_validacion_periodos
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo subir la rama.' }
    git status
}
```

PR hacia main. Título: `Tarea 44a: validar fechas y evitar convocatorias duplicadas`.
Descripción: valida fechas al crear y editar, evita repetir el rango de recepción incluso ante concurrencia, conserva el formulario y muestra cómo corregir los errores. Requiere migración 009. `Closes #113`.

## Verificación del paquete reconstruido

50 pruebas HTTP/SQL aprobadas (31 de validación y 19 de asignación), 54 pruebas Playwright aprobadas (22 nuevas y 32 de dashboard), una prueba integrada con API Nest y PGlite aprobada, compilación del backend y revisión de tipos y ESLint del frontend sin errores. La base de datos embebida y las pruebas con fixtures no certifican la configuración de tu contenedor o del servidor: aplicar la migración y comprobar también en tu equipo.

## Corrección posterior: botón Registrar periodo bloqueado

La versión inicial deshabilitaba el botón si fallaba o seguía pendiente el listado. El listado vacío se mostraba incluso cuando realmente había un error de consulta. Esta corrección deja el botón habilitado salvo durante el envío, conserva las validaciones de fechas y la protección de duplicados del backend, muestra la consulta/error dentro del diálogo y permite reintentar. La consulta tiene un límite de 15 segundos. Tras confirmar el guardado, la actualización del listado se hace por separado; las respuestas antiguas no sustituyen las de consultas más recientes.

Aplica únicamente `tarea44a_corregir_boton.patch` sobre la tarea 44a ya instalada. No requiere otra migración. Extrae `Tarea44a_correccion_boton.zip` en Descargas:

```powershell
cd C:\check_u
& {
    $parche = "$HOME\Downloads\tarea44a_corregir_boton.patch"
    if (-not (Test-Path $parche)) { $parche = "$HOME\Downloads\Tarea44a_correccion_boton\tarea44a_corregir_boton.patch" }
    git apply --check $parche
    if ($LASTEXITCODE -ne 0) { throw 'El parche no coincide. Conserva tus cambios y comparte la salida.' }
    git apply $parche
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo aplicar la corrección.' }
    git diff --check
}
```

Recargar el frontend; si está ejecutándose una compilación de producción, recompilar y reiniciar. Probar con los datos de la captura: GRADOS, inicio 01/11/2026, cierre 10/11/2026, graduación 17/11/2026. Esas fechas cumplen las reglas. Si la API también falla al guardar, se mostrará su error y se conservarán los datos: compartir el error de la terminal del backend para revisar la conexión o consulta SQL.

Se modifican tres archivos: el dashboard, sus pruebas de validación y esta guía. Si ya confirmaste la tarea 44a, crear un nuevo commit por cada uno:

```powershell
cd C:\check_u
& {
    if ((git branch --show-current).Trim() -ne 'tarea44a_validacion_periodos') { throw 'Rama incorrecta.' }
    if (@(git diff --cached --name-only).Count -gt 0) { throw 'Revisa los archivos preparados previamente.' }
    foreach ($archivo in @(
        'frontend/app/funcionario/dashboard/page.tsx'
        'frontend/e2e/validacion_periodos.spec.ts'
        'docs/tarea44a_validacion_periodos.md'
    )) {
        git --literal-pathspecs add -- "$archivo"
        if ($LASTEXITCODE -ne 0) { throw "Error preparando $archivo" }
        git --literal-pathspecs commit --only -m "fix(tarea44a): habilitar registro de periodos - $archivo" -- "$archivo"
        if ($LASTEXITCODE -ne 0) { throw "Error creando commit de $archivo" }
    }
    git push -u origin tarea44a_validacion_periodos
}
```

Si todavía no confirmaste el paquete inicial, usar el bloque general de commits de la sección 4 después de aplicar esta corrección: confirmará los once archivos una vez cada uno con su contenido final.

Verificación de la corrección del botón: 58 casos Playwright aprobados y un recorrido integrado con API Nest y PGlite aprobado. ESLint y comprobación de tipos del frontend sin errores.
