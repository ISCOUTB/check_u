"""Pruebas del analizador de HTML de estampilla Pro-Cultura."""

from __future__ import annotations

import pytest

from modules.estampilla_pro.parser import (
    EstructuraInvalidaError,
    _es_concepto_pro_cultura,
    _parsear_fecha_iso,
    _parsear_valor_entero,
    normalizar_texto,
    parsear_detalle_recibo,
)


def test_normalizar_texto():
    assert normalizar_texto("  Estampilla   PRO-CULTURA  ") == "estampilla pro-cultura"
    assert normalizar_texto("Liquidacion\u00a0Recibo") == "liquidacion recibo"
    assert normalizar_texto("Expedición Títulos") == "expedicion titulos"
    assert normalizar_texto(None) == ""


def test_es_concepto_pro_cultura():
    assert _es_concepto_pro_cultura("Estampilla Pro-Cultura") is True
    assert _es_concepto_pro_cultura("Estampilla Pro Cultura") is True
    assert _es_concepto_pro_cultura("ESTAMPÍLLA PRO-CULTURA") is True
    assert _es_concepto_pro_cultura("Estampilla Procultura") is True
    # Prodesarrollo NO debe confundirse con Pro-Cultura
    assert _es_concepto_pro_cultura("Estampilla Prodesarrollo (Liquidacion Recibo)") is False
    assert _es_concepto_pro_cultura("Estampilla Prodesarrollo") is False
    assert _es_concepto_pro_cultura("Renta departamental general") is False


def test_parsear_valor_entero():
    assert _parsear_valor_entero("$ 70,036") == 70036
    assert _parsear_valor_entero("$ 21,000") == 21000
    assert _parsear_valor_entero("$ 0") == 0
    assert _parsear_valor_entero("150.000 COP") == 150000
    assert _parsear_valor_entero("") == 0
    assert _parsear_valor_entero(None) == 0


def test_parsear_fecha_iso():
    assert _parsear_fecha_iso("2026-10-13") == "2026-10-13"
    assert _parsear_fecha_iso("13/10/2026") == "2026-10-13"
    assert _parsear_fecha_iso("13-10-2026") == "2026-10-13"
    with pytest.raises(EstructuraInvalidaError):
        _parsear_fecha_iso("fecha-invalida")


def test_parsear_recibo_valido(html_pagado):
    detalle = parsear_detalle_recibo(html_pagado)
    assert detalle.recibo_oficial == "0012345678"
    assert detalle.estado_general == "Pagado"
    assert detalle.pagado_general is True
    assert detalle.documento_parcial == "100******"
    assert detalle.nombre_anonimizado == "ESTUDIANTE ANONIMO PRUEBA"
    assert detalle.fecha_pago == "2026-10-13"
    assert detalle.tiene_pro_cultura is True
    assert detalle.valor_pro_cultura == 70036
    assert detalle.estado_pro_cultura == "Pagado"
    assert detalle.pagado_pro_cultura is True
    assert len(detalle.conceptos) == 2


def test_parsear_recibo_solo_prodesarrollo(html_solo_prodesarrollo):
    detalle = parsear_detalle_recibo(html_solo_prodesarrollo)
    assert detalle.pagado_general is True
    assert detalle.tiene_pro_cultura is False
    assert detalle.valor_pro_cultura is None
    assert detalle.estado_pro_cultura is None
    assert detalle.pagado_pro_cultura is False
    assert len(detalle.conceptos) == 1


def test_parsear_recibo_no_pagado(html_no_pagado):
    detalle = parsear_detalle_recibo(html_no_pagado)
    assert detalle.pagado_general is False
    assert detalle.tiene_pro_cultura is True
    assert detalle.valor_pro_cultura == 70036
    assert detalle.pagado_pro_cultura is False


def test_parsear_recibo_estructura_invalida(html_incompleto):
    with pytest.raises(EstructuraInvalidaError):
        parsear_detalle_recibo(html_incompleto)


def test_parsear_html_vacio():
    with pytest.raises(EstructuraInvalidaError):
        parsear_detalle_recibo("")
    with pytest.raises(EstructuraInvalidaError):
        parsear_detalle_recibo("   ")
