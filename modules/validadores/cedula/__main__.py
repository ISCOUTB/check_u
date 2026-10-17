r"""Prueba el validador de cédula con archivos propios (PDF o imagen).

Uso, desde la raíz del repositorio:
    venv\Scripts\python.exe -m modules.validadores.cedula <archivo | carpeta> [...] [--json] [--rui]

Muestra la clasificación, los datos extraídos y cada regla; con --json, el resultado completo del
contrato. Sin --rui NO consulta el RUI (no envía el número de documento a ningún servicio externo) y
la regla del RUI queda no evaluable.
"""

import sys

from ..consola import ejecutar, preparar_salida
from ..fuentes import rui as fuente_rui
from . import validar_cedula

EXTENSIONES = (".pdf", ".png", ".jpg", ".jpeg")


def _sin_consultar(_numero: str) -> fuente_rui.RespuestaRui:
    return fuente_rui.RespuestaRui("sin_respuesta", None, "No se consultó el RUI: usa --rui para consultarlo.")


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    consultar = fuente_rui.consultar_rui if "--rui" in argv else _sin_consultar
    return ejecutar(
        [a for a in argv if a != "--rui"],
        lambda contenido: validar_cedula(
            contenido, id_student="prueba-local", document_version=1, consultar=consultar
        ),
        EXTENSIONES,
        __doc__,
    )


if __name__ == "__main__":
    preparar_salida()
    sys.exit(main())
