# Tarea 38: corregir la carga de estudiante/preinscripcion

## Problema reproducido

La versión de la PR #93 encadenaba `auth/me`, `estudiante/solicitud` y `estudiante/solicitud/analisis`. Las consultas no tenían un límite de espera. Si la segunda no respondía, nunca se solicitaba el detalle y continuaba el indicador de carga. Además, al terminar de verificar la solicitud pero antes de recibir su detalle, la página podía mostrar un error aunque la consulta aún estuviera en curso.

Se reprodujo ese bloqueo en Chromium manteniendo pendiente la consulta de resumen. La prueba falló con el código anterior y pasó con la corrección. Esto acredita el defecto reproducido; no demuestra por sí solo que sea la única causa de la lentitud en el equipo o despliegue del revisor.

## Cambios y responsabilidad

- `frontend/app/estudiante/preinscripcion/page.tsx`: presenta el encabezado y el estado de carga desde el primer render. Verifica la sesión y consulta directamente el detalle, que ya verifica propiedad y devuelve 404 cuando no existe una solicitud. Elimina la consulta redundante. Limita a 15 segundos el conjunto de sesión y carga inicial, cancela peticiones al salir y evita que una respuesta antigua cambie el estado. Distingue carga, error y resultado. Reintentar inicia una única carga nueva.
- `frontend/app/estudiante/preinscripcion/api.ts`: admite una señal de cancelación y limita también a 15 segundos las consultas independientes del detalle, incluida la actualización posterior a un reenvío. Conserva el código HTTP para distinguir ausencia de solicitud, sesión vencida y errores del servicio.
- `frontend/e2e/carga_preinscripcion.spec.ts`: reproduce consulta redundante pendiente, carga lenta sin error falso, vencimiento de sesión/detalle, reintento sin duplicación, redirecciones y JSON ilegible.
- `frontend/e2e/solicitud_redireccion.spec.ts`: ajusta los mocks de la página al endpoint de detalle real; sigue comprobando permisos, bienvenida y datos de asistencia. Las pruebas de home mantienen su endpoint de resumen.
- `frontend/e2e/analisis_preinscripcion.spec.ts`: después de recargar, espera resultados reales antes de comprobar el número de consultas; el encabezado ahora se presenta antes de que lleguen los datos.
- Este documento registra alcance, aplicación y comprobación.

No se agregan dependencias ni variables de entorno. No hace falta una migración para esta corrección. El plazo de la consulta de resultados es independiente del tiempo permitido para enviar documentos al OCR.

## Aplicar sobre la tarea 38 ya instalada

Guardar el parche `tarea38_corregir_carga_preinscripcion.patch` en Descargas. Desde PowerShell:

```powershell
cd C:\check_u
git switch tarea38_completar_ocr
if ($LASTEXITCODE -ne 0) { throw 'No se pudo cambiar a la rama de la tarea 38.' }
$parche = "$HOME\Downloads\tarea38_corregir_carga_preinscripcion.patch"
git apply --check $parche
if ($LASTEXITCODE -ne 0) { throw 'El parche no coincide. Revisa los cambios pendientes antes de continuar.' }
git apply $parche
if ($LASTEXITCODE -ne 0) { throw 'No se pudo aplicar el parche.' }
git diff --check
```

Este parche contiene solamente la corrección posterior a los 31 archivos de la tarea 38; no vuelve a aplicar la implementación completa.

## Ejecutar y verificar

Con la configuración local de la tarea 38, arrancar el backend y el frontend y abrir `http://localhost:3001/estudiante/preinscripcion`.

1. El encabezado debe aparecer mientras se consulta la información. Cuando llega la respuesta, deben mostrarse los documentos.
2. En las herramientas de desarrollo, comprobar que esta página consulta `auth/me` y el detalle, sin depender de otra consulta de resumen. React Strict Mode puede iniciar una petición y cancelarla durante su comprobación de montaje en desarrollo.
3. Si no hay respuesta a tiempo, aparece un mensaje y Reintentar; una espera agotada no se convierte en una aprobación ni en datos simulados.
4. Sin sesión, se dirige al acceso; un funcionario va a su dashboard; sin solicitud registrada, a bienvenida.
5. Comprobar también apertura del análisis, PDF y actualización de resultados después de corregir un documento.

Pruebas, desde `C:\check_u\frontend`:

```powershell
npx tsc --noEmit
npx eslint app/estudiante/preinscripcion/page.tsx app/estudiante/preinscripcion/api.ts e2e/carga_preinscripcion.spec.ts e2e/analisis_preinscripcion.spec.ts e2e/solicitud_redireccion.spec.ts
npx playwright test e2e/carga_preinscripcion.spec.ts e2e/solicitud_redireccion.spec.ts e2e/completar_ocr.spec.ts e2e/analisis_preinscripcion.spec.ts e2e/preinscripcion_api.spec.ts e2e/periodo_inscripcion.spec.ts
```

Verificación realizada: 65 pruebas seleccionadas aprobadas en Chromium; TypeScript y ESLint de los archivos afectados aprobados. Se comprobó la regresión antes de modificar el código.

Las pruebas del navegador simulan las respuestas HTTP para controlar los errores y esperas. No se ha reproducido el despliegue o equipo de Lisandro. Estas pruebas no sustituyen comprobar la conexión y los tiempos reales de la base de datos si allí persiste un error del servicio.

## Un commit por archivo y actualización de la misma PR

Después de probar, desde `C:\check_u`:

```powershell
if ((git branch --show-current).Trim() -ne 'tarea38_completar_ocr') { throw 'Rama incorrecta.' }
if (@(git diff --cached --name-only).Count -gt 0) { throw 'Hay archivos preparados previamente; revísalos primero.' }
$archivos = @(
    'docs/tarea38_correccion_carga.md',
    'frontend/app/estudiante/preinscripcion/api.ts',
    'frontend/app/estudiante/preinscripcion/page.tsx',
    'frontend/e2e/analisis_preinscripcion.spec.ts',
    'frontend/e2e/carga_preinscripcion.spec.ts',
    'frontend/e2e/solicitud_redireccion.spec.ts'
)
foreach ($archivo in $archivos) {
    git add -- $archivo
    if ($LASTEXITCODE -ne 0) { throw "No se pudo preparar $archivo" }
    git commit -m "fix(tarea38): corregir carga en $archivo" --only -- $archivo
    if ($LASTEXITCODE -ne 0) { throw "No se pudo crear el commit de $archivo" }
}
git status
git push origin tarea38_completar_ocr
```

Al subir a la misma rama se actualiza la PR #93; no hace falta abrir otra PR. Mantener un archivo por commit.
