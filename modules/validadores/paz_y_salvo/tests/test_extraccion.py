"""Extracción del Paz y Salvo. Los textos en memoria son inventados e imitan el de la muestra."""

import pymupdf
import pytest

from modules.validadores.paz_y_salvo.extraccion import CAMPOS, DANADO, SIN_TEXTO, extraer, extraer_de_texto

NULO = {"value": None, "confidence": None}
TEXTO = (
    "PAZ Y SALVO BIBLIOTECA\nDocumento de pruebas\n"
    "El sistema de la biblioteca de la Universidad hace constar que el alumno ANA MARIA PRUEBA NUÑEZ "
    "identificado con el código T000000001 se encuentra paz y salvo.\nAtentamente\nLa biblioteca\n"
)


def valores(extraccion):
    return {campo: dato["value"] for campo, dato in extraccion.datos.items()}


def pdf_en_memoria(lineas: list[tuple[float, str]], *, comprimido: bool = False) -> bytes:
    """Un PDF inventado: cada línea va a su altura (y) y se escribe en el orden de la lista."""
    documento = pymupdf.open()
    pagina = documento.new_page()
    for y, linea in lineas:
        pagina.insert_text((72, y), linea, fontsize=11)
    return documento.tobytes(deflate=comprimido)


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


@pytest.mark.parametrize(
    "nombre",
    [
        "MARÍA DEL PILAR DE LA HOZ PRUEBA",
        "ANA MARÍA DE LOS ÁNGELES PRUEBA DE LA ESPRIELLA",
        "PEDRO JOSÉ DE LAS AGUAS Y PRUEBA",
    ],
)
def test_las_particulas_no_cuentan_para_el_tope(nombre):
    # "de", "del", "la", "las", "los" e "y" no cuentan para el tope de 6 palabras (Héctor, 23/10/2026):
    # en Colombia hay nombres completos de 7 o más palabras.
    texto = TEXTO.replace("ANA MARIA PRUEBA NUÑEZ", nombre)
    assert extraer_de_texto(texto).datos["full_name"]["value"] == nombre


@pytest.mark.parametrize("nombre", ["ANA MARIA JOSEFA LUCIA PRUEBA NUÑEZ GOMEZ", "DE LA", "DE LOS PRUEBA"])
def test_siete_palabras_propias_o_menos_de_dos_quedan_nulo(nombre):
    texto = TEXTO.replace("ANA MARIA PRUEBA NUÑEZ", nombre)
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


def test_lee_en_el_orden_en_que_se_ve():
    # Un PDF editado, o de otro generador, puede guardar el texto en otro orden: aquí el nombre se
    # escribe de último, pero en la página va entre "el alumno" e "identificado".
    contenido = pdf_en_memoria(
        [
            (72, "PAZ Y SALVO"),
            (100, "El Sistema de Bibliotecas hace constar que el alumno"),
            (128, "identificado con el código T000000001 se encuentra paz y salvo."),
            (114, "ANA PRUEBA NUÑEZ"),
        ]
    )
    assert valores(extraer(contenido)) == {"full_name": "ANA PRUEBA NUÑEZ", "code_student": "T000000001"}


def test_lo_que_no_es_pdf_es_danado():
    # PyMuPDF abre un HTML adivinando su formato, aunque se le pida un PDF.
    html = (
        b"<html><body>PAZ Y SALVO Biblioteca. El alumno ANA PRUEBA identificado con el codigo "
        b"T000000001 se encuentra paz y salvo.</body></html>"
    )
    extraccion = extraer(html)
    assert extraccion.errores == [DANADO]
    assert extraccion.es_paz_y_salvo is None


def test_truncado_sin_texto_es_danado():
    completo = pdf_en_memoria(
        [(100, "El Sistema de Bibliotecas hace constar que el alumno ANA PRUEBA se encuentra paz y salvo.")],
        comprimido=True,
    )
    cortado = completo[: completo.index(b"stream") + 30]
    assert extraer(cortado).errores == [DANADO]


def test_un_pdf_sano_sin_texto_sigue_siendo_sin_texto():
    assert extraer(pdf_en_memoria([])).errores == [SIN_TEXTO]


@pytest.mark.parametrize("contenido", [b"", b"basura"])
def test_sin_texto_y_danado(contenido):
    extraccion = extraer(contenido)
    assert extraccion.tiene_texto is False
    assert extraccion.es_paz_y_salvo is None
    assert any("vacío o dañado" in error for error in extraccion.errores)
