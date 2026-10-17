"""Adaptador del RUI (ventanillasocial.dnp.gov.co), separado de la lectura y de webapp/.

Reutiliza modules/check_id/rui/consultar.py. El RUI no es una API documentada para terceros: si
falla, cambia o responde algo inesperado, el resultado es "sin_respuesta" (la regla queda
no_evaluable), nunca una discrepancia.

Pendiente: consultar.py envía siempre el tipo de documento "3", un supuesto sin verificar contra el
DNP.
"""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal

Estado = Literal["encontrado", "sin_registro", "sin_respuesta"]


@dataclass(frozen=True)
class RespuestaRui:
    estado: Estado
    nombre: str | None
    detalle: str


def consultar_rui(numero: str, *, consulta: Callable[[dict], dict] | None = None) -> RespuestaRui:
    if consulta is None:
        from modules.check_id.rui.consultar import consultar as consulta

    try:
        respuesta = consulta({"id": numero})
        exito = respuesta["success"]
        nombre = (respuesta.get("data") or {}).get("nombre_completo") or None
    except Exception as error:  # red caída, JSON inválido, formato distinto: la fuente no respondió
        return RespuestaRui("sin_respuesta", None, f"No se pudo consultar el RUI ({type(error).__name__}).")

    if exito is True and nombre:
        return RespuestaRui("encontrado", nombre, "El RUI encontró a la persona.")
    return RespuestaRui("sin_registro", None, "El RUI no tiene información para ese número de documento.")
