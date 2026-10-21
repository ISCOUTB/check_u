"""Reglas del Paz y Salvo de Biblioteca: cada una independiente, con cumple / no_cumple / no_evaluable.

Las cuatro son obligatorias. Pueden fallar varias a la vez (por ejemplo, firma modificada y "no se
encuentra paz y salvo"); el contrato las guarda todas. Aquí nunca se declara inconsistent: la
correspondencia con el estudiante es de la Tarea 09.
"""

from datetime import datetime

from ..resultado import evaluacion
from .extraccion import ExtraccionPazYSalvo
from .firma import FirmaBiblioteca

# Si cambia una regla obligatoria, sube el número mayor; si se agrega una regla, el menor; si solo
# cambia un mensaje, el parche.
VERSION = "paz_y_salvo_bib@1.0.0"

OBLIGATORIOS = {"full_name": "nombre del estudiante", "code_student": "código del estudiante"}

NO_ES_PAZ_Y_SALVO = (
    "El archivo no es un Paz y Salvo de la Biblioteca. Sube el Paz y Salvo que te entregó la Biblioteca."
)
NO_ESTA_A_PAZ_Y_SALVO = (
    "La Biblioteca indica que no estás a paz y salvo. Resuelve tus pendientes y sube un nuevo Paz y Salvo."
)
MODIFICADO = (
    "El Paz y Salvo fue modificado después de que la Biblioteca lo firmó. "
    "Sube el original que te entregó la Biblioteca."
)
SIN_FIRMA = "El Paz y Salvo no tiene firma digital; un funcionario lo revisará."
NO_VERIFICABLE = (
    "La firma del Paz y Salvo no se puede verificar: el archivo fue guardado de nuevo después de "
    "recibirlo. Un funcionario lo revisará."
)


def _regla(nombre: str, resultado: str, mensaje: str, ahora: datetime, motivo: str | None = None, errores=None):
    return evaluacion(nombre, resultado, mandatory=True, message=mensaje, motivo=motivo, errors=errores, ahora=ahora)


def _regla_documento(extraccion: ExtraccionPazYSalvo, ahora: datetime) -> dict:
    nombre = "paz_y_salvo_document"
    if extraccion.es_paz_y_salvo:
        return _regla(nombre, "cumple", "El archivo es un Paz y Salvo de la Biblioteca.", ahora)
    if extraccion.es_paz_y_salvo is False:
        return _regla(nombre, "no_cumple", NO_ES_PAZ_Y_SALVO, ahora)
    return _regla(
        nombre,
        "no_evaluable",
        "No se pudo leer el texto del PDF; un funcionario lo revisará.",
        ahora,
        "low_confidence",
        extraccion.errores,
    )


def _regla_datos(extraccion: ExtraccionPazYSalvo, ahora: datetime) -> dict:
    nombre = "required_fields_present"
    faltan = [campo for campo in OBLIGATORIOS if extraccion.datos[campo]["value"] is None]
    if not faltan:
        return _regla(nombre, "cumple", "El Paz y Salvo trae el nombre y el código del estudiante.", ahora)
    mensaje = "No se encontraron en el Paz y Salvo: " + ", ".join(OBLIGATORIOS[c] for c in faltan) + "."
    return _regla(nombre, "no_evaluable", mensaje, ahora, "low_confidence", faltan)


def _regla_estado(extraccion: ExtraccionPazYSalvo, ahora: datetime) -> dict:
    nombre = "clearance_status"
    if extraccion.estado == "paz_y_salvo":
        return _regla(nombre, "cumple", "La Biblioteca indica que estás a paz y salvo.", ahora)
    if extraccion.estado == "no_paz_y_salvo":
        return _regla(nombre, "no_cumple", NO_ESTA_A_PAZ_Y_SALVO, ahora)
    return _regla(
        nombre,
        "no_evaluable",
        "No se encontró si estás a paz y salvo; un funcionario lo revisará.",
        ahora,
        "low_confidence",
    )


def _regla_firma(firma: FirmaBiblioteca, ahora: datetime) -> dict:
    nombre = "library_signature_intact"
    if firma.presencia == "ausente":
        return _regla(nombre, "no_evaluable", SIN_FIRMA, ahora, "low_confidence")
    if firma.presencia == "no_verificable" or firma.intacta is None:
        return _regla(nombre, "no_evaluable", NO_VERIFICABLE, ahora, "low_confidence")
    if not firma.intacta:
        return _regla(nombre, "no_cumple", MODIFICADO, ahora)
    if not firma.firmante_es_biblioteca:
        mensaje = f"El Paz y Salvo no está firmado por la Biblioteca (firmante: {firma.firmante or 'desconocido'})."
        return _regla(nombre, "no_cumple", mensaje, ahora)
    return _regla(
        nombre,
        "cumple",
        f"El Paz y Salvo tiene la firma de la Biblioteca ({firma.firmante}) y no fue modificado después.",
        ahora,
    )


def _dependiente(nombre: str, ahora: datetime) -> dict:
    return _regla(
        nombre,
        "no_evaluable",
        "No se evalúa porque el archivo no se pudo identificar como un Paz y Salvo de la Biblioteca.",
        ahora,
        "missing_dependency",
    )


def evaluar(extraccion: ExtraccionPazYSalvo, firma: FirmaBiblioteca, *, ahora: datetime) -> list[dict]:
    """Las 4 reglas en orden. Si no es (o no se sabe si es) un Paz y Salvo, las demás no se evalúan."""
    documento = _regla_documento(extraccion, ahora)
    if documento["result"] != "cumple":
        return [
            documento,
            _dependiente("required_fields_present", ahora),
            _dependiente("clearance_status", ahora),
            _dependiente("library_signature_intact", ahora),
        ]
    return [documento, _regla_datos(extraccion, ahora), _regla_estado(extraccion, ahora), _regla_firma(firma, ahora)]
