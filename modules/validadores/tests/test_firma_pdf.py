"""Lectura genérica de la firma de un PDF, con las muestras de firma_electronica/."""

from pathlib import Path

import pytest

from firma_electronica.infra.sign_validator import SignatureValidator
from modules.validadores.firma_pdf import esta_intacta, leer_firma

MUESTRAS = Path(__file__).resolve().parents[3] / "firma_electronica" / "test" / "samples"


@pytest.fixture
def validador():
    return SignatureValidator(trusted_cert_paths=[])


def muestra(sufijo: str) -> bytes:
    return (MUESTRAS / f"PAZ Y SALVO BIBLIOTECA{sufijo}.pdf").read_bytes()


def test_sin_firma(validador):
    assert leer_firma(muestra(""), validador).presencia == "ausente"


def test_firmado_intacto(validador):
    lectura = leer_firma(muestra(" firmado"), validador)
    assert lectura.presencia == "presente"
    assert esta_intacta(lectura.resultado) is True


def test_modificado_no_intacto(validador):
    lectura = leer_firma(muestra(" modificado"), validador)
    assert lectura.presencia == "presente"
    assert esta_intacta(lectura.resultado) is False


@pytest.mark.parametrize("contenido", [b"", b"basura"])
def test_danado_es_ausente(validador, contenido):
    lectura = leer_firma(contenido, validador)
    assert lectura.presencia == "ausente"
    assert lectura.resultado is None


def test_restos_de_firma_no_verificables(validador):
    # Bytes que no son un PDF legible pero conservan el diccionario de una firma.
    lectura = leer_firma(b"%PDF-1.7\n1 0 obj << /Type /Sig /ByteRange [0 10 20 30] >> endobj", validador)
    assert lectura.presencia == "no_verificable"
    assert lectura.detalle
