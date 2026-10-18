"""SignatureValidator ampliado: las claves de siempre no cambian y se agregan las del firmante."""

from pathlib import Path

import pytest

from firma_electronica.infra.sign_validator import SignatureValidator

MUESTRAS = Path(__file__).resolve().parent / "samples"
FIRMADO = MUESTRAS / "PAZ Y SALVO BIBLIOTECA firmado.pdf"
MODIFICADO = MUESTRAS / "PAZ Y SALVO BIBLIOTECA modificado.pdf"
SIN_FIRMA = MUESTRAS / "PAZ Y SALVO BIBLIOTECA.pdf"

CLAVES_DE_SIEMPRE = {"signed", "valid", "modified", "certificate_trusted", "message"}


@pytest.fixture
def validador():
    # Sin raíces: biblioteca.crt no está en el repositorio (nunca se suben certificados de firma).
    return SignatureValidator(trusted_cert_paths=[])


def test_firmado(validador):
    resultado = validador.validate(FIRMADO)
    assert CLAVES_DE_SIEMPRE <= set(resultado)
    assert resultado["signed"] is True
    assert resultado["modified"] is False
    assert resultado["certificate_trusted"] is False
    assert resultado["signature_valid"] is True
    assert resultado["signer_organization"] == "Biblioteca"
    assert resultado["entire_file"] is True
    assert resultado["revoked"] is False
    assert resultado["trust_problem"] == "CHAIN_CONSTRAINTS_FAILURE"
    assert resultado["signer_not_after"] is not None
    assert resultado["issued_by_trusted_root"] is False


def test_modificado(validador):
    resultado = validador.validate(MODIFICADO)
    assert resultado["signed"] is True
    assert resultado["modified"] is True


def test_sin_firma(validador):
    resultado = validador.validate(SIN_FIRMA)
    assert resultado["signed"] is False
    assert resultado["signer_organization"] is None


def test_validate_y_validate_bytes_coinciden(validador):
    for pdf in (FIRMADO, MODIFICADO, SIN_FIRMA):
        assert validador.validate(pdf) == validador.validate_bytes(pdf.read_bytes())
