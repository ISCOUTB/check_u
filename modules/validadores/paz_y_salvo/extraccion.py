"""Extracción del Paz y Salvo de Biblioteca: solo lee, no juzga.

Lee el texto del PDF con PyMuPDF (solo PDF con texto: un escaneo queda por revisar). El formato se
confirmó el 23/10/2026 con un Paz y Salvo real (la Biblioteca lo genera con una plantilla y lo imprime
con Microsoft Print to PDF, sin firma digital):
"El Sistema de Bibliotecas ... hace constar que el alumno NOMBRE identificado con el código T...
se encuentra paz y salvo."
"""

import re
import unicodedata
from dataclasses import dataclass
from typing import Literal

import pymupdf

CAMPOS = ("full_name", "code_student")
TEXTO_MINIMO = 40

DANADO = "El archivo está vacío o dañado."
SIN_TEXTO = "El PDF no tiene texto."
PROTEGIDO = "El PDF está protegido con contraseña."

# Sobre el texto normalizado (mayúsculas, sin tildes). La negación se busca primero: "no se
# encuentra paz y salvo" también contiene "se encuentra paz y salvo".
NEGACION = re.compile(r"\bNO\s+SE\s+ENCUENTRA\s+(?:A\s+)?PAZ\s+Y\s+SALVO\b")
AFIRMACION = re.compile(r"\bSE\s+ENCUENTRA\s+(?:A\s+)?PAZ\s+Y\s+SALVO\b")
NOMBRE = re.compile(r"\b(?:EL|LA)\s+(?:ALUMN[OA]|ESTUDIANTE)\s+(.+?)\s+IDENTIFICAD", re.DOTALL)
CODIGO = re.compile(r"\bCODIGO\s*(?:NO\.?\s*)?(T\d{6,10})\b")
PALABRA_DE_NOMBRE = re.compile(r"[^\W\d_]+(?:[-'’][^\W\d_]+)*")
PALABRAS_MAXIMAS = 6
# No cuentan para el tope: "MARÍA DEL PILAR DE LA HOZ PÉREZ" son 4 palabras propias, no 7.
PARTICULAS = {"DE", "DEL", "LA", "LAS", "LOS", "Y"}

Estado = Literal["paz_y_salvo", "no_paz_y_salvo"]

pymupdf.TOOLS.mupdf_display_errors(False)


@dataclass(frozen=True)
class ExtraccionPazYSalvo:
    tiene_texto: bool
    # True: dice "PAZ Y SALVO" y "BIBLIOTECA". False: hay texto de otro documento. None: sin texto.
    es_paz_y_salvo: bool | None
    estado: Estado | None
    datos: dict[str, dict]
    errores: list[str]


def _dato(valor=None) -> dict:
    return {"value": valor, "confidence": None if valor is None else 1.0}


def _vacia(errores: list[str]) -> ExtraccionPazYSalvo:
    return ExtraccionPazYSalvo(False, None, None, {campo: _dato() for campo in CAMPOS}, errores)


def _normalizar(texto: str) -> str:
    """Mayúsculas y sin tildes, carácter por carácter: las posiciones coinciden con el original."""
    salida = []
    for caracter in texto:
        base = "".join(c for c in unicodedata.normalize("NFKD", caracter) if not unicodedata.combining(c))
        salida.append((base.upper() or caracter)[:1] or caracter)
    return "".join(salida)


def extraer_de_texto(texto: str) -> ExtraccionPazYSalvo:
    if not texto.strip():
        return _vacia([SIN_TEXTO])
    normal = _normalizar(texto)

    if re.search(r"\bPAZ\s+Y\s+SALVO\b", normal) and "BIBLIOTECA" in normal:
        es_paz_y_salvo = True
    else:
        es_paz_y_salvo = False if len(texto.strip()) >= TEXTO_MINIMO else None

    if NEGACION.search(normal):
        estado = "no_paz_y_salvo"
    elif AFIRMACION.search(normal):
        estado = "paz_y_salvo"
    else:
        estado = None

    nombre = None
    encontrado = NOMBRE.search(normal)
    if encontrado:
        # Del texto original, para conservar las mayúsculas y tildes con que viene.
        palabras = texto[encontrado.start(1) : encontrado.end(1)].split()
        # Un nombre son de 2 a 6 palabras propias solo con letras (se admiten guion y apóstrofo; las
        # partículas como "de la" no cuentan): así no se toma como nombre un código ("con el código
        # T…") ni un párrafo entero.
        propias = [p for p in palabras if _normalizar(p) not in PARTICULAS]
        if 2 <= len(propias) <= PALABRAS_MAXIMAS and all(PALABRA_DE_NOMBRE.fullmatch(p) for p in palabras):
            nombre = " ".join(palabras)
    codigo = CODIGO.search(normal)

    datos = {"full_name": _dato(nombre), "code_student": _dato(codigo.group(1) if codigo else None)}
    return ExtraccionPazYSalvo(True, es_paz_y_salvo, estado, datos, [])


def extraer(contenido: bytes) -> ExtraccionPazYSalvo:
    """Un archivo vacío, dañado o protegido se informa en errores, nunca con una excepción."""
    if not contenido:
        return _vacia([DANADO])
    try:
        with pymupdf.open(stream=contenido, filetype="pdf") as documento:
            # PyMuPDF abre otros formatos (un HTML renombrado, por ejemplo) adivinando cuál es.
            if not documento.is_pdf:
                return _vacia([DANADO])
            if documento.needs_pass:
                return _vacia([PROTEGIDO])
            # En el orden en que se ve: un PDF editado puede guardar el texto en otro orden.
            texto = "\n".join(pagina.get_text(sort=True) for pagina in documento)
            reparado = documento.is_repaired
    except Exception:  # PyMuPDF lanza varios tipos según cómo esté dañado el archivo
        return _vacia([DANADO])
    # Un PDF que hubo que reparar y quedó sin texto está cortado o dañado, no es un escaneo.
    if reparado and not texto.strip():
        return _vacia([DANADO])
    return extraer_de_texto(texto)
