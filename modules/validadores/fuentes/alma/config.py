"""Configuración de ALMA solo por variables de entorno.

Sin valores por defecto para la API key. La clave no se registra en logs ni se
devuelve en respuestas.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


class AlmaConfigError(ValueError):
    """Falta o es inválida una variable de entorno de ALMA."""


@dataclass(frozen=True)
class AlmaConfig:
    api_key: str
    base_url: str
    timeout_segundos: float
    max_reintentos: int
    page_size: int


def cargar_config(
    *,
    api_key: str | None = None,
    base_url: str | None = None,
    timeout_segundos: float | None = None,
    max_reintentos: int | None = None,
    page_size: int | None = None,
) -> AlmaConfig:
    """Lee entorno. Los argumentos opcionales sirven para tests (inyección)."""
    clave = api_key if api_key is not None else os.environ.get("ALMA_API_KEY", "").strip()
    if not clave:
        raise AlmaConfigError(
            "Falta ALMA_API_KEY. Define la variable de entorno con una clave de solo lectura."
        )

    url = base_url if base_url is not None else os.environ.get("ALMA_BASE_URL", "").strip()
    if not url:
        raise AlmaConfigError(
            "Falta ALMA_BASE_URL. Debe ser la URL base de la región ALMA (sin barra final)."
        )
    url = url.rstrip("/")

    if timeout_segundos is None:
        raw_timeout = os.environ.get("ALMA_TIMEOUT_SECONDS", "15").strip()
        try:
            timeout_segundos = float(raw_timeout)
        except ValueError as exc:
            raise AlmaConfigError("ALMA_TIMEOUT_SECONDS debe ser un número.") from exc
    if timeout_segundos <= 0:
        raise AlmaConfigError("ALMA_TIMEOUT_SECONDS debe ser mayor que 0.")

    if max_reintentos is None:
        raw_reint = os.environ.get("ALMA_MAX_RETRIES", "3").strip()
        try:
            max_reintentos = int(raw_reint)
        except ValueError as exc:
            raise AlmaConfigError("ALMA_MAX_RETRIES debe ser un entero.") from exc
    if max_reintentos < 0:
        raise AlmaConfigError("ALMA_MAX_RETRIES no puede ser negativo.")

    if page_size is None:
        raw_page = os.environ.get("ALMA_PAGE_SIZE", "100").strip()
        try:
            page_size = int(raw_page)
        except ValueError as exc:
            raise AlmaConfigError("ALMA_PAGE_SIZE debe ser un entero.") from exc
    if page_size < 1 or page_size > 100:
        # ALMA suele limitar el tamaño de página; 100 es un tope habitual.
        raise AlmaConfigError("ALMA_PAGE_SIZE debe estar entre 1 y 100.")

    return AlmaConfig(
        api_key=clave,
        base_url=url,
        timeout_segundos=timeout_segundos,
        max_reintentos=max_reintentos,
        page_size=page_size,
    )