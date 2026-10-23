"""Función principal: consultar_comprobante(numero_factura, confianza_ocr=None).

Aplica la matriz de decisiones de CheckU (Tarea 22):
- Valida la entrada antes de contactar a la entidad externa.
- Evalúa el concepto 'Estampilla Pro-Cultura' y su estado de pago.
- Ante 'No encontrado', distingue alta confianza (no_cumple) de baja confianza (no_evaluable).
- Ante errores técnicos o respuestas anómalas, falla cerrado (no_evaluable, nunca cumple).
- No almacena HTML ni enlaces de descarga, conservando solo los datos requeridos.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from .cliente import EstampillaCliente, EstampillaClienteError
from .parser import EstructuraInvalidaError, parsear_detalle_recibo

logger = logging.getLogger("modules.estampilla_pro")

# Zona horaria fija de Colombia (UTC-5)
BOGOTA = timezone(timedelta(hours=-5), "America/Bogota")

# Umbral de confianza OCR alineado con las reglas del motor de CheckU
UMBRAL_CONFIANZA = 0.8

# Expresión regular para número de factura válido (alfanumérico, guiones, 1-50 chars)
PATRON_FACTURA = re.compile(r"^[a-zA-Z0-9_-]{1,50}$")

# Mensajes al estudiante de la especificación de pantallas
MENSAJE_VALIDO = "El comprobante fue verificado correctamente."
MENSAJE_NO_VALIDO = "No fue posible encontrar el comprobante en los registros oficiales."
MENSAJE_POR_REVISAR = (
    "No fue posible procesar correctamente el documento. Sube el comprobante en formato "
    "PDF digital, preferiblemente sin escanear, o espera a que el personal encargado lo revise."
)

FUENTE = "impuestos.bolivar.gov.co"
TYPE_DOCUMENT = "estampilla_pro_cultura"


def ahora_bogota() -> datetime:
    """Retorna la fecha y hora actual en la zona de Bogotá."""
    return datetime.now(BOGOTA)


def validar_numero_factura(numero: Any) -> str:
    """Valida y limpia el número de factura entregado.

    Lanza ValueError si el formato o contenido es inválido.
    """
    if numero is None:
        raise ValueError("El número de factura no puede ser nulo.")
    cadena = str(numero).strip()
    if not cadena:
        raise ValueError("El número de factura no puede estar vacío.")
    if not PATRON_FACTURA.match(cadena):
        raise ValueError(
            f"El número de factura contiene caracteres no permitidos o longitud inválida: {cadena!r}"
        )
    return cadena


def consultar_comprobante(
    numero_factura: str | int,
    confianza_ocr: float | None = None,
    *,
    document_version: Any = None,
    cliente: EstampillaCliente | None = None,
    usar_cache: bool = True,
    ahora: datetime | None = None,
) -> dict[str, Any]:
    """Consulta el comprobante en el servicio oficial y devuelve el JSON estructurado.

    Parámetros:
      numero_factura: Número oficial del comprobante.
      confianza_ocr: Nivel de confianza si fue extraído por OCR (0.0 a 1.0).
                     None indica entrada manual o máxima confianza.
      document_version: Versión del documento para desambiguar la caché.
      cliente: Instancia de EstampillaCliente (inyección para pruebas).
      usar_cache: Permite omitir la caché en memoria.
      ahora: Momento de la consulta (inyección para pruebas reproducibles).
    """
    momento = ahora if ahora is not None else ahora_bogota()
    consultado_en = momento.astimezone(BOGOTA).isoformat(timespec="seconds")

    # 1. Validación estricta del número de factura entregado
    try:
        referencia = validar_numero_factura(numero_factura)
    except ValueError as error_val:
        logger.warning("Número de factura con formato inválido: %s", error_val)
        return {
            "type_document": TYPE_DOCUMENT,
            "referencia": str(numero_factura).strip(),
            "estado_consulta": "no_disponible",
            "pagado": None,
            "fecha_pago": None,
            "nombre_anonimizado": None,
            "documento_parcial": None,
            "etiqueta_exists": None,
            "valor_pro_cultura": None,
            "moneda": None,
            "resultado": "no_evaluable",
            "motivo": "invalid_input",
            "mensaje": MENSAJE_POR_REVISAR,
            "consultado_en": consultado_en,
            "fuente": FUENTE,
        }

    # 2. Petición al servicio externo
    estampilla_cli = cliente if cliente is not None else EstampillaCliente()

    try:
        payload = estampilla_cli.consultar(
            referencia,
            document_version=document_version,
            usar_cache=usar_cache,
        )
    except EstampillaClienteError as error_cli:
        logger.error("Error al consultar servicio de estampilla: %s", error_cli)
        return {
            "type_document": TYPE_DOCUMENT,
            "referencia": referencia,
            "estado_consulta": "no_disponible",
            "pagado": None,
            "fecha_pago": None,
            "nombre_anonimizado": None,
            "documento_parcial": None,
            "etiqueta_exists": None,
            "valor_pro_cultura": None,
            "moneda": None,
            "resultado": "no_evaluable",
            "motivo": "source_unavailable",
            "mensaje": MENSAJE_POR_REVISAR,
            "consultado_en": consultado_en,
            "fuente": FUENTE,
        }

    # 3. Evaluación de la respuesta JSON
    success = payload.get("success")
    mensaje_api = str(payload.get("message", "")).strip()

    # Caso A: Servicio responde sin liquidaciones encontradas
    if success is False:
        if "no se encontraron" in mensaje_api.lower():
            # Distinción entre alta confianza y baja confianza OCR
            es_alta_confianza = (
                confianza_ocr is None or float(confianza_ocr) >= UMBRAL_CONFIANZA
            )
            if es_alta_confianza:
                resultado = "no_cumple"
                motivo = None
                mensaje = MENSAJE_NO_VALIDO
            else:
                resultado = "no_evaluable"
                motivo = "low_confidence"
                mensaje = MENSAJE_POR_REVISAR

            return {
                "type_document": TYPE_DOCUMENT,
                "referencia": referencia,
                "estado_consulta": "no_encontrado",
                "pagado": None,
                "fecha_pago": None,
                "nombre_anonimizado": None,
                "documento_parcial": None,
                "etiqueta_exists": None,
                "valor_pro_cultura": None,
                "moneda": None,
                "resultado": resultado,
                "motivo": motivo,
                "mensaje": mensaje,
                "consultado_en": consultado_en,
                "fuente": FUENTE,
            }

        # Mensaje de error inesperado de la API
        logger.warning("Mensaje inesperado con success=false: %s", mensaje_api)
        return {
            "type_document": TYPE_DOCUMENT,
            "referencia": referencia,
            "estado_consulta": "no_disponible",
            "pagado": None,
            "fecha_pago": None,
            "nombre_anonimizado": None,
            "documento_parcial": None,
            "etiqueta_exists": None,
            "valor_pro_cultura": None,
            "moneda": None,
            "resultado": "no_evaluable",
            "motivo": "source_unavailable",
            "mensaje": MENSAJE_POR_REVISAR,
            "consultado_en": consultado_en,
            "fuente": FUENTE,
        }

    # Caso B: Comprobante encontrado -> parsear HTML
    html_crudo = payload.get("html")
    if not isinstance(html_crudo, str) or not html_crudo.strip():
        logger.warning("Respuesta con success=true pero sin campo 'html' válido.")
        return {
            "type_document": TYPE_DOCUMENT,
            "referencia": referencia,
            "estado_consulta": "encontrado",
            "pagado": None,
            "fecha_pago": None,
            "nombre_anonimizado": None,
            "documento_parcial": None,
            "etiqueta_exists": None,
            "valor_pro_cultura": None,
            "moneda": None,
            "resultado": "no_evaluable",
            "motivo": "incomplete_data",
            "mensaje": MENSAJE_POR_REVISAR,
            "consultado_en": consultado_en,
            "fuente": FUENTE,
        }

    try:
        detalle = parsear_detalle_recibo(html_crudo)
    except EstructuraInvalidaError as error_parse:
        logger.warning("Estructura de HTML no reconocida: %s", error_parse)
        return {
            "type_document": TYPE_DOCUMENT,
            "referencia": referencia,
            "estado_consulta": "encontrado",
            "pagado": None,
            "fecha_pago": None,
            "nombre_anonimizado": None,
            "documento_parcial": None,
            "etiqueta_exists": None,
            "valor_pro_cultura": None,
            "moneda": None,
            "resultado": "no_evaluable",
            "motivo": "incomplete_data",
            "mensaje": MENSAJE_POR_REVISAR,
            "consultado_en": consultado_en,
            "fuente": FUENTE,
        }

    # 4. Aplicación de las reglas de negocio
    if detalle.tiene_pro_cultura:
        if detalle.pagado_general and detalle.pagado_pro_cultura:
            pagado = True
            resultado = "cumple"
            motivo = None
            mensaje = MENSAJE_VALIDO
        else:
            pagado = False
            resultado = "no_cumple"
            motivo = None
            mensaje = MENSAJE_NO_VALIDO
    else:
        # Hay comprobante pero no incluye el concepto Pro-Cultura (ej. solo Prodesarrollo)
        pagado = detalle.pagado_general
        resultado = "no_cumple"
        motivo = None
        mensaje = MENSAJE_NO_VALIDO

    return {
        "type_document": TYPE_DOCUMENT,
        "referencia": referencia,
        "estado_consulta": "encontrado",
        "pagado": pagado,
        "fecha_pago": detalle.fecha_pago,
        "nombre_anonimizado": detalle.nombre_anonimizado,
        "documento_parcial": detalle.documento_parcial,
        "etiqueta_exists": detalle.tiene_pro_cultura,
        "valor_pro_cultura": detalle.valor_pro_cultura,
        "moneda": "COP",
        "resultado": resultado,
        "motivo": motivo,
        "mensaje": mensaje,
        "consultado_en": consultado_en,
        "fuente": FUENTE,
    }
