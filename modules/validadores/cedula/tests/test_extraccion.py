"""Extracción de la cédula. En memoria se arman ResultadoCedula a mano (nombres y números inventados)."""

import pytest

from modules.cedula.lectura import ResultadoCedula
from modules.validadores.cedula.extraccion import CAMPOS, desde_lectura, extraer
from modules.validadores.cedula.paginas import cargar_paginas

NULO = {"value": None, "confidence": None}
TEXTO_AMARILLA = "REPUBLICA DE COLOMBIA IDENTIFICACION PERSONAL CEDULA DE CIUDADANIA"


def campo(valor, fuente="pdf417", confianza=100.0):
    return {"valor": valor, "caja": None, "pagina": 0, "fuente": fuente, "confianza": confianza}


def lectura(formato="amarilla_hologramas", campos=None, texto="", mrz=None, errores=None):
    campos = campos or {}
    return ResultadoCedula(
        formato=formato,
        formato_nombre="",
        campos={
            nombre: campos.get(nombre, campo(None, None, None))
            for nombre in ("numero_documento", "nombre_completo", "fecha_nacimiento", "sexo")
        },
        paginas=[],
        avisos=[],
        errores=list(errores or []),
        texto_ocr=texto,
        mrz=mrz,
    )


PDF417 = {
    "numero_documento": campo("1000000001"),
    "nombre_completo": campo("ANA MARIA PRUEBA NUNEZ"),
    "fecha_nacimiento": campo("03/04/1978", confianza=None),
    "sexo": campo("F", confianza=None),
}


def test_pdf417_vale_uno():
    extraccion = desde_lectura(lectura(campos=PDF417, texto=TEXTO_AMARILLA))
    assert set(extraccion.datos) == set(CAMPOS)
    assert {k: v["value"] for k, v in extraccion.datos.items()} == {
        "full_name": "ANA MARIA PRUEBA NUNEZ",
        "identification_type": "C.C.",
        "identification_number": "1000000001",
        "birth_date": "1978-04-03",
        "sex": "F",
    }
    assert all(v["confidence"] == 1.0 for v in extraccion.datos.values())
    assert extraccion.formato == "amarilla_hologramas"
    assert extraccion.codigo_leido is True
    assert extraccion.es_cedula is True
    assert extraccion.legible is True


def test_ocr_divide_por_cien():
    campos = {"nombre_completo": campo("ANA PRUEBA", fuente="etiqueta", confianza=62.0)}
    extraccion = desde_lectura(lectura(campos=campos, texto=TEXTO_AMARILLA))
    assert extraccion.datos["full_name"] == {"value": "ANA PRUEBA", "confidence": 0.62}
    assert extraccion.codigo_leido is False


def test_sin_confianza_queda_nulo():
    campos = {"nombre_completo": campo("DEPARTAMENTOX DDMMYYYY", fuente="etiqueta", confianza=None)}
    extraccion = desde_lectura(lectura(campos=campos, texto=TEXTO_AMARILLA))
    assert extraccion.datos["full_name"] == NULO


def test_mrz_valido_y_invalido():
    campos = {
        "numero_documento": campo("1000000001", fuente="mrz", confianza=None),
        "nombre_completo": campo("ANA PRUEBA", fuente="mrz", confianza=None),
    }
    valido = desde_lectura(lectura("digital", campos, texto="ICCOL1000000001", mrz={"valido": True}))
    assert valido.formato == "digital"
    assert valido.codigo_leido is True
    assert valido.datos["identification_number"] == {"value": "1000000001", "confidence": 1.0}

    invalido = desde_lectura(lectura("digital", campos, texto="ICCOL1000000001", mrz={"valido": False}))
    assert invalido.codigo_leido is False
    assert invalido.datos["identification_number"] == NULO
    assert invalido.datos["full_name"] == NULO


def test_extranjeria():
    campos = {"nombre_completo": campo("ANA PRUEBA", fuente="etiqueta", confianza=95.0)}
    extraccion = desde_lectura(lectura(campos=campos, texto="REPÚBLICA DE COLOMBIA CÉDULA DE EXTRANJERÍA"))
    assert extraccion.formato == "extranjeria"
    assert extraccion.es_cedula is True
    assert extraccion.codigo_leido is False
    assert extraccion.datos["identification_type"] == {"value": "C.E.", "confidence": 1.0}
    assert extraccion.datos["full_name"] == NULO


def test_extranjeria_con_mrz_valido():
    campos = {"numero_documento": campo("123456", fuente="mrz", confianza=None)}
    extraccion = desde_lectura(lectura("digital", campos, texto="MIGRACION COLOMBIA", mrz={"valido": True}))
    assert extraccion.formato == "extranjeria"
    assert extraccion.codigo_leido is True
    assert extraccion.datos["identification_number"] == {"value": "123456", "confidence": 1.0}


def test_no_es_cedula():
    texto = "UNIVERSIDAD TECNOLOGICA DE BOLIVAR PAZ Y SALVO DE BIBLIOTECA EL ESTUDIANTE NO TIENE DEUDAS"
    extraccion = desde_lectura(lectura(texto=texto))
    assert extraccion.es_cedula is False
    assert extraccion.formato is None
    assert extraccion.legible is True
    assert extraccion.datos["identification_type"] == NULO


def test_sin_texto():
    extraccion = desde_lectura(lectura(texto="  \n "))
    assert extraccion.es_cedula is None
    assert extraccion.legible is False


@pytest.mark.parametrize(
    ("fecha", "esperada"),
    [("03/04/1978", "1978-04-03"), ("1978-04-03", "1978-04-03"), ("780403", "1978-04-03"), ("31/02/1978", None)],
)
def test_fechas(fecha, esperada):
    campos = {**PDF417, "fecha_nacimiento": campo(fecha, confianza=None)}
    assert desde_lectura(lectura(campos=campos, texto=TEXTO_AMARILLA)).datos["birth_date"]["value"] == esperada


def test_numero_con_puntos():
    campos = {**PDF417, "numero_documento": campo("79.937.877")}
    assert desde_lectura(lectura(campos=campos)).datos["identification_number"]["value"] == "79937877"


def test_sexo_solo_m_o_f():
    campos = {**PDF417, "sexo": campo("X")}
    assert desde_lectura(lectura(campos=campos)).datos["sex"] == NULO


def test_errores_de_la_lectura_pasan():
    extraccion = desde_lectura(lectura(campos=PDF417, errores=["MRZ con dígito de control inválido"]))
    assert extraccion.errores == ["MRZ con dígito de control inválido"]


def test_sin_paginas():
    extraccion = extraer([], leer=lambda _paginas: pytest.fail("no debe leer sin páginas"))
    assert extraccion.legible is False
    assert extraccion.errores == ["El archivo está vacío o dañado."]
    assert all(v == NULO for v in extraccion.datos.values())


def test_muestra_png(requiere_tesseract, png):
    extraccion = extraer(cargar_paginas(png))
    assert {k: v["value"] for k, v in extraccion.datos.items()} == {
        "full_name": "ESTEBAN ALBERTO RODRIGUEZ HERNANDEZ",
        "identification_type": "C.C.",
        "identification_number": "79937877",
        "birth_date": "1978-04-03",
        "sex": "M",
    }
    assert all(v["confidence"] == 1.0 for v in extraccion.datos.values())
    assert extraccion.codigo_leido is True


def test_muestra_pdf_escaneado(requiere_tesseract, pdf_escaneado):
    extraccion = extraer(cargar_paginas(pdf_escaneado))
    assert extraccion.codigo_leido is False
    assert extraccion.datos["full_name"] == NULO
