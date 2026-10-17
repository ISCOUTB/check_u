from datetime import datetime

import pytest

from modules.validadores.cedula import validar_cedula
from modules.validadores.fuentes.rui import RespuestaRui
from modules.validadores.resultado import BOGOTA

AHORA = datetime(2026, 10, 17, 9, 30, tzinfo=BOGOTA)
NOMBRE_PNG = "ESTEBAN ALBERTO RODRIGUEZ HERNANDEZ"


def rui_responde(estado, nombre=None):
    llamadas = []

    def consultar(numero):
        llamadas.append(numero)
        return RespuestaRui(estado, nombre, "simulado")

    consultar.llamadas = llamadas
    return consultar


def rui_prohibido(_numero):
    pytest.fail("no debía consultar el RUI")


def reglas(resultado):
    return {r["rule"]: r for r in resultado["rules"]}


def test_png_valida(requiere_tesseract, png, validar_esquema):
    consultar = rui_responde("encontrado", NOMBRE_PNG)
    resultado = validar_cedula(png, id_student="T00012345", document_version=1, ahora=AHORA, consultar=consultar)
    validar_esquema(resultado)
    assert resultado["document_classification"] == "valid"
    assert resultado["required_action"] == "none"
    assert reglas(resultado)["rui_name_match"]["result"] == "cumple"
    assert consultar.llamadas == ["79937877"]


def test_png_rui_caido_sigue_valida(requiere_tesseract, png, validar_esquema):
    resultado = validar_cedula(
        png, id_student="T00012345", document_version=1, ahora=AHORA, consultar=rui_responde("sin_respuesta")
    )
    validar_esquema(resultado)
    assert resultado["document_classification"] == "valid"
    assert reglas(resultado)["rui_name_match"]["no_evaluable_reason"] == "source_unavailable"


def test_pdf_escaneado_por_revisar(requiere_tesseract, pdf_escaneado, validar_esquema):
    resultado = validar_cedula(
        pdf_escaneado, id_student="T00012345", document_version=1, ahora=AHORA, consultar=rui_prohibido
    )
    validar_esquema(resultado)
    assert resultado["document_classification"] == "to_check"
    assert resultado["required_action"] == "wait_for_review"
    assert reglas(resultado)["machine_readable_code"]["result"] == "no_evaluable"


def test_paz_y_salvo_no_es_cedula(requiere_tesseract, paz_y_salvo, validar_esquema):
    resultado = validar_cedula(
        paz_y_salvo, id_student="T00012345", document_version=1, ahora=AHORA, consultar=rui_prohibido
    )
    validar_esquema(resultado)
    assert resultado["document_classification"] == "invalid"
    assert resultado["required_action"] == "upload_new_version"
    assert resultado["resubmission_reason"].startswith("El archivo no es una cédula.")


@pytest.mark.parametrize("contenido", [b"", b"basura"])
def test_bytes_vacios(contenido, validar_esquema):
    resultado = validar_cedula(contenido, id_student="T00012345", document_version=1, ahora=AHORA, consultar=rui_prohibido)
    validar_esquema(resultado)
    assert resultado["document_classification"] == "to_check"
    assert any("vacío o dañado" in error for error in resultado["errors"])


def test_id_y_version():
    resultado = validar_cedula(b"", id_student="T00012345", document_version=2, ahora=AHORA, consultar=rui_prohibido)
    assert resultado["type_document"] == "identification"
    assert resultado["validation_version"] == "cedula@1.0.0"
    assert resultado["document_version"] == 2
    for id_student, version in [("", 1), (" T1", 1), ("T00012345", 0)]:
        with pytest.raises(ValueError):
            validar_cedula(b"", id_student=id_student, document_version=version)
