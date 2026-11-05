from modules.validadores.fuentes.alma.cliente import ListaAlma
from modules.validadores.fuentes.alma.criterios import (
    evaluar_multas,
    evaluar_opcion_grado,
    evaluar_prestamos,
    evaluar_solicitudes,
)
from modules.validadores.fuentes.alma.consolidar import consolidar_estado


def _lista(tipo, items, completo=True):
    return ListaAlma(
        tipo=tipo,
        total=len(items),
        items=items,
        completo=completo,
        detalle="ok" if completo else "incompleto",
    )


def test_prestamos_sin_pendientes():
    c = evaluar_prestamos(_lista("loans", []))
    assert c.resultado == "cumple"
    assert c.pendientes == 0


def test_prestamos_con_activo():
    c = evaluar_prestamos(_lista("loans", [{"loan_id": "1", "loan_status": "Active"}]))
    assert c.resultado == "no_cumple"
    assert c.pendientes == 1


def test_prestamos_incompleto():
    c = evaluar_prestamos(_lista("loans", [], completo=False))
    assert c.resultado == "no_evaluable"
    assert c.motivo == "incomplete_data"


def test_multas_pendientes():
    c = evaluar_multas(
        _lista("fees", [{"status": "ACTIVE", "balance": 15000, "currency": "COP"}])
    )
    assert c.resultado == "no_cumple"
    assert c.pendientes == 1
    assert c.valor_total == 15000


def test_opcion_grado_source_pending():
    c = evaluar_opcion_grado()
    assert c.resultado == "no_evaluable"
    assert c.motivo == "source_pending"
    assert c.entregada is None


def test_consolidar_no_cumple_gana():
    p = evaluar_prestamos(_lista("loans", []))
    m = evaluar_multas(_lista("fees", [{"status": "ACTIVE", "balance": 1}]))
    s = evaluar_solicitudes(_lista("requests", []))
    estado, paz = consolidar_estado(p, m, s)
    assert estado == "no_cumple"
    assert paz is False


def test_consolidar_cumple_sin_pendientes():
    # Tarea 50: la opción de grado ya no entra en la consolidación (es informativa).
    p = evaluar_prestamos(_lista("loans", []))
    m = evaluar_multas(_lista("fees", []))
    s = evaluar_solicitudes(_lista("requests", []))
    estado, paz = consolidar_estado(p, m, s)
    assert estado == "cumple"
    assert paz is True


def test_consolidar_no_evaluable_si_un_listado_no_se_puede_leer():
    p = evaluar_prestamos(_lista("loans", []))
    m = evaluar_multas(_lista("fees", []))
    s = evaluar_solicitudes(_lista("requests", [], completo=False))
    estado, paz = consolidar_estado(p, m, s)
    assert estado == "no_evaluable"
    assert paz is None


def test_solicitudes_sin_pendientes():
    c = evaluar_solicitudes(_lista("requests", []))
    assert c.resultado == "cumple"
    assert c.pendientes == 0


def test_solicitudes_pendientes():
    c = evaluar_solicitudes(
        _lista(
            "requests",
            [
                {"request_status": "NOT_STARTED"},
                {"request_status": "in_process"},
                {"status": "ON_HOLD_SHELF"},
            ],
        )
    )
    assert c.resultado == "no_cumple"
    assert c.pendientes == 3
    assert c.mensaje == "Tiene 3 solicitud(es) pendiente(s) en Biblioteca."


def test_solicitudes_finales_cumplen():
    c = evaluar_solicitudes(
        _lista(
            "requests",
            [
                {"request_status": "COMPLETED"},
                {"request_status": "CANCELED"},
                {"request_status": "History"},
            ],
        )
    )
    assert c.resultado == "cumple"


def test_solicitud_con_estado_desconocido_no_evaluable():
    c = evaluar_solicitudes(_lista("requests", [{"request_status": "RARO"}]))
    assert c.resultado == "no_evaluable"
    assert c.motivo == "incomplete_data"


def test_solicitudes_listado_incompleto_no_evaluable():
    c = evaluar_solicitudes(_lista("requests", [], completo=False))
    assert c.resultado == "no_evaluable"
    assert c.motivo == "incomplete_data"
