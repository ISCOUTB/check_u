"""Pruebas del validador academic_evaluation (Tarea 32)."""

from __future__ import annotations

import pytest

from modules.malla_curricular.tests.conftest import crear_pdf_banner
from modules.validadores.academic_evaluation import validar_academic_evaluation


def _validar(contenido: bytes) -> dict:
    return validar_academic_evaluation(
        contenido,
        id_student="T00012345",
        document_version=1,
    )


def test_banner_cumple_clasifica_valid():
    pdf = crear_pdf_banner()
    resultado = _validar(pdf)

    assert resultado["type_document"] == "academic_evaluation"
    assert resultado["document_classification"] == "valid"
    assert resultado["validation_status"] == "completed"
    assert resultado["extracted_data"]["code_student"]["value"] == "T00063198"
    assert resultado["extracted_data"]["general_result"]["value"] == "cumple"

    reglas = {r["rule"]: r["result"] for r in resultado["rules"]}
    assert reglas["academic_evaluation_document"] == "cumple"
    assert reglas["required_fields_present"] == "cumple"
    assert reglas["curriculum_compliance"] == "cumple"


def test_banner_no_cumple_clasifica_invalid():
    pdf = crear_pdf_banner(
        max_creditos=160,
        creditos_aprobados=157,
        periodos=[
            {
                "periodo": "2024-1",
                "cumple": "No",
                "total": 16,
                "aprobados": 13,
                "faltantes": 3,
            },
            {
                "periodo": "2024-2",
                "cumple": "Sí",
                "total": 16,
                "aprobados": 16,
                "faltantes": 0,
            },
        ],
    )
    resultado = _validar(pdf)

    assert resultado["document_classification"] == "invalid"
    assert resultado["resubmission_allowed"] is True
    assert resultado["required_action"] == "upload_new_version"

    reglas = {r["rule"]: r["result"] for r in resultado["rules"]}
    assert reglas["academic_evaluation_document"] == "cumple"
    assert reglas["curriculum_compliance"] == "no_cumple"


def test_pdf_vacio_no_inventa_cumple():
    resultado = _validar(b"")

    assert resultado["document_classification"] in ("invalid", "to_check")
    assert all(r["result"] != "cumple" for r in resultado["rules"] if r["mandatory"])


def test_pdf_no_banner_no_inventa_cumple():
    # PDF mínimo con texto que no es Banner
    basura = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"
    resultado = _validar(basura)

    assert resultado["document_classification"] in ("invalid", "to_check")
    reglas = {r["rule"]: r for r in resultado["rules"]}
    assert reglas["academic_evaluation_document"]["result"] in (
        "no_cumple",
        "no_evaluable",
    )


def test_id_student_invalido_lanza():
    with pytest.raises(ValueError, match="id_student"):
        validar_academic_evaluation(
            crear_pdf_banner(),
            id_student="  ",
            document_version=1,
        )


def test_document_version_invalida_lanza():
    with pytest.raises(ValueError, match="document_version"):
        validar_academic_evaluation(
            crear_pdf_banner(),
            id_student="T00012345",
            document_version=0,
        )