from unittest.mock import MagicMock

import pytest

from modules.validadores.fuentes.alma.cliente import AlmaCliente, AlmaClienteError
from modules.validadores.fuentes.alma.config import AlmaConfig


def _cfg() -> AlmaConfig:
    return AlmaConfig(
        api_key="test-key",
        base_url="https://ejemplo.exlibrisgroup.com",
        timeout_segundos=5,
        max_reintentos=0,
        page_size=100,
    )


def test_prestamos_una_pagina_completa():
    session = MagicMock()
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = {
        "total_record_count": 2,
        "item_loan": [{"loan_id": "1"}, {"loan_id": "2"}],
    }
    session.get.return_value = resp

    cliente = AlmaCliente(_cfg(), session=session, sleep=lambda _s: None)
    lista = cliente.prestamos("T0001")

    assert lista.completo is True
    assert lista.total == 2
    assert len(lista.items) == 2
    session.get.assert_called_once()
    args, kwargs = session.get.call_args
    assert "Authorization" in kwargs["headers"]
    assert "test-key" in kwargs["headers"]["Authorization"]


def test_401_autenticacion():
    session = MagicMock()
    resp = MagicMock()
    resp.status_code = 401
    session.get.return_value = resp

    cliente = AlmaCliente(_cfg(), session=session, sleep=lambda _s: None)
    with pytest.raises(AlmaClienteError, match="autenticación"):
        cliente.multas("T0001")


def test_paginacion_dos_paginas():
    session = MagicMock()

    def side_effect(*_a, **kwargs):
        offset = kwargs["params"]["offset"]
        resp = MagicMock()
        resp.status_code = 200
        if offset == 0:
            resp.json.return_value = {
                "total_record_count": 2,
                "fee": [{"id": "a"}],
            }
        else:
            resp.json.return_value = {
                "total_record_count": 2,
                "fee": [{"id": "b"}],
            }
        return resp

    session.get.side_effect = side_effect
    cfg = AlmaConfig(
        api_key="k",
        base_url="https://ejemplo.exlibrisgroup.com",
        timeout_segundos=5,
        max_reintentos=0,
        page_size=1,
    )
    cliente = AlmaCliente(cfg, session=session, sleep=lambda _s: None)
    lista = cliente.multas("T0001")

    assert lista.completo is True
    assert len(lista.items) == 2
    assert session.get.call_count == 2