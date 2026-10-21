"""API pública: consultar_paz_y_salvo(user_id)."""

from __future__ import annotations

from typing import Any

from modules.validadores.resultado import ahora_bogota

from .cliente import AlmaCliente
from .criterios import (
    criterio_desde_excepcion,
    evaluar_multas,
    evaluar_opcion_grado,
    evaluar_prestamos,
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
    `cliente` se inyecta en tests; en uso normal se crea con la config de entorno.
    """
    alma = cliente if cliente is not None else AlmaCliente()
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
        # Se consulta el listado por si Biblioteca define la fuente después;
        # hoy evaluar_opcion_grado no lo usa (source_pending).
        lista_solicitudes = alma.solicitudes(user_id)
        opcion_grado = evaluar_opcion_grado(lista_solicitudes)
    except Exception:
        # Aunque fallen las solicitudes, el criterio de grado sigue source_pending
        # si la fuente no está definida; si preferimos reflejar el fallo de red:
        opcion_grado = evaluar_opcion_grado(None)

    estado, paz_y_salvo = consolidar_estado(prestamos, multas, opcion_grado)
    acciones = acciones_requeridas(prestamos, multas, opcion_grado)
    mensaje = mensaje_general(estado, prestamos, multas, opcion_grado)

    return {
        "user_id": str(user_id).strip(),
        "estado": estado,
        "paz_y_salvo": paz_y_salvo,
        "consultado_en": consultado.isoformat(timespec="seconds"),
        "valido_hasta": None,
        "criterios": {
            "prestamos": criterio_a_dict("prestamos", prestamos),
            "multas": criterio_a_dict("multas", multas),
            "opcion_grado": criterio_a_dict("opcion_grado", opcion_grado),
        },
        "acciones_requeridas": acciones,
        "mensaje": mensaje,
    }