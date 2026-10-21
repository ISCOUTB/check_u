"""Uso desde la raíz del repo (sin levantar Nest/Next):

  set ALMA_API_KEY=tu_clave
  set ALMA_BASE_URL=https://api-xx.hosted.exlibrisgroup.com
  python -m modules.validadores.fuentes.alma T00000001
  python -m modules.validadores.fuentes.alma T00000001 --json
"""

from __future__ import annotations

import argparse
import json
import sys

from .config import AlmaConfigError
from .consultar import consultar_paz_y_salvo


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Consulta el estado de paz y salvo de un usuario en ALMA (Tarea 21)."
    )
    parser.add_argument("user_id", help="Identificador del usuario en ALMA (ej. T00000001)")
    parser.add_argument(
        "--json",
        action="store_true",
        help="Imprime el resultado completo en JSON",
    )
    args = parser.parse_args(argv)

    try:
        resultado = consultar_paz_y_salvo(args.user_id)
    except AlmaConfigError as error:
        print(f"Configuración: {error}", file=sys.stderr)
        return 2
    except Exception as error:
        print(f"Error: {type(error).__name__}: {error}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(resultado, ensure_ascii=False, indent=2))
        return 0

    print(f"Usuario:     {resultado['user_id']}")
    print(f"Estado:      {resultado['estado']}")
    print(f"Paz y salvo: {resultado['paz_y_salvo']}")
    print(f"Consultado:  {resultado['consultado_en']}")
    print(f"Mensaje:     {resultado['mensaje']}")
    print("Criterios:")
    for nombre, crit in resultado["criterios"].items():
        print(f"  - {nombre}: {crit['resultado']} — {crit['mensaje']}")
    if resultado["acciones_requeridas"]:
        print("Acciones:")
        for accion in resultado["acciones_requeridas"]:
            print(f"  - {accion}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())