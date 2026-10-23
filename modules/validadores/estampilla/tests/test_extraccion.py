"""Extracción del certificado de pago, con textos y PDF inventados en memoria."""

import pymupdf
import pytest

from modules.validadores.estampilla.extraccion import (
    CAMPOS,
    DANADO,
    PROTEGIDO,
    SIN_TEXTO,
    extraer,
    extraer_de_texto,
)

ESPERADOS = {
    "receipt_number": "000000000001",
    "identification_number": "1000000001",
    "full_name": "ANA MARIA PRUEBA NUÑEZ",
    "payment_date": "2026-01-15",
    "pro_cultura_amount": 70036,
}
NULO = {"value": None, "confidence": None}
FILA_PRO_CULTURA = "165 - Expedición Títulos Estampilla Pro-Cultura $ 70.036 Pagado"


def valores(extraccion):
    return {campo: dato["value"] for campo, dato in extraccion.datos.items()}


def test_certificado_inventado(texto_certificado):
    extraccion = extraer_de_texto(texto_certificado)
    assert tuple(extraccion.datos) == CAMPOS
    assert valores(extraccion) == ESPERADOS
    assert all(dato["confidence"] == 1.0 for dato in extraccion.datos.values())
    assert extraccion.es_certificado is True
    assert extraccion.fila_pro_cultura is True
    assert extraccion.estado_pro_cultura == "PAGADO"
    assert extraccion.tiene_texto is True
    assert extraccion.errores == []


@pytest.mark.parametrize(
    ("fecha", "esperada"),
    [
        ("15 Ene 2026", "2026-01-15"),
        ("15 Jan 2026", "2026-01-15"),
        ("3 Abr 2026", "2026-04-03"),
        ("3 Apr 2026", "2026-04-03"),
        ("30 Ago 2026", "2026-08-30"),
        ("30 Aug 2026", "2026-08-30"),
        ("1 Dic 2026", "2026-12-01"),
        ("1 Dec 2026", "2026-12-01"),
        ("1 Set 2026", "2026-09-01"),
        ("2026-06-30", "2026-06-30"),
        ("15 Xyz 2026", None),
        ("31 Feb 2026", None),
    ],
)
def test_meses(texto_certificado, fecha, esperada):
    texto = texto_certificado.replace("Fecha de Pago: 15 Ene 2026", f"Fecha de Pago: {fecha}")
    assert extraer_de_texto(texto).datos["payment_date"]["value"] == esperada


@pytest.mark.parametrize(("valor", "esperado"), [("1.070.036", 1070036), ("70,036", 70036), ("0", 0)])
def test_valor_con_punto_de_miles(texto_certificado, valor, esperado):
    texto = texto_certificado.replace("Pro-Cultura $ 70.036", f"Pro-Cultura $ {valor}")
    assert extraer_de_texto(texto).datos["pro_cultura_amount"]["value"] == esperado


@pytest.mark.parametrize("valor", ["70.036,00", "70,036.00"])
def test_valor_con_decimales(texto_certificado, valor):
    texto = texto_certificado.replace("Pro-Cultura $ 70.036", f"Pro-Cultura $ {valor}")
    assert extraer_de_texto(texto).datos["pro_cultura_amount"]["value"] == 70036


def test_fila_pendiente(texto_certificado):
    texto = texto_certificado.replace(FILA_PRO_CULTURA, FILA_PRO_CULTURA.replace("Pagado", "Pendiente"))
    assert extraer_de_texto(texto).estado_pro_cultura == "PENDIENTE"


def test_sin_fila_pro_cultura(texto_certificado):
    extraccion = extraer_de_texto(texto_certificado.replace(FILA_PRO_CULTURA + "\n", ""))
    assert extraccion.fila_pro_cultura is False
    assert extraccion.estado_pro_cultura is None
    # El valor de la Prodesarrollo no se toma como el de la Pro-Cultura.
    assert extraccion.datos["pro_cultura_amount"] == NULO


def test_nombre_con_particulas(texto_certificado):
    texto = texto_certificado.replace("ANA MARIA PRUEBA NUÑEZ", "MARÍA DEL PILAR DE LA HOZ PRUEBA")
    assert extraer_de_texto(texto).datos["full_name"]["value"] == "MARÍA DEL PILAR DE LA HOZ PRUEBA"


@pytest.mark.parametrize("nombre", ["EMPRESA 123 S.A.S", "ANA"])
def test_lo_que_no_parece_un_nombre(texto_certificado, nombre):
    texto = texto_certificado.replace("ANA MARIA PRUEBA NUÑEZ", nombre)
    assert extraer_de_texto(texto).datos["full_name"] == NULO


def test_nombre_termina_en_su_linea():
    extraccion = extraer_de_texto("Contribuyente: 1000000001 - ANA PRUEBA\nFecha de Pago: 15 Ene 2026")
    assert extraccion.datos["full_name"]["value"] == "ANA PRUEBA"
    assert extraccion.datos["payment_date"]["value"] == "2026-01-15"


def test_otro_documento():
    largo = "Reporte de resultados del examen Saber Pro. Puntaje global 150 de 300 puntos."
    assert extraer_de_texto(largo).es_certificado is False
    assert extraer_de_texto("Hola, esto es corto.").es_certificado is None


def test_pdf_en_memoria(texto_certificado, crear_pdf):
    assert valores(extraer(crear_pdf(texto_certificado))) == ESPERADOS


def test_lee_en_orden_visual(texto_certificado):
    # Un PDF editado puede guardar el texto en otro orden: la línea del contribuyente se escribe de
    # última, pero en la página va donde le toca.
    lineas = texto_certificado.splitlines()
    contribuyente = next(i for i, linea in enumerate(lineas) if linea.startswith("Contribuyente"))
    documento = pymupdf.open()
    pagina = documento.new_page()
    orden = [i for i in range(len(lineas)) if i != contribuyente] + [contribuyente]
    for i in orden:
        pagina.insert_text((40, 60 + 14 * i), lineas[i], fontsize=9)
    assert valores(extraer(documento.tobytes())) == ESPERADOS


def test_no_es_pdf_es_danado(texto_certificado):
    html = f"<html><body><pre>{texto_certificado}</pre></body></html>".encode()
    extraccion = extraer(html)
    assert extraccion.errores == [DANADO]
    assert extraccion.es_certificado is None


def test_truncado_sin_texto_es_danado(texto_certificado, crear_pdf):
    completo = crear_pdf(texto_certificado, comprimido=True)
    assert extraer(completo[: completo.index(b"stream") + 30]).errores == [DANADO]


def test_con_contrasena(texto_certificado, crear_pdf):
    documento = pymupdf.open(stream=crear_pdf(texto_certificado), filetype="pdf")
    protegido = documento.tobytes(encryption=pymupdf.PDF_ENCRYPT_AES_256, user_pw="1234", owner_pw="dueno")
    assert extraer(protegido).errores == [PROTEGIDO]


@pytest.mark.parametrize("contenido", [b"", b"basura"])
def test_vacio_y_basura(contenido):
    extraccion = extraer(contenido)
    assert extraccion.errores == [DANADO]
    assert extraccion.es_certificado is None
    assert extraccion.tiene_texto is False


def test_pdf_sano_sin_texto():
    documento = pymupdf.open()
    documento.new_page()
    assert extraer(documento.tobytes()).errores == [SIN_TEXTO]
