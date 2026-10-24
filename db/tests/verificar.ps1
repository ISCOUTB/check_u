param(
    [string]$Servidor = 'localhost',
    [int]$Puerto = 5432,
    [string]$Usuario = 'postgres',
    [string]$BaseDatos = 'checku'
)
$ErrorActionPreference = 'Stop'
Get-Command psql -ErrorAction Stop | Out-Null
$Esquema = Join-Path $PSScriptRoot '../init/01-schema.sql'
$Datos = Join-Path $PSScriptRoot '../init/02-userbase.sql'
$Pruebas = Join-Path $PSScriptRoot 'aceptacion.sql'
for ($Pasada = 1; $Pasada -le 2; $Pasada++) {
    Write-Host "Pasada $Pasada de 2"
    & psql -h $Servidor -p $Puerto -U $Usuario -d $BaseDatos -X -v ON_ERROR_STOP=1 `
        -f $Esquema -f $Datos -f $Pruebas
    if ($LASTEXITCODE -ne 0) {
        throw "La verificacion fallo en la pasada $Pasada (codigo $LASTEXITCODE)."
    }
}
Write-Host 'Correcto: dos ejecuciones y pruebas de aceptacion completadas.'
