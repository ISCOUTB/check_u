from datetime import datetime

import pytest

from modules.validadores.resultado import BOGOTA
from modules.validadores.saber_pro import validar_saber_pro

AHORA = datetime(2026, 10, 17, 9, 30, tzinfo=BOGOTA)


def reglas(resultado: dict) -> dict:
    return {r["rule"]: r for r in resultado["rules"]}


def un_reporte_real(muestras_de_tipo) -> bytes:
    return next(iter(muestras_de_tipo("reporte").values()))["contenido"]


def test_reportes_reales_quedan_validos(muestras_de_tipo, validar_esquema):
    """Tarea 51: sin exigir firma ICFES, un reporte legible con puntaje OK es válido."""
    for nombre, muestra in muestras_de_tipo("reporte").items():
        resultado = validar_saber_pro(
            muestra["contenido"],
            id_student="estudiante-1",
            document_version=1,
            ahora=AHORA,
        )
        validar_esquema(resultado)
        assert resultado["document_classification"] == "valid", nombre
        assert resultado["required_action"] == "none", nombre
        por_regla = reglas(resultado)
        assert set(por_regla) == {
            "saber_pro_report",
            "required_fields_present",
            "global_score_minimum",
        }
        for nombre_regla in por_regla:
            assert por_regla[nombre_regla]["result"] == "cumple", (nombre, nombre_regla)
        assert {
            k: v["value"] for k, v in resultado["extracted_data"].items()
        } == muestra["datos"], nombre


def test_archivo_vacio_da_por_revisar(muestras_de_tipo, validar_esquema):
    corruptos = [m["contenido"] for m in muestras_de_tipo("corrupto").values()]
    for contenido in corruptos + [b""]:
        resultado = validar_saber_pro(
            contenido, id_student="estudiante-1", document_version=2, ahora=AHORA
        )
        validar_esquema(resultado)
        assert resultado["document_classification"] == "to_check"
        assert any("vacío o dañado" in error for error in resultado["errors"])


def test_bytes_vacios_sin_muestras(validar_esquema):
    resultado = validar_saber_pro(
        b"", id_student="estudiante-1", document_version=1, ahora=AHORA
    )
    validar_esquema(resultado)
    assert resultado["document_classification"] == "to_check"
    assert resultado["required_action"] == "wait_for_review"


def test_id_y_version_viajan():
    resultado = validar_saber_pro(
        b"", id_student="T00012345", document_version=3, ahora=AHORA
    )
    assert resultado["id_student"] == "T00012345"
    assert resultado["document_version"] == 3
    assert resultado["type_document"] == "saber_pro"
    assert resultado["validation_version"] == "saber_pro@1.1.0"
    assert resultado["timestamp"] == "2026-10-17T09:30:00-05:00"


def test_sin_ahora_usa_hora_de_bogota():
    resultado = validar_saber_pro(b"", id_student="T00012345", document_version=1)
    assert resultado["timestamp"].endswith("-05:00")


@pytest.mark.parametrize("version", [0, -1])
def test_version_invalida_se_rechaza(version):
    with pytest.raises(ValueError):
        validar_saber_pro(b"", id_student="T00012345", document_version=version)


@pytest.mark.parametrize("id_student", ["", "   ", " T00012345"])
def test_id_en_blanco_se_rechaza(id_student):
    with pytest.raises(ValueError):
        validar_saber_pro(b"", id_student=id_student, document_version=1)