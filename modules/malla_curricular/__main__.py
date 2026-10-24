"""Punto de entrada de línea de comandos para el análisis de malla curricular.

Devuelve exclusivamente un objeto JSON válido por stdout, sin texto adicional,
explicaciones ni bloques de código Markdown.

Uso:
    python -m modules.malla_curricular ruta/a/evaluacion.pdf
    type evaluacion.pdf | python -m modules.malla_curricular
"""

from __future__ import annotations

import sys
from pathlib import Path

from .analizador import AnalizadorMallaCurricular


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    analizador = AnalizadorMallaCurricular()

    # Si se pasa un argumento con la ruta del archivo
    if len(sys.argv) > 1 and sys.argv[1] not in ("-", "--stdin"):
        ruta = Path(sys.argv[1])
        resultado = analizador.analizar(ruta)
    else:
        # Leer desde stdin (bytes de PDF)
        if sys.stdin.isatty():
            # No se pasó archivo ni se está enviando por tubería
            sys.stderr.write("Uso: python -m modules.malla_curricular <ruta_archivo.pdf>\n")
            return 1
        contenido = sys.stdin.buffer.read()
        resultado = analizador.analizar(contenido)

    # Imprimir exclusivamente JSON válido a stdout
    print(resultado.to_json(indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
