r"""Prueba el validador de Estampilla Pro-Cultura con certificados de pago propios (PDF).

Uso, desde la raíz del repositorio:
    venv\Scripts\python.exe -m modules.validadores.estampilla <archivo.pdf | carpeta> [...] [--json] [--consultar]

Muestra la clasificación, los datos extraídos y cada regla; con --json, el resultado completo del
contrato. Sin --consultar NO consulta a la Gobernación de Bolívar (no envía el número de recibo a ningún
servicio externo) y la regla official_record queda pendiente.
"""

import sys

from ..consola import ejecutar, preparar_salida
from . import consultar_gobernacion, validar_estampilla


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    consultar = consultar_gobernacion if "--consultar" in argv else None
    return ejecutar(
        [a for a in argv if a != "--consultar"],
        lambda contenido: validar_estampilla(
            contenido, id_student="prueba-local", document_version=1, consultar_registro=consultar
        ),
        (".pdf",),
        __doc__,
    )


if __name__ == "__main__":
    preparar_salida()
    sys.exit(main())
