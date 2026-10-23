"""Pruebas de la interfaz de línea de comandos y entrada/salida estándar (CLI/stdin)."""

from __future__ import annotations

import io
import json
from unittest.mock import patch

from modules.estampilla_pro.__main__ import main


def test_cli_con_argumentos(monkeypatch):
    resultado_mock = {
        "type_document": "estampilla_pro_cultura",
        "referencia": "123456",
        "resultado": "cumple",
        "mensaje": "El comprobante fue verificado correctamente.",
    }

    with patch("modules.estampilla_pro.__main__.consultar_comprobante", return_value=resultado_mock):
        salida = io.StringIO()
        monkeypatch.setattr("sys.stdout", salida)
        codigo = main(["123456", "--confianza", "0.95"])
        assert codigo == 0
        datos = json.loads(salida.getvalue())
        assert datos["referencia"] == "123456"
        assert datos["resultado"] == "cumple"


def test_cli_por_stdin(monkeypatch):
    resultado_mock = {
        "type_document": "estampilla_pro_cultura",
        "referencia": "987654",
        "resultado": "cumple",
    }

    entrada_stdin = io.StringIO('{"numero_factura": "987654", "confianza_ocr": 0.85}')
    # Simular que stdin no es una terminal interactiva
    monkeypatch.setattr(entrada_stdin, "isatty", lambda: False)
    monkeypatch.setattr("sys.stdin", entrada_stdin)

    with patch("modules.estampilla_pro.__main__.consultar_comprobante", return_value=resultado_mock):
        salida = io.StringIO()
        monkeypatch.setattr("sys.stdout", salida)
        codigo = main([])
        assert codigo == 0
        datos = json.loads(salida.getvalue())
        assert datos["referencia"] == "987654"


def test_cli_sin_argumentos_muestra_ayuda(monkeypatch):
    entrada_stdin = io.StringIO("")
    monkeypatch.setattr(entrada_stdin, "isatty", lambda: True)
    monkeypatch.setattr("sys.stdin", entrada_stdin)

    salida_err = io.StringIO()
    monkeypatch.setattr("sys.stderr", salida_err)
    codigo = main([])
    assert codigo == 1
    assert "usage:" in salida_err.getvalue().lower() or "uso" in salida_err.getvalue().lower()


def test_cli_texto_humano(monkeypatch):
    resultado_mock = {
        "type_document": "estampilla_pro_cultura",
        "referencia": "123456",
        "estado_consulta": "encontrado",
        "resultado": "cumple",
        "pagado": True,
        "etiqueta_exists": True,
        "valor_pro_cultura": 70036,
        "fecha_pago": "2026-10-13",
        "mensaje": "El comprobante fue verificado correctamente.",
    }

    with patch("modules.estampilla_pro.__main__.consultar_comprobante", return_value=resultado_mock):
        salida = io.StringIO()
        monkeypatch.setattr("sys.stdout", salida)
        codigo = main(["123456", "--texto"])
        assert codigo == 0
        txt = salida.getvalue()
        assert "123456" in txt
        assert "cumple" in txt
