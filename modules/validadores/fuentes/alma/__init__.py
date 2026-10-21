"""Adaptador ALMA: paz y salvo por préstamos, multas y opción de grado (Tarea 21)."""

from .cliente import AlmaCliente, AlmaClienteError, ListaAlma
from .config import AlmaConfig, AlmaConfigError, cargar_config
from .consultar import consultar_paz_y_salvo

__all__ = [
    "AlmaCliente",
    "AlmaClienteError",
    "AlmaConfig",
    "AlmaConfigError",
    "ListaAlma",
    "cargar_config",
    "consultar_paz_y_salvo",
]