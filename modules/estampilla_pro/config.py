"""Configuración del módulo de verificación de estampilla Pro-Cultura (Tarea 22).

Lee las variables de entorno:
  ESTAMPILLA_BASE_URL: URL base del formulario/servicio de verificación.
  ESTAMPILLA_TIMEOUT_S: Tiempo de espera en segundos (por defecto 10).
  ESTAMPILLA_MAX_REINTENTOS: Intentos adicionales ante fallos transitorios (por defecto 2).
  ESTAMPILLA_MIN_INTERVAL_S: Intervalo mínimo entre consultas para rate limiting (por defecto 0.5).

El servicio de la Gobernación de Bolívar es público, por lo que no requiere secretos.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

URL_BASE_DEFECTO = "https://impuestos.bolivar.gov.co/gobol_web/liquidaciones/verificar-recibo"
TIMEOUT_DEFECTO = 10.0
MAX_REINTENTOS_DEFECTO = 2
MIN_INTERVAL_DEFECTO = 0.5


class EstampillaConfigError(ValueError):
    """Error en los valores de configuración del servicio."""


@dataclass(frozen=True)
class EstampillaConfig:
    base_url: str = URL_BASE_DEFECTO
    timeout_s: float = TIMEOUT_DEFECTO
    max_reintentos: int = MAX_REINTENTOS_DEFECTO
    min_interval_s: float = MIN_INTERVAL_DEFECTO


def cargar_config() -> EstampillaConfig:
    """Carga y valida la configuración desde el entorno."""
    base_url = os.environ.get("ESTAMPILLA_BASE_URL", URL_BASE_DEFECTO).strip().rstrip("/")
    if not base_url:
        raise EstampillaConfigError("ESTAMPILLA_BASE_URL no puede estar vacía.")

    timeout_raw = os.environ.get("ESTAMPILLA_TIMEOUT_S")
    if timeout_raw is not None:
        try:
            timeout_s = float(timeout_raw)
            if timeout_s <= 0:
                raise ValueError
        except ValueError:
            raise EstampillaConfigError(
                f"ESTAMPILLA_TIMEOUT_S debe ser un número positivo (recibido: {timeout_raw!r})."
            ) from None
    else:
        timeout_s = TIMEOUT_DEFECTO

    reintentos_raw = os.environ.get("ESTAMPILLA_MAX_REINTENTOS")
    if reintentos_raw is not None:
        try:
            max_reintentos = int(reintentos_raw)
            if max_reintentos < 0:
                raise ValueError
        except ValueError:
            raise EstampillaConfigError(
                f"ESTAMPILLA_MAX_REINTENTOS debe ser un entero >= 0 (recibido: {reintentos_raw!r})."
            ) from None
    else:
        max_reintentos = MAX_REINTENTOS_DEFECTO

    interval_raw = os.environ.get("ESTAMPILLA_MIN_INTERVAL_S")
    if interval_raw is not None:
        try:
            min_interval_s = float(interval_raw)
            if min_interval_s < 0:
                raise ValueError
        except ValueError:
            raise EstampillaConfigError(
                f"ESTAMPILLA_MIN_INTERVAL_S debe ser un número >= 0 (recibido: {interval_raw!r})."
            ) from None
    else:
        min_interval_s = MIN_INTERVAL_DEFECTO

    return EstampillaConfig(
        base_url=base_url,
        timeout_s=timeout_s,
        max_reintentos=max_reintentos,
        min_interval_s=min_interval_s,
    )
