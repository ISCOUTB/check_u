"""Extracción del reporte Saber Pro del ICFES: solo lee datos con su confianza, no juzga.

Lee el texto del PDF descargado de icfes.gov.co con PyMuPDF, sin OCR. La página 1 del reporte es
una guía que repite el puntaje global como "Ejemplo", así que solo se lee desde "Reporte de
resultados". Un dato que no está junto a su etiqueta o no tiene el formato esperado queda nulo:
nunca se inventa un valor.
"""

import re
from dataclasses import dataclass
from datetime import datetime

import pymupdf

CAMPOS = (
    "full_name",
    "identification_type",
    "identification_number",
    "registration_number",
    "exam_date",
    "global_score",
)

ENCABEZADO = re.compile(r"Reporte\s+de\s+resultados", re.IGNORECASE)
ETIQUETAS = {
    "nombre": re.compile(r"Nombre\s+Completo\s*:", re.IGNORECASE),
    "identificacion": re.compile(r"Identificaci[oó]n\s*:", re.IGNORECASE),
    "registro": re.compile(r"N[uú]mero\s+de\s+registro\s*:", re.IGNORECASE),
    "aplicacion": re.compile(r"Aplicaci[oó]n\s+del\s+examen\s*:", re.IGNORECASE),
    "puntaje": re.compile(r"Puntaje\s+global\b", re.IGNORECASE),
}
FORMATO_IDENTIFICACION = re.compile(r"([A-Z]{1,4}(?:\.[A-Z]{1,2})*\.?)\s*(\d{5,15})")
FORMATO_REGISTRO = re.compile(r"[A-Z]{2}\d{12}")
FORMATO_FECHA = re.compile(r"\d{2}/\d{2}/\d{4}")
FORMATO_PUNTAJE = re.compile(r"(\d{1,3})\s*/\s*300")
PREFIJO_SABER_PRO = "EK"

SIN_TEXTO = "El PDF no tiene texto."
DANADO = "El archivo está vacío o dañado."
PROTEGIDO = "El PDF está protegido con contraseña."

pymupdf.TOOLS.mupdf_display_errors(False)


@dataclass(frozen=True)
class ExtraccionSaberPro:
    tiene_texto: bool
    # True: dice "Reporte de resultados" y el registro es EK. False: hay texto pero es otro
    # documento. None: no se puede saber (sin texto, o falta el número de registro).
    es_reporte: bool | None
    datos: dict[str, dict]
    errores: list[str]


def _dato(valor=None) -> dict:
    return {"value": valor, "confidence": None if valor is None else 1.0}


def _vacia(errores: list[str]) -> ExtraccionSaberPro:
    return ExtraccionSaberPro(False, None, {campo: _dato() for campo in CAMPOS}, errores)


def _valor_de(etiqueta: re.Pattern, texto: str) -> str | None:
    """El valor que sigue a la etiqueta: en la misma línea o, si no hay, en la siguiente con texto."""
    encontrada = etiqueta.search(texto)
    if not encontrada:
        return None
    resto = texto[encontrada.end():].split("\n")
    candidatos = [resto[0].strip(" \t:")] + [linea.strip() for linea in resto[1:]]
    valor = next((c for c in candidatos if c), None)
    # Si lo que sigue es otra etiqueta ("Identificación:"), el dato no está.
    if valor is None or valor.endswith(":"):
        return None
    return " ".join(valor.split())


def _fecha_iso(texto: str | None) -> str | None:
    if not texto or not FORMATO_FECHA.fullmatch(texto):
        return None
    try:
        return datetime.strptime(texto, "%d/%m/%Y").date().isoformat()
    except ValueError:
        return None


def _puntaje(texto: str | None) -> int | None:
    coincidencia = FORMATO_PUNTAJE.fullmatch(texto or "")
    if not coincidencia:
        return None
    puntaje = int(coincidencia.group(1))
    return puntaje if 0 <= puntaje <= 300 else None


def extraer_de_paginas(paginas: list[str]) -> ExtraccionSaberPro:
    texto = "\n".join(paginas)
    if not texto.strip():
        return _vacia([SIN_TEXTO])

    encabezado = ENCABEZADO.search(texto)
    # Sin encabezado no es un reporte Saber Pro; igual se lee lo que haya para explicar qué es.
    seccion = texto[encabezado.start():] if encabezado else texto

    nombre = _valor_de(ETIQUETAS["nombre"], seccion)
    if nombre and not re.search(r"[^\W\d_]", nombre):
        nombre = None
    identificacion = FORMATO_IDENTIFICACION.fullmatch(_valor_de(ETIQUETAS["identificacion"], seccion) or "")
    registro = _valor_de(ETIQUETAS["registro"], seccion)
    registro = registro if registro and FORMATO_REGISTRO.fullmatch(registro) else None

    datos = {
        "full_name": _dato(nombre),
        "identification_type": _dato(identificacion.group(1) if identificacion else None),
        "identification_number": _dato(identificacion.group(2) if identificacion else None),
        "registration_number": _dato(registro),
        "exam_date": _dato(_fecha_iso(_valor_de(ETIQUETAS["aplicacion"], seccion))),
        "global_score": _dato(_puntaje(_valor_de(ETIQUETAS["puntaje"], seccion))),
    }

    if not encabezado:
        es_reporte = False
    elif registro is None:
        es_reporte = None
    else:
        es_reporte = registro.startswith(PREFIJO_SABER_PRO)
    return ExtraccionSaberPro(True, es_reporte, datos, [])


def extraer(contenido: bytes) -> ExtraccionSaberPro:
    """Lee el PDF; un archivo vacío, dañado o protegido se informa en errores, nunca con una excepción."""
    if not contenido:
        return _vacia([DANADO])
    try:
        with pymupdf.open(stream=contenido, filetype="pdf") as documento:
            if documento.needs_pass:
                return _vacia([PROTEGIDO])
            paginas = [pagina.get_text() for pagina in documento]
    except Exception:  # PyMuPDF lanza varios tipos según cómo esté dañado el archivo
        return _vacia([DANADO])
    return extraer_de_paginas(paginas)
