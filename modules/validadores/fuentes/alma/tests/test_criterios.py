from modules.validadores.fuentes.alma.cliente import ListaAlma
from modules.validadores.fuentes.alma.criterios import (
    evaluar_multas,
    evaluar_opcion_grado,
    evaluar_prestamos,
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
    o = evaluar_opcion_grado()
    estado, paz = consolidar_estado(p, m, o)
    assert estado == "no_cumple"
    assert paz is False


def test_consolidar_no_evaluable_si_no_hay_incumplimiento():
    p = evaluar_prestamos(_lista("loans", []))
    m = evaluar_multas(_lista("fees", []))
    o = evaluar_opcion_grado()
    estado, paz = consolidar_estado(p, m, o)
    assert estado == "no_evaluable"
    assert paz is None