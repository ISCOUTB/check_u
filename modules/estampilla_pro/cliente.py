"""Cliente HTTP para consultar el servicio público de estampilla de la Gobernación de Bolívar.

Aplica buenas prácticas para un servicio público no documentado:
- Identificación con User-Agent propio de CheckU.
- Rate limiting con intervalo mínimo configurable.
- Reintentos con backoff exponencial ante caídas o 5xx.
- Respeto del código HTTP 429 (Too Many Requests / Retry-After).
- Caché en memoria por número de factura y versión de documento.
- Verificación TLS siempre activa.
"""

from __future__ import annotations

import logging
import time
import urllib.parse
from typing import Any, Callable

import requests

from .config import EstampillaConfig, cargar_config

logger = logging.getLogger("modules.estampilla_pro")

USER_AGENT = "CheckU/1.0 (+https://github.com/ISCOUTB/check_u)"

# Caché en memoria: (numero_factura, document_version) -> payload
_CACHE: dict[tuple[str, Any], dict[str, Any]] = {}


def limpiar_cache() -> None:
    """Limpia la caché en memoria (usado en tests y reinicios)."""
    _CACHE.clear()


class EstampillaClienteError(Exception):
    """Fallo de comunicación, tiempo agotado o respuesta no válida del servicio externo."""

    def __init__(self, mensaje: str, *, codigo_http: int | None = None) -> None:
        super().__init__(mensaje)
        self.codigo_http = codigo_http
        self.mensaje = mensaje


class EstampillaCliente:
    """Cliente HTTP con reintentos, limitación de frecuencia y caché."""

    def __init__(
        self,
        config: EstampillaConfig | None = None,
        *,
        session: requests.Session | None = None,
        sleep: Callable[[float], None] = time.sleep,
        time_func: Callable[[], float] = time.time,
    ) -> None:
        self._config = config if config is not None else cargar_config()
        self._session = session or requests.Session()
        self._sleep = sleep
        self._time = time_func
        self._ultimo_acceso: float = 0.0

    def _esperar_rate_limit(self) -> None:
        """Asegura un intervalo mínimo entre consultas para no sobrecargar el servicio."""
        if self._config.min_interval_s <= 0:
            return
        ahora = self._time()
        transcurrido = ahora - self._ultimo_acceso
        if transcurrido < self._config.min_interval_s:
            tiempo_espera = self._config.min_interval_s - transcurrido
            self._sleep(tiempo_espera)
        self._ultimo_acceso = self._time()

    def consultar(
        self,
        numero_factura: str,
        *,
        document_version: Any = None,
        usar_cache: bool = True,
    ) -> dict[str, Any]:
        """Realiza la petición al endpoint oficial y devuelve el JSON decodificado.

        Nunca incluye datos personales en los logs técnicos.
        """
        clave_cache = (numero_factura, document_version)
        if usar_cache and clave_cache in _CACHE:
            logger.info("Resultado obtenido de caché para referencia.")
            return _CACHE[clave_cache]

        numero_codificado = urllib.parse.quote(numero_factura, safe="")
        url = (
            f"{self._config.base_url}/{numero_codificado}/web"
            f"?id={numero_codificado}&tipo=web&txtAjax=true"
        )
        headers = {
            "User-Agent": USER_AGENT,
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest",
        }

        intentos = self._config.max_reintentos + 1
        ultimo_error: Exception | None = None

        for intento in range(intentos):
            self._esperar_rate_limit()
            try:
                logger.info(
                    "Consultando servicio de estampilla (intento %d/%d)",
                    intento + 1,
                    intentos,
                )
                respuesta = self._session.get(
                    url,
                    headers=headers,
                    timeout=self._config.timeout_s,
                    verify=True,
                )

                if respuesta.status_code == 429:
                    retry_after_header = respuesta.headers.get("Retry-After")
                    espera = 1.0
                    if retry_after_header:
                        try:
                            espera = min(float(retry_after_header), 5.0)
                        except ValueError:
                            espera = 1.0
                    else:
                        espera = min(0.5 * (2**intento), 3.0)
                    if intento < self._config.max_reintentos:
                        self._sleep(espera)
                        continue
                    raise EstampillaClienteError(
                        "Límite de peticiones alcanzado (HTTP 429).",
                        codigo_http=429,
                    )

                if 500 <= respuesta.status_code < 600:
                    if intento < self._config.max_reintentos:
                        espera = min(0.5 * (2**intento), 3.0)
                        self._sleep(espera)
                        continue
                    raise EstampillaClienteError(
                        f"Servidor no disponible (HTTP {respuesta.status_code}).",
                        codigo_http=respuesta.status_code,
                    )

                if respuesta.status_code != 200:
                    raise EstampillaClienteError(
                        f"Respuesta HTTP inesperada: {respuesta.status_code}",
                        codigo_http=respuesta.status_code,
                    )

                try:
                    data = respuesta.json()
                except Exception as json_err:
                    raise EstampillaClienteError(
                        "La respuesta del servicio no es un JSON válido."
                    ) from json_err

                if not isinstance(data, dict):
                    raise EstampillaClienteError("La respuesta JSON no es un objeto.")

                if usar_cache:
                    _CACHE[clave_cache] = data
                return data

            except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as red_err:
                ultimo_error = red_err
                if intento < self._config.max_reintentos:
                    espera = min(0.5 * (2**intento), 3.0)
                    self._sleep(espera)
                    continue
                raise EstampillaClienteError(
                    f"Error de red o tiempo agotado: {type(red_err).__name__}"
                ) from red_err
            except EstampillaClienteError:
                raise
            except Exception as err:
                ultimo_error = err
                if intento < self._config.max_reintentos:
                    espera = min(0.5 * (2**intento), 3.0)
                    self._sleep(espera)
                    continue
                raise EstampillaClienteError(f"Error inesperado al consultar: {err}") from err

        raise EstampillaClienteError(
            f"Se agotaron los reintentos para consultar el servicio: {ultimo_error}"
        )
