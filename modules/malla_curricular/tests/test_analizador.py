"""Pruebas unitarias para el analizador y reglas de cumplimiento de la malla curricular."""

from __future__ import annotations

import pytest

from modules.malla_curricular.analizador import AnalizadorMallaCurricular
from modules.malla_curricular.tests.conftest import crear_pdf_banner


def test_caso_cumple_total(pdf_banner_cumple):
    analizador = AnalizadorMallaCurricular()
    res = analizador.analizar(pdf_banner_cumple)

    assert res.general_result == "cumple"
    assert res.motivo == (
        "El estudiante cumple con todos los niveles o periodos académicos evaluados y no presenta "
        "créditos pendientes de aprobación según la evaluación de Banner."
    )
    assert res.max_credits == 160
    assert res.credits_approved == 160
    assert len(res.periods) == 2
    assert all(p.result == "cumple" for p in res.periods)
    assert all(p.faltantes == 0 for p in res.periods)


def test_caso_un_periodo_no_cumple(pdf_banner_un_periodo_no_cumple):
    analizador = AnalizadorMallaCurricular()
    res = analizador.analizar(pdf_banner_un_periodo_no_cumple)

    assert res.general_result == "no_cumple"
    assert res.motivo == (
        "En el periodo 2024-1, el estudiante tiene 3 créditos pendientes de aprobación, "
        "por lo que no cumple con el requisito de aprobación de todos los créditos del programa académico."
    )
    assert res.periods[0].period == "2024-1"
    assert res.periods[0].result == "no_cumple"
    assert res.periods[0].faltantes == 3
    assert res.periods[1].period == "2024-2"
    assert res.periods[1].result == "cumple"


def test_caso_dos_periodos_no_cumple(pdf_banner_dos_periodos_no_cumple):
    """Verifica exactamente el ejemplo de redacción de la sección 5 del Issue #57."""
    analizador = AnalizadorMallaCurricular()
    res = analizador.analizar(pdf_banner_dos_periodos_no_cumple)

    assert res.general_result == "no_cumple"
    assert res.motivo == (
        "En los periodos 2024-1 y 2025-2, el estudiante tiene 3 y 2 créditos pendientes de aprobación, "
        "respectivamente, por lo que no cumple con el requisito de aprobación de todos los créditos del programa académico."
    )
    assert res.periods[0].result == "no_cumple"
    assert res.periods[1].result == "no_cumple"


def test_caso_tres_periodos_no_cumple():
    pdf = crear_pdf_banner(
        periodos=[
            {"periodo": "2023-2", "cumple": "No", "total": 16, "aprobados": 12, "faltantes": 4},
            {"periodo": "2024-1", "cumple": "No", "total": 16, "aprobados": 13, "faltantes": 3},
            {"periodo": "2025-2", "cumple": "No", "total": 18, "aprobados": 16, "faltantes": 2},
        ]
    )
    analizador = AnalizadorMallaCurricular()
    res = analizador.analizar(pdf)

    assert res.general_result == "no_cumple"
    assert res.motivo == (
        "En los periodos 2023-2, 2024-1 y 2025-2, el estudiante tiene 4, 3 y 2 créditos pendientes de aprobación, "
        "respectivamente, por lo que no cumple con el requisito de aprobación de todos los créditos del programa académico."
    )


def test_calculo_faltantes_automatico():
    """Valida la fórmula: faltantes = credits_total - credits_approved cuando no vienen explícitos."""
    pdf = crear_pdf_banner(
        periodos=[
            {"periodo": "2024-1", "cumple": "No", "total": 16, "aprobados": 11, "faltantes": None},
        ]
    )
    analizador = AnalizadorMallaCurricular()
    res = analizador.analizar(pdf)
    assert res.periods[0].faltantes == 5
    assert res.periods[0].result == "no_cumple"
    assert "tiene 5 créditos pendientes" in res.motivo


def test_singular_un_solo_credito_faltante():
    pdf = crear_pdf_banner(
        periodos=[
            {"periodo": "2024-1", "cumple": "No", "total": 16, "aprobados": 15, "faltantes": 1},
        ]
    )
    analizador = AnalizadorMallaCurricular()
    res = analizador.analizar(pdf)
    assert "tiene 1 crédito pendiente de aprobación" in res.motivo


def test_documento_no_banner_da_no_cumple():
    pdf_ajeno = crear_pdf_banner(texto_contenido="FACTURA DE VENTA #12345\nCliente: Juan\nTotal: $100.000")
    analizador = AnalizadorMallaCurricular()
    res = analizador.analizar(pdf_ajeno)
    assert res.general_result == "no_cumple"
    assert "no corresponde a una Evaluación de Grado expedida por Banner" in res.motivo
    assert res.periods == []


def test_documento_real_utb_javier():
    from pathlib import Path
    ruta_real = Path(r"C:\Users\JAVIER\Downloads\Test_malla_curricular\JAVIER MERCADOR.pdf")
    if not ruta_real.is_file():
        pytest.skip("Documento de prueba real no presente en la ruta local")

    analizador = AnalizadorMallaCurricular()
    res = analizador.analizar(ruta_real)

    assert res.type_document == "academic_evaluation"
    assert res.code_student == "T00071286"
    assert "MERCADO BOLIVAR" in res.full_name_student
    assert res.program == "Ingeniería de Sistemas y Computación"
    assert res.general_result == "no_cumple"
    assert res.max_credits == 162
    assert res.credits_approved == 133
    assert len(res.periods) == 10
    assert res.periods[0].period == "2022-2"
    assert res.periods[0].result == "cumple"
    assert res.periods[7].period == "2026-1"
    assert res.periods[7].result == "no_cumple"
    assert res.periods[7].faltantes == 3
    assert res.periods[8].period == "2026-2"
    assert res.periods[8].result == "no_cumple"
    assert res.periods[8].faltantes == 14
    assert res.periods[9].period == "2027-1"
    assert res.periods[9].result == "no_cumple"
    assert res.periods[9].faltantes == 12
    assert "2026-1, 2026-2 y 2027-1" in res.motivo
    assert "3, 14 y 12 créditos" in res.motivo

