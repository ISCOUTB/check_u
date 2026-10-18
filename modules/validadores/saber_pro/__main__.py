r"""Prueba el validador de Saber Pro con PDF propios.

Uso, desde la raíz del repositorio:
    venv\Scripts\python.exe -m modules.validadores.saber_pro <archivo.pdf | carpeta> [...] [--json]

Muestra la clasificación, los datos extraídos y cada regla; con --json, el resultado completo del
contrato tal como lo recibiría el backend. Nada se guarda ni se envía.
"""

import sys

from ..consola import ejecutar, preparar_salida
from . import validar_saber_pro


def main(argv: list[str] | None = None) -> int:
    return ejecutar(
        sys.argv[1:] if argv is None else argv,
        lambda contenido: validar_saber_pro(contenido, id_student="prueba-local", document_version=1),
        (".pdf",),
        __doc__,
    )


if __name__ == "__main__":
    preparar_salida()
    sys.exit(main())
