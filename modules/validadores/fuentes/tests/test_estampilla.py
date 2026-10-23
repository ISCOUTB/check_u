"""Pruebas del adaptador puente de estampilla en modules/validadores/fuentes/."""

from __future__ import annotations

from unittest.mock import patch

from modules.validadores.fuentes import estampilla


def test_puente_consultar_comprobante():
    with patch("modules.validadores.fuentes.estampilla.consultar_comprobante", return_value={"resultado": "cumple"}):
        res = estampilla.consultar_comprobante("123456")
        assert res["resultado"] == "cumple"
