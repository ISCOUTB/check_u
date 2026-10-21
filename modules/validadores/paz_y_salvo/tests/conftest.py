"""Las 3 muestras del repo (firma_electronica/test/samples): "Documento de pruebas", estudiante inventado."""

from pathlib import Path

import pytest

MUESTRAS = Path(__file__).resolve().parents[4] / "firma_electronica" / "test" / "samples"


def _muestra(sufijo: str) -> bytes:
    ruta = MUESTRAS / f"PAZ Y SALVO BIBLIOTECA{sufijo}.pdf"
    if not ruta.exists():
        pytest.skip(f"Falta la muestra {ruta}")
    return ruta.read_bytes()


@pytest.fixture
def sin_firma() -> bytes:
    return _muestra("")


@pytest.fixture
def firmado() -> bytes:
    return _muestra(" firmado")


@pytest.fixture
def modificado() -> bytes:
    return _muestra(" modificado")
