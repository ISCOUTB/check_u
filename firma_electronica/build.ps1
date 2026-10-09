param(
    [switch]$Console   # con -Console deja la consola visible para depurar
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# Limpieza de compilaciones anteriores
Remove-Item -Recurse -Force build, dist -ErrorAction SilentlyContinue
Remove-Item *.spec -ErrorAction SilentlyContinue

$args = @(
    "--noconfirm", "--clean",
    "--name", "FirmaElectronicaBiblioteca",
    "--add-data", "assets;assets",
    "--collect-all", "pyhanko",
    "--collect-all", "pyhanko_certvalidator",
    "--collect-all", "asn1crypto",
    "--collect-all", "oscrypto",
    "--exclude-module", "pandas",
    "--exclude-module", "pyarrow",
    "--exclude-module", "numpy"
)

if (-not $Console) { $args += "--windowed" }

python -m PyInstaller @args main.py