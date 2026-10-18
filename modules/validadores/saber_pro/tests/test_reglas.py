"""Reglas de Saber Pro con datos en memoria: no se crea ningún documento."""

from datetime import datetime, timezone

import pytest

from modules.validadores.resultado import BOGOTA
from modules.validadores.saber_pro.extraccion import CAMPOS, ExtraccionSaberPro
from modules.validadores.saber_pro.firma import EstadoFirma
from modules.validadores.saber_pro.reglas import PUNTAJE_MINIMO, VERSION, evaluar

AHORA = datetime(2026, 10, 17, 9, 30, tzinfo=BOGOTA)
VENCIO = datetime(2025, 12, 2, 19, 51, 18, tzinfo=timezone.utc)
ICFES = "INSTITUTO COLOMBIANO PARA LA EVALUACION DE LA EDUCACION ICFES"

DATOS = {
    "full_name": "Ana María Prueba Núñez",
    "identification_type": "C.C.",
    "identification_number": "1000000001",
    "registration_number": "EK202600000001",
    "exam_date": "2026-04-26",
    "global_score": 150,
}

FIRMA_BUENA = EstadoFirma("presente", True, ICFES, True, "valido", None, None)

OBLIGATORIAS = ["saber_pro_report", "required_fields_present", "global_score_minimum", "icfes_signature_intact"]


def extraccion(es_reporte=True, tiene_texto=True, **cambios) -> ExtraccionSaberPro:
    valores = {**DATOS, **cambios}
    datos = {
        campo: {"value": valores[campo], "confidence": None if valores[campo] is None else 1.0} for campo in CAMPOS
    }
    return ExtraccionSaberPro(tiene_texto, es_reporte, datos, [])


def por_regla(reglas: list[dict]) -> dict:
    return {r["rule"]: r for r in reglas}


def test_version_y_minimo():
    assert VERSION == "saber_pro@1.0.0"
    assert PUNTAJE_MINIMO == 100


def test_reporte_valido_todo_cumple():
    reglas = evaluar(extraccion(), FIRMA_BUENA, ahora=AHORA)
    assert [r["rule"] for r in reglas] == OBLIGATORIAS + ["icfes_certificate_valid"]
    assert [r["mandatory"] for r in reglas] == [True, True, True, True, False]
    assert all(r["result"] == "cumple" for r in reglas)


@pytest.mark.parametrize(("puntaje", "resultado"), [(99, "no_cumple"), (100, "cumple"), (300, "cumple")])
def test_puntaje_99_100_300(puntaje, resultado):
    regla = por_regla(evaluar(extraccion(global_score=puntaje), FIRMA_BUENA, ahora=AHORA))["global_score_minimum"]
    assert regla["result"] == resultado
    if resultado == "cumple":
        assert regla["message"] == (
            f"Tu reporte Saber Pro cumple con el puntaje mínimo requerido (puntaje global: {puntaje}; mínimo: 100)."
        )
    else:
        assert regla["message"] == (
            "Tu puntaje global (99) es menor a 100. Si vuelves a presentar el examen, sube el nuevo reporte."
        )


def test_minimo_configurable():
    regla = por_regla(evaluar(extraccion(global_score=149), FIRMA_BUENA, ahora=AHORA, puntaje_minimo=150))
    assert regla["global_score_minimum"]["result"] == "no_cumple"
    assert "150" in regla["global_score_minimum"]["message"]


def test_puntaje_ausente_no_evaluable():
    regla = por_regla(evaluar(extraccion(global_score=None), FIRMA_BUENA, ahora=AHORA))["global_score_minimum"]
    assert (regla["result"], regla["no_evaluable_reason"]) == ("no_evaluable", "low_confidence")


@pytest.mark.parametrize("campo", ["full_name", "identification_number", "registration_number", "exam_date"])
def test_campo_obligatorio_ausente(campo):
    regla = por_regla(evaluar(extraccion(**{campo: None}), FIRMA_BUENA, ahora=AHORA))["required_fields_present"]
    assert (regla["result"], regla["no_evaluable_reason"]) == ("no_evaluable", "low_confidence")
    assert campo in regla["message"] or campo in " ".join(regla["errors"])


def test_no_es_reporte():
    reglas = por_regla(evaluar(extraccion(es_reporte=False), FIRMA_BUENA, ahora=AHORA))
    assert reglas["saber_pro_report"]["result"] == "no_cumple"
    assert reglas["saber_pro_report"]["message"] == (
        "El archivo no es un reporte de resultados Saber Pro. Sube el PDF descargado de icfes.gov.co."
    )
    for nombre in OBLIGATORIAS[1:] + ["icfes_certificate_valid"]:
        assert (reglas[nombre]["result"], reglas[nombre]["no_evaluable_reason"]) == (
            "no_evaluable",
            "missing_dependency",
        ), nombre


@pytest.mark.parametrize("tiene_texto", [True, False])
def test_ilegible(tiene_texto):
    reglas = por_regla(evaluar(extraccion(es_reporte=None, tiene_texto=tiene_texto), FIRMA_BUENA, ahora=AHORA))
    assert (reglas["saber_pro_report"]["result"], reglas["saber_pro_report"]["no_evaluable_reason"]) == (
        "no_evaluable",
        "low_confidence",
    )
    for nombre in OBLIGATORIAS[1:] + ["icfes_certificate_valid"]:
        assert reglas[nombre]["no_evaluable_reason"] == "missing_dependency", nombre


@pytest.mark.parametrize(
    ("firma", "resultado", "motivo", "mensaje"),
    [
        (FIRMA_BUENA, "cumple", None, None),
        (
            EstadoFirma("presente", False, ICFES, True, "valido", None, None),
            "no_cumple",
            None,
            "El reporte fue modificado después de que el ICFES lo firmó. "
            "Sube el PDF original descargado de icfes.gov.co.",
        ),
        (
            EstadoFirma("presente", True, "Biblioteca", False, "no_confiable", None, None),
            "no_cumple",
            None,
            "El reporte no está firmado por el ICFES (firmante: Biblioteca).",
        ),
        (
            EstadoFirma("no_verificable", None, None, None, None, None, None),
            "no_evaluable",
            "low_confidence",
            "La firma del ICFES no se puede verificar: el archivo fue guardado de nuevo después de descargarlo.",
        ),
        (
            EstadoFirma("ausente", None, None, None, None, None, None),
            "no_evaluable",
            "low_confidence",
            "El PDF no tiene la firma digital del ICFES.",
        ),
    ],
)
def test_firma(firma, resultado, motivo, mensaje):
    regla = por_regla(evaluar(extraccion(), firma, ahora=AHORA))["icfes_signature_intact"]
    assert (regla["result"], regla["no_evaluable_reason"]) == (resultado, motivo)
    if mensaje:
        assert regla["message"] == mensaje


@pytest.mark.parametrize(
    ("certificado", "presencia", "resultado", "motivo"),
    [
        ("valido", "presente", "cumple", None),
        ("vencido", "presente", "no_cumple", None),
        ("revocado", "presente", "no_cumple", None),
        ("no_confiable", "presente", "no_cumple", None),
        ("sin_respuesta", "presente", "no_evaluable", "source_unavailable"),
        ("desconocido", "presente", "no_evaluable", "low_confidence"),
        (None, "no_verificable", "no_evaluable", "missing_dependency"),
        (None, "ausente", "no_evaluable", "missing_dependency"),
    ],
)
def test_certificado(certificado, presencia, resultado, motivo):
    intacta = True if presencia == "presente" else None
    firma = EstadoFirma(presencia, intacta, ICFES, True if intacta else None, certificado, VENCIO, None)
    regla = por_regla(evaluar(extraccion(), firma, ahora=AHORA))["icfes_certificate_valid"]
    assert (regla["result"], regla["no_evaluable_reason"]) == (resultado, motivo)
    assert regla["mandatory"] is False
    if certificado == "vencido":
        assert regla["message"] == (
            "El certificado con el que firmó el ICFES estaba vencido al firmar (venció el 02/12/2025)."
        )


def test_reglas_cumplen_el_contrato(validar_esquema):
    casos = [
        (extraccion(), FIRMA_BUENA),
        (extraccion(global_score=99), EstadoFirma("ausente", None, None, None, None, None, None)),
        (extraccion(es_reporte=False), FIRMA_BUENA),
        (extraccion(es_reporte=None, tiene_texto=False), FIRMA_BUENA),
        (extraccion(full_name=None), EstadoFirma("presente", True, ICFES, True, "sin_respuesta", VENCIO, None)),
    ]
    for datos, firma in casos:
        for regla in evaluar(datos, firma, ahora=AHORA):
            validar_esquema(regla, "rule-evaluation")
