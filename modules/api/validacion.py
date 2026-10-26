"""Despacha cada archivo al validador correspondiente y devuelve DocumentValidationResult."""

from __future__ import annotations

from modules.validadores.academic_evaluation import validar_academic_evaluation
from modules.validadores.cedula import validar_cedula
from modules.validadores.estampilla import validar_estampilla
from modules.validadores.saber_pro import validar_saber_pro

# type_document del contrato → función del motor
VALIDADORES = {
    "identification": validar_cedula,
    "saber_pro": validar_saber_pro,
    "estampilla_pro_cultura": validar_estampilla,
    "academic_evaluation": validar_academic_evaluation,
    # Pendientes:
    # "paz_y_salvo_bib": ...,
}


def analizar_documento(
    contenido: bytes,
    *,
    type_document: str,
    id_student: str,
    document_version: int = 1,
) -> dict:
    """Ejecuta el validador del tipo indicado y devuelve el resultado del contrato."""
    validador = VALIDADORES.get(type_document)
    if validador is None:
        raise ValueError(
            f"Tipo de documento no soportado: {type_document}. "
            f"Soportados: {', '.join(sorted(VALIDADORES))}"
        )

    return validador(
        contenido,
        id_student=id_student,
        document_version=document_version,
    )


def clasificar_estado_general(resultados: list[dict]) -> str:
    """Resume varios DocumentValidationResult en un solo estado."""
    if not resultados:
        return "empty"

    clases = [r.get("document_classification") for r in resultados]

    if any(c == "invalid" for c in clases):
        return "invalid"
    if any(c in ("to_check", "inconsistent") for c in clases):
        return "to_check"
    if all(c == "valid" for c in clases):
        return "valid"
    return "mixed"
