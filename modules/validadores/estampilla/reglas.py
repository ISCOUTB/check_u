"""Reglas de la Estampilla Pro-Cultura: cada una independiente, con cumple / no_cumple / no_evaluable.

Las cinco son obligatorias y pueden fallar varias a la vez. El PDF no trae firma digital, así que lo
que prueba el pago es la consulta a la Gobernación de Bolívar (adaptador de la Tarea 22), y el cotejo
del PDF con ese registro detecta un número de recibo real puesto en un PDF editado. Aquí nunca se
declara inconsistent: la correspondencia con el estudiante es de la Tarea 09.
"""

import re
import unicodedata
from datetime import datetime

from modules.estampilla_pro import MENSAJE_NO_VALIDO

from ..resultado import evaluacion
from .extraccion import PAGADOS, ExtraccionEstampilla

# Si cambia una regla obligatoria, sube el número mayor; si se agrega una regla, el menor; si solo
# cambia un mensaje, el parche.
VERSION = "estampilla_pro_cultura@1.0.0"

ORDEN = [
    "payment_certificate_document",
    "required_fields_present",
    "pro_cultura_paid",
    "official_record",
    "official_record_matches",
]

OBLIGATORIOS = {
    "receipt_number": "número de recibo",
    "identification_number": "documento del contribuyente",
    "full_name": "nombre del contribuyente",
    "payment_date": "fecha de pago",
    "pro_cultura_amount": "valor de la Estampilla Pro-Cultura",
}

# Mensajes al estudiante (spec, sección 7).
NO_ES_CERTIFICADO = (
    "El archivo no es un certificado de pago de la Estampilla Pro-Cultura. "
    "Sube el certificado de pago que descargaste de la Gobernación de Bolívar."
)
SIN_PRO_CULTURA = (
    "El comprobante no incluye la Estampilla Pro-Cultura. Sube el comprobante de pago de la Estampilla Pro-Cultura."
)
NO_PAGADA = (
    "La Estampilla Pro-Cultura no figura pagada en el comprobante. "
    "Sube el comprobante cuando el pago esté confirmado."
)
VALOR_CERO = "La Estampilla Pro-Cultura figura en $0 en el comprobante. Sube el comprobante de pago correcto."
NO_ENCONTRADO = MENSAJE_NO_VALIDO  # el de la Tarea 22
REGISTRO_SIN_PRO_CULTURA = "En los registros oficiales, el comprobante no incluye la Estampilla Pro-Cultura."
REGISTRO_SIN_PAGAR = "En los registros oficiales, la Estampilla Pro-Cultura no figura pagada."
NO_DISPONIBLE = "No fue posible consultar el comprobante en la Gobernación de Bolívar; se volverá a intentar."
NO_CONSULTADO = "El comprobante todavía no se ha consultado en la Gobernación de Bolívar."
NO_COINCIDE = (
    "Los datos del comprobante no coinciden con los registros oficiales ({campos}); un funcionario lo revisará."
)

FUENTE_EXTERNA = {"source_unavailable", "source_pending"}


def _regla(nombre: str, resultado: str, mensaje: str, ahora: datetime, motivo: str | None = None, errores=None):
    return evaluacion(nombre, resultado, mandatory=True, message=mensaje, motivo=motivo, errors=errores, ahora=ahora)


def _valor(extraccion: ExtraccionEstampilla, campo: str):
    return extraccion.datos[campo]["value"]


def _sin_tildes(texto: str) -> str:
    descompuesto = unicodedata.normalize("NFKD", texto.upper())
    return "".join(c for c in descompuesto if not unicodedata.combining(c))


def _regla_documento(extraccion: ExtraccionEstampilla, ahora: datetime) -> dict:
    nombre = "payment_certificate_document"
    if extraccion.es_certificado:
        return _regla(nombre, "cumple", "El archivo es un certificado de pago de la Gobernación de Bolívar.", ahora)
    if extraccion.es_certificado is False:
        return _regla(nombre, "no_cumple", NO_ES_CERTIFICADO, ahora)
    return _regla(
        nombre,
        "no_evaluable",
        "No se pudo leer el texto del PDF; un funcionario lo revisará.",
        ahora,
        "low_confidence",
        extraccion.errores,
    )


def _regla_datos(extraccion: ExtraccionEstampilla, ahora: datetime) -> dict:
    nombre = "required_fields_present"
    faltan = [campo for campo in OBLIGATORIOS if _valor(extraccion, campo) is None]
    if not faltan:
        return _regla(
            nombre,
            "cumple",
            "El comprobante trae el recibo, el contribuyente, la fecha de pago y el valor de la Estampilla Pro-Cultura.",
            ahora,
        )
    mensaje = "No se encontraron en el comprobante: " + ", ".join(OBLIGATORIOS[c] for c in faltan) + "."
    return _regla(nombre, "no_evaluable", mensaje, ahora, "low_confidence", faltan)


def _regla_pagada(extraccion: ExtraccionEstampilla, ahora: datetime) -> dict:
    nombre = "pro_cultura_paid"
    valor = _valor(extraccion, "pro_cultura_amount")
    if not extraccion.fila_pro_cultura:
        return _regla(nombre, "no_cumple", SIN_PRO_CULTURA, ahora)
    if extraccion.estado_pro_cultura is None:
        # La fila está pero su estado no se pudo leer: que lo vea una persona, no "no figura pagada".
        return _regla(
            nombre,
            "no_evaluable",
            "No se pudo leer el estado de la Estampilla Pro-Cultura; un funcionario lo revisará.",
            ahora,
            "low_confidence",
        )
    if extraccion.estado_pro_cultura not in PAGADOS:
        return _regla(nombre, "no_cumple", NO_PAGADA, ahora)
    if valor is None:
        return _regla(
            nombre,
            "no_evaluable",
            "No se encontró el valor de la Estampilla Pro-Cultura; un funcionario lo revisará.",
            ahora,
            "low_confidence",
        )
    if valor <= 0:
        return _regla(nombre, "no_cumple", VALOR_CERO, ahora)
    return _regla(nombre, "cumple", "La Estampilla Pro-Cultura figura pagada en el comprobante.", ahora)


def _regla_registro(extraccion: ExtraccionEstampilla, registro: dict | None, ahora: datetime) -> dict:
    """Traduce lo que devuelve consultar_comprobante (Tarea 22) al contrato (spec, sección 8)."""
    nombre = "official_record"
    if _valor(extraccion, "receipt_number") is None:
        return _regla(
            nombre, "no_evaluable", "No se consulta porque no se encontró el número de recibo.", ahora, "missing_dependency"
        )
    if registro is None:
        return _regla(nombre, "no_evaluable", NO_CONSULTADO, ahora, "source_pending")
    if not isinstance(registro, dict):
        registro = {}  # una respuesta que no es la de la Tarea 22: falla cerrado, más abajo
    resultado = registro.get("resultado")
    if resultado == "cumple":
        return _regla(
            nombre,
            "cumple",
            "El comprobante está en los registros oficiales de la Gobernación de Bolívar, "
            "con la Estampilla Pro-Cultura pagada.",
            ahora,
        )
    if resultado == "no_cumple":
        if registro.get("estado_consulta") == "no_encontrado":
            mensaje = NO_ENCONTRADO
        elif registro.get("etiqueta_exists") is False:
            mensaje = REGISTRO_SIN_PRO_CULTURA
        elif registro.get("pagado") is False:
            mensaje = REGISTRO_SIN_PAGAR
        else:
            mensaje = NO_ENCONTRADO
        return _regla(nombre, "no_cumple", mensaje, ahora)
    if resultado == "no_evaluable" and registro.get("motivo") in ("invalid_input", "low_confidence"):
        return _regla(
            nombre,
            "no_evaluable",
            "El número de recibo del comprobante no se pudo consultar; un funcionario lo revisará.",
            ahora,
            "low_confidence",
        )
    # source_unavailable, incomplete_data o una respuesta desconocida: falla cerrado.
    return _regla(nombre, "no_evaluable", NO_DISPONIBLE, ahora, "source_unavailable")


def _nombre_coincide(nombre: str | None, anonimizado: str | None) -> bool:
    """La Gobernación muestra las primeras letras de cada palabra, pegadas y separadas por asteriscos
    ("ANA****PRU****"); las pruebas de la Tarea 22 traen el nombre completo, con espacios. Se compara
    sin tildes, palabra por palabra."""
    prefijos = [_sin_tildes(parte) for parte in re.findall(r"[^\s*]+", anonimizado or "")]
    propias = _sin_tildes(nombre or "").split()
    if not prefijos or len(propias) != len(prefijos):
        return False
    return all(palabra.startswith(prefijo) for palabra, prefijo in zip(propias, prefijos))


def cotejar(extraccion: ExtraccionEstampilla, registro: dict) -> list[str]:
    """Lo que no coincide entre el PDF y el registro oficial; un dato que la Gobernación no devolvió
    tampoco coincide."""
    distintos = []
    fecha = registro.get("fecha_pago")
    if fecha is None or fecha != _valor(extraccion, "payment_date"):
        distintos.append("fecha de pago")
    valor = registro.get("valor_pro_cultura")
    if valor is None or valor != _valor(extraccion, "pro_cultura_amount"):
        distintos.append("valor")
    # La máscara de asteriscos no conserva la longitud: solo se cotejan los dígitos visibles.
    visibles = re.match(r"\d*", registro.get("documento_parcial") or "").group()
    documento = _valor(extraccion, "identification_number") or ""
    if not visibles or not documento.startswith(visibles):
        distintos.append("documento")
    if not _nombre_coincide(_valor(extraccion, "full_name"), registro.get("nombre_anonimizado")):
        distintos.append("nombre")
    return distintos


def _regla_cotejo(extraccion: ExtraccionEstampilla, registro: dict | None, oficial: dict, ahora: datetime) -> dict:
    nombre = "official_record_matches"
    if oficial["result"] != "cumple":
        return _regla(
            nombre,
            "no_evaluable",
            "No se coteja porque el comprobante no se confirmó en los registros oficiales.",
            ahora,
            "missing_dependency",
        )
    distintos = cotejar(extraccion, registro)
    if not distintos:
        return _regla(nombre, "cumple", "Los datos del comprobante coinciden con los registros oficiales.", ahora)
    return _regla(
        nombre, "no_evaluable", NO_COINCIDE.format(campos=", ".join(distintos)), ahora, "low_confidence", distintos
    )


def _dependiente(nombre: str, ahora: datetime) -> dict:
    return _regla(
        nombre,
        "no_evaluable",
        "No se evalúa porque el archivo no se pudo identificar como un certificado de pago.",
        ahora,
        "missing_dependency",
    )


def evaluar(extraccion: ExtraccionEstampilla, registro: dict | None, *, ahora: datetime) -> list[dict]:
    """Las 5 reglas en orden. `registro` es lo que devolvió la Gobernación, o None si no se consultó."""
    documento = _regla_documento(extraccion, ahora)
    if documento["result"] != "cumple":
        return [documento] + [_dependiente(nombre, ahora) for nombre in ORDEN[1:]]
    oficial = _regla_registro(extraccion, registro, ahora)
    return [
        documento,
        _regla_datos(extraccion, ahora),
        _regla_pagada(extraccion, ahora),
        oficial,
        _regla_cotejo(extraccion, registro, oficial, ahora),
    ]


def accion_por_revisar(reglas: list[dict]) -> str:
    """wait_for_external_validation si lo único pendiente es la Gobernación (caído o sin consultar)."""
    motivos = {
        r["no_evaluable_reason"]
        for r in reglas
        if r["mandatory"] and r["result"] == "no_evaluable" and r["no_evaluable_reason"] != "missing_dependency"
    }
    return "wait_for_external_validation" if motivos and motivos <= FUENTE_EXTERNA else "wait_for_review"
