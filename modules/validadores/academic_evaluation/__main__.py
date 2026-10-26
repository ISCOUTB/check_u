r"""Prueba el validador de Evaluación de Grado con PDF propios.

Uso, desde la raíz del repositorio:
    python -m modules.validadores.academic_evaluation <archivo.pdf | carpeta> [...] [--json]
"""

import sys

from ..consola import ejecutar, preparar_salida
from . import validar_academic_evaluation


def main(argv: list[str] | None = None) -> int:
    return ejecutar(
        sys.argv[1:] if argv is None else argv,
        lambda contenido: validar_academic_evaluation(
            contenido, id_student="prueba-local", document_version=1
        ),
        (".pdf",),
        __doc__,
    )


if __name__ == "__main__":
    preparar_salida()
    sys.exit(main())