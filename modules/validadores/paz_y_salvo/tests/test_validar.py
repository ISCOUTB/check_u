from datetime import datetime

import pytest

from modules.validadores.paz_y_salvo import validar_paz_y_salvo
from modules.validadores.resultado import BOGOTA

AHORA = datetime(2026, 10, 21, 9, 30, tzinfo=BOGOTA)


def validar(contenido, **extra):
    return validar_paz_y_salvo(contenido, id_student="T000123123", document_version=1, ahora=AHORA, **extra)


def reglas(resultado):
    return {r["rule"]: r for r in resultado["rules"]}


def test_sin_firma_por_revisar(sin_firma, validar_esquema):
    resultado = validar(sin_firma)
    validar_esquema(resultado)
    assert resultado["document_classification"] == "to_check"
    assert resultado["required_action"] == "wait_for_review"
    assert reglas(resultado)["library_signature_intact"]["result"] == "no_evaluable"
    assert {k: v["value"] for k, v in resultado["extracted_data"].items()} == {
        "full_name": "ANDRES BELTRAN MENECES",
        "code_student": "T000123123",
    }


def test_firmado_por_revisar(firmado, validar_esquema):
    # Ninguna firma aprueba sola: la Biblioteca no firma digitalmente sus Paz y Salvo reales y su
    # certificado no se puede confirmar, así que una firma "de la Biblioteca" podría ser falsa.
    resultado = validar(firmado)
    validar_esquema(resultado)
    assert resultado["document_classification"] == "to_check"
    assert resultado["required_action"] == "wait_for_review"
    assert reglas(resultado)["library_signature_intact"]["result"] == "no_evaluable"


def test_modificado_no_valido(modificado, validar_esquema):
    resultado = validar(modificado)
    validar_esquema(resultado)
    assert resultado["document_classification"] == "invalid"
    assert resultado["required_action"] == "upload_new_version"
    assert resultado["resubmission_reason"].startswith("El Paz y Salvo fue modificado")


@pytest.mark.parametrize("contenido", [b"", b"basura"])
def test_vacio_por_revisar(contenido, validar_esquema):
    resultado = validar(contenido)
    validar_esquema(resultado)
    assert resultado["document_classification"] == "to_check"
    assert any("vacío o dañado" in error for error in resultado["errors"])


def test_tipo_y_version():
    resultado = validar(b"")
    assert resultado["type_document"] == "paz_y_salvo_bib"
    assert resultado["validation_version"] == "paz_y_salvo_bib@1.0.0"
    for id_student, version in [("", 1), (" T1", 1), ("T1", 0)]:
        with pytest.raises(ValueError):
            validar_paz_y_salvo(b"", id_student=id_student, document_version=version)
