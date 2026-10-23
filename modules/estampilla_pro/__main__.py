"""Punto de entrada de consola y tubería (CLI / stdin / stdout).

Permite invocar el módulo tanto desde la consola como desde un orquestador:

1. Por entrada/salida estándar (tubería):
   echo '{"numero_factura": "123456", "confianza_ocr": 0.95}' | python -m modules.estampilla_pro
   Devuelve el JSON del contrato en stdout.

2. Por argumentos de línea de comandos:
   python -m modules.estampilla_pro 123456
   python -m modules.estampilla_pro 123456 --confianza 0.95 --json
"""

from __future__ import annotations

import argparse
import io
import json
import sys
from typing import Any

from .config import EstampillaConfigError
from .consultar import consultar_comprobante


def _procesar_entrada_stdin() -> dict[str, Any] | None:
    """Intenta leer la carga útil desde la entrada estándar si no es un terminal interactivo."""
    try:
        if sys.stdin and not sys.stdin.isatty():
            contenido = sys.stdin.read().strip()
            if contenido:
                try:
                    datos = json.loads(contenido)
                    if isinstance(datos, dict):
                        return datos
                    return {"numero_factura": str(datos)}
                except Exception as err:
                    print(
                        json.dumps(
                            {
                                "type_document": "estampilla_pro_cultura",
                                "resultado": "no_evaluable",
                                "motivo": "invalid_input",
                                "mensaje": f"JSON de entrada estándar no válido: {err}",
                            },
                            ensure_ascii=False,
                        ),
                        file=sys.stdout,
                    )
                    return None
    except (OSError, io.UnsupportedOperation):
        return None
    return None


def main(argv: list[str] | None = None) -> int:
    # 1. Determinar si se pasaron argumentos de línea de comandos
    argumentos = argv if argv is not None else sys.argv[1:]

    # Si hay argumentos, procesarlos directamente sin esperar stdin
    if argumentos:
        return _procesar_args(argumentos)

    # 2. Si no hay argumentos, revisar si hay entrada por tubería (stdin)
    datos_stdin = _procesar_entrada_stdin()
    if datos_stdin is not None:
        num = datos_stdin.get("numero_factura") or datos_stdin.get("referencia")
        conf = datos_stdin.get("confianza_ocr")
        ver = datos_stdin.get("document_version")
        resultado = consultar_comprobante(num, confianza_ocr=conf, document_version=ver)
        print(json.dumps(resultado, ensure_ascii=False, indent=2))
        return 0

    # 3. Si no hay ni argumentos ni entrada por stdin, mostrar ayuda
    return _procesar_args([])


def _procesar_args(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Consulta y verificación de comprobantes de estampilla Pro-Cultura (Tarea 22)."
    )
    parser.add_argument(
        "numero_factura",
        nargs="?",
        help="Número oficial de liquidación/factura (ej. 123456)",
    )
    parser.add_argument(
        "--confianza",
        type=float,
        default=None,
        help="Nivel de confianza del OCR (0.0 a 1.0)",
    )
    parser.add_argument(
        "--version",
        default=None,
        help="Versión del documento para caché",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        default=True,
        help="Imprime el resultado completo en JSON (por defecto True)",
    )
    parser.add_argument(
        "--texto",
        action="store_true",
        help="Muestra resumen en texto legible para humanos",
    )

    args = parser.parse_args(argv)

    if not args.numero_factura:
        parser.print_help(sys.stderr)
        return 1

    try:
        resultado = consultar_comprobante(
            args.numero_factura,
            confianza_ocr=args.confianza,
            document_version=args.version,
        )
    except EstampillaConfigError as error_cfg:
        print(f"Error de configuración: {error_cfg}", file=sys.stderr)
        return 2
    except Exception as error_gen:
        print(f"Error inesperado: {error_gen}", file=sys.stderr)
        return 1

    if args.texto:
        print(f"Referencia:       {resultado.get('referencia')}")
        print(f"Estado consulta:  {resultado.get('estado_consulta')}")
        print(f"Resultado:        {resultado.get('resultado')}")
        print(f"Pagado:           {resultado.get('pagado')}")
        print(f"Tiene Pro-Cultura:{resultado.get('etiqueta_exists')}")
        print(f"Valor:            {resultado.get('valor_pro_cultura')}")
        print(f"Fecha de pago:    {resultado.get('fecha_pago')}")
        print(f"Mensaje:          {resultado.get('mensaje')}")
        return 0

    print(json.dumps(resultado, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
