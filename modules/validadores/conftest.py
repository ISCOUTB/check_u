"""Fixtures compartidas por las pruebas de todos los validadores."""

import json
from pathlib import Path

import jsonschema
import pytest

CARPETA_ESQUEMAS = Path(__file__).resolve().parents[2] / "contratos" / "esquemas"


@pytest.fixture
def validar_esquema():
    """Valida un objeto contra un esquema del contrato (Tarea 02); falla la prueba si no cumple."""

    def validar(objeto: dict, esquema: str = "document-validation-result") -> None:
        definicion = json.loads((CARPETA_ESQUEMAS / f"{esquema}.schema.json").read_text(encoding="utf-8"))
        validador = jsonschema.Draft202012Validator(definicion, format_checker=jsonschema.FormatChecker())
        errores = sorted(validador.iter_errors(objeto), key=lambda e: list(e.path))
        assert not errores, "\n".join(f"{list(e.path)}: {e.message}" for e in errores)

    return validar
