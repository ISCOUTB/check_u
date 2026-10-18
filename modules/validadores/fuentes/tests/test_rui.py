"""Adaptador del RUI con respuestas simuladas (formato de modules/check_id/rui/consultar.py).

No se grabaron de la red: el RUI es un servicio externo sin acuerdo formal y las pruebas no lo llaman.
"""

import pytest
import requests

from modules.validadores.fuentes.rui import RespuestaRui, consultar_rui


def responde(respuesta):
    def consulta(_datos):
        return respuesta

    return consulta


def falla(error):
    def consulta(_datos):
        raise error

    return consulta


def test_encontrado():
    respuesta = consultar_rui("1000000001", consulta=responde({"success": True, "data": {"nombre_completo": "ANA PRUEBA"}}))
    assert respuesta == RespuestaRui("encontrado", "ANA PRUEBA", respuesta.detalle)


def test_sin_registro():
    respuesta = consultar_rui("1000000001", consulta=responde({"success": False, "data": {"id": "1000000001"}}))
    assert (respuesta.estado, respuesta.nombre) == ("sin_registro", None)


def test_encontrado_sin_nombre_es_sin_registro():
    respuesta = consultar_rui("1000000001", consulta=responde({"success": True, "data": {"nombre_completo": ""}}))
    assert respuesta.estado == "sin_registro"


@pytest.mark.parametrize(
    "consulta",
    [
        falla(requests.ConnectionError("sin red")),
        falla(ValueError("Expecting value: line 1 column 1")),
        falla(KeyError("ok")),
        responde({}),
        responde("<html>mantenimiento</html>"),
    ],
)
def test_respuestas_raras(consulta):
    respuesta = consultar_rui("1000000001", consulta=consulta)
    assert respuesta.estado == "sin_respuesta"
    assert respuesta.nombre is None
    assert respuesta.detalle


def test_envia_el_numero():
    recibido = []

    def consulta(datos):
        recibido.append(datos)
        return {"success": False, "data": {}}

    consultar_rui("1000000001", consulta=consulta)
    assert recibido == [{"id": "1000000001"}]
