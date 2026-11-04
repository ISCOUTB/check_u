"""Adaptador ALMA: paz y salvo por préstamos, multas y opción de grado (Tarea 21)."""

from .cliente import AlmaCliente, AlmaClienteError, ListaAlma
from .config import AlmaConfig, AlmaConfigError, cargar_config, crear_cliente
from .consultar import consultar_paz_y_salvo
from .simulado import AlmaClienteSimulado

__all__ = [
    "AlmaCliente",
    "AlmaClienteError",
    "AlmaClienteSimulado",
    "AlmaConfig",
    "AlmaConfigError",
    "ListaAlma",
    "cargar_config",
    "crear_cliente",
    "consultar_paz_y_salvo",
]