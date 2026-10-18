import pytest

from modules.validadores.cedula.calidad import ANCHO_MINIMO, NITIDEZ_MINIMA, Calidad, es_suficiente, medir
from modules.validadores.cedula.paginas import cargar_paginas


def test_png_una_pagina(png):
    paginas = cargar_paginas(png)
    assert len(paginas) == 1
    assert paginas[0].size[0] == 1024


def test_pdf_una_pagina(pdf_escaneado):
    assert len(cargar_paginas(pdf_escaneado)) >= 1


@pytest.mark.parametrize("contenido", [b"", b"basura", b"%PDF-1.7 roto"])
def test_bytes_que_no_son_documento(contenido):
    assert cargar_paginas(contenido) == []


def test_medir_devuelve_valores(png):
    (calidad,) = medir(cargar_paginas(png))
    assert calidad.ancho == 1024
    assert calidad.nitidez > 0


def test_umbrales_provisionales():
    assert (ANCHO_MINIMO, NITIDEZ_MINIMA) == (1000, 100.0)


@pytest.mark.parametrize(
    ("calidad", "suficiente"),
    [(Calidad(999, 500.0), False), (Calidad(1000, 100.0), True), (Calidad(2000, 99.9), False)],
)
def test_es_suficiente(calidad, suficiente):
    assert es_suficiente(calidad) is suficiente
