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
# Conserva las dependencias instaladas y los datos de PostgreSQL.
# No reconstruye imagenes Docker en cada ejecucion.
# Ejecuta las migraciones pendientes de db/migrations.
#
# Uso:
# .\levantar.ps1                 (entorno completo)
# .\levantar.ps1 --only-db       (solo PostgreSQL y migraciones)
# .\levantar.ps1 --reset-db      (respaldar y reconstruir la BD)
# ============================================================

$ErrorActionPreference = 'Stop'

$argumentosPermitidos = @('--only-db', '--reset-db')
$argumentosNoReconocidos = @(
  $args | Where-Object { $_ -notin $argumentosPermitidos }
)

if ($argumentosNoReconocidos.Count -gt 0) {
  throw "Parametro no reconocido: $($argumentosNoReconocidos -join ', ')"
}

if (($args -contains '--only-db') -and ($args -contains '--reset-db')) {
  throw 'No puedes combinar --only-db y --reset-db.'
}

$soloBaseDatos = $args -contains '--only-db'
$reiniciarBaseDatos = $args -contains '--reset-db'

$raiz = $PSScriptRoot

$contenedor = 'checku-db-local'
$contenedorOCR = 'checku-ocr-local'

$baseDatos = 'checku_local'
$usuario = 'checku'

$schema = Join-Path $raiz 'db\init\01-schema.sql'
$userbase = Join-Path $raiz 'db\init\02-userbase.sql'
$migraciones = Join-Path $raiz 'db\migrations'
$carpetaRespaldos = Join-Path $raiz 'backups'

$urlSaludOCR = 'http://localhost:5001/salud'

# ------------------------------------------------------------
# Detectar Compose local.
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
# Ejecutar comandos Docker.
# ------------------------------------------------------------

function Invoke-Docker {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Argumentos
  )

  & docker @Argumentos

  if ($LASTEXITCODE -ne 0) {
    throw "Fallo Docker: docker $($Argumentos -join ' ')"
  }
}

# ------------------------------------------------------------
# Verificar salud OCR.
# ------------------------------------------------------------

function Test-MotorOCR {
  param(
    [int]$Intentos = 15,
    [int]$EsperaSegundos = 2
  )

  Write-Host "`nVerificando motor OCR..." -ForegroundColor Yellow

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
        return $true
      }
    }
    catch {
      Write-Host "Esperando OCR ($i/$Intentos)..." -ForegroundColor DarkYellow
    }

    if ($i -lt $Intentos) {
      Start-Sleep -Seconds $EsperaSegundos
    }
  }

  return $false
}

# ------------------------------------------------------------
# Instalar dependencias solo cuando falten.
# ------------------------------------------------------------

function Install-Dependencies {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Carpeta,

    [Parameter(Mandatory = $true)]
    [string]$Nombre
  )

  $package = Join-Path $Carpeta 'package.json'
  $lock = Join-Path $Carpeta 'package-lock.json'
  $modules = Join-Path $Carpeta 'node_modules'

  if (-not (Test-Path $package)) {
    throw "No existe $package"
  }

  if (Test-Path $modules) {
    Write-Host "${Nombre}: dependencias existentes. Se reutilizaran." -ForegroundColor Green
    return
  }

  Write-Host "Instalando dependencias de $Nombre..." -ForegroundColor Yellow

  Push-Location $Carpeta

  try {
    if (Test-Path $lock) {
      & npm ci
    }
    else {
      & npm install
    }

    if ($LASTEXITCODE -ne 0) {
      throw "No se pudieron instalar las dependencias de $Nombre."
    }
  }
  finally {
    Pop-Location
  }
}

# ------------------------------------------------------------
# Iniciar servicios Docker sin reconstruir imagenes.
# ------------------------------------------------------------

function Start-ComposeService {
  param(
    [string]$Servicio
  )

  Invoke-Docker -Argumentos @(
    'compose', '-f', $compose, 'up', '-d', $Servicio
  )
}

# ------------------------------------------------------------
# Ejecutar migraciones pendientes.
# ------------------------------------------------------------

function Invoke-Migrations {

  Write-Host "`nVerificando migraciones de base de datos..." -ForegroundColor Yellow

  if (-not (Test-Path $migraciones -PathType Container)) {
    throw "No existe la carpeta de migraciones: $migraciones"
  }

  # Crear tabla de control de migraciones.
  Invoke-Docker -Argumentos @(
    'exec', $contenedor,
    'psql', '-v', 'ON_ERROR_STOP=1',
    '-U', $usuario,
    '-d', $baseDatos,
    '-c',
    'CREATE TABLE IF NOT EXISTS public.schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );'
  )

  # Obtener archivos SQL ordenados alfabeticamente.
  $archivosMigracion = @(
    Get-ChildItem -Path $migraciones -File -Filter '*.sql' |
      Sort-Object Name
  )

  if ($archivosMigracion.Count -eq 0) {
    Write-Host 'No hay archivos de migracion.' -ForegroundColor DarkYellow
    return
  }

  $pendientes = 0
  $ejecutadas = 0
  $omitidas = 0

  foreach ($archivo in $archivosMigracion) {

    $nombre = $archivo.Name

    # Escapar comillas simples para la consulta SQL.
    $nombreSQL = $nombre.Replace("'", "''")

    # Consultar si la migracion ya fue ejecutada.
    $consulta = "SELECT 1 FROM public.schema_migrations WHERE filename = '$nombreSQL';"

    $resultado = & docker exec $contenedor psql `
      -U $usuario `
      -d $baseDatos `
      -tAc $consulta

    if ($LASTEXITCODE -ne 0) {
      throw "No se pudo consultar el estado de la migracion: $nombre"
    }

    if ("$resultado".Trim() -eq '1') {
      Write-Host "OMITIDA: $nombre (ya ejecutada)." -ForegroundColor DarkGray
      $omitidas++
      continue
    }

    $pendientes++

    Write-Host "`nEjecutando migracion: $nombre" -ForegroundColor Yellow

    # Copiar archivo SQL al contenedor.
    $archivoTemporal = "/tmp/checku_migration_$pendientes.sql"

    Invoke-Docker -Argumentos @(
      'cp',
      $archivo.FullName,
      "${contenedor}:$archivoTemporal"
    )

    # Ejecutar migracion.
    Invoke-Docker -Argumentos @(
      'exec', $contenedor,
      'psql',
      '-v', 'ON_ERROR_STOP=1',
      '-U', $usuario,
      '-d', $baseDatos,
      '-f', $archivoTemporal
    )

    # Registrar la migracion solamente despues de ejecutarla correctamente.
    $registro = "INSERT INTO public.schema_migrations (filename) VALUES ('$nombreSQL');"

    Invoke-Docker -Argumentos @(
      'exec', $contenedor,
      'psql',
      '-v', 'ON_ERROR_STOP=1',
      '-U', $usuario,
      '-d', $baseDatos,
      '-c', $registro
    )

    Write-Host "APLICADA: $nombre" -ForegroundColor Green

    $ejecutadas++
  }

  Write-Host "`n===== RESUMEN DE MIGRACIONES =====" -ForegroundColor Cyan
  Write-Host "Encontradas: $($archivosMigracion.Count)"
  Write-Host "Pendientes:  $pendientes"
  Write-Host "Ejecutadas:  $ejecutadas"
  Write-Host "Omitidas:    $omitidas"

  if ($pendientes -eq 0) {
    Write-Host 'La base de datos ya esta actualizada.' -ForegroundColor Green
  }
}

try {

  if ($soloBaseDatos) {
    Write-Host "`n===== CHECKU: SOLO BASE DE DATOS =====" -ForegroundColor Cyan
  }
  elseif ($reiniciarBaseDatos) {
    Write-Host "`n===== CHECKU: REINICIO DE BASE DE DATOS =====" -ForegroundColor Cyan
  }
  else {
    Write-Host "`n===== CHECKU: LEVANTAR ENTORNO LOCAL =====" -ForegroundColor Cyan
  }

  # --------------------------------------------------------
  # 0. Validaciones.
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

  if (-not (Test-Path $migraciones -PathType Container)) {
    throw "No se encontro la carpeta db/migrations."
  }

  if (-not $soloBaseDatos) {
    if (-not (Test-Path (Join-Path $raiz 'backend\package.json'))) {
      throw 'No existe backend\package.json'
    }

    if (-not (Test-Path (Join-Path $raiz 'frontend\package.json'))) {
      throw 'No existe frontend\package.json'
    }
  }

  Invoke-Docker -Argumentos @('info')

  # --------------------------------------------------------
  # 1. OCR.
  # --------------------------------------------------------

  if (-not $soloBaseDatos) {

    Write-Host "`n[1/7] Iniciando OCR..." -ForegroundColor Yellow

    # No utiliza --build: reutiliza la imagen existente.
    Start-ComposeService -Servicio 'ocr'

    $ocrIniciado = $false

    for ($i = 0; $i -lt 30; $i++) {

      $idOCR = & docker compose -f $compose ps --status running -q ocr 2>$null

      if (
        $LASTEXITCODE -eq 0 -and
        -not [string]::IsNullOrWhiteSpace(($idOCR -join '').Trim())
      ) {
        $ocrIniciado = $true
        break
      }

      Start-Sleep -Seconds 2
    }

    if (-not $ocrIniciado) {
      & docker compose -f $compose ps -a
      throw 'El contenedor OCR no inicio. Revisa sus logs.'
    }

    if (-not (Test-MotorOCR)) {
      & docker compose -f $compose logs --tail 100 ocr
      throw 'El motor OCR no respondio correctamente.'
    }
  }

  # --------------------------------------------------------
  # 2. PostgreSQL.
  # --------------------------------------------------------

  Write-Host "`n[2/7] Iniciando PostgreSQL..." -ForegroundColor Yellow

  Start-ComposeService -Servicio 'db'

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

  Write-Host 'PostgreSQL saludable.' -ForegroundColor Green

  # --------------------------------------------------------
  # 3. Verificar existencia de la base.
  # --------------------------------------------------------

  Write-Host "`n[3/7] Verificando base de datos..." -ForegroundColor Yellow

  $consulta = "SELECT 1 FROM pg_database WHERE datname = '$baseDatos';"

  $existe = docker exec $contenedor psql `
    -U $usuario -d postgres -tAc $consulta

  if ($LASTEXITCODE -ne 0) {
    throw 'No se pudo comprobar la base de datos.'
  }

  $baseExiste = "$existe".Trim() -eq '1'

  if ($baseExiste -and -not $reiniciarBaseDatos) {
    Write-Host "La base $baseDatos ya existe. Se verificara el esquema sin borrar datos." -ForegroundColor Green
  }

  # --------------------------------------------------------
  # 4. Reconstruccion EXPLICITA de la base.
  # --------------------------------------------------------

  if ($reiniciarBaseDatos -or -not $baseExiste) {

    if ($reiniciarBaseDatos -and $baseExiste) {

      Write-Host "`n[4/7] Respaldando base de datos..." -ForegroundColor Yellow

      New-Item -ItemType Directory -Path $carpetaRespaldos -Force |
        Out-Null

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

      if (
        -not (Test-Path $respaldo) -or
        (Get-Item $respaldo).Length -eq 0
      ) {
        throw 'El respaldo no existe o esta vacio. No se eliminara la base.'
      }

      Write-Host "Respaldo guardado: $respaldo" -ForegroundColor Green
    }

    if ($reiniciarBaseDatos -and $baseExiste) {

      Write-Host 'Eliminando base anterior...' -ForegroundColor Yellow

      Invoke-Docker -Argumentos @(
        'exec', $contenedor,
        'psql', '-v', 'ON_ERROR_STOP=1',
        '-U', $usuario, '-d', 'postgres',
        '-c', "DROP DATABASE IF EXISTS $baseDatos WITH (FORCE);"
      )
    }

    Write-Host 'Creando base de datos...' -ForegroundColor Yellow

    Invoke-Docker -Argumentos @(
      'exec', $contenedor,
      'psql', '-v', 'ON_ERROR_STOP=1',
      '-U', $usuario, '-d', 'postgres',
      '-c', "CREATE DATABASE $baseDatos OWNER $usuario;"
    )
  }

  # PostgreSQL crea la base automaticamente por POSTGRES_DB, asi que "la base
  # existe" no significa que el esquema exista. Ademas, una base existente puede
  # no tener objetos de versiones anteriores. El esquema y el seed son
  # idempotentes, por lo que se aplican siempre antes de las migraciones.
  Write-Host 'Importando/verificando esquema base...' -ForegroundColor Yellow

  Invoke-Docker -Argumentos @(
    'cp', $schema, "${contenedor}:/tmp/01-schema.sql"
  )

  Invoke-Docker -Argumentos @(
    'exec', $contenedor,
    'psql', '-v', 'ON_ERROR_STOP=1',
    '-U', $usuario, '-d', $baseDatos,
    '-f', '/tmp/01-schema.sql'
  )

  Write-Host 'Importando/verificando usuarios base...' -ForegroundColor Yellow

  Invoke-Docker -Argumentos @(
    'cp', $userbase, "${contenedor}:/tmp/02-userbase.sql"
  )

  Invoke-Docker -Argumentos @(
    'exec', $contenedor,
    'psql', '-v', 'ON_ERROR_STOP=1',
    '-U', $usuario, '-d', $baseDatos,
    '-f', '/tmp/02-userbase.sql'
  )

  Write-Host 'Esquema base verificado.' -ForegroundColor Green

  # --------------------------------------------------------
  # 5. Aplicar migraciones pendientes.
  # --------------------------------------------------------

  Write-Host "`n[5/7] Aplicando migraciones..." -ForegroundColor Yellow

  Invoke-Migrations

  # --------------------------------------------------------
  # 6. Verificar PostgreSQL.
  # --------------------------------------------------------

  Write-Host "`n[6/7] Verificando conexion..." -ForegroundColor Yellow

  Invoke-Docker -Argumentos @(
    'exec', $contenedor,
    'psql', '-v', 'ON_ERROR_STOP=1',
    '-U', $usuario, '-d', $baseDatos,
    '-c', 'SELECT 1;'
  )

  if ($soloBaseDatos) {

    Write-Host "`n===== BASE DE DATOS LISTA =====" -ForegroundColor Green
    Write-Host "Base: $baseDatos"
    Write-Host 'Migraciones verificadas y aplicadas.'
    Write-Host 'No se iniciaron OCR, backend ni frontend.'

    exit 0
  }

  # --------------------------------------------------------
  # 7. Dependencias e inicio de aplicaciones.
  # --------------------------------------------------------

  Write-Host "`n[7/7] Preparando aplicaciones..." -ForegroundColor Yellow

  $backend = Join-Path $raiz 'backend'
  $frontend = Join-Path $raiz 'frontend'

  Install-Dependencies -Carpeta $backend -Nombre 'Backend'
  Install-Dependencies -Carpeta $frontend -Nombre 'Frontend'

  Write-Host "`nIniciando backend..." -ForegroundColor Yellow

  Start-Process powershell.exe -ArgumentList @(
    '-NoExit', '-Command',
    "Set-Location '$backend'; npm run start:dev"
  )

  Write-Host 'Iniciando frontend...' -ForegroundColor Yellow

  Start-Process powershell.exe -ArgumentList @(
    '-NoExit', '-Command',
    "Set-Location '$frontend'; npm run dev -- -p 3001"
  )

  # --------------------------------------------------------
  # Final.
  # --------------------------------------------------------

  Write-Host "`n===== CHECKU LISTO =====" -ForegroundColor Green
  Write-Host 'Backend:   http://localhost:3000/api/health'
  Write-Host 'Frontend:  http://localhost:3001'
  Write-Host 'OCR:       http://localhost:5001'
  Write-Host 'Salud OCR: http://localhost:5001/salud'
  Write-Host "Database:  $baseDatos"
  Write-Host 'Datos PostgreSQL conservados.'
  Write-Host 'Migraciones verificadas.'
  Write-Host 'Dependencias existentes reutilizadas.'

}
catch {
  Write-Host "`nERROR: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host 'El proceso se detuvo.' -ForegroundColor Yellow
  exit 1
}
