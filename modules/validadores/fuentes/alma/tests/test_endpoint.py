"""POST /biblioteca/paz-y-salvo del motor (Tarea 50), con el cliente simulado."""

import json

from modules.api.app import app


def _archivo(tmp_path):
    ruta = tmp_path / "alma_simulacion.json"
    ruta.write_text(
        json.dumps(
            {
                "usuarios": {
                    "T00000901": {
                        "user": {
                            "primary_id": "T00000901",
                            "first_name": "Ana",
                            "last_name": "Prueba",
                            "user_identifier": [{"id_type": {"value": "CC"}, "value": "1000000901"}],
                        },
                        "loans": {"item_loan": [], "total_record_count": 0},
                        "fees": {"fee": [], "total_record_count": 0},
                        "requests": {"user_request": [], "total_record_count": 0},
                    }
                }
            }
        ),
        encoding="utf-8",
    )
    return ruta


def test_endpoint_paz_y_salvo(tmp_path, monkeypatch):
    monkeypatch.delenv("ALMA_MODO", raising=False)
    monkeypatch.setenv("ALMA_SIMULACION_ARCHIVO", str(_archivo(tmp_path)))
    cliente = app.test_client()
    r = cliente.post(
        "/biblioteca/paz-y-salvo",
        json={
            "id_student": "T00000901",
            "identidad": {"numero_documento": "1000000901", "nombres": "Ana", "apellidos": "Prueba"},
        },
    )
    assert r.status_code == 200
    assert r.get_json()["estado"] == "cumple"


def test_endpoint_sin_id_student():
    r = app.test_client().post("/biblioteca/paz-y-salvo", json={"identidad": {}})
    assert r.status_code == 400
    assert r.get_json() == {"error": "estudiante.id_student es obligatorio."}
