"""Reglas de la Estampilla Pro-Cultura, en memoria (certificado inventado y consulta simulada)."""

from datetime import datetime

import pytest

from modules.validadores.estampilla.extraccion import CAMPOS, ExtraccionEstampilla
from modules.validadores.estampilla.reglas import (
    NO_COINCIDE,
    NO_CONSULTADO,
    NO_DISPONIBLE,
    NO_ENCONTRADO,
    NO_ES_CERTIFICADO,
    NO_PAGADA,
    ORDEN,
    REGISTRO_SIN_PAGAR,
    REGISTRO_SIN_PRO_CULTURA,
    SIN_PRO_CULTURA,
    VALOR_CERO,
    VERSION,
    accion_por_revisar,
    cotejar,
    evaluar,
)
from modules.validadores.resultado import BOGOTA, armar_resultado

AHORA = datetime(2026, 1, 20, 9, 30, tzinfo=BOGOTA)
DATOS = {
    "receipt_number": "000000000001",
    "identification_number": "1000000001",
    "full_name": "ANA MARIA PRUEBA NUÑEZ",
    "payment_date": "2026-01-15",
    "pro_cultura_amount": 70036,
}
ETIQUETAS = {
    "receipt_number": "número de recibo",
    "identification_number": "documento del contribuyente",
    "full_name": "nombre del contribuyente",
    "payment_date": "fecha de pago",
    "pro_cultura_amount": "valor de la Estampilla Pro-Cultura",
}


def extraccion(es_certificado=True, fila=True, estado="PAGADO", tiene_texto=True, **cambios):
    valores = {**DATOS, **cambios}
    datos = {c: {"value": valores[c], "confidence": None if valores[c] is None else 1.0} for c in CAMPOS}
    return ExtraccionEstampilla(tiene_texto, es_certificado, fila, estado, datos, [])


def por_regla(reglas):
    return {r["rule"]: r for r in reglas}


def resultado(regla):
    return (regla["result"], regla["no_evaluable_reason"])


def test_version_y_orden(registro_oficial):
    assert VERSION == "estampilla_pro_cultura@1.0.0"
    assert ORDEN == [
        "payment_certificate_document",
        "required_fields_present",
        "pro_cultura_paid",
        "official_record",
        "official_record_matches",
    ]
    reglas = evaluar(extraccion(), registro_oficial(), ahora=AHORA)
    assert [r["rule"] for r in reglas] == ORDEN
    assert all(r["mandatory"] for r in reglas)


def test_todo_cumple(registro_oficial):
    reglas = evaluar(extraccion(), registro_oficial(), ahora=AHORA)
    assert [r["result"] for r in reglas] == ["cumple"] * 5


def test_no_es_certificado(registro_oficial):
    reglas = por_regla(evaluar(extraccion(es_certificado=False), registro_oficial(), ahora=AHORA))
    assert reglas["payment_certificate_document"]["result"] == "no_cumple"
    assert reglas["payment_certificate_document"]["message"] == NO_ES_CERTIFICADO
    for nombre in ORDEN[1:]:
        assert reglas[nombre]["no_evaluable_reason"] == "missing_dependency", nombre

    sin_texto = por_regla(evaluar(extraccion(es_certificado=None, tiene_texto=False), None, ahora=AHORA))
    assert resultado(sin_texto["payment_certificate_document"]) == ("no_evaluable", "low_confidence")
    for nombre in ORDEN[1:]:
        assert sin_texto[nombre]["no_evaluable_reason"] == "missing_dependency", nombre


@pytest.mark.parametrize("campo", CAMPOS)
def test_falta_un_dato(registro_oficial, campo):
    regla = por_regla(evaluar(extraccion(**{campo: None}), registro_oficial(), ahora=AHORA))["required_fields_present"]
    assert resultado(regla) == ("no_evaluable", "low_confidence")
    assert ETIQUETAS[campo] in regla["message"]


@pytest.mark.parametrize(
    ("cambios", "esperado", "mensaje"),
    [
        ({"fila": False, "estado": None, "pro_cultura_amount": None}, ("no_cumple", None), SIN_PRO_CULTURA),
        ({"estado": "PENDIENTE"}, ("no_cumple", None), NO_PAGADA),
        ({"pro_cultura_amount": 0}, ("no_cumple", None), VALOR_CERO),
        ({"pro_cultura_amount": None}, ("no_evaluable", "low_confidence"), None),
    ],
)
def test_pro_cultura_paid(registro_oficial, cambios, esperado, mensaje):
    regla = por_regla(evaluar(extraccion(**cambios), registro_oficial(), ahora=AHORA))["pro_cultura_paid"]
    assert resultado(regla) == esperado
    if mensaje:
        assert regla["message"] == mensaje


@pytest.mark.parametrize(
    ("cambios", "esperado", "mensaje"),
    [
        ({}, ("cumple", None), None),
        ({"estado_consulta": "no_encontrado", "resultado": "no_cumple", "pagado": None}, ("no_cumple", None), NO_ENCONTRADO),
        ({"etiqueta_exists": False, "resultado": "no_cumple"}, ("no_cumple", None), REGISTRO_SIN_PRO_CULTURA),
        ({"pagado": False, "resultado": "no_cumple"}, ("no_cumple", None), REGISTRO_SIN_PAGAR),
        (
            {"estado_consulta": "no_disponible", "resultado": "no_evaluable", "motivo": "source_unavailable"},
            ("no_evaluable", "source_unavailable"),
            NO_DISPONIBLE,
        ),
        ({"resultado": "no_evaluable", "motivo": "incomplete_data"}, ("no_evaluable", "source_unavailable"), NO_DISPONIBLE),
        ({"resultado": "no_evaluable", "motivo": "invalid_input"}, ("no_evaluable", "low_confidence"), None),
        ({"resultado": "algo_raro"}, ("no_evaluable", "source_unavailable"), NO_DISPONIBLE),
    ],
)
def test_official_record(registro_oficial, cambios, esperado, mensaje):
    regla = por_regla(evaluar(extraccion(), registro_oficial(**cambios), ahora=AHORA))["official_record"]
    assert resultado(regla) == esperado
    if mensaje:
        assert regla["message"] == mensaje


def test_no_consultado():
    regla = por_regla(evaluar(extraccion(), None, ahora=AHORA))["official_record"]
    assert resultado(regla) == ("no_evaluable", "source_pending")
    assert regla["message"] == NO_CONSULTADO


def test_sin_recibo_no_se_consulta(registro_oficial):
    regla = por_regla(evaluar(extraccion(receipt_number=None), registro_oficial(), ahora=AHORA))["official_record"]
    assert resultado(regla) == ("no_evaluable", "missing_dependency")


@pytest.mark.parametrize(
    ("cambios", "campos"),
    [
        ({"fecha_pago": "2026-01-16"}, ["fecha de pago"]),
        ({"valor_pro_cultura": 70000}, ["valor"]),
        ({"documento_parcial": "200******"}, ["documento"]),
        ({"nombre_anonimizado": "LUI****PRU****"}, ["nombre"]),
    ],
)
def test_cotejo_detecta_cada_campo(registro_oficial, cambios, campos):
    assert cotejar(extraccion(), registro_oficial(**cambios)) == campos
    regla = por_regla(evaluar(extraccion(), registro_oficial(**cambios), ahora=AHORA))["official_record_matches"]
    assert resultado(regla) == ("no_evaluable", "low_confidence")
    assert regla["message"] == NO_COINCIDE.format(campos=", ".join(campos))


def test_cotejo_con_datos_faltantes(registro_oficial):
    assert cotejar(extraccion(), registro_oficial(fecha_pago=None, valor_pro_cultura=None)) == ["fecha de pago", "valor"]


def test_cotejo_nombre_con_y_sin_mascara(registro_oficial):
    # La Gobernación enmascara ("ANA****…"); las pruebas de la Tarea 22 traen el nombre completo.
    assert cotejar(extraccion(), registro_oficial(nombre_anonimizado="ANA****MAR****PRU****NUÑ****")) == []
    assert cotejar(extraccion(), registro_oficial(nombre_anonimizado="ANA MARIA PRUEBA NUÑEZ")) == []
    assert cotejar(extraccion(), registro_oficial(nombre_anonimizado="ANA****PRU****")) == ["nombre"]


def test_cotejo_sin_tildes(registro_oficial):
    assert cotejar(extraccion(), registro_oficial(nombre_anonimizado="ANA****MAR****PRU****NUN****")) == []


@pytest.mark.parametrize("documento", ["**********", None])
def test_cotejo_documento_sin_digitos_visibles(registro_oficial, documento):
    assert cotejar(extraccion(), registro_oficial(documento_parcial=documento)) == ["documento"]


@pytest.mark.parametrize(
    "cambios",
    [
        {"estado_consulta": "no_encontrado", "resultado": "no_cumple"},
        {"resultado": "no_evaluable", "motivo": "source_unavailable"},
    ],
)
def test_cotejo_solo_si_el_registro_cumple(registro_oficial, cambios):
    regla = por_regla(evaluar(extraccion(), registro_oficial(**cambios), ahora=AHORA))["official_record_matches"]
    assert resultado(regla) == ("no_evaluable", "missing_dependency")


def test_accion_por_revisar(registro_oficial):
    no_consultado = evaluar(extraccion(), None, ahora=AHORA)
    assert accion_por_revisar(no_consultado) == "wait_for_external_validation"
    caido = evaluar(extraccion(), registro_oficial(resultado="no_evaluable", motivo="source_unavailable"), ahora=AHORA)
    assert accion_por_revisar(caido) == "wait_for_external_validation"
    falta_un_dato = evaluar(extraccion(full_name=None), None, ahora=AHORA)
    assert accion_por_revisar(falta_un_dato) == "wait_for_review"
    sin_texto = evaluar(extraccion(es_certificado=None, tiene_texto=False), None, ahora=AHORA)
    assert accion_por_revisar(sin_texto) == "wait_for_review"


def test_varias_fallas_a_la_vez(registro_oficial):
    reglas = evaluar(
        extraccion(estado="PENDIENTE"),
        registro_oficial(estado_consulta="no_encontrado", resultado="no_cumple", pagado=None),
        ahora=AHORA,
    )
    resultados = por_regla(reglas)
    assert resultados["pro_cultura_paid"]["result"] == "no_cumple"
    assert resultados["official_record"]["result"] == "no_cumple"
    final = armar_resultado(
        id_student="T000000001",
        type_document="estampilla_pro_cultura",
        document_version=1,
        extracted_data=extraccion().datos,
        reglas=reglas,
        errores=[],
        validation_version=VERSION,
        ahora=AHORA,
    )
    assert final["document_classification"] == "invalid"
    assert final["resubmission_reason"] == NO_PAGADA


def test_reglas_cumplen_el_contrato(registro_oficial, validar_esquema):
    casos = [
        (extraccion(), registro_oficial()),
        (extraccion(es_certificado=False), registro_oficial()),
        (extraccion(full_name=None, estado="PENDIENTE"), None),
        (extraccion(), registro_oficial(fecha_pago="2026-02-01")),
    ]
    for datos, registro in casos:
        for regla in evaluar(datos, registro, ahora=AHORA):
            validar_esquema(regla, "rule-evaluation")
