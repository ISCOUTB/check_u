# ============================================================
# CHECKU - ENTORNO LOCAL
# Backend:  http://localhost:3000
# Frontend: http://localhost:3001
# OCR:      http://localhost:5001
# Salud:    http://localhost:5001/salud
# Database: PostgreSQL en Docker, puerto 5432
#
# IMPORTANTE:
# Utiliza exclusivamente docker-compose.local.yml.
# No inicia el docker-compose.yml del servidor.
# La base de datos se respalda y reconstruye en cada ejecucion.
# El motor OCR se crea si no existe y se inicia si esta detenido.
# Antes de continuar, verifica que el OCR responda en /salud.
# ============================================================

$ErrorActionPreference = 'Stop'

$raiz = $PSScriptRoot

$contenedor = 'checku-db-local'
$contenedorOCR = 'checku-ocr-local'

$baseDatos = 'checku_local'
$usuario = 'checku'

$schema = Join-Path $raiz 'db\init\01-schema.sql'
$userbase = Join-Path $raiz 'db\init\02-userbase.sql'
$carpetaRespaldos = Join-Path $raiz 'backups'

$urlSaludOCR = 'http://localhost:5001/salud'

# ------------------------------------------------------------
# Detectar el archivo Compose local.
# ------------------------------------------------------------

$compose = $null

foreach ($nombre in @(
    'docker-compose.local.yml',
    'docker.compose.local.yml'
)) {
    $ruta = Join-Path $raiz $nombre

    if (Test-Path $ruta) {
        $compose = $ruta
        break
    }
}

# ------------------------------------------------------------
# Ejecutar comandos Docker y verificar su resultado.
# ------------------------------------------------------------

function Invoke-Docker {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Argumentos
    )

    & docker @Argumentos

    if ($LASTEXITCODE -ne 0) {
        throw "Fallo el comando Docker: docker $($Argumentos -join ' ')"
    }
}

# ------------------------------------------------------------
# Comprobar la salud del motor OCR mediante HTTP.
# ------------------------------------------------------------

function Test-MotorOCR {
    param(
        [int]$Intentos = 15,
        [int]$EsperaSegundos = 2
    )

    Write-Host "`nVerificando salud del motor OCR..." -ForegroundColor Yellow

    for ($i = 1; $i -le $Intentos; $i++) {
        try {
            $respuesta = Invoke-RestMethod `
                -Uri $urlSaludOCR `
                -Method Get `
                -TimeoutSec 5 `
                -ErrorAction Stop

            $tiposRequeridos = @(
                'academic_evaluation',
                'estampilla_pro_cultura',
                'identification',
                'saber_pro'
            )

            $tiposRespuesta = @($respuesta.tipos_soportados)

            $tiposFaltantes = @(
                $tiposRequeridos | Where-Object {
                    $_ -notin $tiposRespuesta
                }
            )

            if (
                $respuesta.ok -eq $true -and
                $respuesta.servicio -eq 'motor-validacion' -and
                $tiposFaltantes.Count -eq 0
            ) {
                Write-Host 'Motor OCR saludable.' -ForegroundColor Green
                Write-Host "Servicio: $($respuesta.servicio)"
                Write-Host "Tipos soportados: $($tiposRespuesta -join ', ')"

                return $true
            }

            Write-Host `
                "La respuesta del OCR no cumple lo esperado (intento $i/$Intentos)." `
                -ForegroundColor Yellow
        }
        catch {
            Write-Host `
                "Esperando respuesta del OCR ($i/$Intentos)..." `
                -ForegroundColor DarkYellow
        }

        if ($i -lt $Intentos) {
            Start-Sleep -Seconds $EsperaSegundos
        }
    }

    return $false
}

try {
    Write-Host "`n===== CHECKU: RECONSTRUIR BASE LOCAL =====" -ForegroundColor Cyan

    # --------------------------------------------------------
    # 0. Validar archivos y disponibilidad de Docker.
    # --------------------------------------------------------

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

    # --------------------------------------------------------
    # 1. Crear/iniciar el OCR y comprobarlo.
    # --------------------------------------------------------

    Write-Host "`n[1/7] Preparando motor OCR..." -ForegroundColor Yellow

    # Compose crea el contenedor si no existe y lo inicia si esta detenido.
    # --build construye la imagen si hace falta.
    Invoke-Docker -Argumentos @(
        'compose', '-f', $compose, 'up', '-d', '--build', 'ocr'
    )

    # Esperar a que Compose reporte el servicio OCR como ejecutandose.
    # Se usa "compose ps" para evitar ejecutar "docker inspect" sobre
    # un contenedor inexistente, lo que puede detener PowerShell.
    $ocrIniciado = $false

    for ($i = 0; $i -lt 30; $i++) {
        $idOCR = & docker compose -f $compose ps --status running -q ocr 2>$null

        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace(($idOCR -join '').Trim())) {
            $ocrIniciado = $true
            break
        }

        Start-Sleep -Seconds 2
    }

    if (-not $ocrIniciado) {
        Write-Host "`nContenedores del proyecto:" -ForegroundColor Yellow
        & docker compose -f $compose ps -a
        throw "El servicio OCR no inicio. Revisa los logs con: docker compose -f `"$compose`" logs --tail 100 ocr"
    }

    Write-Host "Contenedor OCR ejecutandose: $contenedorOCR" -ForegroundColor Green

    # El contenedor puede estar activo aunque Flask no este listo.
    if (-not (Test-MotorOCR)) {
        Write-Host "`nUltimos logs del OCR:" -ForegroundColor Yellow
        & docker compose -f $compose logs --tail 100 ocr
        throw 'El motor OCR no respondio correctamente en /salud. No se continuara con la inicializacion.'
    }

    # --------------------------------------------------------
    # 2. Levantar PostgreSQL.
    # --------------------------------------------------------

    Write-Host "`n[2/7] Levantando PostgreSQL..." -ForegroundColor Yellow

    Invoke-Docker -Argumentos @(
        'compose', '-f', $compose, 'up', '-d', 'db'
    )

    # Esperar a que PostgreSQL este saludable.
    $saludable = $false

    for ($i = 0; $i -lt 30; $i++) {
        $estado = & docker inspect --format '{{.State.Health.Status}}' $contenedor 2>$null

        if ($LASTEXITCODE -eq 0 -and $estado -eq 'healthy') {
            $saludable = $true
            break
        }

        Start-Sleep -Seconds 2
    }

    if (-not $saludable) {
        throw "PostgreSQL no alcanzo el estado healthy. Revisa: docker logs $contenedor"
    }

    # --------------------------------------------------------
    # 3. Preparar respaldo de la base existente.
    # --------------------------------------------------------

    Write-Host "`n[3/7] Preparando respaldo..." -ForegroundColor Yellow

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

    # --------------------------------------------------------
    # 4. Eliminar y recrear la base.
    # --------------------------------------------------------

    Write-Host "`n[4/7] Recreando la base de datos..." -ForegroundColor Yellow

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

    # --------------------------------------------------------
    # 5. Importar esquema y usuarios base.
    # --------------------------------------------------------

    Write-Host "`n[5/7] Importando esquema y usuarios..." -ForegroundColor Yellow

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

    # --------------------------------------------------------
    # 6. Verificar la base de datos.
    # --------------------------------------------------------

    Write-Host "`n[6/7] Verificando la base..." -ForegroundColor Yellow

    Invoke-Docker -Argumentos @(
        'exec', $contenedor,
        'psql', '-v', 'ON_ERROR_STOP=1',
        '-U', $usuario, '-d', $baseDatos,
        '-c', 'SELECT 1;'
    )

    # --------------------------------------------------------
    # 7. Iniciar backend y frontend.
    # --------------------------------------------------------

    Write-Host "`n[7/7] Iniciando aplicaciones..." -ForegroundColor Yellow

    $backend = Join-Path $raiz 'backend'
    $frontend = Join-Path $raiz 'frontend'

    if (-not (Test-Path (Join-Path $backend 'node_modules'))) {
        Write-Host 'Instalando dependencias del backend...' -ForegroundColor Yellow
        Push-Location $backend
        try {
            & npm install
            if ($LASTEXITCODE -ne 0) {
                throw 'No se pudieron instalar las dependencias del backend.'
            }
        }
        finally {
            Pop-Location
        }
    }

    if (-not (Test-Path (Join-Path $frontend 'node_modules'))) {
        Write-Host 'Instalando dependencias del frontend...' -ForegroundColor Yellow
        Push-Location $frontend
        try {
            & npm install
            if ($LASTEXITCODE -ne 0) {
                throw 'No se pudieron instalar las dependencias del frontend.'
            }
        }
        finally {
            Pop-Location
        }
    }

    Start-Process powershell.exe -ArgumentList @(
        '-NoExit', '-Command',
        "Set-Location '$backend'; npm run start:dev"
    )

    Start-Process powershell.exe -ArgumentList @(
        '-NoExit', '-Command',
        "Set-Location '$frontend'; npm run dev -- -p 3001"
    )

    # --------------------------------------------------------
    # Final.
    # --------------------------------------------------------

    Write-Host "`n===== CHECKU LISTO =====" -ForegroundColor Green
    Write-Host 'Backend:  http://localhost:3000/api/health'
    Write-Host 'Frontend: http://localhost:3001'
    Write-Host 'OCR:      http://localhost:5001'
    Write-Host 'Salud OCR: http://localhost:5001/salud'
    Write-Host "SQL fuente: $schema"
    Write-Host "Usuarios base: $userbase"
    Write-Host "Respaldo: $carpetaRespaldos"
}
catch {
    Write-Host "`nERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'El proceso se detuvo. Revisa el error antes de continuar.' -ForegroundColor Yellow
    exit 1
}
