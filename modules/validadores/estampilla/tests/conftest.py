"""Un certificado de pago inventado (ningún dato es real) y cómo convertirlo en PDF."""

import pymupdf
import pytest

TEXTO_CERTIFICADO = """DEPARTAMENTO DE BOLÍVAR
SECRETARÍA DE HACIENDA
CERTIFICADO DE PAGO
FECHA DE EXPEDICIÓN: 2026-01-15 10:20:30
Recibo Oficial: 000000000001
Contribuyente: 1000000001 - ANA MARIA PRUEBA NUÑEZ
Fecha de Pago: 15 Ene 2026
Entidad Recaudadora: 77 - Pse Gou
Renta: 165 - Estampilla Departamental
Valor Base de Liquidacion: $ 0
Renta Conceptos Liquidados Valor Pagado Estado
165 - Expedición Títulos Estampilla Pro-Cultura $ 70.036 Pagado
165 - Expedición Títulos Estampilla Prodesarrollo (Liquidacion $ 21.000 Pagado
Total $ 91.036 Pagado
FIN DEL CERTIFICADO
"""


@pytest.fixture
def texto_certificado() -> str:
    return TEXTO_CERTIFICADO


@pytest.fixture
def crear_pdf():
    """Un PDF de una página: cada línea del texto, 14 puntos debajo de la anterior."""

    def crear(texto: str, *, comprimido: bool = False) -> bytes:
        documento = pymupdf.open()
        pagina = documento.new_page()
        for numero, linea in enumerate(texto.splitlines()):
            if linea:
                pagina.insert_text((40, 60 + 14 * numero), linea, fontsize=9)
        return documento.tobytes(deflate=comprimido)

    return crear
