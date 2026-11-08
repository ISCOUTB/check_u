"""Seguridad Tarea 6 (#140, F11): el motor no le cuenta al cliente sus errores internos.

El detalle técnico va al log del motor; la respuesta lleva un mensaje genérico o uno escrito para el cliente.
"""

import io
import json
import logging

import pytest

from modules.api.app import app
from modules.api.validacion import VALIDADORES
from modules.cedula.digital import leer as leer_cedula_digital
from modules.validadores.fuentes.alma.cliente import AlmaClienteError
from modules.validadores.fuentes.alma.consultar import consultar_paz_y_salvo
from modules.validadores.fuentes.alma.criterios import criterio_desde_excepcion
from modules.validadores.fuentes.rui import consultar_rui

# Lo que una excepción real podría traer: ruta local, versión de una librería y configuración.
SECRETO = r"C:\srv\checku\modules\interno.py: PyMuPDF 1.24 ALMA_API_KEY"
GENERICO = "No fue posible procesar el documento. Intenta de nuevo."


def _analizar(tipo="academic_evaluation", contenido=b"%PDF-1.4 de prueba", estudiante=None):
    return app.test_client().post(
        "/analizar",
        data={
            "estudiante": estudiante or json.dumps({"id_student": "T00000001", "nivel": "PREGRADO"}),
            "tipos": tipo,
            "documentos": (io.BytesIO(contenido), "documento.pdf"),
        },
        content_type="multipart/form-data",
    )


def _validador_que_falla(error):
    def validador(*_args, **_kwargs):
        raise error

    return validador


@pytest.mark.parametrize(
    "error",
    [ValueError(SECRETO), RuntimeError(SECRETO), KeyError(SECRETO)],
    ids=["ValueError", "RuntimeError", "KeyError"],
)
def test_analizar_responde_generico_ante_un_fallo_del_validador(monkeypatch, error):
    monkeypatch.setitem(VALIDADORES, "saber_pro", _validador_que_falla(error))

    r = _analizar("saber_pro")

    assert r.status_code == 200
    assert r.get_json()["errores"] == [
        {"indice": 0, "nombre": "documento.pdf", "type_document": "saber_pro", "error": GENERICO}
    ]
    assert "interno.py" not in r.get_data(as_text=True)


def test_analizar_registra_el_detalle_en_el_log(monkeypatch, caplog):
    monkeypatch.setitem(VALIDADORES, "saber_pro", _validador_que_falla(ValueError(SECRETO)))

    with caplog.at_level(logging.ERROR):
        _analizar("saber_pro")

    assert SECRETO in caplog.text


def test_analizar_conserva_los_mensajes_escritos_para_el_cliente():
    assert _analizar("saber_pro", contenido=b"").get_json()["errores"][0]["error"] == "Archivo vacío."
    assert "Tipo de documento no soportado: otro." in _analizar("otro").get_json()["errores"][0]["error"]


def test_evaluacion_de_grado_no_lleva_la_excepcion_al_resultado(monkeypatch, caplog):
    monkeypatch.setattr(
        "modules.validadores.academic_evaluation.extraccion.analizar_evaluacion_grado",
        _validador_que_falla(RuntimeError(SECRETO)),
    )

    with caplog.at_level(logging.ERROR):
        r = _analizar("academic_evaluation")

    assert r.status_code == 200
    assert len(r.get_json()["resultados"]) == 1
    assert "interno.py" not in r.get_data(as_text=True)
    assert SECRETO in caplog.text


def test_cedula_no_lleva_el_error_del_mrz_al_resultado(monkeypatch, caplog):
    monkeypatch.setattr("modules.mrz.get_info.get_info", _validador_que_falla(RuntimeError(SECRETO)))

    with caplog.at_level(logging.WARNING):
        lectura = leer_cedula_digital([], ["A" * 30, "B" * 30, "C" * 30], None)

    assert lectura.errores
    assert "interno.py" not in " ".join(lectura.errores)
    assert SECRETO in caplog.text


def test_rui_no_cuenta_el_tipo_de_excepcion():
    respuesta = consultar_rui("1000000001", consulta=_validador_que_falla(ConnectionError(SECRETO)))

    assert respuesta.estado == "sin_respuesta"
    assert "ConnectionError" not in respuesta.detalle
    assert "interno.py" not in respuesta.detalle


@pytest.mark.parametrize(
    "error, tecnico",
    [
        (RuntimeError(SECRETO), "RuntimeError"),
        (AlmaClienteError("No se pudo conectar con ALMA (ConnectTimeout)."), "ConnectTimeout"),
        (AlmaClienteError("Revisa ALMA_SIMULACION_ARCHIVO."), "ALMA_SIMULACION_ARCHIVO"),
    ],
    ids=["excepcion", "red", "configuracion"],
)
def test_alma_no_cuenta_el_detalle_tecnico(error, tecnico, caplog):
    with caplog.at_level(logging.WARNING):
        criterio = criterio_desde_excepcion(error)

    assert criterio.resultado == "no_evaluable"
    assert criterio.motivo == "source_unavailable"
    assert tecnico not in criterio.mensaje
    assert tecnico in caplog.text


def test_paz_y_salvo_no_cuenta_el_detalle_tecnico():
    class Falla:
        def prestamos(self, _):
            raise AlmaClienteError("No se pudo conectar con ALMA (ConnectTimeout).")

        multas = solicitudes = prestamos

    assert "ConnectTimeout" not in json.dumps(consultar_paz_y_salvo("T00000001", cliente=Falla()))


def test_un_error_no_previsto_responde_500_sin_detalle(monkeypatch):
    # Una lista donde se espera el objeto estudiante no se atrapa: Flask responde su página genérica.
    r = _analizar(estudiante="[]")
    assert r.status_code == 500
    cuerpo = r.get_data(as_text=True)
    assert "Traceback" not in cuerpo and "AttributeError" not in cuerpo and "app.py" not in cuerpo

    monkeypatch.setenv("ALMA_MODO", "otro")
    r = app.test_client().post("/biblioteca/paz-y-salvo", json={"id_student": "T00000001"})
    assert r.status_code == 500
    assert "ALMA_MODO" not in r.get_data(as_text=True)
