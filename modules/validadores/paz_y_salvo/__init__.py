"""Validador de Paz y Salvo de Biblioteca (Tarea 08c): extracción, firma de la Biblioteca y reglas.

validar_paz_y_salvo recibe el PDF tal como lo subió el estudiante y devuelve un
DocumentValidationResult (contratos/esquemas/document-validation-result.schema.json). Un PDF dañado
no es un error: queda por revisar. Un error del programa sí sube como excepción, para que la cola lo
reintente (Tarea 06).
"""

import re
from collections.abc import Callable
from datetime import datetime

from ..resultado import ahora_bogota, armar_resultado
from .extraccion import extraer
from .firma import FirmaBiblioteca, verificar
from .reglas import VERSION, evaluar

TIPO_DOCUMENTO = "paz_y_salvo_bib"
IDENTIFICADOR = re.compile(r"\S(?:.*\S)?")


def validar_paz_y_salvo(
    contenido: bytes,
    *,
    id_student: str,
    document_version: int,
    ahora: datetime | None = None,
    verificar_firma: Callable[[bytes], FirmaBiblioteca] = verificar,
) -> dict:
    if not IDENTIFICADOR.fullmatch(id_student or ""):
        raise ValueError("id_student no puede estar en blanco ni tener espacios al inicio o al final")
    if document_version < 1:
        raise ValueError("document_version empieza en 1")

    ahora = ahora or ahora_bogota()
    extraccion = extraer(contenido)
    return armar_resultado(
        id_student=id_student,
        type_document=TIPO_DOCUMENTO,
        document_version=document_version,
        extracted_data=extraccion.datos,
        reglas=evaluar(extraccion, verificar_firma(contenido), ahora=ahora),
        errores=extraccion.errores,
        validation_version=VERSION,
        ahora=ahora,
    )
