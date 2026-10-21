"""Evaluación de los tres criterios de paz y salvo a partir de listados ALMA.

Falla cerrado: si el listado no está completo o hubo error de cliente, el
criterio es no_evaluable (nunca cumple).

Los nombres de campo de ALMA se confirman cuando haya respuestas reales;
mientras tanto se usan claves habituales de la doc Users y, si no aparecen,
el criterio queda no_evaluable por datos incompletos.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from .cliente import AlmaClienteError, ListaAlma

ResultadoCriterio = Literal["cumple", "no_cumple", "no_evaluable"]
MotivoNoEvaluable = Literal[
    "source_unavailable",
    "incomplete_data",
    "source_pending",
]


@dataclass(frozen=True)
class Criterio:
    resultado: ResultadoCriterio
    pendientes: int | None
    motivo: MotivoNoEvaluable | None
    mensaje: str
    # Solo multas
    valor_total: float | None = None
    moneda: str | None = None
    # Solo opción de grado
    entregada: bool | None = None


def _criterio_por_error(error: AlmaClienteError) -> Criterio:
    return Criterio(
        resultado="no_evaluable",
        pendientes=None,
        motivo="source_unavailable",
        mensaje=error.mensaje,
    )


def _criterio_listado_incompleto(lista: ListaAlma) -> Criterio:
    return Criterio(
        resultado="no_evaluable",
        pendientes=None,
        motivo="incomplete_data",
        mensaje=lista.detalle,
    )


def _prestamo_activo(item: dict[str, Any]) -> bool | None:
    """True si cuenta como pendiente, False si no, None si no se puede saber."""
    # Claves candidatas (doc ALMA / instalaciones reales pueden variar).
    for clave in ("loan_status", "status", "status_code"):
        valor = item.get(clave)
        if valor is None:
            continue
        texto = str(valor).strip().lower()
        if texto in ("active", "activo", "loaned", "en préstamo", "en prestamo"):
            return True
        if texto in ("complete", "completed", "returned", "devuelto", "histórico", "historico"):
            return False
    # Si trae due_date / loan_id y no hay estado claro, se asume activo
    # solo cuando el listado es de préstamos vigentes (API loans por defecto).
    if item.get("loan_id") or item.get("item_loan_id"):
        return True
    return None


def evaluar_prestamos(lista: ListaAlma) -> Criterio:
    if not lista.completo:
        return _criterio_listado_incompleto(lista)

    activos = 0
    desconocidos = 0
    for item in lista.items:
        estado = _prestamo_activo(item)
        if estado is True:
            activos += 1
        elif estado is None:
            desconocidos += 1

    if desconocidos:
        return Criterio(
            resultado="no_evaluable",
            pendientes=None,
            motivo="incomplete_data",
            mensaje="No se pudo interpretar el estado de uno o más préstamos.",
        )

    if activos == 0:
        return Criterio(
            resultado="cumple",
            pendientes=0,
            motivo=None,
            mensaje="No tiene préstamos pendientes de devolución.",
        )

    return Criterio(
        resultado="no_cumple",
        pendientes=activos,
        motivo=None,
        mensaje=f"Tiene {activos} préstamo(s) pendiente(s) de devolución.",
    )


def _multa_pendiente(item: dict[str, Any]) -> bool | None:
    for clave in ("status", "fee_status", "status_code"):
        valor = item.get(clave)
        if valor is None:
            continue
        texto = str(valor).strip().lower()
        if texto in ("active", "outstanding", "open", "pendiente", "unpaid"):
            return True
        if texto in ("closed", "paid", "cancelled", "canceled", "waived", "pagado"):
            return False
    # Sin estado: si hay monto > 0 se trata como pendiente; si no, desconocido.
    for clave in ("balance", "remaining_amount", "amount"):
        if clave in item:
            try:
                return float(item[clave]) > 0
            except (TypeError, ValueError):
                return None
    return None


def _monto_y_moneda(item: dict[str, Any]) -> tuple[float, str | None]:
    monto = 0.0
    for clave in ("balance", "remaining_amount", "amount"):
        if clave in item:
            try:
                monto = float(item[clave])
                break
            except (TypeError, ValueError):
                pass
    moneda = None
    for clave in ("currency", "currency_code", "moneda"):
        if item.get(clave):
            moneda = str(item[clave])
            break
    return monto, moneda


def evaluar_multas(lista: ListaAlma) -> Criterio:
    if not lista.completo:
        return _criterio_listado_incompleto(lista)

    pendientes = 0
    total = 0.0
    moneda: str | None = None
    desconocidos = 0

    for item in lista.items:
        estado = _multa_pendiente(item)
        if estado is True:
            pendientes += 1
            m, mon = _monto_y_moneda(item)
            total += m
            if mon and moneda is None:
                moneda = mon
        elif estado is None:
            desconocidos += 1

    if desconocidos:
        return Criterio(
            resultado="no_evaluable",
            pendientes=None,
            motivo="incomplete_data",
            mensaje="No se pudo interpretar el estado de uno o más cargos.",
            valor_total=None,
            moneda=None,
        )

    if pendientes == 0:
        return Criterio(
            resultado="cumple",
            pendientes=0,
            motivo=None,
            mensaje="No tiene multas ni cargos pendientes de pago.",
            valor_total=0.0,
            moneda=moneda,
        )

    return Criterio(
        resultado="no_cumple",
        pendientes=pendientes,
        motivo=None,
        mensaje=f"Tiene {pendientes} cargo(s) pendiente(s) de pago.",
        valor_total=total,
        moneda=moneda or "COP",
    )


def evaluar_opcion_grado(lista: ListaAlma | None = None) -> Criterio:
    """La fuente institucional aún no está definida por Biblioteca.

    Hasta que confirmen si las solicitudes ALMA representan la opción de grado
    (y qué tipos cuentan), el criterio es no_evaluable / source_pending.
    """
    # No usamos el listado aún: evitar falsos cumple/no_cumple.
    _ = lista
    return Criterio(
        resultado="no_evaluable",
        pendientes=None,
        motivo="source_pending",
        mensaje="La fuente de datos de la opción de grado aún no está definida.",
        entregada=None,
    )


def criterio_desde_excepcion(error: Exception) -> Criterio:
    if isinstance(error, AlmaClienteError):
        return _criterio_por_error(error)
    return Criterio(
        resultado="no_evaluable",
        pendientes=None,
        motivo="source_unavailable",
        mensaje=f"No se pudo consultar ALMA ({type(error).__name__}).",
    )