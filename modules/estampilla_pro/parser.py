"""Analizador del HTML del servicio de comprobantes de estampilla (Tarea 22).

Extrae los campos requeridos tolerando HTML mal formado (etiquetas sin cerrar,
espacios de no separación U+00A0, atributos mal escapados).

No almacena el HTML completo ni el enlace de descarga del certificado.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import lxml.html


class EstructuraInvalidaError(ValueError):
    """El HTML no contiene los elementos mínimos esperados o cambió de estructura."""


@dataclass(frozen=True)
class ConceptoLiquidado:
    renta: str
    concepto: str
    valor: int
    estado: str


@dataclass(frozen=True)
class DetalleRecibo:
    recibo_oficial: str
    estado_general: str
    documento_parcial: str | None
    nombre_anonimizado: str | None
    fecha_pago: str  # Formato ISO AAAA-MM-DD
    conceptos: list[ConceptoLiquidado]
    tiene_pro_cultura: bool
    valor_pro_cultura: int | None
    estado_pro_cultura: str | None
    pagado_general: bool
    pagado_pro_cultura: bool


def normalizar_texto(texto: str | None) -> str:
    """Normaliza texto: quita acentos, reemplaza U+00A0 por espacio y pasa a minúsculas."""
    if not texto:
        return ""
    limpio = texto.replace("\u00a0", " ").strip()
    sin_tildes = unicodedata.normalize("NFKD", limpio).encode("ASCII", "ignore").decode("utf-8")
    return " ".join(sin_tildes.lower().split())


def _es_concepto_pro_cultura(concepto: str) -> bool:
    """Detecta si el concepto corresponde a Estampilla Pro-Cultura tolerando variantes."""
    norm = normalizar_texto(concepto).replace("-", " ")
    palabras = set(norm.split())
    # Debe ser "pro cultura" o "procultura", descartando prodesarrollo u otros conceptos
    if "prodesarrollo" in norm:
        return False
    if "procultura" in norm:
        return True
    return "pro" in palabras and "cultura" in palabras


def _parsear_valor_entero(texto_valor: str) -> int:
    """Convierte '$ 70,036' o '70.036' a 70036."""
    solo_digitos = re.sub(r"[^\d]", "", texto_valor or "")
    if not solo_digitos:
        return 0
    return int(solo_digitos)


def _parsear_fecha_iso(texto_fecha: str) -> str:
    """Convierte fechas como '2026-10-13' o '13/10/2026' a formato ISO 'AAAA-MM-DD'."""
    limpio = texto_fecha.strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            dt = datetime.strptime(limpio, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    # Si no coincide con formatos conocidos, intentar extraer patrón AAAA-MM-DD
    match = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", limpio)
    if match:
        return match.group(1)
    raise EstructuraInvalidaError(f"No fue posible convertir la fecha a ISO: {texto_fecha!r}")


def _extraer_label(doc: Any, target_label: str) -> str | None:
    """Busca el valor del span asociado a un <label> con texto coincidente."""
    target_norm = normalizar_texto(target_label)
    for lbl in doc.xpath(".//label"):
        lbl_norm = normalizar_texto(lbl.text_content())
        if lbl_norm.startswith(target_norm):
            # 1. Buscar en hermanos siguientes
            hermanos = lbl.xpath("./following-sibling::span")
            if hermanos:
                return hermanos[0].text_content().strip()
            # 2. Buscar en el contenedor padre
            padre = lbl.getparent()
            if padre is not None:
                spans_padre = padre.xpath("./span")
                if spans_padre:
                    return spans_padre[0].text_content().strip()
    return None


def parsear_detalle_recibo(html: str) -> DetalleRecibo:
    """Analiza el HTML del recibo y retorna DetalleRecibo.

    Lanza EstructuraInvalidaError si la estructura no contiene los datos esperados.
    """
    if not html or not isinstance(html, str) or not html.strip():
        raise EstructuraInvalidaError("El contenido HTML está vacío.")

    try:
        doc = lxml.html.fromstring(html)
    except Exception as error:
        raise EstructuraInvalidaError(f"Fallo al interpretar el HTML: {error}") from error

    # 1. Estado general (badge en card-header)
    badges = doc.xpath('.//div[contains(@class, "card-header")]//span[contains(@class, "badge")]')
    if not badges:
        # Intento de fallback a cualquier span en card-header
        badges = doc.xpath('.//div[contains(@class, "card-header")]//span')
    if not badges:
        raise EstructuraInvalidaError("No se encontró la insignia de estado general en card-header.")

    estado_general_texto = badges[0].text_content().strip()
    pagado_general = normalizar_texto(estado_general_texto) == "pagado"

    # 2. Datos por label
    recibo_oficial = _extraer_label(doc, "Recibo Oficial")
    if not recibo_oficial:
        # Fallback a texto en card-header si viene allí
        recibo_oficial = ""

    contribuyente_raw = _extraer_label(doc, "Contribuyente") or ""
    documento_parcial: str | None = None
    nombre_anonimizado: str | None = None

    if "-" in contribuyente_raw:
        partes = [p.strip() for p in contribuyente_raw.split("-", 1)]
        documento_parcial = partes[0] if partes[0] else None
        nombre_anonimizado = partes[1] if len(partes) > 1 and partes[1] else None
    elif contribuyente_raw:
        # Si no hay guion, verificar si parece documento o nombre
        if any(c in contribuyente_raw for c in ("*", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9")):
            documento_parcial = contribuyente_raw
        else:
            nombre_anonimizado = contribuyente_raw

    fecha_pago_raw = _extraer_label(doc, "Fecha De Pago")
    if not fecha_pago_raw:
        raise EstructuraInvalidaError("No se encontró la etiqueta 'Fecha De Pago'.")
    fecha_pago_iso = _parsear_fecha_iso(fecha_pago_raw)

    # 3. Tabla de conceptos
    filas_tr = doc.xpath(".//table//tbody/tr")
    if not filas_tr:
        raise EstructuraInvalidaError("No se encontraron filas de conceptos liquidados en la tabla.")

    conceptos: list[ConceptoLiquidado] = []
    tiene_pro_cultura = False
    valor_pro_cultura: int | None = None
    estado_pro_cultura: str | None = None
    pagado_pro_cultura = False

    for tr in filas_tr:
        celdas = tr.xpath("./td")
        if not celdas:
            continue
        # Fila normal: 4 columnas (Renta, Conceptos Liquidados, Valor, Estado)
        if len(celdas) >= 4:
            renta_col = celdas[0].text_content().strip()
            concepto_col = celdas[1].text_content().strip()
            valor_col = _parsear_valor_entero(celdas[2].text_content())
            estado_col = celdas[3].text_content().strip()

            conceptos.append(
                ConceptoLiquidado(
                    renta=renta_col,
                    concepto=concepto_col,
                    valor=valor_col,
                    estado=estado_col,
                )
            )

            if _es_concepto_pro_cultura(concepto_col):
                tiene_pro_cultura = True
                valor_pro_cultura = valor_col
                estado_pro_cultura = estado_col
                if normalizar_texto(estado_col) == "pagado":
                    pagado_pro_cultura = True

    return DetalleRecibo(
        recibo_oficial=recibo_oficial,
        estado_general=estado_general_texto,
        documento_parcial=documento_parcial,
        nombre_anonimizado=nombre_anonimizado,
        fecha_pago=fecha_pago_iso,
        conceptos=conceptos,
        tiene_pro_cultura=tiene_pro_cultura,
        valor_pro_cultura=valor_pro_cultura,
        estado_pro_cultura=estado_pro_cultura,
        pagado_general=pagado_general,
        pagado_pro_cultura=pagado_pro_cultura,
    )
