"""Modelos de datos para el análisis de la Evaluación de Grado de Banner."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from typing import Any, Literal

ResultadoCumplimiento = Literal["cumple", "no_cumple"]


@dataclass
class PeriodoEvaluacion:
    """Información y cumplimiento de un periodo académico o nivel evaluado."""

    period: str | None
    credits_approved: int | None
    credits_total: int | None
    faltantes: int | None
    result: ResultadoCumplimiento

    def to_dict(self) -> dict[str, Any]:
        return {
            "period": self.period,
            "credits_approved": self.credits_approved,
            "credits_total": self.credits_total,
            "faltantes": self.faltantes,
            "result": self.result,
        }


@dataclass
class ResultadoMallaCurricular:
    """Estructura de respuesta requerida para la Evaluación de Grado de Banner."""

    type_document: str = "academic_evaluation"
    full_name_student: str | None = None
    code_student: str | None = None
    program: str | None = None
    general_result: ResultadoCumplimiento = "no_cumple"
    motivo: str = ""
    max_credits: int | None = None
    credits_approved: int | None = None
    periods: list[PeriodoEvaluacion] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "type_document": "academic_evaluation",
            "full_name_student": self.full_name_student,
            "code_student": self.code_student,
            "program": self.program,
            "general_result": self.general_result,
            "motivo": self.motivo,
            "max_credits": self.max_credits,
            "credits_approved": self.credits_approved,
            "periods": [p.to_dict() for p in self.periods],
        }

    def to_json(self, indent: int | None = 2) -> str:
        """Serializa a JSON válido compatible con JSON.parse()."""
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=indent)
