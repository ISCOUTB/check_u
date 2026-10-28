# Tarea 38 — Completar la funcionalidad documental de la tarea 36

Issue: #90. Base: `main`, commit `f423314` (tarea 36 integrada mediante PR #88).

## Comportamiento

- El diálogo de envío presenta una barra de progreso desde la carga de los PDF. El navegador mide los bytes subidos; después recibe las etapas reales del backend mediante NDJSON en el mismo POST. El porcentaje representa avance de etapas, no una estimación de tiempo restante.
- El backend anuncia registro, almacenamiento del borrador, envío al motor, comprobaciones por documento y generación de resultados. Respeta nivel académico y orden de las dos estampillas. Publica 100 % solamente después de confirmar la transacción. Un fallo conserva los resultados previos y no anuncia éxito.
- Biblioteca muestra expresamente que su validación está pendiente de integración y requiere revisión humana.
- “Ver análisis automático” carga el PDF original mediante un endpoint que exige sesión de estudiante y verifica propiedad. El navegador recibe bytes; las rutas físicas no se publican. Al vencer la conservación del PDF, los resultados históricos permanecen disponibles.
- Las observaciones muestran reglas y errores persistidos. Un documento no válido no se atribuye automáticamente al puntaje de Saber Pro: se presenta la causa específica registrada por el motor.
- Los campos extraídos se presentan con etiquetas en español; los nombres internos se mantienen en el contrato de datos. Los campos desconocidos reciben una etiqueta genérica sin revelar su clave técnica.
- Los documentos no válidos o pendientes admiten correcciones cuando el estado de la solicitud lo permite. Cada corrección crea una entrega y versiones nuevas, conserva las anteriores y ejecuta otra vez el análisis.
- Los documentos válidos no se reemplazan. Se rechazan documentos ajenos, identificadores de versiones antiguas y reemplazos que no correspondan a la solicitud autenticada.
- Cada entrega de corrección consume un reenvío, aunque incluya varios documentos. Se permiten tres por día de Bogotá. La misma clave y los mismos PDF devuelven la corrección registrada sin duplicarla ni consumir otro cupo; cambiar el contenido conservando la clave produce conflicto.

## Base de datos y despliegue

Aplicar `db/migrations/005-reenvios-idempotentes.sql` antes de iniciar el backend actualizado. Es repetible: incorpora las columnas de clave/huella de entrega y su índice único parcial. El esquema de instalaciones nuevas también las incluye.

En PowerShell, desde `C:\check_u`:

```powershell
docker cp db/migrations/005-reenvios-idempotentes.sql checku-db-local:/tmp/tarea38.sql
if ($LASTEXITCODE -ne 0) { throw 'No se pudo copiar la migración.' }
docker exec checku-db-local psql -v ON_ERROR_STOP=1 -U checku -d checku_local -f /tmp/tarea38.sql
if ($LASTEXITCODE -ne 0) { throw 'No se pudo aplicar la migración.' }
npm --prefix backend run build
```

El motor OCR conserva su configuración de la tarea 36. Reiniciar el backend y el frontend después de aplicar los cambios. El proxy de producción debe permitir respuestas transmitidas sin acumular NDJSON; el endpoint envía `X-Accel-Buffering: no` y `Cache-Control: no-store`. Configurar el tiempo de espera del proxy de acuerdo con la duración del OCR. El cliente admite hasta quince minutos.

## Verificación automatizada

Desde la raíz:

```powershell
npm --prefix backend run test:e2e -- --no-file-parallelism
npm --prefix backend run test -- src/solicitudes/solicitudes.controller.spec.ts
cd frontend
npx tsc --noEmit
npx playwright test e2e/completar_ocr.spec.ts e2e/analisis_preinscripcion.spec.ts e2e/periodo_inscripcion.spec.ts e2e/preinscripcion_api.spec.ts
```

El conjunto HTTP/SQL utiliza PGlite con el esquema PostgreSQL y el motor simulado para producir fallos controlados. Comprueba avance transmitido mientras el motor está bloqueado, confirmación posterior a la transacción, propiedad del PDF, caducidad, versiones, idempotencia, límite diario, múltiples documentos y reversión ante errores. Las pruebas del navegador comprueban el diálogo inicial, reenvíos de dos estampillas, vista previa, etiquetas, errores, accesibilidad y ausencia de desborde en claro/oscuro.

Para comprobar también el motor Python real, mantenerlo disponible en la dirección configurada de la tarea 36 y ejecutar desde la raíz, en otra terminal:

```powershell
$env:OCR_REAL_TEST = '1'
$env:VERIFICAR_TAREA38 = '1'
$env:OCR_TEST_PYTHON = (py -c 'import sys; print(sys.executable)').Trim()
npm --prefix backend run test:e2e -- test/analisis-preinscripcion.e2e-spec.ts -t 'motor real' --no-file-parallelism
Remove-Item Env:OCR_REAL_TEST, Env:VERIFICAR_TAREA38, Env:OCR_TEST_PYTHON
```

Esta comprobación genera un PDF sintético sin datos personales; verifica el análisis inicial, descarga privada, corrección real, versión 2, cupo consumido y conservación del original anterior. No acredita que un documento auténtico cumpla sus requisitos académicos.

Resultados de la implementación: 72 pruebas HTTP/SQL aprobadas (una prueba opcional del motor omitida en esa corrida), 12 pruebas del controlador aprobadas, 49 pruebas seleccionadas del frontend aprobadas y la prueba opcional del motor real aprobada por separado. Compilación del backend y revisión de tipos del frontend aprobadas.

## Revisión manual

1. Enviar una preinscripción con documentos de prueba y observar el progreso en la parte superior del diálogo. El 100 % debe conducir al detalle con resultados guardados.
2. Abrir un análisis: comprobar el PDF, los datos en español y las observaciones concretas.
3. Reemplazar uno o ambos documentos que requieran corrección y enviar. Comprobar la nueva versión y el contador diario después de recargar.
4. Al agotar tres correcciones, comprobar que el servidor rechace una cuarta y la interfaz informe el límite. Cambiar el día en pruebas solamente mediante la base sintética.

## Un commit por archivo

Después de aplicar el parche y verificarlo, desde `C:\check_u`, sin otros cambios pendientes:

```powershell
$preparados = @(git diff --cached --name-only)
if ($preparados.Count -gt 0) { throw 'Hay archivos preparados de otra operación. Revísalos antes de continuar.' }
$archivos = @(git -c core.quotepath=false ls-files --modified --others --exclude-standard | Sort-Object -Unique)
foreach ($archivo in $archivos) {
    git add -- $archivo
    if ($LASTEXITCODE -ne 0) { throw "Error preparando $archivo" }
    git commit -m "feat(tarea38): actualizar $archivo" --only -- $archivo
    if ($LASTEXITCODE -ne 0) { throw "Error creando el commit de $archivo" }
}
git status
git push -u origin tarea38_completar_ocr
```

Crear el PR hacia `main`, enlazar `Closes #90` y conservar los commits individuales al integrar.
