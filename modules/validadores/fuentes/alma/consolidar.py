"""Consolida los tres criterios en estado general, paz_y_salvo y acciones."""

from __future__ import annotations

from typing import Any, Literal

from .criterios import Criterio

EstadoGeneral = Literal["cumple", "no_cumple", "no_evaluable"]


def consolidar_estado(
    prestamos: Criterio,
    multas: Criterio,
    opcion_grado: Criterio,
) -> tuple[EstadoGeneral, bool | None]:
    """Reglas del issue:

    - algún no_cumple → estado no_cumple, paz_y_salvo false
    - ninguno no_cumple pero alguno no_evaluable → no_evaluable, null
    - los tres cumple → cumple, true
    """
    criterios = (prestamos, multas, opcion_grado)

    if any(c.resultado == "no_cumple" for c in criterios):
        return "no_cumple", False
    if any(c.resultado == "no_evaluable" for c in criterios):
        return "no_evaluable", None
    return "cumple", True


def acciones_requeridas(
    prestamos: Criterio,
    multas: Criterio,
    opcion_grado: Criterio,
) -> list[str]:
    acciones: list[str] = []
    if prestamos.resultado == "no_cumple":
        acciones.append("Devolver los préstamos pendientes en Biblioteca.")
    if multas.resultado == "no_cumple":
        acciones.append("Pagar los cargos pendientes en Biblioteca.")
    if opcion_grado.resultado == "no_cumple":
        acciones.append("Completar la entrega de la opción de grado.")
    return acciones


def mensaje_general(estado: EstadoGeneral, prestamos: Criterio, multas: Criterio, opcion_grado: Criterio) -> str:
    if estado == "cumple":
        return "El estudiante cumple los criterios consultados de paz y salvo."
    if estado == "no_cumple":
        partes = [
            c.mensaje
            for c in (prestamos, multas, opcion_grado)
            if c.resultado == "no_cumple"
        ]
        return " ".join(partes) if partes else "El estudiante no cumple uno o más criterios."
    return (
        "No fue posible determinar el paz y salvo: al menos un criterio no pudo evaluarse."
    )


def criterio_a_dict(nombre: str, c: Criterio) -> dict[str, Any]:
    base: dict[str, Any] = {
        "resultado": c.resultado,
        "motivo": c.motivo,
        "mensaje": c.mensaje,
    }
    if nombre == "prestamos":
        base["pendientes"] = c.pendientes
    elif nombre == "multas":
        base["pendientes"] = c.pendientes
        base["valor_total"] = c.valor_total
        base["moneda"] = c.moneda
    elif nombre == "opcion_grado":
        base["entregada"] = c.entregada
    return base