"""Convierte lo que subió el estudiante (PDF o imagen) en páginas para leer la cédula.

Un PDF se rasteriza con PyMuPDF a 200 ppp, como lo hacía webapp/. Un archivo vacío, dañado o
protegido con contraseña devuelve una lista vacía: el validador lo informa, no lanza.
"""

import io

import pymupdf
from PIL import Image, UnidentifiedImageError

PPP = 200


def _paginas_pdf(contenido: bytes) -> list[Image.Image]:
    with pymupdf.open(stream=contenido, filetype="pdf") as documento:
        if documento.needs_pass:
            return []
        escala = pymupdf.Matrix(PPP / 72, PPP / 72)
        paginas = []
        for pagina in documento:
            imagen = pagina.get_pixmap(matrix=escala)
            paginas.append(Image.frombytes("RGB", (imagen.width, imagen.height), imagen.samples))
        return paginas


def cargar_paginas(contenido: bytes) -> list[Image.Image]:
    if not contenido:
        return []
    try:
        if contenido.startswith(b"%PDF"):
            return _paginas_pdf(contenido)
        with Image.open(io.BytesIO(contenido)) as imagen:
            return [imagen.convert("RGB")]
    except (UnidentifiedImageError, OSError, ValueError, RuntimeError):
        return []
