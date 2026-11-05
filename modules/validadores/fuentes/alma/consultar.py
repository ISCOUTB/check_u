"""API pública: consultar_paz_y_salvo(user_id) y consultar_para_checku(user_id, identidad)."""

from __future__ import annotations

import logging
import re
import unicodedata
from typing import Any

from modules.validadores.resultado import ahora_bogota

from .cliente import AlmaCliente
from .config import crear_cliente
from .simulado import AlmaClienteSimulado
from .criterios import (
    criterio_desde_excepcion,
    evaluar_multas,
    evaluar_opcion_grado,
    evaluar_prestamos,
    evaluar_solicitudes,
)
from .consolidar import (
    acciones_requeridas,
    consolidar_estado,
    criterio_a_dict,
    mensaje_general,
)


def consultar_paz_y_salvo(
    user_id: str,
    *,
    cliente: AlmaCliente | None = None,
) -> dict[str, Any]:
    """Consulta préstamos, multas y opción de grado; devuelve el JSON consolidado.

    No incluye respuestas crudas de ALMA ni datos personales innecesarios.
    `cliente` se inyecta en tests; en uso normal sale de ALMA_MODO (simulado o real).
    """
    alma = cliente if cliente is not None else crear_cliente()
    consultado = ahora_bogota()

    try:
        lista_prestamos = alma.prestamos(user_id)
        prestamos = evaluar_prestamos(lista_prestamos)
    except Exception as error:
        prestamos = criterio_desde_excepcion(error)

    try:
        lista_multas = alma.multas(user_id)
        multas = evaluar_multas(lista_multas)
    except Exception as error:
        multas = criterio_desde_excepcion(error)

    try:
        lista_solicitudes = alma.solicitudes(user_id)
        solicitudes = evaluar_solicitudes(lista_solicitudes)
    except Exception as error:
        solicitudes = criterio_desde_excepcion(error)

    # Informativo: la fuente de la opción de grado sigue sin definirse (Tarea 50).
    opcion_grado = evaluar_opcion_grado(None)

    estado, paz_y_salvo = consolidar_estado(prestamos, multas, solicitudes)
    acciones = acciones_requeridas(prestamos, multas, solicitudes)
    mensaje = mensaje_general(estado, prestamos, multas, solicitudes)

    return {
        "user_id": str(user_id).strip(),
        "estado": estado,
        "paz_y_salvo": paz_y_salvo,
        "consultado_en": consultado.isoformat(timespec="seconds"),
        "valido_hasta": None,
        "criterios": {
            "prestamos": criterio_a_dict("prestamos", prestamos),
            "multas": criterio_a_dict("multas", multas),
            "solicitudes": criterio_a_dict("solicitudes", solicitudes),
            "opcion_grado": criterio_a_dict("opcion_grado", opcion_grado),
        },
        "acciones_requeridas": acciones,
        "mensaje": mensaje,
    }

_CAMPOS = {"numero_documento": "número de documento", "nombre": "nombre"}


def _solo_alfanumerico(valor: Any) -> str:
    return re.sub(r"[^0-9A-Za-z]", "", str(valor or "")).upper()


def _nombre_normalizado(*partes: Any) -> str:
    texto = " ".join(str(p or "") for p in partes)
    sin_tildes = "".join(
        c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn"
    )
    return " ".join(sin_tildes.lower().split())


def _sin_evaluar(
    user_id: str, estado: str, mensaje: str, fuente: str, coincide: bool | None, distintos: list[str]
) -> dict[str, Any]:
    return {
        "user_id": str(user_id).strip(),
        "estado": estado,
        "paz_y_salvo": None,
        "consultado_en": ahora_bogota().isoformat(timespec="seconds"),
        "valido_hasta": None,
        "criterios": {},
        "acciones_requeridas": [],
        "mensaje": mensaje,
        "fuente": fuente,
        "identidad": {"coincide": coincide, "campos_distintos": distintos},
    }


_log = logging.getLogger(__name__)

MENSAJE_SIN_CONSULTA = "No fue posible consultar a Biblioteca. Una funcionaria lo revisará."


def consultar_para_checku(
    user_id: str,
    identidad: dict[str, Any],
    *,
    cliente: AlmaCliente | AlmaClienteSimulado | None = None,
) -> dict[str, Any]:
    """Tarea 50: contrasta el usuario de ALMA con la BD de CheckU y, si coincide, consulta el paz y salvo.

    `identidad` = {numero_documento, nombres, apellidos} tal como está en CheckU. Nunca devuelve
    los datos personales que tiene ALMA, solo si coinciden.
    """
    alma = cliente if cliente is not None else crear_cliente()
    fuente = "alma_simulada" if isinstance(alma, AlmaClienteSimulado) else "alma"

    documento = _solo_alfanumerico(identidad.get("numero_documento"))
    if not documento:
        return _sin_evaluar(
            user_id,
            "no_evaluable",
            "No hay número de documento registrado en CheckU para contrastar con Biblioteca.",
            fuente,
            None,
            [],
        )

    try:
        usuario = alma.usuario(user_id)
    except Exception as error:
        # El detalle (configuración, red) va al log del motor; el estudiante ve un mensaje neutro.
        _log.warning("No se pudo consultar ALMA para %s: %s", user_id, error)
        return _sin_evaluar(user_id, "no_evaluable", MENSAJE_SIN_CONSULTA, fuente, None, [])
    if usuario is None:
        return _sin_evaluar(
            user_id,
            "no_encontrado",
            "Biblioteca (ALMA) no tiene registrado este código de estudiante.",
            fuente,
            None,
            [],
        )

    distintos: list[str] = []
    identificadores = usuario.get("user_identifier") or []
    if isinstance(identificadores, dict):
        identificadores = [identificadores]
    if not any(
        isinstance(i, dict) and _solo_alfanumerico(i.get("value")) == documento
        for i in identificadores
    ):
        distintos.append("numero_documento")
    nombre_checku = _nombre_normalizado(identidad.get("nombres"), identidad.get("apellidos"))
    nombre_alma = _nombre_normalizado(
        usuario.get("first_name"), usuario.get("middle_name"), usuario.get("last_name")
    )
    if nombre_checku != nombre_alma:
        distintos.append("nombre")
    if distintos:
        return _sin_evaluar(
            user_id,
            "inconsistente",
            "Los datos de Biblioteca (ALMA) no coinciden con los registrados en CheckU: "
            + ", ".join(_CAMPOS[c] for c in distintos)
            + ".",
            fuente,
            False,
            distintos,
        )

    resultado = consultar_paz_y_salvo(user_id, cliente=alma)
    resultado["fuente"] = fuente
    resultado["identidad"] = {"coincide": True, "campos_distintos": []}
    return resultado
