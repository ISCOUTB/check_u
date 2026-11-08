# Tarea 55 — Registro e importación de estudiantes

Implementa la solicitud #138 de CheckU. La funcionaria puede registrar un estudiante o importar estudiantes desde CSV en `/funcionario/registrar_estudiantes`. El acceso está en el menú de usuario del Navbar de la funcionaria: abrir su nombre y elegir **Registrar estudiantes**.

## Alcance y decisiones

- Registro de usuarios base: nombres, apellidos, código estudiantil y rol `ESTUDIANTE`.
- No crea solicitudes de grado ni cambia las existentes. No implementa contraseñas, correo ni acceso dinámico para los usuarios nuevos: la autenticación de prueba actual permanece en `AuthService`, configurada por `AUTH_*`. El registro en `usuarios` no permite por sí solo iniciar sesión.
- El formato solicitado no incluye correo. Se permite `correo = NULL` para estudiantes, manteniendo el correo obligatorio para funcionarios y conservando los correos existentes y su restricción de unicidad.
- Nombres y apellidos: obligatorios, máximo 100 caracteres, sin saltos de línea ni caracteres de control. Se recortan espacios externos.
- Código: texto de 1–50 letras ASCII, números, guion o guion bajo. Se recortan espacios externos y se guarda en mayúsculas, conservando ceros iniciales. Es una regla explícita del módulo, no una afirmación sobre todos los códigos institucionales futuros.
- Un índice único sobre `upper(btrim(codigo_estudiante))` impide duplicados incluso con peticiones simultáneas. Los usuarios previos se conservan.
- CSV UTF-8, extensión `.csv`, separador `;`, encabezado obligatorio y cuatro columnas en este orden. Límites elegidos: 1000 registros y 64 KiB por archivo. Admite BOM, CRLF y comillas CSV escapadas; ignora líneas vacías.
- El rol de cada fila debe ser exactamente `ESTUDIANTE`; no permite crear funcionarios.
- Cada fila de datos devuelve su línea física, código, resultado y motivo. Las filas con errores de contenido se rechazan sin impedir el registro de las válidas. Repetir un archivo informa duplicados, sin sobrescribir registros.
- Un archivo ilegible, encabezado incorrecto, exceso de tamaño/registros o comillas mal cerradas rechaza la importación completa antes de escribir. Un fallo inesperado de base de datos revierte todas las altas de esa importación.
- La API comprueba sesión y rol antes de procesar el archivo. La pantalla conserva datos/archivo al fallar, bloquea envíos simultáneos y no muestra éxito antes de recibir y validar la respuesta. Si se pierde la conexión después del guardado, reintentar permite detectar los códigos ya registrados.

## Aplicar en Windows

Este paquete parte de `main` en el commit `7c5738c23eacf61ca52b82b1bf53bf3fb23dcbab`. Incluye el parche y el contenido completo de cada archivo modificado bajo `archivos/`. Aplica **solo el parche**, sin copiar además esos archivos.

1. Extrae el ZIP en `C:\checku-tarea55`, de modo que exista `C:\checku-tarea55\tarea55_registro_estudiantes.patch`.
2. Ejecuta este bloque completo. Se detiene ante cambios locales, rama ya existente o parche incompatible; no borra trabajo.

```powershell
cd C:\check_u
& {
    $ErrorActionPreference = 'Stop'
    $pendientes = @(git status --porcelain)
    if ($LASTEXITCODE -ne 0) { throw 'No fue posible consultar Git.' }
    if ($pendientes.Count -gt 0) { throw 'Guarda tus cambios actuales antes de aplicar la tarea 55.' }
    git fetch origin main
    if ($LASTEXITCODE -ne 0) { throw 'No fue posible descargar main.' }
    git switch main
    if ($LASTEXITCODE -ne 0) { throw 'No fue posible cambiar a main.' }
    git merge --ff-only FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Tu main diverge. Revisa los cambios antes de continuar.' }
    if (git branch --list tarea55_registro_estudiantes) { throw 'La rama ya existe. Revisa si aplicaste el parche antes.' }
    git switch -c tarea55_registro_estudiantes
    if ($LASTEXITCODE -ne 0) { throw 'No fue posible crear la rama.' }
    $parche = 'C:\checku-tarea55\tarea55_registro_estudiantes.patch'
    if (-not (Test-Path $parche)) { throw "No existe $parche. Extrae el ZIP primero." }
    git apply --check -- "$parche"
    if ($LASTEXITCODE -ne 0) { throw 'El parche no coincide con tu versión. No se aplicó.' }
    git apply -- "$parche"
    if ($LASTEXITCODE -ne 0) { throw 'No fue posible aplicar el parche.' }
    git diff --check
    if ($LASTEXITCODE -ne 0) { throw 'Revisa los errores de formato mostrados.' }
    git status --short
}
```

Si ya hay cambios nuevos en main que hacen incompatible el parche, conserva la salida de `git apply --check`; no uses `--reject` ni reemplaces archivos completos automáticamente. No ejecutes este bloque si la rama ya contiene la tarea.

## Migración 011: obligatoria antes de probar

Con PostgreSQL local de Docker iniciado y el esquema actual ya instalado:

```powershell
cd C:\check_u
& {
    docker exec checku-db-local pg_isready -U checku -d checku_local
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL no está disponible.' }
    docker cp db/migrations/011-registro-estudiantes.sql checku-db-local:/tmp/tarea55.sql
    if ($LASTEXITCODE -ne 0) { throw 'No fue posible copiar la migración.' }
    docker exec checku-db-local psql -v ON_ERROR_STOP=1 -U checku -d checku_local -f /tmp/tarea55.sql
    if ($LASTEXITCODE -ne 0) { throw 'Falló la migración 011. Revisa el error antes de abrir el formulario.' }
}
```

La migración es repetible. Si encuentra códigos previos que solo difieren en mayúsculas o espacios externos, se detiene y no elimina ni combina usuarios. Consulta los conflictos y resuélvelos revisando sus relaciones antes de repetir:

```sql
SELECT upper(btrim(codigo_estudiante)) AS codigo_normalizado,
       array_agg(id_usuario ORDER BY id_usuario) AS usuarios
FROM usuarios
WHERE codigo_estudiante IS NOT NULL
GROUP BY upper(btrim(codigo_estudiante))
HAVING count(*) > 1;
```

Para una base nueva, `db/init/01-schema.sql` ya incorpora los cambios. El flujo existente de `levantar.ps1` también ejecuta las migraciones en orden. No elimines volúmenes ni reinicialices tu base actual para esta tarea.

## Dependencias y configuración

No se agregan dependencias ni variables de entorno. Usa Node/npm y versiones del lockfile del proyecto:

```powershell
cd C:\check_u
npm --prefix backend ci
npm --prefix frontend ci
```

Cada comando debe terminar correctamente antes del siguiente. Revisa `backend/.env` con la conexión PostgreSQL real y las credenciales `AUTH_FUNCIONARIO_USERNAME`, `AUTH_FUNCIONARIO_PASSWORD` y sus equivalentes de estudiante. No subas `.env` ni contraseñas a Git. `frontend/.env.local` debe contener:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

Conserva tus secretos existentes. Los `.env.example` de main contienen la estructura, no credenciales de producción.

## Probar manualmente

Terminal backend:

```powershell
cd C:\check_u
npm --prefix backend run start:dev
```

Terminal frontend:

```powershell
cd C:\check_u
npm --prefix frontend run dev
```

- Frontend y login: `http://localhost:3001`.
- Dashboard: `http://localhost:3001/funcionario/dashboard`.
- Registro: `http://localhost:3001/funcionario/registrar_estudiantes`.
- API: `http://localhost:3000/api`.
- PostgreSQL local: `localhost:5432`, según tu configuración.

Este módulo no necesita el motor OCR. Inicia sesión con la cuenta de funcionaria definida en tu `.env`. Abre el menú de su nombre y **Registrar estudiantes**.

1. Registra nombres/apellidos y un código nuevo; verifica la confirmación. Repite el mismo código en minúsculas: debe rechazarse sin borrar el formulario.
2. Descarga la plantilla. Guarda en UTF-8, por ejemplo, este archivo de **datos sintéticos**:

```csv
nombres;apellidos;codigo_estudiantil;rol
Ana;Prueba;T00550101;ESTUDIANTE
Luis;Prueba;T00550101;ESTUDIANTE
María;Prueba;T00550102;FUNCIONARIO
Pedro;Prueba;T00550103;ESTUDIANTE
```

La primera importación, si los códigos son nuevos, registra dos estudiantes y rechaza dos filas, explicando código repetido y rol incorrecto. Si ya existen, los informa como duplicados. Corrige solo las filas fallidas en otro archivo antes de reimportar.

3. Recarga la pantalla y repite un código para confirmar persistencia. El resultado de la importación se muestra en la respuesta actual; no se agrega un historial de importaciones a esta tarea.
4. Intenta abrir la ruta como estudiante o sin sesión: debe redirigir al inicio apropiado; la API rechaza altas con 403/401.
5. Verifica en la base, sin modificar los registros:

```powershell
docker exec checku-db-local psql -U checku -d checku_local -c "SELECT id_usuario,nombres,apellidos,codigo_estudiante,rol,correo FROM usuarios WHERE codigo_estudiante LIKE 'T005501%' ORDER BY id_usuario;"
```

Los registros de esta prueba manual quedan en tu base. Usa códigos de prueba y no elimines usuarios que ya tengan solicitudes asociadas.

## API

Ambas rutas requieren la cookie de sesión de una funcionaria autenticada.

| Método y ruta | Entrada | Resultado |
| --- | --- | --- |
| `POST /api/funcionario/estudiantes` | JSON: `nombres`, `apellidos`, `codigo_estudiantil` string, `rol: "ESTUDIANTE"` | 201, usuario creado con `id_usuario` y los campos de entrada normalizados |
| `POST /api/funcionario/estudiantes/importar` | Multipart, un único archivo bajo `archivo` | 200, `total`, `registrados`, `errores`, `filas` |

Cada elemento de `filas` incluye `linea`, `nombres`, `apellidos`, `codigo_estudiantil`, `estado` (`registrado`/`error`) y `mensaje`. Errores: 400 datos/CSV inválidos, 401 sin sesión, 403 rol incorrecto, 409 código individual duplicado, 413 archivo excesivo y 503 base de datos no disponible. El nombre interno en `usuarios` sigue siendo `codigo_estudiante`; el contrato solicitado utiliza `codigo_estudiantil`.

## Pruebas automatizadas

Compilar y probar la API (las credenciales son sintéticas y se configuran dentro de estas pruebas):

```powershell
cd C:\check_u
npm --prefix backend run build
npm --prefix backend run test:e2e -- test/registro-estudiantes.e2e-spec.ts --no-file-parallelism
npm --prefix frontend run build
cd frontend
npx playwright install chromium
npx playwright test e2e/registro_estudiantes.spec.ts
```

Playwright usa la configuración habitual del proyecto en puerto 3001. Si ya hay un frontend en ese puerto, debe ser el de esta rama; reinícialo después de configurar `.env.local`. Las 20 pruebas de interfaz simulan sesión/API deliberadamente; la persistencia se verifica por separado y con la prueba integrada siguiente.

Prueba integrada opcional con navegador, API Nest y PostgreSQL embebido PGlite **sin interceptar HTTP**. Primero detén los servidores backend/frontend (usa puertos 3000 y 3005). No apunta a tu base local ni borra sus datos:

```powershell
cd C:\check_u
$env:ESTUDIANTES_UI_REAL = '1'
try {
    npm --prefix backend run test:e2e -- test/registro-estudiantes-ui.e2e-spec.ts --no-file-parallelism
    if ($LASTEXITCODE -ne 0) { throw 'Falló la prueba integrada.' }
} finally {
    Remove-Item Env:ESTUDIANTES_UI_REAL -ErrorAction SilentlyContinue
}
```

La prueba usa Chromium instalado por Playwright. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` es opcional para un ejecutable externo; normalmente no se define.

### Verificación realizada en la entrega

- Build backend Nest y build frontend Next **con Turbopack**: correctos.
- API con Nest y PostgreSQL embebido PGlite: **38 pruebas aprobadas**, con persistencia, validación por fila, permisos, duplicados, peticiones individuales simultáneas, límite de carga, rollback e idempotencia de migración y detección de conflictos previos.
- Interfaz Chromium: **20 pruebas aprobadas**, incluyendo contratos HTTP, errores de red/sesión, datos conservados, bloqueo de envíos, plantilla, resultados por fila y axe WCAG A/AA en claro/oscuro a 320/1280 px.
- Recorrido integrado navegador → Next → Nest → PGlite sin respuestas HTTP simuladas: **1 prueba aprobada**. Comprueba registro individual, CSV mixto, datos guardados y rechazo de duplicado tras recargar.
- Regresión AuthService y opciones CSV/servicio: **19 pruebas aprobadas**, con variables de autenticación de prueba suministradas al proceso.
- ESLint de los archivos frontend afectados y oxlint con tipos del módulo y nuevas pruebas backend: sin errores.

No se ejecutó Docker ni se verificó tu instalación Windows o el servidor desplegado en esta entrega. PGlite ejecuta PostgreSQL embebido, no sustituye la prueba de conexión/configuración de tu PostgreSQL local. No se afirma haber ejecutado toda la batería del repositorio.

## Commits: uno por archivo

Después de probar y revisar `git diff`, ejecuta el bloque completo. Se detiene si hay archivos ya preparados o si falla un comando. Solo incluye el alcance de esta tarea: revisa los nombres antes de confirmar.

```powershell
cd C:\check_u
& {
    $ErrorActionPreference = 'Stop'
    $rama = git branch --show-current
    if ($LASTEXITCODE -ne 0 -or $rama.Trim() -ne 'tarea55_registro_estudiantes') { throw 'Rama incorrecta.' }
    $preparados = @(git diff --cached --name-only)
    if ($LASTEXITCODE -ne 0 -or $preparados.Count -gt 0) { throw 'Revisa los archivos preparados antes de continuar.' }
    git diff --check
    if ($LASTEXITCODE -ne 0) { throw 'Revisa los errores de formato.' }
    $archivos = @(git -c core.quotepath=false ls-files --modified --others --exclude-standard | Sort-Object -Unique)
    if ($LASTEXITCODE -ne 0) { throw 'No fue posible consultar los archivos.' }
    Write-Host "Se crearán $($archivos.Count) commits: uno por archivo."
    $archivos | ForEach-Object { Write-Host $_ }
    foreach ($archivo in $archivos) {
        git --literal-pathspecs add -- "$archivo"
        if ($LASTEXITCODE -ne 0) { throw "Error preparando $archivo" }
        git --literal-pathspecs commit --only -m "feat(tarea55): actualizar $archivo" -- "$archivo"
        if ($LASTEXITCODE -ne 0) { throw "Error creando el commit de $archivo" }
    }
    git status
    git push -u origin tarea55_registro_estudiantes
    if ($LASTEXITCODE -ne 0) { throw 'Los commits son locales; revisa el error de push.' }
}
```

No combines esta tarea con cambios pendientes de otra rama. Puedes crear la PR desde `https://github.com/ISCOUTB/check_u/compare/main...tarea55_registro_estudiantes`, título **Tarea 55: registro e importación de estudiantes** y referencia **Closes #138**. Para conservar un commit por archivo al integrar, coordina el uso de **Create a merge commit**, ya que **Squash and merge** los combina.

## Archivos y responsabilidades

- `backend/src/estudiantes/`: parser CSV, validación y persistencia, guard de sesión/rol, controlador y módulo.
- `backend/src/app.module.ts`: integra el módulo.
- `db/migrations/011-registro-estudiantes.sql` y `db/init/01-schema.sql`: correo pendiente de estudiantes y unicidad normalizada del código.
- `frontend/app/funcionario/registrar_estudiantes/`: formulario individual, importación, cliente API, resultados, metadatos y estilos.
- `frontend/app/components/navbar/Navbar.tsx`: enlace para funcionaria.
- `frontend/public/plantillas/estudiantes.csv`: plantilla con encabezado y sin usuarios precargados.
- `backend/test/registro-estudiantes.e2e-spec.ts`, `backend/test/registro-estudiantes-ui.e2e-spec.ts`, `frontend/e2e/registro_estudiantes.spec.ts`: pruebas del comportamiento y permisos.
- Este documento: aplicación, migración, pruebas, alcance y commits.
