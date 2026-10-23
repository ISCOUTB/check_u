"""Reglas del Paz y Salvo, en memoria (estudiante inventado)."""

from datetime import datetime

import pytest

from modules.validadores.paz_y_salvo.extraccion import ExtraccionPazYSalvo
from modules.validadores.paz_y_salvo.firma import FirmaBiblioteca
from modules.validadores.paz_y_salvo.reglas import VERSION, evaluar
from modules.validadores.resultado import BOGOTA, armar_resultado

AHORA = datetime(2026, 10, 21, 9, 30, tzinfo=BOGOTA)
ORDEN = ["paz_y_salvo_document", "required_fields_present", "clearance_status", "library_signature_intact"]
FIRMA_BUENA = FirmaBiblioteca("presente", True, "Biblioteca", True)


def extraccion(es_paz_y_salvo=True, estado="paz_y_salvo", nombre="ANA PRUEBA", codigo="T000000001", tiene_texto=True):
    datos = {
        "full_name": {"value": nombre, "confidence": None if nombre is None else 1.0},
        "code_student": {"value": codigo, "confidence": None if codigo is None else 1.0},
    }
    return ExtraccionPazYSalvo(tiene_texto, es_paz_y_salvo, estado, datos, [])


def por_regla(reglas):
    return {r["rule"]: r for r in reglas}


def test_version():
    assert VERSION == "paz_y_salvo_bib@1.0.0"


def test_texto_correcto_y_firma_de_la_biblioteca_queda_por_revisar():
    # Decisión de Héctor (23/10/2026): ninguna firma aprueba sola. Los Paz y Salvo reales no traen
    # firma digital y el certificado de la Biblioteca no se puede confirmar.
    reglas = evaluar(extraccion(), FIRMA_BUENA, ahora=AHORA)
    assert [r["rule"] for r in reglas] == ORDEN
    assert all(r["mandatory"] for r in reglas)
    assert [r["result"] for r in reglas] == ["cumple", "cumple", "cumple", "no_evaluable"]
    resultado = armar_resultado(
        id_student="T000000001",
        type_document="paz_y_salvo_bib",
        document_version=1,
        extracted_data=extraccion().datos,
        reglas=reglas,
        errores=[],
        validation_version=VERSION,
        ahora=AHORA,
    )
    assert resultado["document_classification"] == "to_check"


def test_no_es_paz_y_salvo():
    reglas = por_regla(evaluar(extraccion(es_paz_y_salvo=False), FIRMA_BUENA, ahora=AHORA))
    assert reglas["paz_y_salvo_document"]["result"] == "no_cumple"
    assert reglas["paz_y_salvo_document"]["message"] == (
        "El archivo no es un Paz y Salvo de la Biblioteca. Sube el Paz y Salvo que te entregó la Biblioteca."
    )
    for nombre in ORDEN[1:]:
        assert reglas[nombre]["no_evaluable_reason"] == "missing_dependency", nombre


def test_sin_texto():
    reglas = por_regla(evaluar(extraccion(es_paz_y_salvo=None, tiene_texto=False), FIRMA_BUENA, ahora=AHORA))
    documento = reglas["paz_y_salvo_document"]
    assert (documento["result"], documento["no_evaluable_reason"]) == ("no_evaluable", "low_confidence")
    for nombre in ORDEN[1:]:
        assert reglas[nombre]["no_evaluable_reason"] == "missing_dependency", nombre


@pytest.mark.parametrize("campo", ["nombre", "codigo"])
def test_campo_ausente(campo):
    regla = por_regla(evaluar(extraccion(**{campo: None}), FIRMA_BUENA, ahora=AHORA))["required_fields_present"]
    assert (regla["result"], regla["no_evaluable_reason"]) == ("no_evaluable", "low_confidence")


@pytest.mark.parametrize(
    ("estado", "resultado", "motivo"),
    [("paz_y_salvo", "cumple", None), ("no_paz_y_salvo", "no_cumple", None), (None, "no_evaluable", "low_confidence")],
)
def test_estado(estado, resultado, motivo):
    regla = por_regla(evaluar(extraccion(estado=estado), FIRMA_BUENA, ahora=AHORA))["clearance_status"]
    assert (regla["result"], regla["no_evaluable_reason"]) == (resultado, motivo)
    if resultado == "no_cumple":
        assert regla["message"] == (
            "La Biblioteca indica que no estás a paz y salvo. Resuelve tus pendientes y sube un nuevo Paz y Salvo."
        )


@pytest.mark.parametrize(
    ("firma", "resultado", "mensaje"),
    [
        (
            FIRMA_BUENA,
            "no_evaluable",
            "El Paz y Salvo tiene una firma a nombre de la Biblioteca (Biblioteca), pero su certificado no "
            "se puede confirmar; un funcionario lo revisará.",
        ),
        (
            FirmaBiblioteca("presente", False, "Biblioteca", True),
            "no_cumple",
            "El Paz y Salvo fue modificado después de que la Biblioteca lo firmó. "
            "Sube el original que te entregó la Biblioteca.",
        ),
        (
            FirmaBiblioteca("presente", True, "Notaría Primera", False),
            "no_cumple",
            "El Paz y Salvo no está firmado por la Biblioteca (firmante: Notaría Primera).",
        ),
        (FirmaBiblioteca("ausente", None, None, None), "no_evaluable", None),
        (FirmaBiblioteca("no_verificable", None, None, None), "no_evaluable", None),
    ],
)
def test_firma(firma, resultado, mensaje):
    regla = por_regla(evaluar(extraccion(), firma, ahora=AHORA))["library_signature_intact"]
    assert regla["result"] == resultado
    if resultado == "no_evaluable":
        assert regla["no_evaluable_reason"] == "low_confidence"
    if mensaje:
        assert regla["message"] == mensaje


def test_sin_firma_y_no_verificable_dicen_cosas_distintas():
    ausente = por_regla(evaluar(extraccion(), FirmaBiblioteca("ausente", None, None, None), ahora=AHORA))
    copia = por_regla(evaluar(extraccion(), FirmaBiblioteca("no_verificable", None, None, None), ahora=AHORA))
    assert ausente["library_signature_intact"]["message"] != copia["library_signature_intact"]["message"]


def test_varias_fallas_a_la_vez():
    reglas = evaluar(
        extraccion(estado="no_paz_y_salvo"), FirmaBiblioteca("presente", False, "Biblioteca", True), ahora=AHORA
    )
    resultados = por_regla(reglas)
    assert resultados["clearance_status"]["result"] == "no_cumple"
    assert resultados["library_signature_intact"]["result"] == "no_cumple"
    resultado = armar_resultado(
        id_student="T000000001",
        type_document="paz_y_salvo_bib",
        document_version=1,
        extracted_data=extraccion().datos,
        reglas=reglas,
        errores=[],
        validation_version=VERSION,
        ahora=AHORA,
    )
    assert resultado["document_classification"] == "invalid"
    assert resultado["resubmission_reason"] == resultados["clearance_status"]["message"]


def test_reglas_cumplen_el_contrato(validar_esquema):
    casos = [
        (extraccion(), FIRMA_BUENA),
        (extraccion(es_paz_y_salvo=False), FIRMA_BUENA),
        (extraccion(estado=None, nombre=None), FirmaBiblioteca("no_verificable", None, None, None)),
        (extraccion(estado="no_paz_y_salvo"), FirmaBiblioteca("presente", True, "X", False)),
    ]
    for datos, firma in casos:
        for regla in evaluar(datos, firma, ahora=AHORA):
            validar_esquema(regla, "rule-evaluation")
