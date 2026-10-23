"""Pruebas integrales de consultar_comprobante (matriz de reglas de la Tarea 22)."""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
import pytest

from modules.estampilla_pro.cliente import EstampillaCliente, EstampillaClienteError, limpiar_cache
from modules.estampilla_pro.consultar import (
    MENSAJE_NO_VALIDO,
    MENSAJE_POR_REVISAR,
    MENSAJE_VALIDO,
    consultar_comprobante,
    validar_numero_factura,
)


class MockCliente:
    def __init__(self, respuesta: dict | Exception) -> None:
        self.respuesta = respuesta
        self.llamadas: list[str] = []

    def consultar(self, numero_factura: str, **kwargs):
        self.llamadas.append(numero_factura)
        if isinstance(self.respuesta, Exception):
            raise self.respuesta
        return self.respuesta


AHORA_FIJO = datetime(2026, 10, 20, 9, 15, 0, tzinfo=timezone(timedelta(hours=-5)))


@pytest.fixture(autouse=True)
def _limpiar():
    limpiar_cache()
    yield
    limpiar_cache()


def test_validar_numero_factura():
    assert validar_numero_factura("0012345678") == "0012345678"
    assert validar_numero_factura("FAC-2026-99") == "FAC-2026-99"
    assert validar_numero_factura(12345) == "12345"

    with pytest.raises(ValueError):
        validar_numero_factura("")
    with pytest.raises(ValueError):
        validar_numero_factura("   ")
    with pytest.raises(ValueError):
        validar_numero_factura("123 456")  # espacios internos
    with pytest.raises(ValueError):
        validar_numero_factura("<script>alert(1)</script>")
    with pytest.raises(ValueError):
        validar_numero_factura("a" * 51)  # longitud excesiva
    with pytest.raises(ValueError):
        validar_numero_factura(None)


def test_caso_1_pagado_con_etiqueta_pro_cultura(html_pagado):
    cliente = MockCliente({"success": True, "html": html_pagado})
    resultado = consultar_comprobante(
        "0012345678",
        cliente=cliente,
        ahora=AHORA_FIJO,
    )

    assert resultado["type_document"] == "estampilla_pro_cultura"
    assert resultado["referencia"] == "0012345678"
    assert resultado["estado_consulta"] == "encontrado"
    assert resultado["pagado"] is True
    assert resultado["etiqueta_exists"] is True
    assert resultado["valor_pro_cultura"] == 70036
    assert resultado["moneda"] == "COP"
    assert resultado["fecha_pago"] == "2026-10-13"
    assert resultado["nombre_anonimizado"] == "ESTUDIANTE ANONIMO PRUEBA"
    assert resultado["documento_parcial"] == "100******"
    assert resultado["resultado"] == "cumple"
    assert resultado["motivo"] is None
    assert resultado["mensaje"] == MENSAJE_VALIDO
    assert resultado["consultado_en"] == "2026-10-20T09:15:00-05:00"
    assert resultado["fuente"] == "impuestos.bolivar.gov.co"

    # Privacidad: no debe contener HTML ni enlaces
    assert "html" not in resultado
    assert "url" not in str(resultado).lower() or "impuestos.bolivar.gov.co" in str(resultado)


def test_caso_2_sin_etiqueta_solo_prodesarrollo(html_solo_prodesarrollo):
    cliente = MockCliente({"success": True, "html": html_solo_prodesarrollo})
    resultado = consultar_comprobante(
        "0012345678",
        cliente=cliente,
        ahora=AHORA_FIJO,
    )

    assert resultado["estado_consulta"] == "encontrado"
    assert resultado["etiqueta_exists"] is False
    assert resultado["pagado"] is True  # Según el recibo general
    assert resultado["valor_pro_cultura"] is None
    assert resultado["resultado"] == "no_cumple"
    assert resultado["motivo"] is None
    assert resultado["mensaje"] == MENSAJE_NO_VALIDO


def test_caso_3_estado_distinto_de_pagado(html_no_pagado):
    cliente = MockCliente({"success": True, "html": html_no_pagado})
    resultado = consultar_comprobante(
        "0012345678",
        cliente=cliente,
        ahora=AHORA_FIJO,
    )

    assert resultado["estado_consulta"] == "encontrado"
    assert resultado["etiqueta_exists"] is True
    assert resultado["pagado"] is False
    assert resultado["valor_pro_cultura"] == 70036
    assert resultado["resultado"] == "no_cumple"
    assert resultado["motivo"] is None
    assert resultado["mensaje"] == MENSAJE_NO_VALIDO


def test_caso_4_no_encontrado_alta_confianza():
    cliente = MockCliente({"success": False, "message": "No se encontraron liquidaciones"})
    
    # 1. Sin confianza_ocr explícita (asume alta)
    res1 = consultar_comprobante("999999", cliente=cliente)
    assert res1["estado_consulta"] == "no_encontrado"
    assert res1["resultado"] == "no_cumple"
    assert res1["motivo"] is None
    assert res1["mensaje"] == MENSAJE_NO_VALIDO
    assert res1["pagado"] is None
    assert res1["etiqueta_exists"] is None

    # 2. Con confianza >= 0.8
    res2 = consultar_comprobante("999999", confianza_ocr=0.92, cliente=cliente)
    assert res2["resultado"] == "no_cumple"
    assert res2["motivo"] is None


def test_caso_5_no_encontrado_baja_confianza():
    cliente = MockCliente({"success": False, "message": "No se encontraron liquidaciones"})
    resultado = consultar_comprobante("999999", confianza_ocr=0.65, cliente=cliente)

    assert resultado["estado_consulta"] == "no_encontrado"
    assert resultado["resultado"] == "no_evaluable"
    assert resultado["motivo"] == "low_confidence"
    assert resultado["mensaje"] == MENSAJE_POR_REVISAR
    assert resultado["pagado"] is None


def test_caso_6_success_false_otro_mensaje():
    cliente = MockCliente({"success": False, "message": "Error interno del servidor web"})
    resultado = consultar_comprobante("12345", cliente=cliente)

    assert resultado["estado_consulta"] == "no_disponible"
    assert resultado["resultado"] == "no_evaluable"
    assert resultado["motivo"] == "source_unavailable"
    assert resultado["mensaje"] == MENSAJE_POR_REVISAR


def test_caso_7_estructura_distinta_o_incompleta(html_incompleto):
    cliente = MockCliente({"success": True, "html": html_incompleto})
    resultado = consultar_comprobante("12345", cliente=cliente)

    assert resultado["estado_consulta"] == "encontrado"
    assert resultado["resultado"] == "no_evaluable"
    assert resultado["motivo"] == "incomplete_data"
    assert resultado["mensaje"] == MENSAJE_POR_REVISAR
    assert resultado["pagado"] is None
    assert resultado["etiqueta_exists"] is None


def test_caso_8_html_nulo_o_vacio():
    cliente = MockCliente({"success": True, "html": ""})
    resultado = consultar_comprobante("12345", cliente=cliente)

    assert resultado["resultado"] == "no_evaluable"
    assert resultado["motivo"] == "incomplete_data"


def test_caso_9_error_cliente_http():
    cliente = MockCliente(EstampillaClienteError("Conexión rechazada", codigo_http=503))
    resultado = consultar_comprobante("12345", cliente=cliente)

    assert resultado["estado_consulta"] == "no_disponible"
    assert resultado["resultado"] == "no_evaluable"
    assert resultado["motivo"] == "source_unavailable"
    assert resultado["mensaje"] == MENSAJE_POR_REVISAR


def test_caso_10_numero_caracteres_invalidos():
    cliente = MockCliente({"success": True, "html": "..."})
    resultado = consultar_comprobante("123/../../hack", cliente=cliente)

    assert resultado["estado_consulta"] == "no_disponible"
    assert resultado["resultado"] == "no_evaluable"
    assert resultado["motivo"] == "invalid_input"
    assert resultado["mensaje"] == MENSAJE_POR_REVISAR
    # Nunca debe llamar al cliente externo
    assert len(cliente.llamadas) == 0
