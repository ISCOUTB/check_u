"""Pruebas del cliente HTTP de estampilla Pro-Cultura."""

from __future__ import annotations

import pytest
import requests

from modules.estampilla_pro.cliente import (
    USER_AGENT,
    EstampillaCliente,
    EstampillaClienteError,
    limpiar_cache,
)
from modules.estampilla_pro.config import EstampillaConfig


class RespuestaFalsa:
    def __init__(
        self,
        status_code: int,
        json_data: dict | None = None,
        headers: dict | None = None,
        text: str = "",
    ) -> None:
        self.status_code = status_code
        self._json = json_data
        self.headers = headers or {}
        self.text = text

    def json(self):
        if self._json is None:
            raise ValueError("No es JSON")
        return self._json


class SesionFalsa:
    def __init__(self, respuestas: list[Any]) -> None:
        self.respuestas = list(respuestas)
        self.peticiones: list[dict] = []

    def get(self, url: str, **kwargs):
        self.peticiones.append({"url": url, "kwargs": kwargs})
        if not self.respuestas:
            raise requests.exceptions.ConnectionError("Sin respuestas preparadas")
        prox = self.respuestas.pop(0)
        if isinstance(prox, Exception):
            raise prox
        return prox


@pytest.fixture(autouse=True)
def _limpiar():
    limpiar_cache()
    yield
    limpiar_cache()


def test_cliente_peticion_exitosa():
    sesion = SesionFalsa([RespuestaFalsa(200, {"success": True, "html": "<div>ok</div>"})])
    cliente = EstampillaCliente(
        EstampillaConfig(min_interval_s=0.0),
        session=sesion,
        sleep=lambda _: None,
    )

    resultado = cliente.consultar("12345")
    assert resultado["success"] is True
    assert len(sesion.peticiones) == 1
    req = sesion.peticiones[0]
    assert "12345" in req["url"]
    assert req["kwargs"]["headers"]["User-Agent"] == USER_AGENT
    assert req["kwargs"]["verify"] is True


def test_cliente_usa_cache():
    sesion = SesionFalsa([RespuestaFalsa(200, {"success": True, "html": "<div>ok</div>"})])
    cliente = EstampillaCliente(
        EstampillaConfig(min_interval_s=0.0),
        session=sesion,
        sleep=lambda _: None,
    )

    res1 = cliente.consultar("12345", document_version=1)
    res2 = cliente.consultar("12345", document_version=1)
    assert res1 == res2
    # Solo una llamada HTTP realizada gracias a la caché
    assert len(sesion.peticiones) == 1


def test_cliente_reintentos_ante_500():
    sesion = SesionFalsa(
        [
            RespuestaFalsa(503),
            RespuestaFalsa(200, {"success": True, "html": "<div>ok</div>"}),
        ]
    )
    tiempos_sleep = []
    cliente = EstampillaCliente(
        EstampillaConfig(max_reintentos=2, min_interval_s=0.0),
        session=sesion,
        sleep=tiempos_sleep.append,
    )

    resultado = cliente.consultar("12345")
    assert resultado["success"] is True
    assert len(sesion.peticiones) == 2
    assert len(tiempos_sleep) == 1


def test_cliente_reintentos_agotados_500():
    sesion = SesionFalsa([RespuestaFalsa(500), RespuestaFalsa(500)])
    cliente = EstampillaCliente(
        EstampillaConfig(max_reintentos=1, min_interval_s=0.0),
        session=sesion,
        sleep=lambda _: None,
    )

    with pytest.raises(EstampillaClienteError) as exc_info:
        cliente.consultar("12345")
    assert exc_info.value.codigo_http == 500


def test_cliente_manejo_429():
    sesion = SesionFalsa(
        [
            RespuestaFalsa(429, headers={"Retry-After": "2"}),
            RespuestaFalsa(200, {"success": True, "html": "<div>ok</div>"}),
        ]
    )
    tiempos_sleep = []
    cliente = EstampillaCliente(
        EstampillaConfig(max_reintentos=2, min_interval_s=0.0),
        session=sesion,
        sleep=tiempos_sleep.append,
    )

    resultado = cliente.consultar("12345")
    assert resultado["success"] is True
    assert tiempos_sleep == [2.0]


def test_cliente_error_red_timeout():
    sesion = SesionFalsa(
        [
            requests.exceptions.Timeout("Timeout"),
            requests.exceptions.Timeout("Timeout"),
        ]
    )
    cliente = EstampillaCliente(
        EstampillaConfig(max_reintentos=1, min_interval_s=0.0),
        session=sesion,
        sleep=lambda _: None,
    )

    with pytest.raises(EstampillaClienteError):
        cliente.consultar("12345")


def test_cliente_respuesta_no_json():
    sesion = SesionFalsa([RespuestaFalsa(200, text="<html>No JSON</html>")])
    cliente = EstampillaCliente(
        EstampillaConfig(max_reintentos=0, min_interval_s=0.0),
        session=sesion,
        sleep=lambda _: None,
    )

    with pytest.raises(EstampillaClienteError):
        cliente.consultar("12345")


def test_cliente_rate_limiting():
    sesion = SesionFalsa(
        [
            RespuestaFalsa(200, {"success": True}),
            RespuestaFalsa(200, {"success": True}),
        ]
    )
    tiempos_sleep = []
    tiempo_actual = [100.0]

    def tiempo_mock():
        return tiempo_actual[0]

    def sleep_mock(seg):
        tiempos_sleep.append(seg)
        tiempo_actual[0] += seg

    cliente = EstampillaCliente(
        EstampillaConfig(min_interval_s=1.0),
        session=sesion,
        sleep=sleep_mock,
        time_func=tiempo_mock,
    )

    cliente.consultar("1111", usar_cache=False)
    tiempo_actual[0] += 0.3  # pasaron 0.3s
    cliente.consultar("2222", usar_cache=False)

    # Debe haber dormido 0.7s para completar el intervalo de 1.0s
    assert len(tiempos_sleep) == 1
    assert pytest.approx(tiempos_sleep[0], 0.01) == 0.7
