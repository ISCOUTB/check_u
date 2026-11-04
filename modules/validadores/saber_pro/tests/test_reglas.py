"""Reglas de Saber Pro con datos en memoria: no se crea ningún documento."""

from datetime import datetime

import pytest

from modules.validadores.resultado import BOGOTA
from modules.validadores.saber_pro.extraccion import CAMPOS, ExtraccionSaberPro
from modules.validadores.saber_pro.reglas import PUNTAJE_MINIMO, VERSION, evaluar

AHORA = datetime(2026, 10, 17, 9, 30, tzinfo=BOGOTA)

DATOS = {
    "full_name": "Ana María Prueba Núñez",
    "identification_type": "C.C.",
    "identification_number": "1000000001",
    "registration_number": "EK202600000001",
    "exam_date": "2026-04-26",
    "global_score": 150,
}

OBLIGATORIAS = [
    "saber_pro_report",
    "required_fields_present",
    "global_score_minimum",
]


def extraccion(es_reporte=True, tiene_texto=True, **cambios) -> ExtraccionSaberPro:
    valores = {**DATOS, **cambios}
    datos = {
        campo: {
            "value": valores[campo],
            "confidence": None if valores[campo] is None else 1.0,
        }
        for campo in CAMPOS
    }
    return ExtraccionSaberPro(tiene_texto, es_reporte, datos, [])


def por_regla(reglas: list[dict]) -> dict:
    return {r["rule"]: r for r in reglas}


def test_version_y_minimo():
    assert VERSION == "saber_pro@1.1.0"
    assert PUNTAJE_MINIMO == 100


def test_reporte_valido_todo_cumple():
    reglas = evaluar(extraccion(), ahora=AHORA)
    assert [r["rule"] for r in reglas] == OBLIGATORIAS
    assert all(r["mandatory"] is True for r in reglas)
    assert all(r["result"] == "cumple" for r in reglas)


@pytest.mark.parametrize(
    ("puntaje", "resultado"),
    [(99, "no_cumple"), (100, "cumple"), (300, "cumple")],
)
def test_puntaje_99_100_300(puntaje, resultado):
    regla = por_regla(evaluar(extraccion(global_score=puntaje), ahora=AHORA))[
        "global_score_minimum"
    ]
    assert regla["result"] == resultado
    if resultado == "cumple":
        assert regla["message"] == (
            "Tu reporte Saber Pro cumple con el puntaje mínimo requerido "
            f"(puntaje global: {puntaje}; mínimo: 100)."
        )
    else:
        assert regla["message"] == (
            "Tu puntaje global (99) es menor a 100. "
            "Si vuelves a presentar el examen, sube el nuevo reporte."
        )


def test_minimo_configurable():
    regla = por_regla(
        evaluar(extraccion(global_score=149), ahora=AHORA, puntaje_minimo=150)
    )
    assert regla["global_score_minimum"]["result"] == "no_cumple"
    assert "150" in regla["global_score_minimum"]["message"]


def test_puntaje_ausente_no_evaluable():
    regla = por_regla(evaluar(extraccion(global_score=None), ahora=AHORA))[
        "global_score_minimum"
    ]
    assert (regla["result"], regla["no_evaluable_reason"]) == (
        "no_evaluable",
        "low_confidence",
    )


@pytest.mark.parametrize(
    "campo",
    ["full_name", "identification_number", "registration_number", "exam_date"],
)
def test_campo_obligatorio_ausente(campo):
    regla = por_regla(evaluar(extraccion(**{campo: None}), ahora=AHORA))[
        "required_fields_present"
    ]
    assert (regla["result"], regla["no_evaluable_reason"]) == (
        "no_evaluable",
        "low_confidence",
    )
    assert campo in regla["message"] or campo in " ".join(regla["errors"])


def test_no_es_reporte():
    reglas = por_regla(evaluar(extraccion(es_reporte=False), ahora=AHORA))
    assert reglas["saber_pro_report"]["result"] == "no_cumple"
    assert reglas["saber_pro_report"]["message"] == (
        "El archivo no es un reporte de resultados Saber Pro. "
        "Sube el PDF descargado de icfes.gov.co."
    )
    for nombre in OBLIGATORIAS[1:]:
        assert (reglas[nombre]["result"], reglas[nombre]["no_evaluable_reason"]) == (
            "no_evaluable",
            "missing_dependency",
        ), nombre


@pytest.mark.parametrize("tiene_texto", [True, False])
def test_ilegible(tiene_texto):
    reglas = por_regla(
        evaluar(extraccion(es_reporte=None, tiene_texto=tiene_texto), ahora=AHORA)
    )
    assert (
        reglas["saber_pro_report"]["result"],
        reglas["saber_pro_report"]["no_evaluable_reason"],
    ) == ("no_evaluable", "low_confidence")
    for nombre in OBLIGATORIAS[1:]:
        assert reglas[nombre]["no_evaluable_reason"] == "missing_dependency", nombre


def test_reglas_cumplen_el_contrato(validar_esquema):
    casos = [
        extraccion(),
        extraccion(global_score=99),
        extraccion(es_reporte=False),
        extraccion(es_reporte=None, tiene_texto=False),
        extraccion(full_name=None),
    ]
    for datos in casos:
        for regla in evaluar(datos, ahora=AHORA):
            validar_esquema(regla, "rule-evaluation")