# Tarea 44: corregir el ciclo entre bienvenida y el formulario

## Causa y cambio

`GET /api/solicitudes/estado` devolvía el destino del borrador sin `?nivel=PREGRADO` o `?nivel=POSGRADO`. El formulario rechazaba la URL incompleta y volvía a bienvenida. Bienvenida volvía a enviar al formulario: ambas páginas se alternaban y nunca mostraban el borrador.

El backend ahora incluye el nivel persistido en el destino. El cliente valida el estado y el nivel, construye la ruta conocida y también admite la respuesta de un backend anterior que omita el parámetro en `destino`. Si se abre directamente el formulario sin nivel, recupera el destino del borrador real. Una respuesta inválida o una conexión sin respuesta termina en un error recuperable, sin inventar un estado sin solicitud. La consulta de navegación tiene un límite de 15 segundos.

No requiere migraciones ni variables nuevas. No elimina ni modifica los borradores existentes.

## Aplicación sobre la tarea 44 ya instalada

Descargar `tarea44_corregir_navegacion.patch` en Descargas. Detener con Ctrl+C las terminales del backend y frontend. Mantener los cambios actuales de la tarea 44: este parche es incremental y se aplica sobre ellos, estén confirmados o pendientes de commit. No volver a aplicar el parche original de la tarea 44.

En PowerShell:

```powershell
cd C:\check_u
& {
    $parche = "$HOME\Downloads\tarea44_corregir_navegacion.patch"
    git apply --check $parche
    if ($LASTEXITCODE -ne 0) { throw 'El parche no coincide con los archivos actuales. Conserva los cambios y comparte la salida.' }
    git apply $parche
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo aplicar la corrección.' }
    git diff --check
    if ($LASTEXITCODE -ne 0) { throw 'Revisa los espacios indicados por Git.' }
    git status --short
}
```

Volver a iniciar en dos terminales independientes:

```powershell
# Terminal del backend
cd C:\check_u
npm.cmd --prefix backend run start:dev
```

```powershell
# Terminal del frontend
cd C:\check_u
npm.cmd --prefix frontend run dev -- --webpack
```

La base de datos debe seguir disponible. Esta corrección no requiere reiniciar los contenedores.

## Comprobación manual

Con la sesión del estudiante que ya tiene un borrador, abrir `http://localhost:3001/estudiante/home`. Debe llegar al formulario con el nivel correspondiente en la URL y mostrar los datos guardados. Repetir entrando por `/estudiante/bienvenida` y `/estudiante/iniciar_preinscripcion` sin parámetros. Recargar con F5 y comprobar que la URL permanece estable. Sin solicitud, bienvenida debe permitir elegir el nivel.

Si la API devuelve 503, corresponde revisar la conexión del backend a la base de datos: ahora debe mostrarse el error con Reintentar, sin alternar páginas.

## Verificación automatizada

Resultado: 31 pruebas backend aprobadas (incluido el recorrido integrado con navegador), 91 pruebas Playwright aprobadas, compilación del backend y comprobación de tipos del frontend correctas. ESLint sin errores en los archivos cliente editados; oxlint del backend sin errores, con advertencias existentes en el proyecto.

- API HTTP y PostgreSQL compatible (PGlite): casos PREGRADO/POSGRADO que verifican el destino con el nivel persistido.
- Navegador con API Nest y PGlite: crea un borrador real después de cancelar una solicitud de otro periodo; lo recupera desde home, bienvenida y el formulario sin nivel, conserva el nombre guardado y funciona tras F5. Solo el motor OCR está sustituido en esta prueba.
- Playwright: ambos niveles desde las tres entradas, F5, respuesta inválida, ausencia de solicitud, fallo 503 con reintento y consulta sin respuesta con límite de espera.
- Regresión de bienvenida, formulario y redirección de solicitudes.

```powershell
npm.cmd --prefix backend run test:e2e -- test/cancelacion-preinscripcion.e2e-spec.ts --no-file-parallelism
cd C:\check_u\frontend
npx.cmd playwright test e2e/navegacion_borrador.spec.ts e2e/iniciar_preinscripcion.spec.ts e2e/bienvenida.spec.ts e2e/solicitud_redireccion.spec.ts
```

La prueba integrada con navegador se habilita con `CANCELACION_UI_REAL=1`, requiere Chromium de Playwright y puertos 3000 y 3005 libres. Las demás pruebas API no requieren habilitarla.

## Commits

Mantener un commit por archivo, incluyendo los archivos de prueba y esta guía. Si los cambios originales de la tarea 44 todavía están pendientes, confirmar cada archivo una sola vez con su contenido final. No usar `git add .` para agruparlos en un único commit.
