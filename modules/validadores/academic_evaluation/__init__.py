"""Validador de Evaluación de Grado Banner (Tarea 32 / academic_evaluation).

Usa modules/malla_curricular para extracción y traduce el resultado al
DocumentValidationResult del contrato.
"""

from __future__ import annotations

import re
from datetime import datetime

from ..resultado import ahora_bogota, armar_resultado
from .extraccion import extraer
from .reglas import VERSION, evaluar

TIPO_DOCUMENTO = "academic_evaluation"
IDENTIFICADOR = re.compile(r"\S(?:.*\S)?")


def validar_academic_evaluation(
    contenido: bytes,
    *,
    id_student: str,
    document_version: int,
    ahora: datetime | None = None,
) -> dict:
    if not IDENTIFICADOR.fullmatch(id_student or ""):
        raise ValueError(
            "id_student no puede estar en blanco ni tener espacios al inicio o al final"
        )
    if document_version < 1:
        raise ValueError("document_version empieza en 1")

    ahora = ahora or ahora_bogota()
    extraccion = extraer(contenido)
    reglas = evaluar(extraccion, ahora=ahora)
    return armar_resultado(
        id_student=id_student,
        type_document=TIPO_DOCUMENTO,
        document_version=document_version,
        extracted_data=extraccion.datos,
        reglas=reglas,
        errores=extraccion.errores,
        validation_version=VERSION,
        ahora=ahora,
    )