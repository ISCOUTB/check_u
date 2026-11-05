"""consultar_para_checku (Tarea 50): contraste de identidad con la BD de CheckU y resultado de ALMA.

JSON inventados en tmp_path; nada de datos reales.
"""

import json

import pytest

from modules.validadores.fuentes.alma import AlmaClienteSimulado
from modules.validadores.fuentes.alma.consultar import consultar_para_checku

IDENTIDAD = {"numero_documento": "1.000.000.901", "nombres": "Ana María", "apellidos": "Prueba Díaz"}


def _alma(**listas):
    registro = {
        "user": {
            "primary_id": "T00000901",
            "first_name": "ANA MARIA",
            "last_name": "prueba  diaz",
            "user_identifier": [
                {"id_type": {"value": "BARCODE"}, "value": "B-77"},
                {"id_type": {"value": "CC"}, "value": "1000000901"},
            ],
        },
        "loans": {"item_loan": [], "total_record_count": 0},
        "fees": {"fee": [], "total_record_count": 0},
        "requests": {"user_request": [], "total_record_count": 0},
    }
    registro.update(listas)
    return registro


@pytest.fixture
def cliente(tmp_path):
    def crear(registro=None):
        ruta = tmp_path / "alma_simulacion.json"
        usuarios = {"T00000901": registro} if registro is not None else {}
        ruta.write_text(json.dumps({"usuarios": usuarios}), encoding="utf-8")
        return AlmaClienteSimulado(ruta)

    return crear


def test_coincide_y_evalua(cliente):
    out = consultar_para_checku("T00000901", IDENTIDAD, cliente=cliente(_alma()))
    assert out["estado"] == "cumple"
    assert out["paz_y_salvo"] is True
    assert out["identidad"] == {"coincide": True, "campos_distintos": []}
    assert out["fuente"] == "alma_simulada"
    assert set(out["criterios"]) == {"prestamos", "multas", "solicitudes", "opcion_grado"}


def test_documento_distinto_es_inconsistente(cliente):
    alma = _alma()
    alma["user"]["user_identifier"] = [{"id_type": {"value": "CC"}, "value": "1000000999"}]
    out = consultar_para_checku("T00000901", IDENTIDAD, cliente=cliente(alma))
    assert out["estado"] == "inconsistente"
    assert out["paz_y_salvo"] is None
    assert out["criterios"] == {}
    assert out["identidad"] == {"coincide": False, "campos_distintos": ["numero_documento"]}


def test_nombre_distinto_es_inconsistente(cliente):
    alma = _alma()
    alma["user"]["first_name"] = "Otra"
    out = consultar_para_checku("T00000901", IDENTIDAD, cliente=cliente(alma))
    assert out["estado"] == "inconsistente"
    assert out["identidad"]["campos_distintos"] == ["nombre"]


def test_nombre_con_tildes_y_mayusculas_coincide(cliente):
    out = consultar_para_checku("T00000901", IDENTIDAD, cliente=cliente(_alma()))
    assert out["identidad"]["coincide"] is True


def test_no_encontrado(cliente):
    out = consultar_para_checku("T00000901", IDENTIDAD, cliente=cliente(None))
    assert out["estado"] == "no_encontrado"
    assert out["paz_y_salvo"] is None
    assert out["criterios"] == {}
    assert out["identidad"]["coincide"] is None


def test_sin_documento_en_perfil_no_evaluable(cliente):
    identidad = {**IDENTIDAD, "numero_documento": "  "}
    out = consultar_para_checku("T00000901", identidad, cliente=cliente(_alma()))
    assert out["estado"] == "no_evaluable"
    assert out["identidad"] == {"coincide": None, "campos_distintos": []}


def test_archivo_ausente_no_evaluable(tmp_path):
    out = consultar_para_checku(
        "T00000901", IDENTIDAD, cliente=AlmaClienteSimulado(tmp_path / "no.json")
    )
    assert out["estado"] == "no_evaluable"
    assert out["paz_y_salvo"] is None
    # Revisión final: el estudiante no ve pistas de configuración del servidor.
    assert out["mensaje"] == "No fue posible consultar a Biblioteca. Una funcionaria lo revisará."
    assert "ALMA_SIMULACION_ARCHIVO" not in json.dumps(out)


def test_con_pendientes_no_cumple(cliente):
    alma = _alma(fees={"fee": [{"status": "ACTIVE", "balance": 15000, "currency": "COP"}], "total_record_count": 1})
    out = consultar_para_checku("T00000901", IDENTIDAD, cliente=cliente(alma))
    assert out["estado"] == "no_cumple"
    assert out["criterios"]["multas"]["valor_total"] == 15000.0


def test_no_expone_datos_de_alma(cliente):
    out = consultar_para_checku("T00000901", IDENTIDAD, cliente=cliente(_alma()))
    texto = json.dumps(out, ensure_ascii=False).lower()
    assert "1000000901" not in texto
    assert "diaz" not in texto and "díaz" not in texto
    assert "b-77" not in texto
