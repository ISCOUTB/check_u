"""El archivo de ejemplo de la simulación de ALMA (Tarea 50) que se versiona en el repositorio.

Cada desarrollador lo copia como alma_simulacion.json (ignorado por git) y llena el número de documento
de su estudiante. Aquí se comprueba que el ejemplo no trae documentos y que, una vez llenado, cada
escenario da el resultado que promete.
"""

import json
from pathlib import Path

import pytest

from modules.validadores.fuentes.alma import AlmaClienteSimulado
from modules.validadores.fuentes.alma.consultar import consultar_para_checku

EJEMPLO = Path(__file__).resolve().parents[1] / "alma_simulacion.example.json"
CODIGO = "T00000001"
# Datos del estudiante de prueba de db/init/02-userbase.sql; el documento lo inventa cada desarrollador.
IDENTIDAD = {"numero_documento": "1000000001", "nombres": "Lisandro", "apellidos": "Zapata"}

ESPERADO = {
    "paz_y_salvo": ("cumple", None),
    "prestamos": ("no_cumple", "prestamos"),
    "solicitudes": ("no_cumple", "solicitudes"),
    "multas": ("no_cumple", "multas"),
    "combinado": ("no_cumple", None),
    "inconsistente": ("inconsistente", None),
}


def _cargar():
    return json.loads(EJEMPLO.read_text(encoding="utf-8"))


def _documento_cc(registro):
    return next(
        i for i in registro["user"]["user_identifier"] if i["id_type"]["value"] == "CC"
    )


def test_el_ejemplo_no_trae_numeros_de_documento_salvo_el_inconsistente():
    datos = _cargar()
    assert _documento_cc(datos["usuarios"][CODIGO])["value"] == ""
    for nombre, registro in datos["escenarios"].items():
        valor = _documento_cc(registro)["value"]
        if nombre == "inconsistente":
            assert valor and valor != IDENTIDAD["numero_documento"]
        else:
            assert valor == "", nombre


@pytest.mark.parametrize("escenario", sorted(ESPERADO))
def test_cada_escenario_da_su_resultado_al_llenar_el_documento(escenario, tmp_path):
    datos = _cargar()
    assert set(datos["escenarios"]) | {"paz_y_salvo"} == set(ESPERADO)
    registro = datos["usuarios"][CODIGO] if escenario == "paz_y_salvo" else datos["escenarios"][escenario]
    registro = json.loads(json.dumps(registro))
    cc = _documento_cc(registro)
    if not cc["value"]:
        cc["value"] = IDENTIDAD["numero_documento"]
    ruta = tmp_path / "alma_simulacion.json"
    ruta.write_text(json.dumps({"usuarios": {CODIGO: registro}}), encoding="utf-8")

    out = consultar_para_checku(CODIGO, IDENTIDAD, cliente=AlmaClienteSimulado(ruta))

    estado, criterio = ESPERADO[escenario]
    assert out["estado"] == estado, out["mensaje"]
    if criterio:
        assert out["criterios"][criterio]["resultado"] == "no_cumple"
        otros = {"prestamos", "multas", "solicitudes"} - {criterio}
        assert all(out["criterios"][c]["resultado"] == "cumple" for c in otros)
    if escenario == "combinado":
        assert all(out["criterios"][c]["resultado"] == "no_cumple" for c in ("prestamos", "multas", "solicitudes"))
