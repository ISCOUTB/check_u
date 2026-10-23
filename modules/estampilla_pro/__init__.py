"""Módulo de verificación de comprobantes de estampilla Pro-Cultura (Tarea 22)."""

from .cliente import EstampillaCliente, EstampillaClienteError, limpiar_cache
from .config import EstampillaConfig, EstampillaConfigError, cargar_config
from .consultar import (
    MENSAJE_NO_VALIDO,
    MENSAJE_POR_REVISAR,
    MENSAJE_VALIDO,
    UMBRAL_CONFIANZA,
    consultar_comprobante,
    validar_numero_factura,
)
from .parser import (
    ConceptoLiquidado,
    DetalleRecibo,
    EstructuraInvalidaError,
    parsear_detalle_recibo,
)

__all__ = [
    "ConceptoLiquidado",
    "DetalleRecibo",
    "EstampillaCliente",
    "EstampillaClienteError",
    "EstampillaConfig",
    "EstampillaConfigError",
    "EstructuraInvalidaError",
    "MENSAJE_NO_VALIDO",
    "MENSAJE_POR_REVISAR",
    "MENSAJE_VALIDO",
    "UMBRAL_CONFIANZA",
    "cargar_config",
    "consultar_comprobante",
    "limpiar_cache",
    "parsear_detalle_recibo",
    "validar_numero_factura",
]
