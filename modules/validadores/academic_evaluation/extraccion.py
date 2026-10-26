"""Extracción de Evaluación de Grado Banner vía modules/malla_curricular.

Solo adapta el resultado de malla a extracted_data del contrato.
No aplica reglas de negocio aquí.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from modules.malla_curricular import analizar_evaluacion_grado
from modules.malla_curricular.modelos import ResultadoMallaCurricular

CAMPOS = (
    "full_name_student",
    "code_student",
    "program",
    "max_credits",
    "credits_approved",
    "general_result",
    "motivo",
)

DANADO = "El archivo está vacío o dañado."
NO_BANNER = (
    "El documento no corresponde a una Evaluación de Grado expedida por Banner "
    "o la información es ilegible o incompleta."
)


@dataclass(frozen=True)
class ExtraccionAcademicEvaluation:
    """Resultado de la extracción, separado de las reglas."""

    # True si malla identificó un documento Banner usable
    es_evaluacion: bool | None
    datos: dict[str, dict[str, Any]]
    periodos: list[dict[str, Any]]
    errores: list[str]
    motivo_malla: str


def _dato(valor: Any = None) -> dict[str, Any]:
    return {"value": valor, "confidence": None if valor is None else 1.0}


def _vacia(errores: list[str], motivo: str = "") -> ExtraccionAcademicEvaluation:
    return ExtraccionAcademicEvaluation(
        es_evaluacion=None,
        datos={campo: _dato() for campo in CAMPOS},
        periodos=[],
        errores=errores,
        motivo_malla=motivo,
    )


def _desde_malla(resultado: ResultadoMallaCurricular) -> ExtraccionAcademicEvaluation:
    datos = {
        "full_name_student": _dato(resultado.full_name_student),
        "code_student": _dato(resultado.code_student),
        "program": _dato(resultado.program),
        "max_credits": _dato(resultado.max_credits),
        "credits_approved": _dato(resultado.credits_approved),
        "general_result": _dato(resultado.general_result),
        "motivo": _dato(resultado.motivo or None),
    }
    periodos = [p.to_dict() for p in resultado.periods]

    # Sin periodos y general_result no_cumple suele ser error estructural de malla
    tiene_identidad = bool(
        resultado.full_name_student or resultado.code_student or resultado.program
    )
    if not periodos and resultado.general_result == "no_cumple" and not tiene_identidad:
        return ExtraccionAcademicEvaluation(
            es_evaluacion=False,
            datos=datos,
            periodos=[],
            errores=[resultado.motivo or NO_BANNER],
            motivo_malla=resultado.motivo or NO_BANNER,
        )

    if not periodos and resultado.general_result == "no_cumple":
        # Documento leído en parte, pero sin periodos evaluables
        return ExtraccionAcademicEvaluation(
            es_evaluacion=None,
            datos=datos,
            periodos=[],
            errores=[resultado.motivo] if resultado.motivo else [],
            motivo_malla=resultado.motivo or "",
        )

    return ExtraccionAcademicEvaluation(
        es_evaluacion=True,
        datos=datos,
        periodos=periodos,
        errores=[],
        motivo_malla=resultado.motivo or "",
    )


def extraer(contenido: bytes) -> ExtraccionAcademicEvaluation:
    """Lee el PDF con malla_curricular. Fallos de archivo → errores, sin excepción."""
    if not contenido:
        return _vacia([DANADO], DANADO)

    try:
        resultado = analizar_evaluacion_grado(contenido)
    except Exception as exc:  # noqa: BLE001 — cualquier fallo de lectura/OCR
        return _vacia([f"Error al analizar el documento: {exc}"], str(exc))

    return _desde_malla(resultado)