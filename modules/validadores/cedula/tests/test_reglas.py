"""Reglas de la cédula, en memoria (nombres y números inventados)."""

from dataclasses import replace
from datetime import datetime

import pytest

from modules.validadores.cedula.calidad import Calidad
from modules.validadores.cedula.extraccion import CAMPOS, ExtraccionCedula
from modules.validadores.cedula.reglas import UMBRAL_CONFIANZA, VERSION, evaluar
from modules.validadores.fuentes.rui import RespuestaRui
from modules.validadores.resultado import BOGOTA

AHORA = datetime(2026, 10, 17, 9, 30, tzinfo=BOGOTA)
NOMBRE = "ANA MARIA PRUEBA NUNEZ"
BUENA = [Calidad(1200, 500.0)]
RUI_IGUAL = RespuestaRui("encontrado", NOMBRE, "")
OBLIGATORIAS = ["identification_document", "required_fields_present", "machine_readable_code"]
INFORMATIVAS = ["image_quality", "rui_name_match"]


def extraccion(formato="amarilla_hologramas", es_cedula=True, codigo_leido=True, confianza=1.0, **valores):
    base = {
        "full_name": NOMBRE,
        "identification_type": "C.C." if formato != "extranjeria" else "C.E.",
        "identification_number": "1000000001",
        "birth_date": "1978-04-03",
        "sex": "F",
        **valores,
    }
    datos = {
        campo: {"value": base[campo], "confidence": None if base[campo] is None else confianza} for campo in CAMPOS
    }
    return ExtraccionCedula(es_cedula is not None, es_cedula, formato, codigo_leido, datos, [])


def por_regla(reglas):
    return {r["rule"]: r for r in reglas}


def test_version_y_umbral():
    assert VERSION == "cedula@1.0.0"
    assert UMBRAL_CONFIANZA == 0.8


def test_cedula_completa_todo_cumple():
    reglas = evaluar(extraccion(), BUENA, RUI_IGUAL, ahora=AHORA)
    assert [r["rule"] for r in reglas] == OBLIGATORIAS + INFORMATIVAS
    assert [r["mandatory"] for r in reglas] == [True, True, True, False, False]
    assert all(r["result"] == "cumple" for r in reglas)
    assert por_regla(reglas)["identification_document"]["message"] == "Se leyó la cédula: Cédula amarilla con hologramas."


def test_no_es_cedula():
    reglas = por_regla(evaluar(extraccion(formato=None, es_cedula=False), BUENA, None, ahora=AHORA))
    assert reglas["identification_document"]["result"] == "no_cumple"
    assert reglas["identification_document"]["message"] == (
        "El archivo no es una cédula. Sube una foto o un PDF de tu cédula por ambas caras."
    )
    for nombre in OBLIGATORIAS[1:] + INFORMATIVAS:
        assert reglas[nombre]["no_evaluable_reason"] == "missing_dependency", nombre


def test_no_reconocida_con_mala_imagen_queda_por_revisar():
    # Una cédula real escaneada en baja resolución puede no dejar palabras reconocibles: con mala
    # imagen no se puede afirmar que no sea una cédula.
    mala = [Calidad(400, 50.0)]
    reglas = por_regla(evaluar(extraccion(formato=None, es_cedula=False), mala, None, ahora=AHORA))
    documento = reglas["identification_document"]
    assert (documento["result"], documento["no_evaluable_reason"]) == ("no_evaluable", "low_confidence")
    assert "baja calidad" in documento["message"]


def test_ilegible():
    reglas = por_regla(evaluar(extraccion(formato=None, es_cedula=None), [], None, ahora=AHORA))
    assert (reglas["identification_document"]["result"], reglas["identification_document"]["no_evaluable_reason"]) == (
        "no_evaluable",
        "low_confidence",
    )
    for nombre in OBLIGATORIAS[1:] + INFORMATIVAS:
        assert reglas[nombre]["no_evaluable_reason"] == "missing_dependency", nombre


@pytest.mark.parametrize(("confianza", "resultado"), [(0.79, "no_evaluable"), (0.8, "cumple")])
def test_dato_bajo_umbral(confianza, resultado):
    regla = por_regla(evaluar(extraccion(confianza=confianza), BUENA, RUI_IGUAL, ahora=AHORA))["required_fields_present"]
    assert regla["result"] == resultado
    if resultado == "no_evaluable":
        assert regla["no_evaluable_reason"] == "low_confidence"
        assert "número de identificación" in regla["message"]


def test_dato_ausente():
    regla = por_regla(evaluar(extraccion(full_name=None), BUENA, None, ahora=AHORA))["required_fields_present"]
    assert regla["result"] == "no_evaluable"
    assert "nombre" in regla["message"]
    assert "full_name" in regla["errors"]


def test_codigo_no_leido():
    regla = por_regla(evaluar(extraccion(codigo_leido=False), BUENA, RUI_IGUAL, ahora=AHORA))["machine_readable_code"]
    assert (regla["result"], regla["no_evaluable_reason"]) == ("no_evaluable", "low_confidence")
    assert regla["message"] == "No se pudo leer el código de la cédula (MRZ o PDF417); un funcionario la revisará."


def test_codigo_leido_digital_y_amarilla():
    digital = por_regla(evaluar(extraccion(formato="digital"), BUENA, RUI_IGUAL, ahora=AHORA))
    assert digital["machine_readable_code"]["result"] == "cumple"
    assert "MRZ" in digital["machine_readable_code"]["message"]
    amarilla = por_regla(evaluar(extraccion(), BUENA, RUI_IGUAL, ahora=AHORA))
    assert "PDF417" in amarilla["machine_readable_code"]["message"]


def test_calidad():
    baja = por_regla(evaluar(extraccion(), [Calidad(800, 50.5)], RUI_IGUAL, ahora=AHORA))["image_quality"]
    assert (baja["result"], baja["mandatory"]) == ("no_cumple", False)
    assert "800" in baja["message"] and "50" in baja["message"]

    buena = por_regla(evaluar(extraccion(), [Calidad(1200, 500.0), Calidad(1000, 100.0)], RUI_IGUAL, ahora=AHORA))
    assert buena["image_quality"]["result"] == "cumple"

    sin_paginas = por_regla(evaluar(extraccion(), [], RUI_IGUAL, ahora=AHORA))["image_quality"]
    assert sin_paginas["no_evaluable_reason"] == "missing_dependency"


@pytest.mark.parametrize(
    ("rui", "formato", "resultado", "motivo"),
    [
        (RUI_IGUAL, "amarilla_hologramas", "cumple", None),
        (RespuestaRui("encontrado", "PEDRO PEREZ GOMEZ", ""), "amarilla_hologramas", "no_cumple", None),
        (RespuestaRui("sin_respuesta", None, ""), "amarilla_hologramas", "no_evaluable", "source_unavailable"),
        (RespuestaRui("sin_registro", None, ""), "amarilla_hologramas", "no_evaluable", "source_unavailable"),
        (None, "extranjeria", "no_evaluable", "source_pending"),
        (None, "amarilla_hologramas", "no_evaluable", "missing_dependency"),
    ],
)
def test_rui(rui, formato, resultado, motivo):
    regla = por_regla(evaluar(extraccion(formato=formato), BUENA, rui, ahora=AHORA))["rui_name_match"]
    assert (regla["result"], regla["no_evaluable_reason"], regla["mandatory"]) == (resultado, motivo, False)
    if resultado == "no_cumple":
        assert "%" in regla["message"]


def test_umbral_rui_configurable():
    casi = RespuestaRui("encontrado", "ANA MARIA PRUEBA NUNES", "")
    assert por_regla(evaluar(extraccion(), BUENA, casi, ahora=AHORA))["rui_name_match"]["result"] == "cumple"
    estricto = por_regla(evaluar(extraccion(), BUENA, casi, ahora=AHORA, umbral_rui=99.9))
    assert estricto["rui_name_match"]["result"] == "no_cumple"


def test_reglas_cumplen_el_contrato(validar_esquema):
    casos = [
        (extraccion(), BUENA, RUI_IGUAL),
        (extraccion(formato=None, es_cedula=False), [], None),
        (extraccion(formato=None, es_cedula=None), [], None),
        (extraccion(confianza=0.5, codigo_leido=False), [Calidad(10, 1.0)], RespuestaRui("sin_respuesta", None, "")),
        (replace(extraccion(formato="extranjeria"), codigo_leido=False), BUENA, None),
    ]
    for datos, calidades, rui in casos:
        for regla in evaluar(datos, calidades, rui, ahora=AHORA):
            validar_esquema(regla, "rule-evaluation")
