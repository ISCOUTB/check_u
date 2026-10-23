"""validar_estampilla con el adaptador real de la Tarea 22 y su HTML anonimizado, sin internet."""

from datetime import datetime

import pytest

from modules.estampilla_pro import consultar_comprobante
from modules.estampilla_pro.tests.conftest import HTML_NO_PAGADO, HTML_PAGADO_VALIDO, HTML_SOLO_PRODESARROLLO
from modules.validadores.estampilla import validar_estampilla
from modules.validadores.estampilla.reglas import NO_ENCONTRADO, REGISTRO_SIN_PAGAR, REGISTRO_SIN_PRO_CULTURA
from modules.validadores.resultado import BOGOTA

AHORA = datetime(2026, 10, 20, 9, 30, tzinfo=BOGOTA)
NO_ENCONTRADA = {"success": False, "message": "No se encontraron liquidaciones", "type": "error"}


class ClienteFalso:
    """Hace las veces de EstampillaCliente: devuelve una respuesta fija, sin red."""

    def __init__(self, respuesta: dict):
        self.respuesta = respuesta

    def consultar(self, numero, **_):
        return self.respuesta


def con_html(html: str) -> dict:
    return {"success": True, "message": "success", "html": html}


@pytest.fixture
def pdf_como_el_de_la_tarea_22(texto_certificado, crear_pdf) -> bytes:
    # Los mismos datos que el HTML anonimizado de las pruebas de la Tarea 22.
    texto = (
        texto_certificado.replace("ANA MARIA PRUEBA NUÑEZ", "ESTUDIANTE ANONIMO PRUEBA")
        .replace("Fecha de Pago: 15 Ene 2026", "Fecha de Pago: 13 Oct 2026")
    )
    return crear_pdf(texto)


@pytest.mark.parametrize(
    ("respuesta", "clasificacion", "motivo"),
    [
        (con_html(HTML_PAGADO_VALIDO), "valid", None),
        (con_html(HTML_SOLO_PRODESARROLLO), "invalid", REGISTRO_SIN_PRO_CULTURA),
        (con_html(HTML_NO_PAGADO), "invalid", REGISTRO_SIN_PAGAR),
        (NO_ENCONTRADA, "invalid", NO_ENCONTRADO),
    ],
)
def test_con_el_adaptador_real(pdf_como_el_de_la_tarea_22, validar_esquema, respuesta, clasificacion, motivo):
    def consultar(numero, version):
        return consultar_comprobante(numero, None, document_version=version, cliente=ClienteFalso(respuesta))

    resultado = validar_estampilla(
        pdf_como_el_de_la_tarea_22,
        id_student="T000000001",
        document_version=1,
        ahora=AHORA,
        consultar_registro=consultar,
    )
    validar_esquema(resultado)
    assert resultado["document_classification"] == clasificacion
    assert resultado["resubmission_reason"] == motivo
