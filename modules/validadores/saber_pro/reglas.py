"""Reglas de Saber Pro: cada una independiente, con cumple / no_cumple / no_evaluable y su evidencia.

Las cuatro primeras son obligatorias y deciden la clasificación. icfes_certificate_valid es
informativa: el certificado con el que firma el ICFES venció el 02/12/2025 y una regla obligatoria
rechazaría todo reporte auténtico (spec, sección 6).
"""

from datetime import datetime

from ..resultado import BOGOTA, evaluacion
from .extraccion import ExtraccionSaberPro
from .firma import EstadoFirma

# Si cambia una regla obligatoria o el mínimo, sube el número mayor; si se agrega una regla, el
# menor; si solo cambia un mensaje, el parche.
VERSION = "saber_pro@1.0.0"
PUNTAJE_MINIMO = 100

OBLIGATORIOS = {
    "full_name": "nombre completo",
    "identification_type": "tipo de identificación",
    "identification_number": "número de identificación",
    "registration_number": "número de registro",
    "exam_date": "fecha de aplicación",
}

NO_ES_REPORTE = "El archivo no es un reporte de resultados Saber Pro. Sube el PDF descargado de icfes.gov.co."
MODIFICADO = (
    "El reporte fue modificado después de que el ICFES lo firmó. Sube el PDF original descargado de icfes.gov.co."
)
NO_VERIFICABLE = (
    "La firma del ICFES no se puede verificar: el archivo fue guardado de nuevo después de descargarlo."
)
SIN_FIRMA = "El PDF no tiene la firma digital del ICFES."


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
            message=f"El archivo es un reporte de resultados Saber Pro (número de registro {registro}).",
            ahora=ahora,
        )
    if extraccion.es_reporte is False:
        return evaluacion(nombre, "no_cumple", mandatory=True, message=NO_ES_REPORTE, ahora=ahora)
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
        message="No se encontraron estos datos en el reporte: " + ", ".join(OBLIGATORIOS[c] for c in faltan) + ".",
        motivo="low_confidence",
        errors=faltan,
        ahora=ahora,
    )


def _regla_puntaje(extraccion: ExtraccionSaberPro, ahora: datetime, minimo: int) -> dict:
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


def _regla_firma(firma: EstadoFirma, ahora: datetime) -> dict:
    nombre = "icfes_signature_intact"
    if firma.presencia != "presente" or firma.intacta is None:
        mensaje = NO_VERIFICABLE if firma.presencia == "no_verificable" else SIN_FIRMA
        return evaluacion(nombre, "no_evaluable", mandatory=True, message=mensaje, motivo="low_confidence", ahora=ahora)
    if not firma.intacta:
        return evaluacion(nombre, "no_cumple", mandatory=True, message=MODIFICADO, ahora=ahora)
    if not firma.firmante_es_icfes:
        return evaluacion(
            nombre,
            "no_cumple",
            mandatory=True,
            message=f"El reporte no está firmado por el ICFES (firmante: {firma.firmante or 'desconocido'}).",
            ahora=ahora,
        )
    return evaluacion(
        nombre,
        "cumple",
        mandatory=True,
        message="El reporte tiene la firma digital del ICFES y no fue modificado después de firmarse.",
        ahora=ahora,
    )


def _regla_certificado(firma: EstadoFirma, ahora: datetime) -> dict:
    nombre = "icfes_certificate_valid"

    def regla(resultado: str, mensaje: str, motivo: str | None = None) -> dict:
        return evaluacion(nombre, resultado, mandatory=False, message=mensaje, motivo=motivo, ahora=ahora)

    if firma.presencia != "presente":
        return regla("no_evaluable", "No se evalúa porque no hay una firma verificable.", "missing_dependency")
    if firma.certificado == "valido":
        return regla(
            "cumple",
            "El certificado del ICFES es de Camerfirma Colombia, estaba vigente al firmar y no está revocado.",
        )
    if firma.certificado == "vencido":
        cuando = f" (venció el {firma.vence.astimezone(BOGOTA):%d/%m/%Y})" if firma.vence else ""
        return regla("no_cumple", f"El certificado con el que firmó el ICFES estaba vencido al firmar{cuando}.")
    if firma.certificado == "revocado":
        return regla("no_cumple", "El certificado con el que firmó el ICFES está revocado.")
    if firma.certificado == "no_confiable":
        return regla(
            "no_cumple",
            "El certificado de la firma no pertenece a la cadena de Camerfirma Colombia, la autoridad del ICFES.",
        )
    if firma.certificado == "sin_respuesta":
        return regla(
            "no_evaluable",
            "No se pudo consultar si el certificado del ICFES está revocado.",
            "source_unavailable",
        )
    return regla("no_evaluable", "No se pudo establecer la validez del certificado de la firma.", "low_confidence")


def evaluar(
    extraccion: ExtraccionSaberPro,
    firma: EstadoFirma,
    *,
    ahora: datetime,
    puntaje_minimo: int = PUNTAJE_MINIMO,
) -> list[dict]:
    """Las 5 reglas en orden. Si no es (o no se sabe si es) un Saber Pro, las demás no se evalúan."""
    reporte = _regla_reporte(extraccion, ahora)
    if reporte["result"] != "cumple":
        return [
            reporte,
            _dependiente("required_fields_present", True, ahora),
            _dependiente("global_score_minimum", True, ahora),
            _dependiente("icfes_signature_intact", True, ahora),
            _dependiente("icfes_certificate_valid", False, ahora),
        ]
    return [
        reporte,
        _regla_datos(extraccion, ahora),
        _regla_puntaje(extraccion, ahora, puntaje_minimo),
        _regla_firma(firma, ahora),
        _regla_certificado(firma, ahora),
    ]
