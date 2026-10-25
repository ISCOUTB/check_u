"""Validador de Estampilla Pro-Cultura (Tarea 08d): extracción, consulta a la Gobernación y reglas.

validar_estampilla recibe el certificado de pago (PDF) tal como lo subió el estudiante y devuelve un
DocumentValidationResult (contratos/esquemas/document-validation-result.schema.json). Lo confirma en la
Gobernación de Bolívar con el adaptador de la Tarea 22 (modules/estampilla_pro), al que solo se le
envía el número de recibo. Un PDF dañado no es un error: queda por revisar. Un error del programa sí
sube como excepción, para que la cola lo reintente (Tarea 06).

En pregrado con doble programa el estudiante sube una estampilla por programa: validar_estampillas
recibe las dos, marca cada resultado con su document_order (1 o 2) y revisa que no sean el mismo recibo.
"""

import re
from collections.abc import Callable, Sequence
from datetime import datetime

from modules.estampilla_pro import consultar_comprobante

from ..resultado import ahora_bogota, armar_resultado
from .extraccion import ExtraccionEstampilla, extraer
from .reglas import VERSION, accion_por_revisar, evaluar, regla_recibo_distinto

TIPO_DOCUMENTO = "estampilla_pro_cultura"
IDENTIFICADOR = re.compile(r"\S(?:.*\S)?")
ORDENES = (1, 2)

Consulta = Callable[[str, int], dict]


def consultar_gobernacion(numero: str, document_version: int) -> dict:
    """La consulta real. El texto viene de un PDF digital, así que no hay confianza de OCR que pasar."""
    return consultar_comprobante(numero, None, document_version=document_version)


def _revisar_entradas(id_student: str, document_version: int) -> None:
    if not IDENTIFICADOR.fullmatch(id_student or ""):
        raise ValueError("id_student no puede estar en blanco ni tener espacios al inicio o al final")
    if document_version < 1:
        raise ValueError("document_version empieza en 1")


def _evaluar(
    contenido: bytes, document_version: int, ahora: datetime, consultar_registro: Consulta | None
) -> tuple[ExtraccionEstampilla, list[dict]]:
    extraccion = extraer(contenido)
    recibo = extraccion.datos["receipt_number"]["value"]
    registro = None
    if consultar_registro is not None and extraccion.es_certificado and recibo:
        registro = consultar_registro(recibo, document_version)
    return extraccion, evaluar(extraccion, registro, ahora=ahora)


def _resultado(
    extraccion: ExtraccionEstampilla,
    reglas: list[dict],
    *,
    id_student: str,
    document_version: int,
    document_order: int,
    ahora: datetime,
) -> dict:
    resultado = armar_resultado(
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
    # document_order va junto a document_version: qué estampilla es (1 = primer programa, 2 = segundo).
    ordenado = {}
    for clave, valor in resultado.items():
        ordenado[clave] = valor
        if clave == "document_version":
            ordenado["document_order"] = document_order
    return ordenado


def validar_estampilla(
    contenido: bytes,
    *,
    id_student: str,
    document_version: int,
    ahora: datetime | None = None,
    consultar_registro: Consulta | None = consultar_gobernacion,
    document_order: int = 1,
) -> dict:
    """`consultar_registro=None` no consulta a la Gobernación: official_record queda source_pending."""
    _revisar_entradas(id_student, document_version)
    if document_order not in ORDENES:
        raise ValueError("document_order es 1 (primer programa) o 2 (segundo programa)")
    ahora = ahora or ahora_bogota()
    extraccion, reglas = _evaluar(contenido, document_version, ahora, consultar_registro)
    return _resultado(
        extraccion,
        reglas,
        id_student=id_student,
        document_version=document_version,
        document_order=document_order,
        ahora=ahora,
    )


def validar_estampillas(
    contenidos: Sequence[bytes],
    *,
    id_student: str,
    document_version: int,
    ahora: datetime | None = None,
    consultar_registro: Consulta | None = consultar_gobernacion,
) -> list[dict]:
    """Una o dos estampillas, en el orden de los programas. Con dos, el resultado de la segunda lleva
    además distinct_receipt: el mismo recibo para los dos programas queda por revisar."""
    if not 1 <= len(contenidos) <= len(ORDENES):
        raise ValueError("Se validan una estampilla, o dos en el doble programa de pregrado")
    _revisar_entradas(id_student, document_version)
    ahora = ahora or ahora_bogota()
    evaluados = [_evaluar(contenido, document_version, ahora, consultar_registro) for contenido in contenidos]
    if len(evaluados) == 2:
        (primera, _), (segunda, reglas_segunda) = evaluados
        reglas_segunda.append(regla_recibo_distinto(primera, segunda, ahora=ahora))
    return [
        _resultado(
            extraccion,
            reglas,
            id_student=id_student,
            document_version=document_version,
            document_order=orden,
            ahora=ahora,
        )
        for orden, (extraccion, reglas) in zip(ORDENES, evaluados)
    ]
