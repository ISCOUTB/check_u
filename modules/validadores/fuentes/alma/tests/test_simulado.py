"""Cliente simulado de ALMA (Tarea 50): misma interfaz y misma forma de respuesta que la API real.

Los JSON se generan aquí, en tmp_path, con datos inventados: el archivo real de simulación vive
fuera del repositorio.
"""

import json

import pytest

from modules.validadores.fuentes.alma import (
    AlmaCliente,
    AlmaClienteError,
    AlmaClienteSimulado,
    AlmaConfigError,
    crear_cliente,
)


def _usuario(**listas):
    base = {
        "user": {
            "primary_id": "T00000901",
            "first_name": "Ana",
            "last_name": "Prueba",
            "user_identifier": [{"id_type": {"value": "CC"}, "value": "1000000901"}],
        },
        "loans": {"item_loan": [], "total_record_count": 0},
        "fees": {"fee": [], "total_record_count": 0, "total_sum": 0, "currency": "COP"},
        "requests": {"user_request": [], "total_record_count": 0},
    }
    base.update(listas)
    return base


@pytest.fixture
def archivo(tmp_path):
    def escribir(datos):
        ruta = tmp_path / "alma_simulacion.json"
        ruta.write_text(json.dumps(datos), encoding="utf-8")
        return ruta

    return escribir


def test_lista_prestamos_como_la_api(archivo):
    ruta = archivo(
        {
            "usuarios": {
                "T00000901": _usuario(
                    loans={
                        "item_loan": [
                            {"loan_id": "1", "loan_status": "ACTIVE"},
                            {"loan_id": "2", "loan_status": "ACTIVE"},
                        ],
                        "total_record_count": 2,
                    }
                )
            }
        }
    )
    lista = AlmaClienteSimulado(ruta).prestamos("T00000901")
    assert lista.tipo == "loans"
    assert lista.total == 2
    assert lista.completo is True
    assert len(lista.items) == 2


def test_sin_total_se_comporta_como_el_cliente_real(archivo):
    # cliente._total_reportado cuenta los ítems de la página cuando falta total_record_count.
    ruta = archivo(
        {"usuarios": {"T00000901": _usuario(fees={"fee": [{"status": "ACTIVE", "balance": 5}]})}}
    )
    lista = AlmaClienteSimulado(ruta).multas("T00000901")
    assert lista.total == 1
    assert len(lista.items) == 1


def test_listado_con_forma_inesperada_queda_vacio(archivo):
    ruta = archivo({"usuarios": {"T00000901": _usuario(requests="no es un objeto")}})
    lista = AlmaClienteSimulado(ruta).solicitudes("T00000901")
    assert lista.items == []
    # Revisión final: un listado mal formado no puede dejar a alguien a paz y salvo.
    assert lista.completo is False


def test_bloque_ausente_no_da_paz_y_salvo(archivo):
    usuario = _usuario()
    del usuario["loans"]
    ruta = archivo({"usuarios": {"T00000901": usuario}})
    lista = AlmaClienteSimulado(ruta).prestamos("T00000901")
    assert lista.items == []
    assert lista.completo is False


def test_usuario_existente_y_ausente(archivo):
    ruta = archivo({"usuarios": {"T00000901": _usuario()}})
    cliente = AlmaClienteSimulado(ruta)
    assert cliente.usuario("T00000901")["primary_id"] == "T00000901"
    assert cliente.usuario(" T00000901 ")["primary_id"] == "T00000901"
    assert cliente.usuario("T99999999") is None
    with pytest.raises(AlmaClienteError) as error:
        cliente.prestamos("T99999999")
    assert error.value.codigo_http == 404
    assert cliente.solicitudes("T00000901").total == 0


def test_archivo_ausente_o_invalido(tmp_path):
    with pytest.raises(AlmaClienteError, match="No se encontró el archivo de simulación de ALMA."):
        AlmaClienteSimulado(tmp_path / "no_existe.json").usuario("T1")
    malo = tmp_path / "malo.json"
    malo.write_text("{no es json", encoding="utf-8")
    with pytest.raises(AlmaClienteError, match="El archivo de simulación de ALMA no es JSON válido."):
        AlmaClienteSimulado(malo).prestamos("T1")


def test_variable_de_entorno(archivo, monkeypatch):
    ruta = archivo({"usuarios": {"T00000901": _usuario()}})
    monkeypatch.setenv("ALMA_SIMULACION_ARCHIVO", str(ruta))
    assert AlmaClienteSimulado().usuario("T00000901") is not None
    monkeypatch.delenv("ALMA_SIMULACION_ARCHIVO")
    with pytest.raises(AlmaClienteError):
        AlmaClienteSimulado().usuario("T00000901")


def test_crear_cliente_por_modo(monkeypatch):
    monkeypatch.delenv("ALMA_MODO", raising=False)
    assert isinstance(crear_cliente(), AlmaClienteSimulado)
    monkeypatch.setenv("ALMA_MODO", "real")
    monkeypatch.setenv("ALMA_API_KEY", "clave-de-prueba")
    monkeypatch.setenv("ALMA_BASE_URL", "https://ejemplo.exlibrisgroup.com")
    assert isinstance(crear_cliente(), AlmaCliente)
    monkeypatch.setenv("ALMA_MODO", "otro")
    with pytest.raises(AlmaConfigError):
        crear_cliente()
