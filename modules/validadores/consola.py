"""Comando de consola compartido para probar un validador con archivos propios.

Lo usan `python -m modules.validadores.saber_pro`, `…cedula` y `…estampilla`. Muestra la
clasificación, los datos extraídos y cada regla; con --json, el resultado completo del contrato.
Nada se guarda ni se envía (salvo lo que el validador consulte: el RUI con --rui, la Gobernación con
--consultar).
"""

import json
import sys
from collections.abc import Callable
from pathlib import Path

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


def _archivos(argumentos: list[str], extensiones: tuple[str, ...]) -> list[Path]:
    rutas = []
    for argumento in argumentos:
        ruta = Path(argumento)
        if ruta.is_dir():
            rutas += sorted(p for p in ruta.iterdir() if p.suffix.lower() in extensiones)
        else:
            rutas.append(ruta)
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


def ejecutar(
    argv: list[str],
    validar: Callable[[bytes], dict],
    extensiones: tuple[str, ...],
    uso: str,
) -> int:
    como_json = "--json" in argv
    argumentos = [a for a in argv if a != "--json"]
    if not argumentos:
        print(uso)
        return 1

    color = sys.stdout.isatty() and not como_json
    for ruta in _archivos(argumentos, extensiones):
        if not ruta.is_file():
            print(f"No existe el archivo: {ruta}")
            return 1
        resultado = validar(ruta.read_bytes())
        if como_json:
            print(json.dumps(resultado, ensure_ascii=False, indent=2))
        else:
            _mostrar(ruta, resultado, color)
    return 0


def preparar_salida() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="replace")  # consolas de Windows sin UTF-8
