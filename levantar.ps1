
# ============================================================
# CHECKU - ENTORNO LOCAL
# Backend:  http://localhost:3000
# Frontend: http://localhost:3001
# Database: PostgreSQL en Docker, puerto 5432
#
# IMPORTANTE:
# Utiliza exclusivamente docker-compose.local.yml.
# No inicia el docker-compose.yml del servidor.
# ============================================================

$ErrorActionPreference = 'Stop'

$raiz = $PSScriptRoot
$contenedor = 'checku-db-local'
$baseDatos = 'checku_local'
$usuario = 'checku'

$schema = Join-Path $raiz 'db\init\01-schema.sql'
$userbase = Join-Path $raiz 'db\init\02-userbase.sql'
$carpetaRespaldos = Join-Path $raiz 'backups'

# Detectar el nombre del archivo Compose local.
$compose = $null

foreach ($nombre in @('docker-compose.local.yml', 'docker.compose.local.yml')) {
    $ruta = Join-Path $raiz $nombre

    if (Test-Path $ruta) {
        $compose = $ruta
        break
    }
}

function Invoke-Docker {
    param([string[]]$Argumentos)

    & docker @Argumentos

    if ($LASTEXITCODE -ne 0) {
        throw "Fallo el comando Docker: docker $($Argumentos -join ' ')"
    }
}

try {
    Write-Host "`n===== CHECKU: RECONSTRUIR BASE LOCAL =====" -ForegroundColor Cyan

    # Validar archivos antes de tocar la base de datos.
    if (-not $compose) {
        throw 'No se encontro el archivo Compose local.'
    }

    if (-not (Test-Path $schema)) {
        throw "No se encontro $schema"
    }

    if (-not (Test-Path $userbase)) {
        throw "No se encontro $userbase"
    }

    if (-not (Test-Path (Join-Path $raiz 'backend\package.json'))) {
        throw 'No se encontro backend\package.json'
    }

    if (-not (Test-Path (Join-Path $raiz 'frontend\package.json'))) {
        throw 'No se encontro frontend\package.json'
    }

    Invoke-Docker -Argumentos @('info')

    # 1. Levantar PostgreSQL.
    Write-Host "`n[1/6] Levantando PostgreSQL..." -ForegroundColor Yellow

    Invoke-Docker -Argumentos @(
        'compose', '-f', $compose, 'up', '-d', 'db'
    )

    # Esperar a que PostgreSQL este saludable.
    $saludable = $false

    for ($i = 0; $i -lt 30; $i++) {
        $estado = docker inspect --format '{{.State.Health.Status}}' $contenedor 2>$null

        if ($LASTEXITCODE -eq 0 -and $estado -eq 'healthy') {
            $saludable = $true
            break
        }

        Start-Sleep -Seconds 2
    }

    if (-not $saludable) {
        throw 'PostgreSQL no alcanzo el estado healthy. Revisa docker logs checku-db-local.'
    }

    # 2. Respaldar la base existente, si existe.
    Write-Host "`n[2/6] Preparando respaldo..." -ForegroundColor Yellow

    New-Item -ItemType Directory -Path $carpetaRespaldos -Force |
        Out-Null

    $consulta = "SELECT 1 FROM pg_database WHERE datname = '$baseDatos';"

    $existe = docker exec $contenedor psql `
        -U $usuario -d postgres -tAc $consulta

    if ($LASTEXITCODE -ne 0) {
        throw 'No se pudo comprobar si existe la base de datos.'
    }

    if ("$existe".Trim() -eq '1') {
        $fecha = Get-Date -Format 'yyyyMMdd_HHmmss'
        $respaldo = Join-Path $carpetaRespaldos "checku_$fecha.sql"

        Invoke-Docker -Argumentos @(
            'exec', $contenedor,
            'pg_dump', '-U', $usuario,
            '-d', $baseDatos,
            '--inserts', '--column-inserts',
            '-f', '/tmp/checku_backup.sql'
        )

        Invoke-Docker -Argumentos @(
            'cp',
            "${contenedor}:/tmp/checku_backup.sql",
            $respaldo
        )

        if (-not (Test-Path $respaldo)) {
            throw 'No se encontro el archivo de respaldo. No se borrara la base.'
        }

        if ((Get-Item $respaldo).Length -eq 0) {
            throw 'El respaldo esta vacio. No se borrara la base.'
        }

        Write-Host "Respaldo guardado en: $respaldo" -ForegroundColor Green
    }
    else {
        Write-Host 'No existe una base anterior; se omitio el respaldo.'
    }

    # 3. Eliminar y recrear la base.
    Write-Host "`n[3/6] Recreando la base de datos..." -ForegroundColor Yellow

    $dropSql = "DROP DATABASE IF EXISTS $baseDatos WITH (FORCE);"

    Invoke-Docker -Argumentos @(
        'exec', $contenedor,
        'psql', '-v', 'ON_ERROR_STOP=1',
        '-U', $usuario, '-d', 'postgres',
        '-c', $dropSql
    )

    $createSql = "CREATE DATABASE $baseDatos OWNER $usuario;"

    Invoke-Docker -Argumentos @(
        'exec', $contenedor,
        'psql', '-v', 'ON_ERROR_STOP=1',
        '-U', $usuario, '-d', 'postgres',
        '-c', $createSql
    )

    # 4. Copiar e importar el esquema y los usuarios base.
    Write-Host "`n[4/6] Importando 01-schema.sql..." -ForegroundColor Yellow

    Invoke-Docker -Argumentos @(
        'cp', $schema, "${contenedor}:/tmp/01-schema.sql"
    )

    Invoke-Docker -Argumentos @(
        'exec', $contenedor,
        'psql', '-v', 'ON_ERROR_STOP=1',
        '-U', $usuario, '-d', $baseDatos,
        '-f', '/tmp/01-schema.sql'
    )

    Write-Host 'Importando 02-userbase.sql...' -ForegroundColor Yellow

    Invoke-Docker -Argumentos @(
        'cp', $userbase, "${contenedor}:/tmp/02-userbase.sql"
    )

    Invoke-Docker -Argumentos @(
        'exec', $contenedor,
        'psql', '-v', 'ON_ERROR_STOP=1',
        '-U', $usuario, '-d', $baseDatos,
        '-f', '/tmp/02-userbase.sql'
    )

    # 5. Verificar que PostgreSQL responde.
    Write-Host "`n[5/6] Verificando la base..." -ForegroundColor Yellow

    Invoke-Docker -Argumentos @(
        'exec', $contenedor,
        'psql', '-v', 'ON_ERROR_STOP=1',
        '-U', $usuario, '-d', $baseDatos,
        '-c', 'SELECT 1;'
    )

    # 6. Iniciar backend y frontend.
    Write-Host "`n[6/6] Iniciando aplicaciones..." -ForegroundColor Yellow

    $backend = Join-Path $raiz 'backend'
    $frontend = Join-Path $raiz 'frontend'

    Start-Process powershell.exe -ArgumentList @(
        '-NoExit', '-Command',
        "Set-Location '$backend'; npm run start:dev"
    )

    Start-Process powershell.exe -ArgumentList @(
        '-NoExit', '-Command',
        "Set-Location '$frontend'; npm run dev -- -p 3001"
    )

    Write-Host "`n===== CHECKU LISTO =====" -ForegroundColor Green
    Write-Host 'Backend:  http://localhost:3000/api/health'
    Write-Host 'Frontend: http://localhost:3001'
    Write-Host "SQL fuente: $schema"
    Write-Host "Usuarios base: $userbase"
}
catch {
    Write-Host "`nERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'El proceso se detuvo. Revisa el error antes de continuar.' -ForegroundColor Yellow
    exit 1
}
