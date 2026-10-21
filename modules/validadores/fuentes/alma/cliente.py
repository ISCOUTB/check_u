"""Cliente HTTP de ALMA (Users API): préstamos, solicitudes y multas.

- Autenticación por cabecera Authorization (apikey), sin loguear la clave.
- Paginación: recorre todas las páginas usando total_record_count cuando existe.
- Errores de red/HTTP → AlmaClienteError (el criterio quedará no_evaluable arriba).
- No guarda ni devuelve respuestas completas con datos personales.

Los nombres de campos se alinean con la documentación Users de Ex Libris;
si una instalación devuelve otra forma, el listado se marca incompleto.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any, Callable, Literal

import requests

from .config import AlmaConfig, cargar_config

MetodoLista = Literal["loans", "requests", "fees"]


class AlmaClienteError(Exception):
    """Fallo al hablar con ALMA o respuesta no usable para decidir."""

    def __init__(self, mensaje: str, *, codigo_http: int | None = None) -> None:
        super().__init__(mensaje)
        self.codigo_http = codigo_http
        self.mensaje = mensaje


@dataclass(frozen=True)
class ListaAlma:
    """Listado consolidado sin volcar registros crudos al resto del sistema."""

    tipo: MetodoLista
    total: int
    items: list[dict[str, Any]]
    completo: bool
    detalle: str


# Claves de array habituales en respuestas JSON de ALMA Users (doc Ex Libris).
_CLAVES_ITEMS: dict[MetodoLista, tuple[str, ...]] = {
    "loans": ("item_loan", "user_loan"),
    "requests": ("user_request", "request"),
    "fees": ("fee", "user_fee"),
}


def _headers(config: AlmaConfig) -> dict[str, str]:
    return {
        "Authorization": f"apikey {config.api_key}",
        "Accept": "application/json",
    }


def _extraer_items(tipo: MetodoLista, payload: dict[str, Any]) -> list[dict[str, Any]]:
    for clave in _CLAVES_ITEMS[tipo]:
        valor = payload.get(clave)
        if isinstance(valor, list):
            return [x for x in valor if isinstance(x, dict)]
        if isinstance(valor, dict):
            return [valor]
    # Respuesta sin lista reconocida: no inventamos ítems.
    return []


def _total_reportado(payload: dict[str, Any], items_pagina: list[dict[str, Any]]) -> int | None:
    for clave in ("total_record_count", "totalRecordCount"):
        if clave in payload:
            try:
                return int(payload[clave])
            except (TypeError, ValueError):
                return None
    # Si no hay total, solo sabemos el tamaño de esta página.
    return len(items_pagina) if items_pagina else 0


class AlmaCliente:
    """Cliente de solo lectura sobre /almaws/v1/users/{id}/…"""

    def __init__(
        self,
        config: AlmaConfig | None = None,
        *,
        session: requests.Session | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._config = config if config is not None else cargar_config()
        self._session = session or requests.Session()
        self._sleep = sleep

    def _get_json(self, url: str, params: dict[str, Any]) -> dict[str, Any]:
        ultimo_error: Exception | None = None
        intentos = self._config.max_reintentos + 1

        for intento in range(intentos):
            try:
                respuesta = self._session.get(
                    url,
                    headers=_headers(self._config),
                    params=params,
                    timeout=self._config.timeout_segundos,
                )
            except requests.RequestException as error:
                ultimo_error = error
                if intento + 1 < intentos:
                    self._sleep(min(2**intento, 8))
                    continue
                raise AlmaClienteError(
                    f"No se pudo conectar con ALMA ({type(error).__name__})."
                ) from error

            codigo = respuesta.status_code

            if codigo in (429, 500, 502, 503, 504) and intento + 1 < intentos:
                self._sleep(min(2**intento, 8))
                continue

            if codigo in (401, 403):
                raise AlmaClienteError(
                    "ALMA rechazó la autenticación o los permisos de la clave.",
                    codigo_http=codigo,
                )
            if codigo == 404:
                raise AlmaClienteError(
                    "ALMA no encontró el recurso o el usuario.",
                    codigo_http=codigo,
                )
            if codigo == 429:
                raise AlmaClienteError(
                    "ALMA limitó la tasa de peticiones (429).",
                    codigo_http=codigo,
                )
            if codigo >= 400:
                raise AlmaClienteError(
                    f"ALMA respondió error HTTP {codigo}.",
                    codigo_http=codigo,
                )

            try:
                data = respuesta.json()
            except ValueError as error:
                raise AlmaClienteError(
                    "ALMA devolvió un cuerpo que no es JSON válido.",
                    codigo_http=codigo,
                ) from error

            if not isinstance(data, dict):
                raise AlmaClienteError(
                    "ALMA devolvió JSON con forma inesperada (se esperaba objeto).",
                    codigo_http=codigo,
                )
            return data

        raise AlmaClienteError(
            f"No se pudo completar la petición a ALMA ({type(ultimo_error).__name__})."
        )

    def listar(
        self,
        user_id: str,
        tipo: MetodoLista,
        *,
        params_extra: dict[str, Any] | None = None,
    ) -> ListaAlma:
        """Obtiene el listado completo (todas las páginas) o marca incompleto."""
        if not user_id or not str(user_id).strip():
            raise AlmaClienteError("user_id vacío: no se puede consultar ALMA.")

        uid = str(user_id).strip()
        path = f"/almaws/v1/users/{uid}/{tipo}"
        url = f"{self._config.base_url}{path}"

        offset = 0
        limit = self._config.page_size
        acumulados: list[dict[str, Any]] = []
        total: int | None = None

        while True:
            params: dict[str, Any] = {"offset": offset, "limit": limit}
            if params_extra:
                params.update(params_extra)

            payload = self._get_json(url, params)
            pagina = _extraer_items(tipo, payload)

            if total is None:
                total = _total_reportado(payload, pagina)

            acumulados.extend(pagina)

            if total is None:
                return ListaAlma(
                    tipo=tipo,
                    total=len(acumulados),
                    items=acumulados,
                    completo=False,
                    detalle="La respuesta no trajo total_record_count; no se puede asegurar el listado completo.",
                )

            if len(acumulados) >= total:
                break
            if not pagina:
                # Sin ítems pero total > acumulado → incompleto / forma inesperada.
                return ListaAlma(
                    tipo=tipo,
                    total=total,
                    items=acumulados,
                    completo=False,
                    detalle="Paginación incompleta: ALMA indicó más registros de los recibidos.",
                )

            offset += limit
            # Tope de seguridad para no buclear si el total miente.
            if offset > total + limit:
                return ListaAlma(
                    tipo=tipo,
                    total=total,
                    items=acumulados,
                    completo=False,
                    detalle="Paginación detenida por límite de seguridad.",
                )

        return ListaAlma(
            tipo=tipo,
            total=total if total is not None else len(acumulados),
            items=acumulados,
            completo=True,
            detalle=f"Listado {tipo} completo ({len(acumulados)} registro(s)).",
        )

    def prestamos(self, user_id: str) -> ListaAlma:
        return self.listar(user_id, "loans")

    def solicitudes(self, user_id: str) -> ListaAlma:
        return self.listar(user_id, "requests")

    def multas(self, user_id: str) -> ListaAlma:
        return self.listar(user_id, "fees")