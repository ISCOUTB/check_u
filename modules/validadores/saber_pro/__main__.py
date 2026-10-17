"""Prueba el validador de Saber Pro con PDF propios.

Uso, desde la raíz del repositorio:
    venv\\Scripts\\python.exe -m modules.validadores.saber_pro <archivo.pdf | carpeta> [...] [--json]

Muestra la clasificación, los datos extraídos y cada regla; con --json, el resultado completo del
contrato tal como lo recibiría el backend. Nada se guarda ni se envía.
"""

import json
import sys
from pathlib import Path

from . import validar_saber_pro

RESULTADO = {"cumple": "cumple", "no_cumple": "no cumple", "no_evaluable": "no evaluable"}
COLORES = {
    "valid": "92",
    "invalid": "91",
    "to_check": "93",
    "cumple": "92",
    "no_cumple": "91",
    "no_evaluable": "93",
}


def _pintar(texto: str, clave: str, color: bool) -> str:
    return f"\033[{COLORES[clave]}m{texto}\033[0m" if color else texto


def _archivos(argumentos: list[str]) -> list[Path]:
    rutas = []
    for argumento in argumentos:
        ruta = Path(argumento)
        rutas += sorted(ruta.glob("*.pdf")) if ruta.is_dir() else [ruta]
    return rutas


def _mostrar(ruta: Path, resultado: dict, color: bool) -> None:
    clase = resultado["document_classification"]
    print(f"\n=== {ruta.name}")
    print(f"Clasificación: {_pintar(clase, clase, color)}   Acción: {resultado['required_action']}")
    if resultado["resubmission_reason"]:
        print(f"Motivo para el estudiante: {resultado['resubmission_reason']}")
    if resultado["errors"]:
        print(f"Errores del documento: {', '.join(resultado['errors'])}")
    print("Datos extraídos:")
    for campo, dato in resultado["extracted_data"].items():
        print(f"  {campo:<22} {dato['value']!s:<40} confianza {dato['confidence']}")
    print("Reglas:")
    for regla in resultado["rules"]:
        tipo = "obligatoria" if regla["mandatory"] else "informativa"
        motivo = f" ({regla['no_evaluable_reason']})" if regla["no_evaluable_reason"] else ""
        estado = _pintar(RESULTADO[regla["result"]], regla["result"], color)
        print(f"  {regla['rule']:<26} {estado}{motivo}  [{tipo}]")
        print(f"      {regla['message']}")


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    como_json = "--json" in argv
    argumentos = [a for a in argv if a != "--json"]
    if not argumentos:
        print(__doc__)
        return 1

    color = sys.stdout.isatty() and not como_json
    for ruta in _archivos(argumentos):
        if not ruta.is_file():
            print(f"No existe el archivo: {ruta}")
            return 1
        resultado = validar_saber_pro(ruta.read_bytes(), id_student="prueba-local", document_version=1)
        if como_json:
            print(json.dumps(resultado, ensure_ascii=False, indent=2))
        else:
            _mostrar(ruta, resultado, color)
    return 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="replace")  # consolas de Windows sin UTF-8
    sys.exit(main())
