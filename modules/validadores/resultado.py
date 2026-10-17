"""Arma el DocumentValidationResult del contrato (Tarea 02) a partir de las reglas evaluadas.

Lo comparten los cinco validadores. La clasificación y la acción del estudiante salen solo de
las reglas obligatorias; las informativas se muestran, pero no deciden.
"""

from datetime import datetime, timedelta, timezone

# Colombia no tiene horario de verano, y Windows no trae la base de zonas IANA: UTC-5 fijo.
BOGOTA = timezone(timedelta(hours=-5), "America/Bogota")

RESULTADOS = ("cumple", "no_cumple", "no_evaluable")


def ahora_bogota() -> datetime:
    return datetime.now(BOGOTA)


def _fecha(momento: datetime) -> str:
    return momento.astimezone(BOGOTA).isoformat(timespec="seconds")


def evaluacion(
    rule: str,
    result: str,
    *,
    mandatory: bool,
    message: str,
    motivo: str | None = None,
    errors: list[str] | None = None,
    ahora: datetime,
) -> dict:
    """Un RuleEvaluation. no_evaluable exige su motivo; cumple y no_cumple no llevan motivo."""
    if result not in RESULTADOS:
        raise ValueError(f"Resultado de regla desconocido: {result}")
    if (result == "no_evaluable") != (motivo is not None):
        raise ValueError("no_evaluable lleva motivo; cumple y no_cumple no")
    return {
        "rule": rule,
        "result": result,
        "no_evaluable_reason": motivo,
        "mandatory": mandatory,
        "message": message,
        "timestamp": _fecha(ahora),
        "errors": list(errors or []),
    }


def clasificar(reglas: list[dict]) -> str:
    """invalid si una obligatoria no cumple; to_check si alguna no es evaluable; si no, valid."""
    obligatorias = [r for r in reglas if r["mandatory"]]
    if any(r["result"] == "no_cumple" for r in obligatorias):
        return "invalid"
    if any(r["result"] == "no_evaluable" for r in obligatorias):
        return "to_check"
    return "valid"


def armar_resultado(
    *,
    id_student: str,
    type_document: str,
    document_version: int,
    extracted_data: dict,
    reglas: list[dict],
    errores: list[str],
    validation_version: str,
    ahora: datetime,
    accion_por_revisar: str = "wait_for_review",
) -> dict:
    """El DocumentValidationResult completo, con la regla de reenvío del contrato."""
    clasificacion = clasificar(reglas)
    if clasificacion == "invalid":
        primera = next(r for r in reglas if r["mandatory"] and r["result"] == "no_cumple")
        reenvio = {
            "resubmission_allowed": True,
            "required_action": "upload_new_version",
            "resubmission_reason": primera["message"],
        }
    else:
        reenvio = {
            "resubmission_allowed": False,
            "required_action": accion_por_revisar if clasificacion == "to_check" else "none",
            "resubmission_reason": None,
        }
    return {
        "id_student": id_student,
        "type_document": type_document,
        "document_version": document_version,
        "extracted_data": extracted_data,
        "rules": reglas,
        "errors": list(errores),
        "document_classification": clasificacion,
        "validation_status": "completed",
        **reenvio,
        "validation_version": validation_version,
        "timestamp": _fecha(ahora),
    }
