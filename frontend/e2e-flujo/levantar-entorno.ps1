# Tarea 53: entorno aislado para las pruebas de flujo. No toca los contenedores de levantar.ps1.
#
#   Base de datos: contenedor checku-t53-db, puerto 5443 (se borra al terminar).
#   Motor real:    contenedor checku-t53-motor, puerto 5013, con ALMA simulado.
#   Motor prueba:  e2e-flujo/motor-de-prueba.mjs, puerto 5014 (el backend le habla a este).
#   Backend:       puerto 3000.   Frontend: puerto 3001.
#
# Uso, desde la raíz del repositorio:
#   .\frontend\e2e-flujo\levantar-entorno.ps1           (levanta todo)
#   .\frontend\e2e-flujo\levantar-entorno.ps1 -Apagar   (apaga y borra los contenedores)
#
# Las credenciales de abajo son de prueba y solo existen en este entorno.
param([switch]$Apagar)

# docker escribe avisos en stderr: con 'Stop', PowerShell 5.1 los convierte en excepciones. Cada paso revisa su salida.
$ErrorActionPreference = 'Continue'
# PowerShell 5.1 manda ASCII por las tuberías y dañaría las tildes del SQL.
$OutputEncoding = [Text.UTF8Encoding]::new($false)
$raiz = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$datos = Join-Path ([IO.Path]::GetTempPath()) 'checku-t53-alma'
$imagen = 'checku-t53-motor:pruebas'

if ($Apagar) {
    docker rm -f checku-t53-db checku-t53-motor 2>$null | Out-Null
    Write-Host 'Contenedores de prueba eliminados. Cierra las ventanas del backend, frontend y motor de prueba.'
    return
}

New-Item -ItemType Directory -Force -Path $datos -ErrorAction Stop | Out-Null
Copy-Item (Join-Path $raiz 'modules\validadores\fuentes\alma\alma_simulacion.example.json') (Join-Path $datos 'alma_simulacion.json') -ErrorAction Stop

docker rm -f checku-t53-db checku-t53-motor 2>$null | Out-Null
docker run -d --name checku-t53-db -p 127.0.0.1:5443:5432 -e POSTGRES_USER=checku `
    -e POSTGRES_PASSWORD=checku_t53_pruebas -e POSTGRES_DB=checku_local postgres:16 | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear la base de datos de prueba.' }
do { Start-Sleep -Seconds 1; docker exec checku-t53-db pg_isready -U checku -d checku_local *> $null } until ($LASTEXITCODE -eq 0)

$archivos = @('db\init\01-schema.sql', 'db\init\02-userbase.sql') +
    (Get-ChildItem (Join-Path $raiz 'db\migrations') -Filter *.sql | Sort-Object Name | ForEach-Object { "db\migrations\$($_.Name)" })
foreach ($archivo in $archivos) {
    Get-Content -Raw -Encoding utf8 (Join-Path $raiz $archivo) |
        docker exec -i checku-t53-db psql -U checku -d checku_local -v ON_ERROR_STOP=1 -q
    if ($LASTEXITCODE -ne 0) { throw "Falló $archivo" }
}

docker image inspect $imagen *> $null
if ($LASTEXITCODE -ne 0) {
    docker build -f (Join-Path $raiz 'modules\api\Dockerfile') -t $imagen $raiz
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo construir la imagen del motor.' }
}
docker run -d --name checku-t53-motor -p 127.0.0.1:5013:5001 -e ALMA_MODO=simulado `
    -e ALMA_SIMULACION_ARCHIVO=/datos/alma/alma_simulacion.json -v "${datos}:/datos/alma:ro" $imagen | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar el motor.' }

$backend = @"
`$env:PORT='3000'; `$env:NODE_ENV='development'
`$env:DB_HOST='127.0.0.1'; `$env:DB_PORT='5443'; `$env:DB_USER='checku'; `$env:DB_PASSWORD='checku_t53_pruebas'; `$env:DB_NAME='checku_local'
`$env:MOTOR_URL='http://127.0.0.1:5014'; `$env:MOTOR_TIMEOUT_MS='120000'
`$env:AUTH_ESTUDIANTE_USERNAME='estudiante@ejemplo.edu.co'; `$env:AUTH_ESTUDIANTE_PASSWORD='flujo-estudiante'; `$env:AUTH_ESTUDIANTE_NAME='Estudiante Prueba'
`$env:AUTH_FUNCIONARIO_USERNAME='funcionaria@ejemplo.edu.co'; `$env:AUTH_FUNCIONARIO_PASSWORD='flujo-funcionaria'; `$env:AUTH_FUNCIONARIO_NAME='Funcionaria Prueba'
npm run start:dev
"@
Start-Process powershell -WorkingDirectory (Join-Path $raiz 'backend') -ArgumentList '-NoExit', '-Command', $backend
Start-Process powershell -WorkingDirectory (Join-Path $raiz 'frontend') -ArgumentList '-NoExit', '-Command', "`$env:NEXT_PUBLIC_API_URL='http://localhost:3000/api'; npm run dev"
Start-Process powershell -WorkingDirectory $PSScriptRoot -ArgumentList '-NoExit', '-Command', 'node motor-de-prueba.mjs'

Write-Host "Entorno listo. JSON de ALMA: $datos\alma_simulacion.json"
Write-Host 'Ejecuta las pruebas con: cd frontend; npx playwright test -c playwright.flujo.config.ts'
