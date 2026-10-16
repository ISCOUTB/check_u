# Check_U - Instalar (si hace falta) y abrir todo el programa
# ---------------------------------------------------------
# Uso: clic derecho sobre este archivo > "Ejecutar con PowerShell",
# o desde una terminal, parado en la carpeta del proyecto:
#
#     .\iniciar.ps1
#
# Levanta las tres partes de CheckU en esta misma ventana:
#   - backend (NestJS)      http://localhost:3000/api
#   - frontend (Next.js)    http://localhost:3001   <- se abre en el navegador
#   - panel Python (Flask)  http://localhost:5000   (lector de cedulas)
# Ctrl+C (o cerrar la ventana) apaga las tres.
#
# Se puede correr las veces que haga falta: la primera vez instala
# todo lo necesario; las siguientes veces esos pasos se saltan solos
# (ya estan hechos) y va directo a arrancar.

$ErrorActionPreference = "Stop"

# Correr siempre desde la carpeta donde esta este script, sin importar
# desde donde se haya lanzado (doble clic, otra terminal, etc.).
Set-Location $PSScriptRoot

Write-Host "== 1. Verificando Python ==" -ForegroundColor Cyan
$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) {
    Write-Host "No se encontro 'python' en el PATH." -ForegroundColor Red
    Write-Host "Instala Python 3.11+ desde https://www.python.org/downloads/ (marca la casilla 'Add python.exe to PATH' durante la instalacion) y vuelve a correr este script." -ForegroundColor Yellow
    exit 1
}
python --version

Write-Host "`n== 2. Verificando Node.js ==" -ForegroundColor Cyan
# El backend y el frontend necesitan Node 20.19 o mas nuevo (se recomienda
# Node 22 LTS). Se revisa antes de instalar nada de Python, para no esperar
# la instalacion completa y fallar al final.
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "No se encontro 'node' en el PATH." -ForegroundColor Red
    Write-Host "Instala Node.js 22 LTS desde https://nodejs.org/ y vuelve a correr este script." -ForegroundColor Yellow
    exit 1
}
$versionNode = [version]((node --version).TrimStart("v"))
if ($versionNode -lt [version]"20.19.0") {
    Write-Host "Tienes Node $versionNode; CheckU necesita 20.19 o mas nuevo." -ForegroundColor Red
    Write-Host "Instala Node.js 22 LTS desde https://nodejs.org/ y vuelve a correr este script." -ForegroundColor Yellow
    exit 1
}
Write-Host "Node $versionNode" -ForegroundColor Green

Write-Host "`n== 3. Puertos 3000, 3001 y 5000 ==" -ForegroundColor Cyan
# Si otro programa (o una copia anterior de CheckU) ya usa uno de los
# puertos, se avisa ahora, antes de instalar o arrancar nada a medias.
$ocupados = @(foreach ($puerto in 3000, 3001, 5000) {
    if (Get-NetTCPConnection -LocalPort $puerto -State Listen -ErrorAction SilentlyContinue) { $puerto }
})
if ($ocupados.Count -gt 0) {
    Write-Host "Ya hay algo usando el puerto $($ocupados -join ', ')." -ForegroundColor Red
    Write-Host "Cierra la otra copia de CheckU (Ctrl+C en su ventana) o el programa que lo use, y vuelve a correr '.\iniciar.ps1'." -ForegroundColor Yellow
    exit 1
}
Write-Host "Libres." -ForegroundColor Green

Write-Host "`n== 4. Entorno virtual (venv) ==" -ForegroundColor Cyan
if (-not (Test-Path ".\venv\Scripts\python.exe")) {
    python -m venv venv
    Write-Host "Creado." -ForegroundColor Green
} else {
    Write-Host "Ya existe, se reutiliza." -ForegroundColor Yellow
}
# Se usa el python/pip DE ADENTRO del venv por su ruta completa (nunca
# se "activa" el venv): asi no depende de Activate.ps1 ni de PATH, y se
# evita un bug ya visto donde reactivar el venv reseteaba el PATH y
# hacia que Tesseract "desapareciera" entre un script y el siguiente.
$pythonVenv = ".\venv\Scripts\python.exe"
$pipVenv = ".\venv\Scripts\pip.exe"

Write-Host "`n== 5. Dependencias de Python ==" -ForegroundColor Cyan
# pip no se puede actualizar a si mismo con pip.exe en Windows; se hace con python -m pip.
& $pythonVenv -m pip install --upgrade pip | Out-Null
# zxing-cpp lee el codigo de barras PDF417 del reverso de la cedula
# amarilla con hologramas; rapidfuzz compara nombres contra el RUI.
& $pipVenv install pdf2image pytesseract pillow opencv-python flask requests pymupdf zxing-cpp rapidfuzz

Write-Host "`n== 6. Tesseract OCR ==" -ForegroundColor Cyan
$tesseract = Get-Command tesseract -ErrorAction SilentlyContinue

if (-not $tesseract) {
    Write-Host "No esta en el PATH. Intentando instalarlo con winget (puede pedirte confirmar en una ventana aparte)..." -ForegroundColor Yellow
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if ($winget) {
        try {
            winget install -e --id UB-Mannheim.TesseractOCR --accept-source-agreements --accept-package-agreements
        } catch {
            Write-Host "winget no pudo instalarlo solo: $($_.Exception.Message)" -ForegroundColor Red
        }
        $tesseractPathComun = "C:\Program Files\Tesseract-OCR"
        if ((Test-Path "$tesseractPathComun\tesseract.exe") -and ($env:Path -notlike "*$tesseractPathComun*")) {
            $env:Path += ";$tesseractPathComun"
        }
        $tesseract = Get-Command tesseract -ErrorAction SilentlyContinue
        if ($tesseract) {
            Write-Host "Tesseract instalado: $($tesseract.Source)" -ForegroundColor Green
        } else {
            Write-Host "No se pudo confirmar la instalacion. Instalalo a mano desde https://github.com/UB-Mannheim/tesseract/wiki (marca 'Add to PATH' y el idioma 'Spanish')." -ForegroundColor Red
        }
    } else {
        Write-Host "No se encontro 'winget' en este equipo (viene con Windows 10/11 actualizado, o desde 'App Installer' en la Microsoft Store)." -ForegroundColor Red
        Write-Host "Instala Tesseract a mano desde https://github.com/UB-Mannheim/tesseract/wiki (marca 'Spanish' y 'Add to PATH')." -ForegroundColor Yellow
    }
} else {
    Write-Host "Encontrado: $($tesseract.Source)" -ForegroundColor Green
}

if ($tesseract) {
    $tesseractDir = Split-Path $tesseract.Source -Parent

    # El instalador silencioso de winget no siempre agrega la carpeta de
    # Tesseract al PATH permanente (el que queda guardado en el registro
    # de Windows) -- se agrega aca para que quede disponible tambien en
    # terminales nuevas, sin depender de repetir este script.
    try {
        $pathUsuario = [Environment]::GetEnvironmentVariable("Path", "User")
        if ($pathUsuario -notlike "*$tesseractDir*") {
            $nuevoPathUsuario = if ([string]::IsNullOrEmpty($pathUsuario)) { $tesseractDir } else { "$pathUsuario;$tesseractDir" }
            [Environment]::SetEnvironmentVariable("Path", $nuevoPathUsuario, "User")
            Write-Host "Carpeta de Tesseract agregada al PATH de Usuario (permanente)." -ForegroundColor Green
        }
    } catch {
        Write-Host "No se pudo guardar el PATH de forma permanente; no es grave, el panel lo detecta igual por su cuenta." -ForegroundColor Yellow
    }
    if ($env:Path -notlike "*$tesseractDir*") {
        $env:Path += ";$tesseractDir"
    }

    # winget instala Tesseract sin el selector de idiomas del instalador
    # interactivo, asi que casi siempre falta 'spa' (espanol).
    $tessdataDir = Join-Path $tesseractDir "tessdata"
    $spaFile = Join-Path $tessdataDir "spa.traineddata"
    if (Test-Path $spaFile) {
        Write-Host "Paquete de idioma espanol (spa) ya esta instalado." -ForegroundColor Green
    } elseif (Test-Path $tessdataDir) {
        Write-Host "Falta el idioma espanol (spa). Descargandolo..." -ForegroundColor Yellow
        try {
            Invoke-WebRequest -Uri "https://github.com/tesseract-ocr/tessdata/raw/main/spa.traineddata" -OutFile $spaFile
            Write-Host "Instalado en $spaFile" -ForegroundColor Green
        } catch {
            Write-Host "No se pudo descargar automaticamente: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "Descargalo a mano desde https://github.com/tesseract-ocr/tessdata y colocalo en $tessdataDir" -ForegroundColor Yellow
        }
    } else {
        Write-Host "No se encontro la carpeta tessdata en $tessdataDir; revisa tu instalacion de Tesseract." -ForegroundColor Yellow
    }
}

Write-Host "`n== 7. Lectura de PDF (PyMuPDF) ==" -ForegroundColor Cyan
Write-Host "Ya quedo instalado en el paso 5 (pip); no necesita nada mas en Windows (poppler es opcional, solo como respaldo)." -ForegroundColor Green

Write-Host "`n== 8. Verificacion del entorno de Python ==" -ForegroundColor Cyan
& $pythonVenv webapp\entorno.py
$entornoOk = ($LASTEXITCODE -eq 0)

if (-not $entornoOk) {
    Write-Host "`n== Falta corregir algo antes de abrir el panel ==" -ForegroundColor Yellow
    Write-Host "Revisa el reporte de arriba, corrigelo y vuelve a correr '.\iniciar.ps1'." -ForegroundColor Yellow
    Write-Host "Si acabas de instalar Tesseract y el problema persiste, prueba abriendo una terminal nueva (o reiniciando VS Code) y corriendo este script otra vez." -ForegroundColor Yellow
    exit 1
}

Write-Host "`n== 9. Dependencias del backend y el frontend ==" -ForegroundColor Cyan
# npm ci solo cuando hace falta: si no hay node_modules o si el
# package-lock.json cambio (por ejemplo, despues de un git pull) desde la
# ultima instalacion. npm deja su propia copia en node_modules\.package-lock.json.
foreach ($carpeta in "backend", "frontend") {
    $lock = Join-Path $carpeta "package-lock.json"
    $instalado = Join-Path $carpeta "node_modules\.package-lock.json"
    if ((Test-Path $instalado) -and ((Get-Item $instalado).LastWriteTime -ge (Get-Item $lock).LastWriteTime)) {
        Write-Host "${carpeta}: ya instalado, se reutiliza." -ForegroundColor Yellow
        continue
    }
    Write-Host "${carpeta}: instalando paquetes (npm ci)..." -ForegroundColor Yellow
    Push-Location $carpeta
    try {
        npm.cmd ci --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) {
            Write-Host "npm ci fallo en $carpeta. Revisa el error de arriba y vuelve a correr '.\iniciar.ps1'." -ForegroundColor Red
            exit 1
        }
    } finally {
        Pop-Location
    }
    Write-Host "${carpeta}: listo." -ForegroundColor Green
}

Write-Host "`n== 10. Configuracion del frontend ==" -ForegroundColor Cyan
# frontend/.env.local le dice al frontend donde esta el backend. No se sube
# a git; se crea a partir del ejemplo si no existe.
if (Test-Path "frontend\.env.local") {
    Write-Host "frontend\.env.local ya existe, se reutiliza." -ForegroundColor Yellow
} else {
    Copy-Item "frontend\.env.example" "frontend\.env.local"
    Write-Host "Creado frontend\.env.local a partir de frontend\.env.example." -ForegroundColor Green
}

Write-Host "`n== Todo listo: arrancando CheckU ==" -ForegroundColor Cyan
Write-Host "Aplicacion:   http://localhost:3001   (se abre sola en el navegador)" -ForegroundColor White
Write-Host "API:          http://localhost:3000/api" -ForegroundColor White
Write-Host "Panel Python: http://localhost:5000" -ForegroundColor White
Write-Host "(para cerrar todo: Ctrl+C en esta ventana, o cerrarla)" -ForegroundColor DarkGray

# El backend y el frontend corren en segundo plano en esta misma ventana. Se
# lanzan con node directamente (no con npm) para que Ctrl+C no pregunte
# "Desea terminar el trabajo por lotes (S/N)?".
$backend = Start-Process -FilePath "node" -ArgumentList "node_modules\@nestjs\cli\bin\nest.js", "start", "--watch" -WorkingDirectory "backend" -NoNewWindow -PassThru
$frontend = Start-Process -FilePath "node" -ArgumentList "node_modules\next\dist\bin\next", "dev", "-p", "3001" -WorkingDirectory "frontend" -NoNewWindow -PassThru

# El navegador se abre cuando el frontend ya responde, no tras una espera
# fija: la primera vez Next.js tarda en compilar. Va en un job aparte para
# no bloquear el panel, que corre en primer plano.
Start-Job -ScriptBlock {
    for ($intento = 0; $intento -lt 120; $intento++) {
        try {
            Invoke-WebRequest -Uri "http://localhost:3001" -UseBasicParsing -TimeoutSec 5 | Out-Null
            Start-Process "http://localhost:3001"
            return
        } catch {
            Start-Sleep -Seconds 1
        }
    }
} | Out-Null

try {
    & $pythonVenv webapp\app.py
} finally {
    # Al cerrar el panel (Ctrl+C o un error) se apagan tambien el backend y
    # el frontend, con sus procesos hijos, para no dejar puertos ocupados.
    foreach ($proceso in $backend, $frontend) {
        if ($proceso -and -not $proceso.HasExited) {
            cmd /c "taskkill /T /F /PID $($proceso.Id) >nul 2>&1"
        }
    }
    Write-Host "`nCheckU detenido." -ForegroundColor Cyan
}
