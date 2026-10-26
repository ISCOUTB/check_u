# Tarea 28 — Borrador de solicitud

El formulario guarda progresivamente en PostgreSQL y recupera el borrador al recargar.
No exige documentos ni todos los campos completos. No ejecuta OCR ni crea entregas.

## Preparar una base de datos existente

No es necesario recrearla ni ejecutar `levantar.ps1`.
Desde PowerShell, en la raíz del repositorio, con el contenedor local iniciado:

```powershell
cmd /c "docker exec -i checku-db-local psql -U checku -d checku_local -v ON_ERROR_STOP=1 < db\migrations\003-borrador-parcial.sql"
```

Si el contenedor tiene otro nombre, reemplazar `checku-db-local`. Si PostgreSQL se ejecuta
sin Docker, ejecutar el mismo archivo mediante `psql -v ON_ERROR_STOP=1 -f ...`, con los
parámetros de conexión locales. La migración es transaccional y se puede repetir.
Para instalaciones nuevas, los cambios ya están incluidos en `db/init/01-schema.sql`.
No hay cambios en los usuarios iniciales ni en sus códigos.

Los textos pendientes se almacenan como NULL; los controles del frontend los presentan
como texto vacío. Las respuestas sí/no conservan NULL cuando no se han respondido.
Se flexibiliza la obligatoriedad de identidad, programa, modalidad y número Saber Pro
para poder guardar formularios parciales. Las validaciones de completitud se mantienen
al enviar formalmente la preinscripción.

## Backend

- `POST /api/solicitudes/borrador`: crea o actualiza el borrador del estudiante de la cookie
  `checku.sid`. Ignora identificadores de estudiante enviados por el cliente.
- `GET /api/solicitudes/borrador`: devuelve el formulario guardado, su nivel y documentos
  asociados, o `borrador: null` si no hay borrador. Si la solicitud ya fue enviada,
  informa su estado para que el frontend redirija.
- Ambas rutas requieren sesión de estudiante: 401 sin sesión y 403 para otros roles.
- Las solicitudes enviadas se protegen con 409; nunca se modifican al guardar borrador.
- La transacción bloquea la fila del estudiante antes de buscar o crear una solicitud,
  para serializar los primeros guardados concurrentes. Los siguientes reutilizan el ID.
- El POST acepta datos parciales. Los campos omitidos de perfil y estudios se conservan;
  un texto vacío explícito limpia ese campo. Una lista de programas o experiencias
  suministrada reemplaza esa sección. Se admiten hasta dos filas con orden 1 y 2.
- Cambiar de nivel limpia primero los hijos incompatibles, respetando los triggers.
- `segundoPrograma: false` elimina el programa con orden 2.
- Los metadatos de documentos quedan en CARGADO con `id_entrega` NULL. Esta tarea no
  implementa transporte de bytes ni almacenamiento físico de PDF: ese servicio de carga
  debe usar el `id_solicitud` retornado. No se ejecutan trabajos Python.

Ejemplo de respuesta del POST:

```json
{
  "ok": true,
  "id_solicitud": 102,
  "estado": "BORRADOR",
  "mensaje": "Borrador guardado exitosamente",
  "guardadoEn": "2026-10-25T18:00:00.000Z"
}
```

`guardadoEn` viene de la fecha de actualización de PostgreSQL. No se anuncia éxito
si el servidor rechaza la petición o la conexión falla. El ID se mantiene en el estado
React del formulario para las cargas posteriores; no se guardan datos personales en
localStorage ni sessionStorage.

## Instalación y ejecución

Desde la raíz:

```powershell
npm --prefix backend ci
npm --prefix frontend ci
```

Mantener la configuración local existente de backend y frontend, incluido
`NEXT_PUBLIC_API_URL` si se usa una dirección diferente a `http://localhost:3000/api`.
Iniciar cada servicio en una terminal:

```powershell
npm --prefix backend run start:dev
npm --prefix frontend run dev
```

Abrir el formulario sin `?escenario=borrador` ni otros escenarios de demostración.
Los escenarios explícitos siguen mostrando datos de ejemplo solo en desarrollo.

## Validación

```powershell
npm --prefix backend run build
npm --prefix backend test
npm --prefix backend run test:e2e
cd frontend
npx next typegen
npx tsc --noEmit
npx playwright test e2e/preinscripcion_api.spec.ts e2e/preinscripcion_validacion.spec.ts
npx playwright test e2e/iniciar_preinscripcion.spec.ts --grep "Tarea 28"
```

Las nuevas pruebas de la API ejecutan el esquema y los triggers con PostgreSQL embebido
PGlite, añadido solo como dependencia de desarrollo. No requieren borrar ni conectar la
base de datos del desarrollador. La ejecución en PostgreSQL nativo sigue siendo una
comprobación de integración local adicional.

Comprobación manual:

1. Iniciar sesión como estudiante y escribir solo algunos campos, sin cargar documentos.
2. Pulsar Guardar para continuar después y esperar el anuncio de éxito.
3. Recargar con F5: verificar que los valores regresan.
4. Modificar otro campo y guardar: comprobar que se conserva el mismo id_solicitud.
5. Detener el backend e intentar guardar: debe aparecer el error, sin anuncio de éxito.
6. Revisar que entregas no obtuvo filas nuevas y la solicitud sigue en BORRADOR.

No se incluyen commits ni push: corresponden al desarrollador.

## Verificación realizada para este paquete

- Backend: compilación correcta, 257 pruebas unitarias y 20 pruebas de API aprobadas.
- Frontend: generación de tipos, comprobación TypeScript y 57 pruebas de lógica aprobadas.
- Los archivos de producción del frontend modificados pasan ESLint.
- Las dos nuevas pruebas visuales Playwright están incluidas. Su ejecución en este
  entorno quedó bloqueada al arrancar Chromium por una restricción del sistema operativo
  (`socket() failed: Operation not permitted`); requieren ejecución en el PC local.
