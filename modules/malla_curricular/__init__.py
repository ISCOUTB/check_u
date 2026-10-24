"""Módulo de análisis de Evaluación de Grado de Banner y cumplimiento de malla curricular (Tarea 27)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .analizador import AnalizadorMallaCurricular
from .extractor import ExtractorEvaluacionBanner
from .modelos import PeriodoEvaluacion, ResultadoCumplimiento, ResultadoMallaCurricular

_analizador_global = AnalizadorMallaCurricular()


def analizar_evaluacion_grado(origen: bytes | str | Path) -> ResultadoMallaCurricular:
    """Analiza una Evaluación de Grado y retorna el objeto ResultadoMallaCurricular."""
    return _analizador_global.analizar(origen)


def analizar_malla_curricular(origen: bytes | str | Path) -> dict[str, Any]:
    """Analiza una Evaluación de Grado y retorna el diccionario JSON requerido por la issue #57."""
    return _analizador_global.analizar(origen).to_dict()


__all__ = [
    "AnalizadorMallaCurricular",
    "ExtractorEvaluacionBanner",
    "PeriodoEvaluacion",
    "ResultadoCumplimiento",
    "ResultadoMallaCurricular",
    "analizar_evaluacion_grado",
    "analizar_malla_curricular",
]
