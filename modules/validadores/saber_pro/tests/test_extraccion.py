"""Extracción de Saber Pro. Los textos en memoria son inventados e imitan el formato del reporte."""

import pytest

from modules.validadores.saber_pro.extraccion import CAMPOS, extraer, extraer_de_paginas

GUIA = """¿Cómo entender mis resultados?
Es el resultado numérico que se obtiene calculando
un promedio simple a partir del puntaje de los
módulos genéricos del examen.
Paso 1
Puntaje
global
1 54
▶ Puntaje global
Ejemplo:
Módulo
Puntaje
Inglés
1 84
1 51 + 1 33 + 1 58 + 1 44 + 1 84
5
= 1 54
"""

REPORTE = """Reporte de resultados
1. Datos del evaluado
Nombre Completo:
Ana María Prueba Núñez
Identificación:
C.C. 1000000001
Número de registro:
EK202600000001
Aplicación del examen:
26/04/2026
Publicación de resultados:
14/08/2026
2. Reporte General
Puntaje global
150 /300
¿En qué percentiles estás?
3. Resultados por prueba
COMUNICACIÓN ESCRITA
Puntaje
165/300
"""

ESPERADO = {
    "full_name": "Ana María Prueba Núñez",
    "identification_type": "C.C.",
    "identification_number": "1000000001",
    "registration_number": "EK202600000001",
    "exam_date": "2026-04-26",
    "global_score": 150,
}

NULO = {"value": None, "confidence": None}


def valores(extraccion):
    return {campo: dato["value"] for campo, dato in extraccion.datos.items()}


def test_extrae_los_seis_campos():
    extraccion = extraer_de_paginas([REPORTE])
    assert set(extraccion.datos) == set(CAMPOS)
    assert valores(extraccion) == ESPERADO
    assert all(dato["confidence"] == 1.0 for dato in extraccion.datos.values())
    assert extraccion.tiene_texto is True
    assert extraccion.es_reporte is True
    assert extraccion.errores == []


def test_ignora_el_ejemplo_de_la_guia():
    extraccion = extraer_de_paginas([GUIA, REPORTE])
    assert extraccion.datos["global_score"]["value"] == 150


def test_valor_en_la_misma_linea():
    texto = REPORTE.replace("Puntaje global\n150 /300", "Puntaje global 150/300").replace(
        "Número de registro:\nEK202600000001", "Número de registro: EK202600000001"
    )
    assert valores(extraer_de_paginas([texto])) == ESPERADO


def test_nombre_con_tildes_y_espacios():
    texto = REPORTE.replace("Ana María Prueba Núñez", "Ana  María\tPrueba Núñez ")
    assert extraer_de_paginas([texto]).datos["full_name"]["value"] == "Ana María Prueba Núñez"


def test_nombre_largo_en_dos_lineas():
    # El reporte parte en dos líneas los valores largos (como la institución del reporte real).
    texto = REPORTE.replace("Ana María Prueba Núñez", "María Fernanda De Los Ángeles\nGutiérrez Pérez")
    assert extraer_de_paginas([texto]).datos["full_name"]["value"] == "María Fernanda De Los Ángeles Gutiérrez Pérez"


@pytest.mark.parametrize(
    ("original", "imposible", "campo"),
    [
        ("150 /300", "354 /300", "global_score"),
        ("26/04/2026", "31/02/2026", "exam_date"),
        ("EK202600000001", "EK20260000001", "registration_number"),
    ],
)
def test_valores_imposibles_quedan_nulos(original, imposible, campo):
    extraccion = extraer_de_paginas([REPORTE.replace(original, imposible, 1)])
    assert extraccion.datos[campo] == NULO


def test_campo_ausente_queda_nulo():
    texto = REPORTE.replace("Identificación:\nC.C. 1000000001\n", "")
    extraccion = extraer_de_paginas([texto])
    assert extraccion.datos["identification_type"] == NULO
    assert extraccion.datos["identification_number"] == NULO
    assert extraccion.datos["global_score"]["value"] == 150
    assert extraccion.datos["full_name"]["value"] == "Ana María Prueba Núñez"


def test_saber_11_no_es_reporte():
    extraccion = extraer_de_paginas([REPORTE.replace("EK202600000001", "AC202600000001")])
    assert extraccion.es_reporte is False
    assert extraccion.datos["registration_number"]["value"] == "AC202600000001"


def test_texto_sin_reporte_no_es_reporte():
    extraccion = extraer_de_paginas(["Factura de venta electrónica\nTotal a pagar: 150.000"])
    assert extraccion.tiene_texto is True
    assert extraccion.es_reporte is False


def test_encabezado_sin_registro_es_incierto():
    extraccion = extraer_de_paginas([REPORTE.replace("Número de registro:\nEK202600000001\n", "")])
    assert extraccion.es_reporte is None


@pytest.mark.parametrize("paginas", [[], ["", "  \n "]])
def test_sin_texto(paginas):
    extraccion = extraer_de_paginas(paginas)
    assert extraccion.tiene_texto is False
    assert extraccion.es_reporte is None
    assert extraccion.errores == ["El PDF no tiene texto."]
    assert all(dato == NULO for dato in extraccion.datos.values())


@pytest.mark.parametrize("contenido", [b"", b"no es un pdf"])
def test_bytes_que_no_son_pdf(contenido):
    extraccion = extraer(contenido)
    assert extraccion.tiene_texto is False
    assert extraccion.es_reporte is None
    assert any("vacío o dañado" in error for error in extraccion.errores)


def test_reportes_reales_coinciden_con_esperados(muestras_de_tipo):
    for nombre, muestra in muestras_de_tipo("reporte").items():
        extraccion = extraer(muestra["contenido"])
        assert valores(extraccion) == muestra["datos"], nombre
        assert all(dato["confidence"] == 1.0 for dato in extraccion.datos.values()), nombre
        assert extraccion.es_reporte is True, nombre


def test_corrupto_real_no_tiene_texto(muestras_de_tipo):
    for nombre, muestra in muestras_de_tipo("corrupto").items():
        extraccion = extraer(muestra["contenido"])
        assert extraccion.tiene_texto is False, nombre
