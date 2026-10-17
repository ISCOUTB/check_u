"""Muestras reales de Saber Pro del equipo: viven solo en el PC de cada uno (git ignora test_data/).

Sin la carpeta o sin esperados.json, las pruebas que las usan se saltan con un aviso.
"""

import json
from pathlib import Path

import pytest

CARPETA_MUESTRAS = Path(__file__).resolve().parents[4] / "modules" / "test_data" / "saber_pro"


@pytest.fixture
def carpeta_muestras() -> Path:
    return CARPETA_MUESTRAS


@pytest.fixture
def esperados() -> dict:
    """{archivo: {"tipo", "datos", "clasificacion", "contenido": bytes}} de las muestras presentes."""
    archivo = CARPETA_MUESTRAS / "esperados.json"
    if not archivo.exists():
        pytest.skip(f"Faltan las muestras locales de Saber Pro ({archivo})")
    muestras = {}
    for nombre, esperado in json.loads(archivo.read_text(encoding="utf-8")).items():
        pdf = CARPETA_MUESTRAS / nombre
        if pdf.exists():
            muestras[nombre] = {**esperado, "contenido": pdf.read_bytes()}
    if not muestras:
        pytest.skip(f"esperados.json no tiene ningún PDF presente en {CARPETA_MUESTRAS}")
    return muestras


@pytest.fixture
def muestras_de_tipo(esperados):
    """muestras_de_tipo("reporte") o ("corrupto"); se salta si no hay ninguna de ese tipo."""

    def filtrar(tipo: str) -> dict:
        encontrados = {nombre: m for nombre, m in esperados.items() if m["tipo"] == tipo}
        if not encontrados:
            pytest.skip(f"No hay muestras de tipo '{tipo}'")
        return encontrados

    return filtrar
