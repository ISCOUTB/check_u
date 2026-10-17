"""Validador de cédula (Tarea 08a): adapta modules/cedula, modules/mrz y el RUI al contrato.

validar_cedula recibe la cédula tal como la subió el estudiante (PDF o imagen) y devuelve un
DocumentValidationResult (contratos/esquemas/document-validation-result.schema.json). Un archivo
dañado no es un error: queda por revisar. Un error del programa sí sube como excepción, para que la
cola lo reintente (Tarea 06).
"""

import re
from collections.abc import Callable
from datetime import datetime

from modules.cedula.lectura import leer_cedula

from ..fuentes.rui import RespuestaRui, consultar_rui
from ..resultado import ahora_bogota, armar_resultado
from .calidad import medir
from .extraccion import ExtraccionCedula, extraer
from .paginas import cargar_paginas
from .reglas import UMBRAL_CONFIANZA, VERSION, evaluar

TIPO_DOCUMENTO = "identification"
IDENTIFICADOR = re.compile(r"\S(?:.*\S)?")


def _se_puede_consultar_rui(extraccion: ExtraccionCedula) -> bool:
    """El RUI solo se consulta con una cédula de ciudadanía y nombre y número confiables."""
    if not extraccion.es_cedula or extraccion.formato == "extranjeria":
        return False
    return all(
        (extraccion.datos[campo]["confidence"] or 0) >= UMBRAL_CONFIANZA
        for campo in ("full_name", "identification_number")
    )


def validar_cedula(
    contenido: bytes,
    *,
    id_student: str,
    document_version: int,
    ahora: datetime | None = None,
    consultar: Callable[[str], RespuestaRui] = consultar_rui,
    leer=leer_cedula,
) -> dict:
    if not IDENTIFICADOR.fullmatch(id_student or ""):
        raise ValueError("id_student no puede estar en blanco ni tener espacios al inicio o al final")
    if document_version < 1:
        raise ValueError("document_version empieza en 1")

    ahora = ahora or ahora_bogota()
    paginas = cargar_paginas(contenido)
    extraccion = extraer(paginas, leer=leer)
    rui = None
    if _se_puede_consultar_rui(extraccion):
        rui = consultar(extraccion.datos["identification_number"]["value"])

    return armar_resultado(
        id_student=id_student,
        type_document=TIPO_DOCUMENTO,
        document_version=document_version,
        extracted_data=extraccion.datos,
        reglas=evaluar(extraccion, medir(paginas), rui, ahora=ahora),
        errores=extraccion.errores,
        validation_version=VERSION,
        ahora=ahora,
    )
