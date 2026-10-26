"""Reglas de academic_evaluation a partir de lo que entrega malla_curricular.

No se inventan requisitos académicos: solo se traduce general_result, créditos
y periodos que ya calculó modules/malla_curricular.
"""

from __future__ import annotations

from datetime import datetime

from ..resultado import evaluacion
from .extraccion import ExtraccionAcademicEvaluation

VERSION = "academic_evaluation@1.0.0"

OBLIGATORIOS = {
    "full_name_student": "nombre completo del estudiante",
    "code_student": "código estudiantil",
    "program": "programa académico",
}


def _valor(extraccion: ExtraccionAcademicEvaluation, campo: str):
    return extraccion.datos[campo]["value"]


def _regla_documento(extraccion: ExtraccionAcademicEvaluation, ahora: datetime) -> dict:
    nombre = "academic_evaluation_document"
    if extraccion.es_evaluacion is True:
        return evaluacion(
            nombre,
            "cumple",
            mandatory=True,
            message="El archivo corresponde a una Evaluación de Grado de Banner legible.",
            ahora=ahora,
        )
    if extraccion.es_evaluacion is False:
        return evaluacion(
            nombre,
            "no_cumple",
            mandatory=True,
            message=extraccion.motivo_malla
            or "El archivo no es una Evaluación de Grado de Banner válida.",
            ahora=ahora,
        )
    return evaluacion(
        nombre,
        "no_evaluable",
        mandatory=True,
        message=extraccion.motivo_malla
        or "No se pudo confirmar que el archivo sea una Evaluación de Grado de Banner.",
        motivo="low_confidence",
        errors=extraccion.errores,
        ahora=ahora,
    )


def _dependiente(nombre: str, ahora: datetime) -> dict:
    return evaluacion(
        nombre,
        "no_evaluable",
        mandatory=True,
        message="No se evalúa porque el documento no se identificó como Evaluación de Grado.",
        motivo="missing_dependency",
        ahora=ahora,
    )


def _regla_datos(extraccion: ExtraccionAcademicEvaluation, ahora: datetime) -> dict:
    nombre = "required_fields_present"
    faltan = [c for c in OBLIGATORIOS if _valor(extraccion, c) is None]
    if not faltan:
        return evaluacion(
            nombre,
            "cumple",
            mandatory=True,
            message="La evaluación trae nombre, código estudiantil y programa.",
            ahora=ahora,
        )
    return evaluacion(
        nombre,
        "no_evaluable",
        mandatory=True,
        message="No se encontraron estos datos: "
        + ", ".join(OBLIGATORIOS[c] for c in faltan)
        + ".",
        motivo="low_confidence",
        errors=faltan,
        ahora=ahora,
    )


def _regla_cumplimiento(extraccion: ExtraccionAcademicEvaluation, ahora: datetime) -> dict:
    """Traduce general_result de malla sin inventar umbrales nuevos."""
    nombre = "curriculum_compliance"
    general = _valor(extraccion, "general_result")
    motivo = _valor(extraccion, "motivo") or extraccion.motivo_malla or ""

    if general == "cumple":
        return evaluacion(
            nombre,
            "cumple",
            mandatory=True,
            message=motivo
            or "El estudiante cumple la malla según la Evaluación de Grado de Banner.",
            ahora=ahora,
        )
    if general == "no_cumple":
        return evaluacion(
            nombre,
            "no_cumple",
            mandatory=True,
            message=motivo
            or "El estudiante no cumple la malla según la Evaluación de Grado de Banner.",
            ahora=ahora,
        )
    return evaluacion(
        nombre,
        "no_evaluable",
        mandatory=True,
        message="No se pudo determinar el cumplimiento de la malla curricular.",
        motivo="low_confidence",
        ahora=ahora,
    )


def evaluar(extraccion: ExtraccionAcademicEvaluation, *, ahora: datetime) -> list[dict]:
    documento = _regla_documento(extraccion, ahora)
    if documento["result"] != "cumple":
        return [
            documento,
            _dependiente("required_fields_present", ahora),
            _dependiente("curriculum_compliance", ahora),
        ]
    return [
        documento,
        _regla_datos(extraccion, ahora),
        _regla_cumplimiento(extraccion, ahora),
    ]