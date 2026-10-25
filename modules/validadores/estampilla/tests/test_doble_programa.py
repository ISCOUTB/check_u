"""Doble programa en pregrado: una estampilla por programa, con su document_order (datos inventados)."""

from datetime import datetime

import pytest

from modules.validadores.estampilla import validar_estampilla, validar_estampillas
from modules.validadores.estampilla.reglas import MISMO_RECIBO
from modules.validadores.resultado import BOGOTA

AHORA = datetime(2026, 1, 20, 9, 30, tzinfo=BOGOTA)


@pytest.fixture
def consultar(registro_oficial):
    """La Gobernación encuentra cualquier recibo, pagado y con los datos del certificado inventado."""
    return lambda numero, version: registro_oficial(referencia=numero)


@pytest.fixture
def pdf_con_recibo(texto_certificado, crear_pdf):
    def crear(recibo: str) -> bytes:
        return crear_pdf(texto_certificado.replace("Recibo Oficial: 000000000001", f"Recibo Oficial: {recibo}"))

    return crear


def reglas(resultado):
    return {r["rule"]: r for r in resultado["rules"]}


def validar_dos(contenidos, consultar):
    return validar_estampillas(contenidos, id_student="T000000001", document_version=1, ahora=AHORA, consultar_registro=consultar)


def test_una_estampilla_lleva_document_order(pdf_con_recibo, consultar, validar_esquema):
    contenido = pdf_con_recibo("000000000001")
    primera = validar_estampilla(contenido, id_student="T1", document_version=1, ahora=AHORA, consultar_registro=consultar)
    segunda = validar_estampilla(
        contenido, id_student="T1", document_version=1, ahora=AHORA, consultar_registro=consultar, document_order=2
    )
    assert (primera["document_order"], segunda["document_order"]) == (1, 2)
    validar_esquema(primera)
    validar_esquema(segunda)


@pytest.mark.parametrize("orden", [0, 3])
def test_document_order_fuera_de_rango(pdf_con_recibo, orden):
    with pytest.raises(ValueError):
        validar_estampilla(pdf_con_recibo("000000000001"), id_student="T1", document_version=1, document_order=orden)


def test_dos_comprobantes_distintos(pdf_con_recibo, consultar, validar_esquema):
    resultados = validar_dos([pdf_con_recibo("000000000001"), pdf_con_recibo("000000000002")], consultar)
    assert [r["document_order"] for r in resultados] == [1, 2]
    assert [r["document_classification"] for r in resultados] == ["valid", "valid"]
    assert "distinct_receipt" not in reglas(resultados[0])
    assert reglas(resultados[1])["distinct_receipt"]["result"] == "cumple"
    for resultado in resultados:
        validar_esquema(resultado)


def test_el_mismo_comprobante_dos_veces_queda_por_revisar(pdf_con_recibo, consultar, validar_esquema):
    # Puede ser un error o un recibo que cubre los dos títulos: que lo decida un funcionario.
    contenido = pdf_con_recibo("000000000001")
    primera, segunda = validar_dos([contenido, contenido], consultar)
    assert primera["document_classification"] == "valid"
    regla = reglas(segunda)["distinct_receipt"]
    assert (regla["result"], regla["no_evaluable_reason"], regla["message"]) == ("no_evaluable", "low_confidence", MISMO_RECIBO)
    assert regla["mandatory"] is True
    assert (segunda["document_classification"], segunda["required_action"]) == ("to_check", "wait_for_review")
    validar_esquema(segunda)


def test_sin_recibo_en_uno_no_se_compara(pdf_con_recibo, consultar, validar_esquema):
    primera, segunda = validar_dos([b"", pdf_con_recibo("000000000002")], consultar)
    assert primera["document_classification"] == "to_check"
    regla = reglas(segunda)["distinct_receipt"]
    assert (regla["result"], regla["no_evaluable_reason"]) == ("no_evaluable", "missing_dependency")
    validar_esquema(segunda)


def test_una_sola_estampilla(pdf_con_recibo, consultar):
    (resultado,) = validar_dos([pdf_con_recibo("000000000001")], consultar)
    assert resultado["document_order"] == 1
    assert "distinct_receipt" not in reglas(resultado)


@pytest.mark.parametrize("cantidad", [0, 3])
def test_cantidad_invalida(pdf_con_recibo, cantidad):
    with pytest.raises(ValueError):
        validar_dos([pdf_con_recibo("000000000001")] * cantidad, None)
