"""Extracción del certificado de pago de la Estampilla Pro-Cultura: solo lee, no juzga.

Lee el texto del PDF con PyMuPDF (solo PDF con texto: un escaneo queda por revisar). El formato es el
del certificado que genera la Gobernación de Bolívar (Secretaría de Hacienda), visto en uno real el
23/10/2026:
"Recibo Oficial: N / Contribuyente: DOCUMENTO - NOMBRE / Fecha de Pago: DD Mmm AAAA / … una fila
'Estampilla Pro-Cultura $ V Pagado' en la tabla de conceptos liquidados".
"""

import re
import unicodedata
from dataclasses import dataclass
from datetime import date

import pymupdf

CAMPOS = ("receipt_number", "identification_number", "full_name", "payment_date", "pro_cultura_amount")
TEXTO_MINIMO = 40

DANADO = "El archivo está vacío o dañado."
SIN_TEXTO = "El PDF no tiene texto."
PROTEGIDO = "El PDF está protegido con contraseña."

# Sobre el texto normalizado (mayúsculas, sin tildes).
RECIBO = re.compile(r"\bRECIBO\s+OFICIAL\s*:\s*(\d{6,20})\b")
CONTRIBUYENTE = re.compile(r"\bCONTRIBUYENTE\s*:\s*(\d{5,15})\s*-\s*([^\n]+)")
FECHA = re.compile(
    r"\bFECHA\s+DE\s+PAGO\s*:\s*(?:(\d{4})-(\d{2})-(\d{2})|(\d{1,2})\s+([A-Z]{3})[A-Z]*\.?\s+(\d{4}))"
)
# La etiqueta se busca sola: con guion, raya o espacio ("PRO-CULTURA", "PRO – CULTURA", "PROCULTURA"),
# o partida en dos renglones de su celda ("…ESTAMPILLA PRO-   $ 70.036   PAGADO\n   CULTURA"). El valor
# y el estado se leen después, en la región de la fila.
ETIQUETA_PRO_CULTURA = re.compile(
    r"ESTAMPILLA\s+PRO\s*[-–—]?\s*CULTURA\b|ESTAMPILLA\s+PRO\b\s*[-–—]?[^\n]*\n\s*CULTURA\b"
)
# Hasta 20 caracteres y no pegado a más dígitos: un número más largo no es un valor (y int() no
# acepta más de 4300 dígitos).
VALOR = re.compile(r"(?<![\d.,])(\d[\d.,]{0,19})(?![\d.,])")
PAGADOS = {"PAGADO", "PAGADA"}
ESTADOS = PAGADOS | {"PENDIENTE", "ANULADO", "ANULADA", "VENCIDO", "VENCIDA", "REVERSADO", "REVERSADA"}
MESES = {
    "ENE": 1, "JAN": 1, "FEB": 2, "MAR": 3, "ABR": 4, "APR": 4, "MAY": 5, "JUN": 6, "JUL": 7,
    "AGO": 8, "AUG": 8, "SEP": 9, "SET": 9, "OCT": 10, "NOV": 11, "DIC": 12, "DEC": 12,
}  # fmt: skip
DECIMALES = re.compile(r"[.,]\d{2}$")

PALABRA_DE_NOMBRE = re.compile(r"[^\W\d_]+(?:[-'’][^\W\d_]+)*")
PALABRAS_MAXIMAS = 6
# No cuentan para el tope: "MARÍA DEL PILAR DE LA HOZ PÉREZ" son 4 palabras propias, no 7.
PARTICULAS = {"DE", "DEL", "LA", "LAS", "LOS", "Y"}

pymupdf.TOOLS.mupdf_display_errors(False)


@dataclass(frozen=True)
class ExtraccionEstampilla:
    tiene_texto: bool
    # True: es un certificado de pago de Bolívar. False: hay texto de otro documento. None: sin texto.
    es_certificado: bool | None
    fila_pro_cultura: bool
    # El estado de la fila Pro-Cultura, uno de ESTADOS ("PAGADO", "PENDIENTE"…), o None si no se leyó.
    estado_pro_cultura: str | None
    datos: dict[str, dict]
    errores: list[str]


def _dato(valor=None) -> dict:
    return {"value": valor, "confidence": None if valor is None else 1.0}


def _vacia(errores: list[str]) -> ExtraccionEstampilla:
    return ExtraccionEstampilla(False, None, False, None, {campo: _dato() for campo in CAMPOS}, errores)


def _normalizar(texto: str) -> str:
    """Mayúsculas y sin tildes, carácter por carácter: las posiciones coinciden con el original."""
    salida = []
    for caracter in texto:
        base = "".join(c for c in unicodedata.normalize("NFKD", caracter) if not unicodedata.combining(c))
        salida.append((base.upper() or caracter)[:1] or caracter)
    return "".join(salida)


def _nombre(texto: str) -> str | None:
    """De 2 a 6 palabras propias solo con letras (guion y apóstrofo valen); las partículas no cuentan."""
    palabras = texto.split()
    propias = [p for p in palabras if _normalizar(p) not in PARTICULAS]
    if 2 <= len(propias) <= PALABRAS_MAXIMAS and all(PALABRA_DE_NOMBRE.fullmatch(p) for p in palabras):
        return " ".join(palabras)
    return None


def _fecha(encontrada: re.Match) -> str | None:
    anio, mes, dia, dia_corto, mes_corto, anio_corto = encontrada.groups()
    try:
        if anio:
            fecha = date(int(anio), int(mes), int(dia))
        else:
            if mes_corto not in MESES:
                return None
            fecha = date(int(anio_corto), MESES[mes_corto], int(dia_corto))
    except ValueError:  # 31 de febrero y similares
        return None
    return fecha.isoformat()


def _pesos(texto: str) -> int:
    """'70.036' y '70,036' son 70036; '70.036,00' también (se quitan los 2 decimales)."""
    return int(re.sub(r"\D", "", DECIMALES.sub("", texto)) or 0)


def _fila_pro_cultura(normal: str) -> tuple[bool, int | None, str | None]:
    """(hay fila, valor, estado). Valor y estado se buscan desde la etiqueta hasta el fin del renglón
    donde termina: así no se toma el estado del Total, que va en el renglón siguiente."""
    etiqueta = ETIQUETA_PRO_CULTURA.search(normal)
    if not etiqueta:
        return False, None, None
    fin = normal.find("\n", etiqueta.end())
    region = normal[etiqueta.start() : fin if fin >= 0 else len(normal)]
    valor = VALOR.search(region)
    estado = next((palabra for palabra in re.findall(r"[A-Z]+", region) if palabra in ESTADOS), None)
    return True, _pesos(valor.group(1)) if valor else None, estado


def extraer_de_texto(texto: str) -> ExtraccionEstampilla:
    if not texto.strip():
        return _vacia([SIN_TEXTO])
    normal = _normalizar(texto)

    if "CERTIFICADO DE PAGO" in normal and "BOLIVAR" in normal and "HACIENDA" in normal:
        es_certificado = True
    else:
        es_certificado = False if len(texto.strip()) >= TEXTO_MINIMO else None

    recibo = RECIBO.search(normal)
    contribuyente = CONTRIBUYENTE.search(normal)
    nombre = None
    if contribuyente:
        # Del texto original, para conservar las mayúsculas y tildes con que viene.
        nombre = _nombre(texto[contribuyente.start(2) : contribuyente.end(2)])
    fecha = FECHA.search(normal)
    hay_fila, valor, estado = _fila_pro_cultura(normal)

    datos = {
        "receipt_number": _dato(recibo.group(1) if recibo else None),
        "identification_number": _dato(contribuyente.group(1) if contribuyente else None),
        "full_name": _dato(nombre),
        "payment_date": _dato(_fecha(fecha) if fecha else None),
        "pro_cultura_amount": _dato(valor),
    }
    return ExtraccionEstampilla(True, es_certificado, hay_fila, estado, datos, [])


def extraer(contenido: bytes) -> ExtraccionEstampilla:
    """Un archivo vacío, dañado, protegido o que no es PDF se informa en errores, nunca con una excepción."""
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
