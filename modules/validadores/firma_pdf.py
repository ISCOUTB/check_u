"""Lectura genérica de la firma digital de un PDF, compartida por los validadores.

Distingue tres casos que no son equivalentes:
- ausente: no hay rastro de firma;
- no_verificable: quedan restos de la firma (/Type /Sig o /FT /Sig), pero pyHanko no encuentra
  una firma que pueda validar, como pasa cuando el PDF se abre en el navegador y se guarda de nuevo;
- presente: pyHanko la encuentra; el resultado del SignatureValidator de firma_electronica/ dice si
  está intacta y quién firmó.
"""

import re
from dataclasses import dataclass
from typing import Literal

RESTOS_DE_FIRMA = re.compile(rb"/(?:Type|FT)\s*/Sig\b")

Presencia = Literal["ausente", "no_verificable", "presente"]


@dataclass(frozen=True)
class LecturaFirma:
    presencia: Presencia
    resultado: dict | None
    detalle: str


def _sin_firma_valida(contenido: bytes, detalle: str) -> LecturaFirma:
    presencia = "no_verificable" if RESTOS_DE_FIRMA.search(contenido) else "ausente"
    return LecturaFirma(presencia, None, detalle)


def leer_firma(contenido: bytes, validador, *, allow_fetching: bool = False) -> LecturaFirma:
    """Nunca lanza por un PDF dañado: lo informa como ausente o no verificable."""
    try:
        resultado = validador.validate_bytes(contenido, allow_fetching=allow_fetching)
    except Exception:  # pyHanko lanza varios tipos con un PDF dañado
        return _sin_firma_valida(contenido, "No se pudo leer la estructura del PDF.")
    if not resultado["signed"]:
        return _sin_firma_valida(contenido, resultado["message"])
    return LecturaFirma("presente", resultado, resultado["message"])


def esta_intacta(resultado: dict) -> bool:
    """La firma es válida, el contenido no cambió y cubre todo el archivo (nada agregado después)."""
    return bool(resultado["signature_valid"] and not resultado["modified"] and resultado["entire_file"])
