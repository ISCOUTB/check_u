"""Pruebas unitarias para el extractor de Evaluación de Grado de Banner."""

from __future__ import annotations

import pymupdf
import pytest

from modules.malla_curricular.extractor import (
    DANADO,
    NO_ES_BANNER,
    PROTEGIDO,
    SIN_TEXTO,
    ExtractorEvaluacionBanner,
    normalizar_periodo,
)
from modules.malla_curricular.tests.conftest import crear_pdf_banner


def test_archivo_vacio():
    extractor = ExtractorEvaluacionBanner()
    res = extractor.extraer_desde_bytes_o_archivo(b"")
    assert not res.tiene_texto
    assert not res.es_banner
    assert res.error == DANADO


def test_archivo_corrupto():
    extractor = ExtractorEvaluacionBanner()
    res = extractor.extraer_desde_bytes_o_archivo(b"%PDF-1.4 corrupt data invalid")
    assert not res.tiene_texto
    assert not res.es_banner
    assert res.error == DANADO


def test_archivo_sin_texto():
    # PDF válido pero con página en blanco
    doc = pymupdf.open()
    doc.new_page()
    pdf_bytes = doc.tobytes()
    doc.close()

    extractor = ExtractorEvaluacionBanner()
    res = extractor.extraer_desde_bytes_o_archivo(pdf_bytes)
    assert not res.tiene_texto
    assert not res.es_banner
    assert res.error == SIN_TEXTO


def test_documento_no_es_banner():
    # PDF con texto pero de otro tipo de documento
    pdf_otro = crear_pdf_banner(
        texto_contenido="CERTIFICADO DE AFILIACIÓN A LA EPS SANITAS\nEl usuario se encuentra activo."
    )
    extractor = ExtractorEvaluacionBanner()
    res = extractor.extraer_desde_bytes_o_archivo(pdf_otro)
    assert res.tiene_texto
    assert not res.es_banner
    assert res.error == NO_ES_BANNER


def test_extraccion_datos_estudiante(pdf_banner_cumple):
    extractor = ExtractorEvaluacionBanner()
    res = extractor.extraer_desde_bytes_o_archivo(pdf_banner_cumple)
    assert res.es_banner
    assert res.full_name_student == "Javier Enrique Mercado Bolívar"
    assert res.code_student == "T00063198"
    assert res.program == "Ingeniería de Sistemas y Computación"
    assert res.max_credits == 160
    assert res.credits_approved == 160
    assert len(res.periodos) == 2


@pytest.mark.parametrize(
    ("entrada", "esperado"),
    [
        ("202410", "2024-1"),
        ("202420", "2024-2"),
        ("2025-1", "2025-1"),
        ("2025-2", "2025-2"),
        ("2024-01", "2024-1"),
        ("2024-02", "2024-2"),
        ("2024-I", "2024-1"),
        ("2024-II", "2024-2"),
        ("1P-2026", "2026-1"),
        ("2P-2026", "2026-2"),
        ("Nivel I", None),
        ("202405", None),  # Intersemestral, no determinable con certeza como 1 o 2
        ("", None),
        (None, None),
    ],
)
def test_normalizar_periodo(entrada, esperado):
    assert normalizar_periodo(entrada) == esperado


def test_formato_nombre_apellidos_coma():
    pdf = crear_pdf_banner(estudiante="Mercado Bolívar, Javier Enrique")
    extractor = ExtractorEvaluacionBanner()
    res = extractor.extraer_desde_bytes_o_archivo(pdf)
    assert res.full_name_student == "Javier Enrique Mercado Bolívar"
