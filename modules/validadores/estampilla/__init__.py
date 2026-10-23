"""Validador de Estampilla Pro-Cultura (Tarea 08d): extracción, consulta a la Gobernación y reglas.

validar_estampilla recibe el certificado de pago (PDF) tal como lo subió el estudiante y devuelve un
DocumentValidationResult (contratos/esquemas/document-validation-result.schema.json). Lo confirma en la
Gobernación de Bolívar con el adaptador de la Tarea 22 (modules/estampilla_pro), al que solo se le
envía el número de recibo. Un PDF dañado no es un error: queda por revisar. Un error del programa sí
sube como excepción, para que la cola lo reintente (Tarea 06).
"""

import re
from collections.abc import Callable
from datetime import datetime

from modules.estampilla_pro import consultar_comprobante

from ..resultado import ahora_bogota, armar_resultado
from .extraccion import extraer
from .reglas import VERSION, accion_por_revisar, evaluar

TIPO_DOCUMENTO = "estampilla_pro_cultura"
IDENTIFICADOR = re.compile(r"\S(?:.*\S)?")


def consultar_gobernacion(numero: str, document_version: int) -> dict:
    """La consulta real. El texto viene de un PDF digital, así que no hay confianza de OCR que pasar."""
    return consultar_comprobante(numero, None, document_version=document_version)


def validar_estampilla(
    contenido: bytes,
    *,
    id_student: str,
    document_version: int,
    ahora: datetime | None = None,
    consultar_registro: Callable[[str, int], dict] | None = consultar_gobernacion,
) -> dict:
    """`consultar_registro=None` no consulta a la Gobernación: official_record queda source_pending."""
    if not IDENTIFICADOR.fullmatch(id_student or ""):
        raise ValueError("id_student no puede estar en blanco ni tener espacios al inicio o al final")
    if document_version < 1:
        raise ValueError("document_version empieza en 1")

    ahora = ahora or ahora_bogota()
    extraccion = extraer(contenido)
    recibo = extraccion.datos["receipt_number"]["value"]
    registro = None
    if consultar_registro is not None and extraccion.es_certificado and recibo:
        registro = consultar_registro(recibo, document_version)

    reglas = evaluar(extraccion, registro, ahora=ahora)
    return armar_resultado(
        id_student=id_student,
        type_document=TIPO_DOCUMENTO,
        document_version=document_version,
        extracted_data=extraccion.datos,
        reglas=reglas,
        errores=extraccion.errores,
        validation_version=VERSION,
        ahora=ahora,
        accion_por_revisar=accion_por_revisar(reglas),
    )
