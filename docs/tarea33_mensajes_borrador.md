# Tarea 33 — Mensajes del guardado de borrador

El guardado distingue validación, sesión expirada, permisos, identidad duplicada,
solicitud enviada, conexión fallida, indisponibilidad y errores inesperados. Los
mensajes explican qué puede hacer el estudiante sin mostrar SQL, trazas ni datos
personales procedentes de errores internos.

No requiere migraciones SQL ni dependencias nuevas. Mantiene la política de la
Tarea 28: el borrador permite campos incompletos. Un mensaje de campo obligatorio
solo se genera cuando la validación o una restricción real lo identifica.

## Comportamiento

- En curso: muestra Guardando tu borrador y evita peticiones duplicadas.
- Éxito: confirma que el borrador se guardó y muestra la fecha del servidor.
- Edición posterior: muestra Tienes cambios sin guardar.
- Fallo: oculta el anuncio de éxito anterior, conserva los campos y permite reintentar.
- Guardar y salir: el error se presenta dentro del diálogo y no abandona el formulario.
- Una respuesta ilegible o sin los datos de confirmación se trata como un fallo de
  confirmación, nunca como un guardado exitoso.
- La información conservada tras un fallo permanece en el formulario actual; no se
  afirma que el último cambio esté en PostgreSQL ni que sobreviva a cerrar la página.

El POST /api/solicitudes/borrador devuelve errores con statusCode, codigo y message.
Las validaciones conocidas añaden campos con nombres públicos y motivo FALTANTE o
INVALIDO. El frontend interpreta códigos y campos conocidos con sus propios mensajes;
no imprime el message arbitrario de una respuesta del servidor.

La causa SQL se mantiene internamente en DatabaseService para distinguir restricciones
de fallos de infraestructura. La traducción pública se aplica solo al POST del borrador.

## Pruebas

Desde la raíz, con las dependencias del proyecto instaladas:

```powershell
npm --prefix backend run build
cd backend
npx vitest run src/solicitudes/errores-borrador.spec.ts src/solicitudes/solicitudes.controller.spec.ts src/database/database.service.spec.ts
npm run test:e2e
cd ..\frontend
npx next typegen
npx tsc --noEmit
npx playwright test e2e/preinscripcion_api.spec.ts e2e/preinscripcion_validacion.spec.ts
npx playwright test e2e/borrador_mensajes.spec.ts
npx playwright test e2e/iniciar_preinscripcion.spec.ts --grep "Tarea 28|guardado en el mismo|borrador parcial|Guardar y salir"
```

Resultados comprobados al preparar el parche:

- Backend compila y TypeScript pasa en backend y frontend.
- 31 pruebas unitarias de los componentes afectados pasan, incluidas 14 nuevas.
- 23 pruebas de API pasan, con esquema SQL y triggers reales en PGlite.
- 65 pruebas de lógica del frontend pasan.
- 8 pruebas nuevas en navegador y 5 de regresión del borrador pasan.
- Lint del backend sin errores; conserva seis advertencias anteriores de unbound-method
  en database.service.spec.ts. Los componentes y el cliente HTTP del frontend modificados pasan ESLint.

### Fallos anteriores de main

Sobre main 84e41d228a88f9c1bd31337fe977cea0bd26fba8, la suite unitaria completa ya
presenta cinco fallos sin aplicar la tarea 33. Se comprobó ejecutándola con los archivos
originales de main y se reprodujeron los mismos cinco fallos con esta tarea:

- Un JSON Schema exportado de document-analysis-response no coincide con el contrato.
- Cuatro pruebas de segundo programa en solicitudes.service.spec.ts tienen una secuencia
  de respuestas simuladas que no contempla el bloqueo del usuario antes del SELECT.

El paquete no modifica esos contratos ni esas pruebas ajenas a los mensajes. La suite
completa con esta tarea registra 307 aprobadas y esos mismos cinco fallos anteriores.

## Comprobación manual

1. Con el entorno habitual del proyecto iniciado, guardar algunos campos y verificar éxito.
2. Modificar un campo: debe aparecer Tienes cambios sin guardar.
3. Detener temporalmente el backend e intentar guardar: debe avisar del fallo de conexión
   sin vaciar los controles ni conservar el anuncio de éxito anterior.
4. Reiniciar el backend, iniciar sesión nuevamente en otra pestaña si perdió la sesión,
   y pulsar Reintentar en el formulario original.
5. Las pruebas de navegador simulan además 400/422, 401, 503 y 500, así como el diálogo
   Guardar y salir; no requieren provocar errores en la base de datos personal.

Los commits y el push los realiza el desarrollador, con un commit por archivo.
