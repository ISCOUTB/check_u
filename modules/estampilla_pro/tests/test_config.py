"""Pruebas de la configuración de estampilla Pro-Cultura."""

from __future__ import annotations

import pytest

from modules.estampilla_pro.config import (
    URL_BASE_DEFECTO,
    EstampillaConfig,
    EstampillaConfigError,
    cargar_config,
)


def test_config_defecto(monkeypatch):
    monkeypatch.delenv("ESTAMPILLA_BASE_URL", raising=False)
    monkeypatch.delenv("ESTAMPILLA_TIMEOUT_S", raising=False)
    monkeypatch.delenv("ESTAMPILLA_MAX_REINTENTOS", raising=False)
    monkeypatch.delenv("ESTAMPILLA_MIN_INTERVAL_S", raising=False)

    cfg = cargar_config()
    assert cfg.base_url == URL_BASE_DEFECTO
    assert cfg.timeout_s == 10.0
    assert cfg.max_reintentos == 2
    assert cfg.min_interval_s == 0.5


def test_config_personalizada(monkeypatch):
    monkeypatch.setenv("ESTAMPILLA_BASE_URL", "https://mi-proxy.local/verificar/")
    monkeypatch.setenv("ESTAMPILLA_TIMEOUT_S", "5.5")
    monkeypatch.setenv("ESTAMPILLA_MAX_REINTENTOS", "4")
    monkeypatch.setenv("ESTAMPILLA_MIN_INTERVAL_S", "0.2")

    cfg = cargar_config()
    assert cfg.base_url == "https://mi-proxy.local/verificar"
    assert cfg.timeout_s == 5.5
    assert cfg.max_reintentos == 4
    assert cfg.min_interval_s == 0.2


@pytest.mark.parametrize(
    ("var", "val"),
    [
        ("ESTAMPILLA_BASE_URL", ""),
        ("ESTAMPILLA_TIMEOUT_S", "-1"),
        ("ESTAMPILLA_TIMEOUT_S", "abc"),
        ("ESTAMPILLA_MAX_REINTENTOS", "-1"),
        ("ESTAMPILLA_MAX_REINTENTOS", "xyz"),
        ("ESTAMPILLA_MIN_INTERVAL_S", "-0.1"),
    ],
)
def test_config_invalida_lanza_error(monkeypatch, var, val):
    monkeypatch.setenv(var, val)
    with pytest.raises(EstampillaConfigError):
        cargar_config()
