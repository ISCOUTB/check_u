"""Extracción del Paz y Salvo. Los textos en memoria son inventados e imitan el de la muestra."""

import pytest

from modules.validadores.paz_y_salvo.extraccion import CAMPOS, extraer, extraer_de_texto

NULO = {"value": None, "confidence": None}
TEXTO = (
    "PAZ Y SALVO BIBLIOTECA\nDocumento de pruebas\n"
    "El sistema de la biblioteca de la Universidad hace constar que el alumno ANA MARIA PRUEBA NUÑEZ "
    "identificado con el código T000000001 se encuentra paz y salvo.\nAtentamente\nLa biblioteca\n"
)


def valores(extraccion):
    return {campo: dato["value"] for campo, dato in extraccion.datos.items()}


def test_muestra_sin_firma(sin_firma):
    extraccion = extraer(sin_firma)
    assert set(extraccion.datos) == set(CAMPOS)
    assert valores(extraccion) == {"full_name": "ANDRES BELTRAN MENECES", "code_student": "T000123123"}
    assert all(dato["confidence"] == 1.0 for dato in extraccion.datos.values())
    assert extraccion.estado == "paz_y_salvo"
    assert extraccion.es_paz_y_salvo is True
    assert extraccion.tiene_texto is True


def test_negacion_no_es_afirmacion():
    extraccion = extraer_de_texto(TEXTO.replace("se encuentra paz y salvo", "no se encuentra paz y salvo"))
    assert extraccion.estado == "no_paz_y_salvo"


def test_sin_frase():
    extraccion = extraer_de_texto(TEXTO.replace(" se encuentra paz y salvo", " tiene un registro"))
    assert extraccion.estado is None


def test_mayusculas_y_tildes():
    texto = TEXTO.replace("código", "CÓDIGO").replace("PAZ Y SALVO BIBLIOTECA", "Paz Y Salvo Biblioteca")
    extraccion = extraer_de_texto(texto)
    assert valores(extraccion) == {"full_name": "ANA MARIA PRUEBA NUÑEZ", "code_student": "T000000001"}
    assert extraccion.es_paz_y_salvo is True


def test_nombre_en_dos_lineas():
    texto = TEXTO.replace("ANA MARIA PRUEBA NUÑEZ", "ANA MARIA\nPRUEBA NUÑEZ")
    assert extraer_de_texto(texto).datos["full_name"]["value"] == "ANA MARIA PRUEBA NUÑEZ"


@pytest.mark.parametrize(
    "fragmento",
    [
        "el alumno con el código T000000001 identificado",
        "el alumno que aparece registrado en el sistema de préstamos de la biblioteca central identificado",
    ],
)
def test_lo_que_no_parece_un_nombre_queda_nulo(fragmento):
    # Un nombre son de 2 a 6 palabras solo con letras: ni números ni párrafos enteros.
    texto = "PAZ Y SALVO BIBLIOTECA\nSe hace constar que " + fragmento + " se encuentra paz y salvo."
    assert extraer_de_texto(texto).datos["full_name"] == NULO


def test_nombre_con_guion_y_apostrofo():
    texto = TEXTO.replace("ANA MARIA PRUEBA NUÑEZ", "ANA-MARIA D'ANGELO PRUEBA")
    assert extraer_de_texto(texto).datos["full_name"]["value"] == "ANA-MARIA D'ANGELO PRUEBA"


def test_campos_ausentes():
    texto = "PAZ Y SALVO BIBLIOTECA\nSe hace constar que el usuario se encuentra paz y salvo con la biblioteca."
    extraccion = extraer_de_texto(texto)
    assert extraccion.datos == {"full_name": NULO, "code_student": NULO}
    assert extraccion.estado == "paz_y_salvo"


def test_otro_documento():
    extraccion = extraer_de_texto("Reporte de resultados del examen Saber Pro. Puntaje global 150 de 300 puntos.")
    assert extraccion.es_paz_y_salvo is False


@pytest.mark.parametrize("contenido", [b"", b"basura"])
def test_sin_texto_y_danado(contenido):
    extraccion = extraer(contenido)
    assert extraccion.tiene_texto is False
    assert extraccion.es_paz_y_salvo is None
    assert any("vacío o dañado" in error for error in extraccion.errores)
