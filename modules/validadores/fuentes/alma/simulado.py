"""Cliente simulado de ALMA (Tarea 50).

Misma interfaz pública que AlmaCliente (usuario, prestamos, multas, solicitudes) y las mismas
formas de respuesta de la API Users de Ex Libris, leídas de un JSON local:

    {"usuarios": {"<primary_id>": {"user": {...}, "loans": {...}, "fees": {...}, "requests": {...}}}}

El archivo lo indica ALMA_SIMULACION_ARCHIVO y vive fuera del repositorio (solo datos de prueba).
Cambiar a la API real es usar AlmaCliente (ALMA_MODO=real): los consumidores no cambian.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from .cliente import (
    AlmaClienteError,
    ListaAlma,
    MetodoLista,
    _extraer_items,
    _total_reportado,
)


class AlmaClienteSimulado:
    """Responde como ALMA a partir del archivo de simulación; no hace peticiones de red."""

    def __init__(self, ruta: str | Path | None = None) -> None:
        self._ruta = ruta

    def _datos(self) -> dict[str, Any]:
        ruta = self._ruta or os.environ.get("ALMA_SIMULACION_ARCHIVO", "").strip()
        if not ruta or not Path(ruta).is_file():
            raise AlmaClienteError(
                "No se encontró el archivo de simulación de ALMA. Revisa ALMA_SIMULACION_ARCHIVO."
            )
        try:
            datos = json.loads(Path(ruta).read_text(encoding="utf-8"))
        except (OSError, ValueError) as error:
            raise AlmaClienteError(
                "El archivo de simulación de ALMA no es JSON válido."
            ) from error
        if not isinstance(datos, dict) or not isinstance(datos.get("usuarios"), dict):
            raise AlmaClienteError(
                "El archivo de simulación de ALMA no es JSON válido: falta el objeto «usuarios»."
            )
        return datos

    def _registro(self, user_id: str) -> dict[str, Any] | None:
        if not user_id or not str(user_id).strip():
            raise AlmaClienteError("user_id vacío: no se puede consultar ALMA.")
        registro = self._datos()["usuarios"].get(str(user_id).strip())
        return registro if isinstance(registro, dict) else None

    def usuario(self, user_id: str) -> dict[str, Any] | None:
        registro = self._registro(user_id)
        if registro is None:
            return None
        usuario = registro.get("user")
        return usuario if isinstance(usuario, dict) else None

    def listar(self, user_id: str, tipo: MetodoLista) -> ListaAlma:
        registro = self._registro(user_id)
        if registro is None:
            raise AlmaClienteError(
                "ALMA no encontró el recurso o el usuario.", codigo_http=404
            )
        payload = registro.get(tipo)
        if not isinstance(payload, dict):
            # Revisión final: un bloque ausente o mal formado no es un listado vacío; queda incompleto
            # para que nadie quede a paz y salvo por un error en el archivo de simulación.
            return ListaAlma(
                tipo=tipo,
                total=0,
                items=[],
                completo=False,
                detalle=f"El archivo de simulación no trae un listado «{tipo}» válido para este usuario.",
            )
        items = _extraer_items(tipo, payload)
        total = _total_reportado(payload, items)
        if total is None:
            return ListaAlma(
                tipo=tipo,
                total=len(items),
                items=items,
                completo=False,
                detalle="La respuesta no trajo total_record_count; no se puede asegurar el listado completo.",
            )
        completo = len(items) >= total
        return ListaAlma(
            tipo=tipo,
            total=total,
            items=items,
            completo=completo,
            detalle=(
                f"Listado {tipo} completo ({len(items)} registro(s))."
                if completo
                else "Paginación incompleta: ALMA indicó más registros de los recibidos."
            ),
        )

    def prestamos(self, user_id: str) -> ListaAlma:
        return self.listar(user_id, "loans")

    def solicitudes(self, user_id: str) -> ListaAlma:
        return self.listar(user_id, "requests")

    def multas(self, user_id: str) -> ListaAlma:
        return self.listar(user_id, "fees")
