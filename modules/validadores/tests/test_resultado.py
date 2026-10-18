from datetime import datetime

import pytest

from modules.validadores.resultado import (
    BOGOTA,
    armar_resultado,
    clasificar,
    evaluacion,
)

AHORA = datetime(2026, 10, 17, 9, 30, tzinfo=BOGOTA)


def regla(nombre, resultado, obligatoria=True, motivo=None, mensaje=None):
    return evaluacion(
        nombre,
        resultado,
        mandatory=obligatoria,
        message=mensaje or f"{nombre}: {resultado}",
        motivo=motivo,
        ahora=AHORA,
    )


def armar(reglas, **extra):
    return armar_resultado(
        id_student="9900112233",
        type_document="saber_pro",
        document_version=1,
        extracted_data={"global_score": {"value": 150, "confidence": 1.0}},
        reglas=reglas,
        errores=[],
        validation_version="saber_pro@1.0.0",
        ahora=AHORA,
        **extra,
    )


def test_evaluacion_no_evaluable_exige_motivo():
    with pytest.raises(ValueError):
        regla("r", "no_evaluable")
    with pytest.raises(ValueError):
        regla("r", "cumple", motivo="low_confidence")


def test_clasificar_todo_cumple_es_valid():
    assert clasificar([regla("a", "cumple"), regla("b", "cumple")]) == "valid"


def test_clasificar_una_obligatoria_no_cumple_es_invalid():
    assert clasificar([regla("a", "cumple"), regla("b", "no_cumple")]) == "invalid"
    assert (
        clasificar([regla("a", "no_evaluable", motivo="low_confidence"), regla("b", "no_cumple")])
        == "invalid"
    )


def test_clasificar_solo_no_evaluable_es_to_check():
    assert clasificar([regla("a", "cumple"), regla("b", "no_evaluable", motivo="low_confidence")]) == "to_check"


def test_clasificar_ignora_reglas_informativas():
    assert clasificar([regla("a", "cumple"), regla("b", "no_cumple", obligatoria=False)]) == "valid"
    assert (
        clasificar([regla("a", "cumple"), regla("b", "no_evaluable", obligatoria=False, motivo="source_unavailable")])
        == "valid"
    )


def test_invalid_permite_reenvio():
    resultado = armar(
        [
            regla("a", "cumple"),
            regla("b", "no_cumple", mensaje="Primera que falla."),
            regla("c", "no_cumple", mensaje="Segunda que falla."),
        ]
    )
    assert resultado["document_classification"] == "invalid"
    assert resultado["resubmission_allowed"] is True
    assert resultado["required_action"] == "upload_new_version"
    assert resultado["resubmission_reason"] == "Primera que falla."


def test_invalid_toma_la_primera_obligatoria_aunque_antes_falle_una_informativa():
    resultado = armar(
        [
            regla("info", "no_cumple", obligatoria=False, mensaje="Informativa."),
            regla("b", "no_cumple", mensaje="Obligatoria."),
        ]
    )
    assert resultado["resubmission_reason"] == "Obligatoria."


def test_to_check_sin_reenvio():
    reglas = [regla("a", "cumple"), regla("b", "no_evaluable", motivo="low_confidence")]
    resultado = armar(reglas)
    assert resultado["document_classification"] == "to_check"
    assert resultado["resubmission_allowed"] is False
    assert resultado["required_action"] == "wait_for_review"
    assert resultado["resubmission_reason"] is None

    externo = armar(reglas, accion_por_revisar="wait_for_external_validation")
    assert externo["required_action"] == "wait_for_external_validation"


def test_valid_sin_accion():
    resultado = armar([regla("a", "cumple")])
    assert resultado["document_classification"] == "valid"
    assert resultado["resubmission_allowed"] is False
    assert resultado["required_action"] == "none"
    assert resultado["resubmission_reason"] is None


def test_resultado_cumple_el_contrato(validar_esquema):
    casos = [
        [regla("a", "cumple")],
        [regla("a", "no_cumple")],
        [regla("a", "no_evaluable", motivo="low_confidence")],
    ]
    for reglas in casos:
        resultado = armar(reglas)
        validar_esquema(resultado)
        assert resultado["validation_status"] == "completed"
        assert resultado["timestamp"].endswith("-05:00")
        assert resultado["rules"][0]["timestamp"].endswith("-05:00")
