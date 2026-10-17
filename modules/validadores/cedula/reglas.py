"""Reglas de la cédula: cada una independiente, con cumple / no_cumple / no_evaluable.

Las tres primeras son obligatorias. La calidad de imagen y el RUI son informativas: los umbrales de
calidad aún no se calibran y el RUI no es una fuente formal (spec 08a, decisiones 3 y 4). Aquí
nunca se declara inconsistent: la discrepancia entre fuentes es de la Tarea 09.
"""

from datetime import datetime

from modules.cedula.similitud import UMBRAL_SIMILITUD, comparar_nombres

from ..fuentes.rui import RespuestaRui
from ..resultado import evaluacion
from .calidad import ANCHO_MINIMO, NITIDEZ_MINIMA, Calidad, es_suficiente
from .extraccion import ExtraccionCedula

# Si cambia una regla obligatoria o un umbral obligatorio, sube el número mayor; si se agrega una
# regla, el menor; si solo cambia un mensaje, el parche.
VERSION = "cedula@1.0.0"
UMBRAL_CONFIANZA = 0.8

NOMBRES_FORMATO = {
    "digital": "Cédula digital",
    "amarilla_hologramas": "Cédula amarilla con hologramas",
    "extranjeria": "Cédula de extranjería",
}
OBLIGATORIOS = {
    "full_name": "nombre",
    "identification_type": "tipo de documento",
    "identification_number": "número de identificación",
}

NO_ES_CEDULA = "El archivo no es una cédula. Sube una foto o un PDF de tu cédula por ambas caras."
CODIGO_ILEGIBLE = "No se pudo leer el código de la cédula (MRZ o PDF417); un funcionario la revisará."


def _regla_documento(extraccion: ExtraccionCedula, ahora: datetime) -> dict:
    nombre = "identification_document"
    if extraccion.es_cedula:
        return evaluacion(
            nombre,
            "cumple",
            mandatory=True,
            message=f"Se leyó la cédula: {NOMBRES_FORMATO[extraccion.formato]}.",
            ahora=ahora,
        )
    if extraccion.es_cedula is False:
        return evaluacion(nombre, "no_cumple", mandatory=True, message=NO_ES_CEDULA, ahora=ahora)
    return evaluacion(
        nombre,
        "no_evaluable",
        mandatory=True,
        message="No se pudo leer el archivo; un funcionario lo revisará.",
        motivo="low_confidence",
        errors=extraccion.errores,
        ahora=ahora,
    )


def _dependiente(nombre: str, obligatoria: bool, ahora: datetime) -> dict:
    return evaluacion(
        nombre,
        "no_evaluable",
        mandatory=obligatoria,
        message="No se evalúa porque el archivo no se pudo identificar como una cédula.",
        motivo="missing_dependency",
        ahora=ahora,
    )


def _confiable(extraccion: ExtraccionCedula, campo: str) -> bool:
    confianza = extraccion.datos[campo]["confidence"]
    return confianza is not None and confianza >= UMBRAL_CONFIANZA


def _regla_datos(extraccion: ExtraccionCedula, ahora: datetime) -> dict:
    nombre = "required_fields_present"
    faltan = [campo for campo in OBLIGATORIOS if not _confiable(extraccion, campo)]
    if not faltan:
        return evaluacion(
            nombre,
            "cumple",
            mandatory=True,
            message="Se leyeron el nombre, el tipo y el número de documento.",
            ahora=ahora,
        )
    return evaluacion(
        nombre,
        "no_evaluable",
        mandatory=True,
        message=(
            "No se pudieron leer con suficiente confianza: "
            + ", ".join(OBLIGATORIOS[campo] for campo in faltan)
            + f" (mínimo {UMBRAL_CONFIANZA:.0%})."
        ),
        motivo="low_confidence",
        errors=faltan,
        ahora=ahora,
    )


def _regla_codigo(extraccion: ExtraccionCedula, ahora: datetime) -> dict:
    nombre = "machine_readable_code"
    if not extraccion.codigo_leido:
        return evaluacion(
            nombre, "no_evaluable", mandatory=True, message=CODIGO_ILEGIBLE, motivo="low_confidence", ahora=ahora
        )
    codigo = "PDF417" if extraccion.formato == "amarilla_hologramas" else "MRZ con dígitos de control válidos"
    return evaluacion(nombre, "cumple", mandatory=True, message=f"Se leyó el código de la cédula: {codigo}.", ahora=ahora)


def _regla_calidad(calidades: list[Calidad], ahora: datetime) -> dict:
    nombre = "image_quality"
    if not calidades:
        return evaluacion(
            nombre,
            "no_evaluable",
            mandatory=False,
            message="No hay páginas para medir la calidad.",
            motivo="missing_dependency",
            ahora=ahora,
        )
    bajas = [c for c in calidades if not es_suficiente(c)]
    if not bajas:
        return evaluacion(
            nombre,
            "cumple",
            mandatory=False,
            message="La resolución y la nitidez están sobre los mínimos provisionales.",
            ahora=ahora,
        )
    detalle = "; ".join(f"ancho {c.ancho} px, nitidez {c.nitidez:.1f}" for c in bajas)
    return evaluacion(
        nombre,
        "no_cumple",
        mandatory=False,
        message=(
            f"La imagen podría ser de baja calidad ({detalle}). Mínimos provisionales: "
            f"ancho {ANCHO_MINIMO} px, nitidez {NITIDEZ_MINIMA:.0f}."
        ),
        ahora=ahora,
    )


def _regla_rui(extraccion: ExtraccionCedula, rui: RespuestaRui | None, ahora: datetime, umbral: float) -> dict:
    nombre = "rui_name_match"

    def regla(resultado: str, mensaje: str, motivo: str | None = None) -> dict:
        return evaluacion(nombre, resultado, mandatory=False, message=mensaje, motivo=motivo, ahora=ahora)

    if rui is None:
        if extraccion.formato == "extranjeria":
            return regla(
                "no_evaluable",
                "Falta definir cómo consultar el RUI para la cédula de extranjería.",
                "source_pending",
            )
        return regla("no_evaluable", "No se consultó el RUI: faltan el nombre o el número.", "missing_dependency")
    if rui.estado != "encontrado":
        return regla("no_evaluable", rui.detalle or "El RUI no respondió.", "source_unavailable")

    comparacion = comparar_nombres(extraccion.datos["full_name"]["value"], rui.nombre, umbral)
    if comparacion.coincide is None:
        return regla("no_evaluable", "No hay un nombre leído para comparar con el RUI.", "missing_dependency")
    if comparacion.coincide:
        return regla("cumple", f"El nombre coincide con el del RUI ({comparacion.similitud:.0f} % de similitud).")
    return regla(
        "no_cumple",
        f"El nombre no coincide con el del RUI ({comparacion.similitud:.0f} % de similitud; mínimo {umbral:.0f} %).",
    )


def evaluar(
    extraccion: ExtraccionCedula,
    calidades: list[Calidad],
    rui: RespuestaRui | None,
    *,
    ahora: datetime,
    umbral_rui: float = UMBRAL_SIMILITUD,
) -> list[dict]:
    """Las 5 reglas en orden. Si no es (o no se sabe si es) una cédula, las demás no se evalúan."""
    documento = _regla_documento(extraccion, ahora)
    if documento["result"] != "cumple":
        return [
            documento,
            _dependiente("required_fields_present", True, ahora),
            _dependiente("machine_readable_code", True, ahora),
            _dependiente("image_quality", False, ahora),
            _dependiente("rui_name_match", False, ahora),
        ]
    return [
        documento,
        _regla_datos(extraccion, ahora),
        _regla_codigo(extraccion, ahora),
        _regla_calidad(calidades, ahora),
        _regla_rui(extraccion, rui, ahora, umbral_rui),
    ]
