"""Fixtures y generadores de PDF sintéticos para las pruebas de malla curricular."""

from __future__ import annotations

import io
from typing import Any

import pymupdf
import pytest


def crear_pdf_banner(
    texto_contenido: str | None = None,
    estudiante: str = "Javier Enrique Mercado Bolívar",
    codigo: str = "T00063198",
    programa: str = "Ingeniería de Sistemas y Computación",
    max_creditos: int = 160,
    creditos_aprobados: int = 160,
    periodos: list[dict[str, Any]] | None = None,
) -> bytes:
    """Genera en memoria un PDF con texto digital imitando una Evaluación de Grado de Banner."""
    doc = pymupdf.open()
    page = doc.new_page(width=612, height=792)  # Tamaño carta

    if texto_contenido is not None:
        texto = texto_contenido
    else:
        if periodos is None:
            periodos = [
                {"periodo": "202410", "cumple": "Sí", "total": 16, "aprobados": 16, "faltantes": 0},
                {"periodo": "202420", "cumple": "Sí", "total": 18, "aprobados": 18, "faltantes": 0},
            ]

        lineas = [
            "UNIVERSIDAD TECNOLÓGICA DE BOLÍVAR",
            "EVALUACIÓN DE GRADO - SISTEMA BANNER",
            "",
            "INFORMACIÓN DEL ESTUDIANTE",
            f"Estudiante : {estudiante}",
            f"ID : {codigo}",
            f"Programa : {programa}",
            "Nivel : Pregrado",
            "",
            "RESUMEN DEL PROGRAMA ACADÉMICO",
            f"Créditos Requeridos : {max_creditos}    Créditos Aplicados : {creditos_aprobados}",
            "",
            "DETALLE POR PERIODOS / ÁREAS",
        ]

        for p in periodos:
            p_id = p.get("periodo", "2024-1")
            cump = p.get("cumple", "Sí")
            tot = p.get("total", 16)
            apr = p.get("aprobados", 16)
            fal = p.get("faltantes", 0)

            lineas.append(f"Periodo : {p_id}")
            lineas.append(f"Cumple : {cump}")
            lineas.append(f"Requeridos : {tot}    Aplicados : {apr}    Faltantes : {fal}")
            lineas.append("")

        texto = "\n".join(lineas)

    # Insertar texto en el PDF
    page.insert_text((50, 50), texto, fontsize=10)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


@pytest.fixture
def pdf_banner_cumple() -> bytes:
    return crear_pdf_banner()


@pytest.fixture
def pdf_banner_un_periodo_no_cumple() -> bytes:
    return crear_pdf_banner(
        max_creditos=160,
        creditos_aprobados=157,
        periodos=[
            {"periodo": "2024-1", "cumple": "No", "total": 16, "aprobados": 13, "faltantes": 3},
            {"periodo": "2024-2", "cumple": "Sí", "total": 16, "aprobados": 16, "faltantes": 0},
        ],
    )


@pytest.fixture
def pdf_banner_dos_periodos_no_cumple() -> bytes:
    return crear_pdf_banner(
        max_creditos=160,
        creditos_aprobados=155,
        periodos=[
            {"periodo": "2024-1", "cumple": "No", "total": 16, "aprobados": 13, "faltantes": 3},
            {"periodo": "2025-2", "cumple": "No", "total": 18, "aprobados": 16, "faltantes": 2},
        ],
    )
