"""validar_estampilla de punta a punta, con PDF inventados y una consulta simulada."""

from datetime import datetime

import pytest

from modules.validadores.estampilla import validar_estampilla
from modules.validadores.estampilla.reglas import NO_ENCONTRADO
from modules.validadores.resultado import BOGOTA

AHORA = datetime(2026, 1, 20, 9, 30, tzinfo=BOGOTA)


def validar(contenido, consultar_registro):
    return validar_estampilla(
        contenido, id_student="T000000001", document_version=1, ahora=AHORA, consultar_registro=consultar_registro
    )


def no_debe_consultar(numero, version):
    raise AssertionError("no debía consultar a la Gobernación")


def test_valido(texto_certificado, crear_pdf, registro_oficial, validar_esquema):
    consultados = []

    def consultar(numero, version):
        consultados.append((numero, version))
        return registro_oficial()

    resultado = validar(crear_pdf(texto_certificado), consultar)
    validar_esquema(resultado)
    assert resultado["document_classification"] == "valid"
    assert resultado["required_action"] == "none"
    assert consultados == [("000000000001", 1)]


def test_no_consultado_espera_validacion_externa(texto_certificado, crear_pdf, validar_esquema):
    resultado = validar(crear_pdf(texto_certificado), None)
    validar_esquema(resultado)
    assert resultado["document_classification"] == "to_check"
    assert resultado["required_action"] == "wait_for_external_validation"


def test_no_encontrado_no_valido(texto_certificado, crear_pdf, registro_oficial, validar_esquema):
    no_encontrado = registro_oficial(estado_consulta="no_encontrado", resultado="no_cumple", pagado=None)
    resultado = validar(crear_pdf(texto_certificado), lambda numero, version: no_encontrado)
    validar_esquema(resultado)
    assert resultado["document_classification"] == "invalid"
    assert resultado["required_action"] == "upload_new_version"
    assert resultado["resubmission_reason"] == NO_ENCONTRADO


def test_no_coincide_por_revisar(texto_certificado, crear_pdf, registro_oficial, validar_esquema):
    otra_fecha = registro_oficial(fecha_pago="2026-01-16")
    resultado = validar(crear_pdf(texto_certificado), lambda numero, version: otra_fecha)
    validar_esquema(resultado)
    assert resultado["document_classification"] == "to_check"
    assert resultado["required_action"] == "wait_for_review"


@pytest.mark.parametrize("contenido", [b"", b"basura"])
def test_danado_por_revisar(contenido, validar_esquema):
    resultado = validar(contenido, no_debe_consultar)
    validar_esquema(resultado)
    assert resultado["document_classification"] == "to_check"
    assert resultado["required_action"] == "wait_for_review"
    assert any("vacío o dañado" in error for error in resultado["errors"])


def test_tipo_version_y_entradas_invalidas():
    resultado = validar(b"", None)
    assert resultado["type_document"] == "estampilla_pro_cultura"
    assert resultado["validation_version"] == "estampilla_pro_cultura@1.0.0"
    for id_student, version in [("", 1), (" T1", 1), ("T1", 0)]:
        with pytest.raises(ValueError):
            validar_estampilla(b"", id_student=id_student, document_version=version, consultar_registro=None)
