"""Extracción de la cédula: adapta lo que devuelve leer_cedula (modules/cedula) al contrato.

No vuelve a leer nada: traduce los campos de leer_cedula a datos con confianza y decide, con lo que
encontró, si el archivo es una cédula y de qué versión. Corrige dos cosas de la lectura original:
todo lo que no tiene MRZ se trataba como cédula amarilla (aunque no fuera una cédula) y la cédula
de extranjería no existía.
"""

import re
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime
from typing import Literal

from modules.cedula.lectura import ResultadoCedula, leer_cedula

CAMPOS = ("full_name", "identification_type", "identification_number", "birth_date", "sex")

# Se comparan solo letras (sin espacios ni signos): el OCR pega palabras ("LUGARDENACIMIENTO") y
# mete signos sueltos ("GS.RH.").
MARCAS_EXTRANJERIA = ("EXTRANJERIA", "MIGRACIONCOLOMBIA")
# Vocabulario del frente y del reverso de la cédula de ciudadanía. Hacen falta al menos
# MARCAS_MINIMAS distintas: una sola ("fecha de nacimiento") aparece en muchos otros documentos.
VOCABULARIO_CEDULA = (
    "REPUBLICADECOLOMBIA",
    "IDENTIFICACIONPERSONAL",
    "CEDULADECIUDADANIA",
    "REGISTRADURIA",
    "REGISTRADOR",
    "FECHADENACIMIENTO",
    "LUGARDENACIMIENTO",
    "ESTATURA",
    "GSRH",
    "INDICEDERECHO",
    "EXPEDICION",
)
MARCAS_MINIMAS = 2
# Con menos texto que esto no se puede decir que el archivo sea otra cosa: queda ilegible.
TEXTO_MINIMO = 40

DANADO = "El archivo está vacío o dañado."

Formato = Literal["digital", "amarilla_hologramas", "extranjeria"]


@dataclass(frozen=True)
class ExtraccionCedula:
    legible: bool
    # True: es una cédula. False: hay texto, pero de otro documento. None: no se puede saber.
    es_cedula: bool | None
    formato: Formato | None
    # MRZ con dígitos de control válidos (digital y extranjería) o PDF417 leído (amarilla).
    codigo_leido: bool
    datos: dict[str, dict]
    errores: list[str]


def _dato(valor=None, confianza=None) -> dict:
    if valor is None or confianza is None:
        return {"value": None, "confidence": None}
    return {"value": valor, "confidence": confianza}


def _sin_tildes(texto: str) -> str:
    descompuesto = unicodedata.normalize("NFKD", texto.upper())
    return "".join(c for c in descompuesto if not unicodedata.combining(c))


def _confianza(campo: dict, mrz_valido: bool) -> float | None:
    fuente = campo.get("fuente")
    if fuente == "pdf417" or (fuente == "mrz" and mrz_valido):
        return 1.0
    if fuente == "mrz" or campo.get("confianza") is None:
        return None
    return round(float(campo["confianza"]) / 100, 4)


def _fecha(texto: str | None) -> str | None:
    texto = (texto or "").strip()
    for formato in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(texto, formato).date().isoformat()
        except ValueError:
            continue
    if re.fullmatch(r"\d{6}", texto):  # aammdd del MRZ: siglo según el año actual
        anio = int(texto[:2])
        anio += 2000 if anio <= date.today().year % 100 else 1900
        try:
            return date(anio, int(texto[2:4]), int(texto[4:])).isoformat()
        except ValueError:
            return None
    return None


def _normalizar(nombre: str, valor) -> str | None:
    if valor is None:
        return None
    valor = str(valor)
    if nombre == "numero_documento":
        return re.sub(r"\D", "", valor) or None
    if nombre == "fecha_nacimiento":
        return _fecha(valor)
    if nombre == "sexo":
        valor = valor.strip().upper()
        return valor if valor in ("M", "F") else None
    return " ".join(valor.split()) or None


def _formato(resultado: ResultadoCedula, texto: str, hay_pdf417: bool) -> Formato | None:
    letras = re.sub(r"[^A-Z]", "", texto)
    if any(marca in letras for marca in MARCAS_EXTRANJERIA):
        return "extranjeria"
    if resultado.formato == "digital":
        return "digital"
    if hay_pdf417 or sum(marca in letras for marca in VOCABULARIO_CEDULA) >= MARCAS_MINIMAS:
        return "amarilla_hologramas"
    return None


def desde_lectura(resultado: ResultadoCedula) -> ExtraccionCedula:
    texto = _sin_tildes(resultado.texto_ocr or "")
    campos = resultado.campos
    hay_pdf417 = any(c.get("fuente") == "pdf417" and c.get("valor") for c in campos.values())
    mrz_valido = bool(resultado.mrz and resultado.mrz.get("valido") is True)
    formato = _formato(resultado, texto, hay_pdf417)

    if formato is not None:
        es_cedula = True
    elif len(texto.strip()) >= TEXTO_MINIMO:
        es_cedula = False
    else:
        es_cedula = None
    codigo_leido = mrz_valido if formato in ("digital", "extranjeria") else hay_pdf417

    claves = {
        "nombre_completo": "full_name",
        "numero_documento": "identification_number",
        "fecha_nacimiento": "birth_date",
        "sexo": "sex",
    }
    datos = {campo: _dato() for campo in CAMPOS}
    if formato is not None:
        datos["identification_type"] = _dato("C.E." if formato == "extranjeria" else "C.C.", 1.0)
        for origen, clave in claves.items():
            campo = campos.get(origen) or {}
            # Sin muestras de extranjería, solo se confía en lo que trae un MRZ válido.
            if formato == "extranjeria" and campo.get("fuente") != "mrz":
                continue
            datos[clave] = _dato(_normalizar(origen, campo.get("valor")), _confianza(campo, mrz_valido))

    return ExtraccionCedula(
        legible=es_cedula is not None,
        es_cedula=es_cedula,
        formato=formato,
        codigo_leido=codigo_leido,
        datos=datos,
        errores=list(resultado.errores),
    )


def extraer(paginas: list, *, leer=leer_cedula) -> ExtraccionCedula:
    if not paginas:
        return ExtraccionCedula(False, None, None, False, {campo: _dato() for campo in CAMPOS}, [DANADO])
    return desde_lectura(leer(paginas))
