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
    # Tarea 50: la opción de grado es informativa; sin pendientes el estudiante cumple.
    assert out["estado"] == "cumple"
    assert out["paz_y_salvo"] is True
    assert "prestamos" in out["criterios"]
    assert "multas" in out["criterios"]
    assert "solicitudes" in out["criterios"]
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


# Tarea 50: los cinco escenarios de la issue #125.


def _cliente(prestamos=(), multas=(), solicitudes=()):
    cliente = MagicMock()
    cliente.prestamos.return_value = _lista("loans", list(prestamos))
    cliente.multas.return_value = _lista("fees", list(multas))
    cliente.solicitudes.return_value = _lista("requests", list(solicitudes))
    return cliente


PRESTAMO = {"loan_id": "1", "loan_status": "ACTIVE"}
MULTA = {"status": "ACTIVE", "balance": 15000, "currency": "COP"}
SOLICITUD = {"request_id": "9", "request_status": "IN_PROCESS"}


def test_escenario_paz_y_salvo():
    out = consultar_paz_y_salvo("T00000001", cliente=_cliente())
    assert out["estado"] == "cumple"
    assert out["paz_y_salvo"] is True
    assert out["acciones_requeridas"] == []


def test_escenario_con_prestamos():
    out = consultar_paz_y_salvo("T00000001", cliente=_cliente(prestamos=[PRESTAMO]))
    assert out["estado"] == "no_cumple"
    assert out["criterios"]["prestamos"]["pendientes"] == 1


def test_escenario_con_solicitudes():
    out = consultar_paz_y_salvo("T00000001", cliente=_cliente(solicitudes=[SOLICITUD]))
    assert out["estado"] == "no_cumple"
    assert out["criterios"]["solicitudes"]["pendientes"] == 1
    assert "Cerrar o cancelar las solicitudes pendientes en Biblioteca." in out["acciones_requeridas"]


def test_escenario_con_multas():
    out = consultar_paz_y_salvo("T00000001", cliente=_cliente(multas=[MULTA]))
    assert out["estado"] == "no_cumple"
    assert out["criterios"]["multas"]["valor_total"] == 15000.0


def test_escenario_combinado():
    out = consultar_paz_y_salvo(
        "T00000001",
        cliente=_cliente(prestamos=[PRESTAMO], multas=[MULTA], solicitudes=[SOLICITUD]),
    )
    assert out["estado"] == "no_cumple"
    assert out["paz_y_salvo"] is False
    assert len(out["acciones_requeridas"]) == 3


def test_opcion_grado_es_informativa():
    out = consultar_paz_y_salvo("T00000001", cliente=_cliente())
    assert out["criterios"]["opcion_grado"]["informativo"] is True
    assert out["estado"] == "cumple"
