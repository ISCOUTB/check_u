"""Muestras de cédula del repositorio (de muestra, no de personas reales) y un PDF que no es cédula."""

from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[4]
PNG = RAIZ / "modules" / "test_data" / "cedula_alexander_veha_rocha.png"
PDF_ESCANEADO = RAIZ / "modules" / "test_data" / "cc_escaneada.pdf"
PAZ_Y_SALVO = RAIZ / "firma_electronica" / "test" / "samples" / "PAZ Y SALVO BIBLIOTECA.pdf"


@pytest.fixture
def requiere_tesseract():
    """Las pruebas que leen las muestras corren Tesseract; sin él se saltan con un aviso."""
    import pytesseract

    try:
        pytesseract.get_tesseract_version()
    except Exception:
        pytest.skip("Tesseract no está instalado")


@pytest.fixture
def muestra():
    def leer(ruta: Path) -> bytes:
        if not ruta.exists():
            pytest.skip(f"Falta la muestra {ruta}")
        return ruta.read_bytes()

    return leer


@pytest.fixture
def png(muestra) -> bytes:
    return muestra(PNG)


@pytest.fixture
def pdf_escaneado(muestra) -> bytes:
    return muestra(PDF_ESCANEADO)


@pytest.fixture
def paz_y_salvo(muestra) -> bytes:
    return muestra(PAZ_Y_SALVO)
