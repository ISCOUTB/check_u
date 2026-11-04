"""Reglas de Saber Pro: cada una independiente, con cumple / no_cumple / no_evaluable y su evidencia.

Tarea 51: ya no se exige ni evalúa la firma digital del ICFES. Los reportes oficiales
no la traen de forma usable; se mantienen tipo de documento, campos, registro EK y puntaje.
"""

from datetime import datetime

from ..resultado import evaluacion
from .extraccion import ExtraccionSaberPro

# Si cambia una regla obligatoria o el mínimo, sube el número mayor; si se agrega una regla, el
# menor; si solo cambia un mensaje, el parche.
VERSION = "saber_pro@1.1.0"
PUNTAJE_MINIMO = 100

OBLIGATORIOS = {
    "full_name": "nombre completo",
    "identification_type": "tipo de identificación",
    "identification_number": "número de identificación",
    "registration_number": "número de registro",
    "exam_date": "fecha de aplicación",
}

NO_ES_REPORTE = (
    "El archivo no es un reporte de resultados Saber Pro. "
    "Sube el PDF descargado de icfes.gov.co."
)


def _valor(extraccion: ExtraccionSaberPro, campo: str):
    return extraccion.datos[campo]["value"]


def _regla_reporte(extraccion: ExtraccionSaberPro, ahora: datetime) -> dict:
    nombre = "saber_pro_report"
    if extraccion.es_reporte:
        registro = _valor(extraccion, "registration_number")
        return evaluacion(
            nombre,
            "cumple",
            mandatory=True,
            message=(
                "El archivo es un reporte de resultados Saber Pro "
                f"(número de registro {registro})."
            ),
            ahora=ahora,
        )
    if extraccion.es_reporte is False:
        return evaluacion(
            nombre, "no_cumple", mandatory=True, message=NO_ES_REPORTE, ahora=ahora
        )
    mensaje = (
        "No se encontró el número de registro del reporte; un funcionario lo revisará."
        if extraccion.tiene_texto
        else "No se pudo leer el texto del PDF; un funcionario lo revisará."
    )
    return evaluacion(
        nombre,
        "no_evaluable",
        mandatory=True,
        message=mensaje,
        motivo="low_confidence",
        errors=extraccion.errores,
        ahora=ahora,
    )


def _dependiente(nombre: str, obligatoria: bool, ahora: datetime) -> dict:
    return evaluacion(
        nombre,
        "no_evaluable",
        mandatory=obligatoria,
        message="No se evalúa porque el archivo no se pudo identificar como un reporte Saber Pro.",
        motivo="missing_dependency",
        ahora=ahora,
    )


def _regla_datos(extraccion: ExtraccionSaberPro, ahora: datetime) -> dict:
    nombre = "required_fields_present"
    faltan = [campo for campo in OBLIGATORIOS if _valor(extraccion, campo) is None]
    if not faltan:
        return evaluacion(
            nombre,
            "cumple",
            mandatory=True,
            message="El reporte trae nombre, identificación, número de registro y fecha de aplicación.",
            ahora=ahora,
        )
    return evaluacion(
        nombre,
        "no_evaluable",
        mandatory=True,
        message="No se encontraron estos datos en el reporte: "
        + ", ".join(OBLIGATORIOS[c] for c in faltan)
        + ".",
        motivo="low_confidence",
        errors=faltan,
        ahora=ahora,
    )


def _regla_puntaje(
    extraccion: ExtraccionSaberPro, ahora: datetime, minimo: int
) -> dict:
    nombre = "global_score_minimum"
    puntaje = _valor(extraccion, "global_score")
    if puntaje is None:
        return evaluacion(
            nombre,
            "no_evaluable",
            mandatory=True,
            message="No se encontró el puntaje global en el reporte.",
            motivo="low_confidence",
            ahora=ahora,
        )
    if puntaje >= minimo:
        return evaluacion(
            nombre,
            "cumple",
            mandatory=True,
            message=(
                "Tu reporte Saber Pro cumple con el puntaje mínimo requerido "
                f"(puntaje global: {puntaje}; mínimo: {minimo})."
            ),
            ahora=ahora,
        )
    return evaluacion(
        nombre,
        "no_cumple",
        mandatory=True,
        message=(
            f"Tu puntaje global ({puntaje}) es menor a {minimo}. "
            "Si vuelves a presentar el examen, sube el nuevo reporte."
        ),
        ahora=ahora,
    )


def evaluar(
    extraccion: ExtraccionSaberPro,
    *,
    ahora: datetime,
    puntaje_minimo: int = PUNTAJE_MINIMO,
) -> list[dict]:
    """Las 3 reglas obligatorias. Si no es un Saber Pro, el resto no se evalúa."""
    reporte = _regla_reporte(extraccion, ahora)
    if reporte["result"] != "cumple":
        return [
            reporte,
            _dependiente("required_fields_present", True, ahora),
            _dependiente("global_score_minimum", True, ahora),
        ]
    return [
        reporte,
        _regla_datos(extraccion, ahora),
        _regla_puntaje(extraccion, ahora, puntaje_minimo),
    ]