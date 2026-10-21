import pytest

from modules.validadores.paz_y_salvo.firma import es_biblioteca, verificar


def test_muestra_sin_firma(sin_firma):
    firma = verificar(sin_firma)
    assert firma.presencia == "ausente"
    assert firma.intacta is None


def test_muestra_firmada(firmado):
    firma = verificar(firmado)
    assert firma.presencia == "presente"
    assert firma.intacta is True
    assert firma.firmante == "Biblioteca"
    assert firma.firmante_es_biblioteca is True


def test_muestra_modificada(modificado):
    firma = verificar(modificado)
    assert firma.presencia == "presente"
    assert firma.intacta is False


def test_danado():
    assert verificar(b"").presencia == "ausente"


@pytest.mark.parametrize(
    ("organizacion", "nombre_comun", "esperado"),
    [
        ("Biblioteca", None, True),
        (None, "UTB - Biblioteca", True),
        ("BIBLIOTÉCA", None, True),
        ("ICFES", "ICFES", False),
        (None, None, False),
    ],
)
def test_es_biblioteca(organizacion, nombre_comun, esperado):
    assert es_biblioteca(organizacion, nombre_comun) is esperado


def test_cualquier_biblioteca_pasa_riesgo_aceptado():
    # Decisión 2 del spec: solo integridad y nombre del firmante, sin validar el certificado. Un
    # certificado de otra entidad (o uno propio) cuyo nombre diga "biblioteca" pasa. Si algún día se
    # valida el certificado institucional, esta prueba debe cambiar.
    assert es_biblioteca("Biblioteca Municipal", None) is True


class ValidadorFalso:
    def __init__(self, organizacion, nombre_comun):
        self.organizacion, self.nombre_comun = organizacion, nombre_comun

    def validate_bytes(self, data, *, allow_fetching=None):
        return {
            "signed": True,
            "modified": False,
            "signature_valid": True,
            "entire_file": True,
            "message": "",
            "signer_organization": self.organizacion,
            "signer_common_name": self.nombre_comun,
        }


def test_otro_firmante():
    firma = verificar(b"%PDF", validador=ValidadorFalso("Notaría Primera", "Notario"))
    assert firma.firmante_es_biblioteca is False
    assert firma.firmante == "Notaría Primera"


def test_firmante_solo_con_nombre_comun():
    firma = verificar(b"%PDF", validador=ValidadorFalso(None, "Biblioteca UTB"))
    assert firma.firmante == "Biblioteca UTB"
    assert firma.firmante_es_biblioteca is True
