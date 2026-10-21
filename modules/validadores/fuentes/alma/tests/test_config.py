import pytest

from modules.validadores.fuentes.alma.config import AlmaConfigError, cargar_config


def test_exige_api_key(monkeypatch):
    monkeypatch.delenv("ALMA_API_KEY", raising=False)
    monkeypatch.setenv("ALMA_BASE_URL", "https://api-eu.hosted.exlibrisgroup.com")
    with pytest.raises(AlmaConfigError, match="ALMA_API_KEY"):
        cargar_config()


def test_exige_base_url(monkeypatch):
    monkeypatch.setenv("ALMA_API_KEY", "test-key")
    monkeypatch.delenv("ALMA_BASE_URL", raising=False)
    with pytest.raises(AlmaConfigError, match="ALMA_BASE_URL"):
        cargar_config()


def test_carga_ok_inyectada():
    cfg = cargar_config(
        api_key="k",
        base_url="https://ejemplo.exlibrisgroup.com/",
        timeout_segundos=10,
        max_reintentos=1,
        page_size=50,
    )
    assert cfg.api_key == "k"
    assert cfg.base_url == "https://ejemplo.exlibrisgroup.com"
    assert cfg.page_size == 50