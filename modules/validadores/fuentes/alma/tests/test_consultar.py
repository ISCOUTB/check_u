from unittest.mock import MagicMock

from modules.validadores.fuentes.alma.cliente import ListaAlma
from modules.validadores.fuentes.alma.consultar import consultar_paz_y_salvo


def _lista(tipo, items=None, completo=True):
    items = items or []
    return ListaAlma(
        tipo=tipo,
        total=len(items),
        items=items,
        completo=completo,
        detalle="ok",
    )


def test_consultar_estructura_sin_incumplimiento():
    cliente = MagicMock()
    cliente.prestamos.return_value = _lista("loans")
    cliente.multas.return_value = _lista("fees")
    cliente.solicitudes.return_value = _lista("requests")

    out = consultar_paz_y_salvo("T00000001", cliente=cliente)

    assert out["user_id"] == "T00000001"
    assert out["estado"] == "no_evaluable"  # opción de grado source_pending
    assert out["paz_y_salvo"] is None
    assert "prestamos" in out["criterios"]
    assert "multas" in out["criterios"]
    assert "opcion_grado" in out["criterios"]
    assert out["criterios"]["opcion_grado"]["motivo"] == "source_pending"
    assert out["valido_hasta"] is None
    assert isinstance(out["acciones_requeridas"], list)
    assert "consultado_en" in out


def test_consultar_con_multa():
    cliente = MagicMock()
    cliente.prestamos.return_value = _lista("loans")
    cliente.multas.return_value = _lista(
        "fees", [{"status": "ACTIVE", "balance": 15000, "currency": "COP"}]
    )
    cliente.solicitudes.return_value = _lista("requests")

    out = consultar_paz_y_salvo("T00000001", cliente=cliente)

    assert out["estado"] == "no_cumple"
    assert out["paz_y_salvo"] is False
    assert out["criterios"]["multas"]["pendientes"] == 1
    assert any("Pagar" in a for a in out["acciones_requeridas"])