"""Pruebas de conformidad estricta del esquema y tipos de salida JSON."""

from __future__ import annotations

import json

from modules.malla_curricular import analizar_malla_curricular
from modules.malla_curricular.tests.conftest import crear_pdf_banner

CLAVES_RAIZ = {
    "type_document",
    "full_name_student",
    "code_student",
    "program",
    "general_result",
    "motivo",
    "max_credits",
    "credits_approved",
    "periods",
}

CLAVES_PERIODO = {
    "period",
    "credits_approved",
    "credits_total",
    "faltantes",
    "result",
}


def test_conformidad_esquema_json(pdf_banner_cumple):
    diccionario = analizar_malla_curricular(pdf_banner_cumple)

    # 1. Claves exactas en la raíz
    assert set(diccionario.keys()) == CLAVES_RAIZ

    # 2. Valores y tipos
    assert diccionario["type_document"] == "academic_evaluation"
    assert diccionario["general_result"] in ("cumple", "no_cumple")
    assert isinstance(diccionario["motivo"], str) and len(diccionario["motivo"]) > 0

    if diccionario["max_credits"] is not None:
        assert isinstance(diccionario["max_credits"], int)
    if diccionario["credits_approved"] is not None:
        assert isinstance(diccionario["credits_approved"], int)

    # 3. Claves exactas en cada periodo
    assert isinstance(diccionario["periods"], list)
    for p in diccionario["periods"]:
        assert set(p.keys()) == CLAVES_PERIODO
        assert p["result"] in ("cumple", "no_cumple")
        if p["period"] is not None:
            assert isinstance(p["period"], str)
        if p["credits_approved"] is not None:
            assert isinstance(p["credits_approved"], int)
        if p["credits_total"] is not None:
            assert isinstance(p["credits_total"], int)
        if p["faltantes"] is not None:
            assert isinstance(p["faltantes"], int)

    # 4. Compatibilidad con json.loads / JSON.parse
    cadena_json = json.dumps(diccionario)
    reparseado = json.loads(cadena_json)
    assert reparseado == diccionario
