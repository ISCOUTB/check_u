# Revisión de PR #110: retirar el bloque de historial

Se retira «Historial de preinscripciones» de inicio, bienvenida y detalle, conforme al comentario de Lisandro: esa información corresponde a la tarea #106. Se eliminan el componente y sus estilos, y las tres pantallas dejan de consultar el listado que utilizaba ese bloque.

La cancelación conserva la confirmación, el estado persistido CANCELADA, la auditoría y la consulta del detalle por ID tras recargar. No se cambian tablas, endpoints ni reglas de navegación. No hay migraciones, dependencias ni variables de entorno nuevas.

## Aplicación en Windows

Este parche es incremental sobre la rama de la tarea 44 que ya subiste. Descargar `tarea44_retirar_historial.patch` en Descargas. No volver a aplicar los parches anteriores.

```powershell
cd C:\check_u
& {
    if ((git branch --show-current).Trim() -ne 'tarea44_cancelar_preinscripcion') {
        throw 'Selecciona la rama tarea44_cancelar_preinscripcion.'
    }
    $parche = "$HOME\Downloads\tarea44_retirar_historial.patch"
    git apply --check $parche
    if ($LASTEXITCODE -ne 0) { throw 'El parche no coincide. Conserva tus cambios y comparte la salida.' }
    git apply $parche
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo aplicar el parche.' }
    git diff --check
    if ($LASTEXITCODE -ne 0) { throw 'Revisa los espacios indicados por Git.' }
    git status --short
}
```

Con el frontend abierto en desarrollo, recargar inicio, bienvenida y el detalle: el bloque debe desaparecer. Confirmar una cancelación y recargar su URL con `?solicitud=ID`: debe seguir mostrándose «Preinscripción cancelada». Si utilizas una compilación de producción, volver a compilar y reiniciar el frontend.

## Un commit por archivo y actualización de la misma PR

Se modifican seis archivos, se eliminan dos y se añade esta guía: nueve commits. Este bloque prepara exclusivamente los archivos de la corrección, incluyendo las dos eliminaciones.

```powershell
cd C:\check_u
& {
    if ((git branch --show-current).Trim() -ne 'tarea44_cancelar_preinscripcion') { throw 'Rama incorrecta.' }
    if (@(git diff --cached --name-only).Count -gt 0) { throw 'Hay cambios preparados previamente; revísalos primero.' }
    $archivos = @(
        'backend/test/cancelacion-preinscripcion.e2e-spec.ts'
        'docs/tarea44_cancelar_preinscripcion.md'
        'docs/tarea44_retirar_historial.md'
        'frontend/app/estudiante/HistorialPreinscripciones.module.css'
        'frontend/app/estudiante/HistorialPreinscripciones.tsx'
        'frontend/app/estudiante/bienvenida/page.tsx'
        'frontend/app/estudiante/home/page.tsx'
        'frontend/app/estudiante/preinscripcion/page.tsx'
        'frontend/e2e/cancelacion_preinscripcion.spec.ts'
    )
    foreach ($archivo in $archivos) {
        git --literal-pathspecs add -- "$archivo"
        if ($LASTEXITCODE -ne 0) { throw "Error preparando $archivo" }
        git --literal-pathspecs commit --only -m "fix(tarea44): retirar bloque de historial - $archivo" -- "$archivo"
        if ($LASTEXITCODE -ne 0) { throw "Error creando commit de $archivo" }
    }
    git push origin tarea44_cancelar_preinscripcion
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo subir la corrección.' }
    git status
}
```

El push actualiza la PR existente; no requiere una PR nueva.

## Verificación

Resultado de esta revisión: 31 pruebas backend aprobadas (incluida la integrada con navegador), 53 pruebas Playwright aprobadas, ESLint y comprobación de tipos del frontend sin errores.

La prueba integrada crea y cancela una solicitud con API Nest y PostgreSQL compatible embebido (PGlite), comprueba la auditoría y los documentos, recarga el detalle, verifica la ausencia del bloque y crea un borrador de otro periodo. Solo el motor OCR está simulado.

Playwright verifica la cancelación y los estados, el diálogo, errores y reintentos, la accesibilidad, la bienvenida y el inicio. También comprueba que las tres pantallas no muestren el bloque ni soliciten el listado de historial. Las respuestas API de esta suite de navegador son fixtures.

```powershell
npm.cmd --prefix backend run test:e2e -- test/cancelacion-preinscripcion.e2e-spec.ts --no-file-parallelism
cd C:\check_u\frontend
npx.cmd playwright test e2e/cancelacion_preinscripcion.spec.ts e2e/bienvenida.spec.ts e2e/inicio.spec.ts
```

La prueba integrada opcional se habilita con `CANCELACION_UI_REAL=1` y requiere Chromium de Playwright y los puertos 3000 y 3005 libres.
