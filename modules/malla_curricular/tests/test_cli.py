"""Pruebas unitarias para la interfaz de línea de comandos (CLI) de malla curricular."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

from modules.malla_curricular.tests.conftest import crear_pdf_banner


def test_cli_con_archivo_como_parametro():
    pdf_bytes = crear_pdf_banner()
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tf:
        tf.write(pdf_bytes)
        tf_path = tf.name

    try:
        proc = subprocess.run(
            [sys.executable, "-m", "modules.malla_curricular", tf_path],
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        assert proc.returncode == 0
        assert proc.stderr == ""

        # La salida debe ser exclusivamente JSON válido
        salida_json = json.loads(proc.stdout)
        assert salida_json["type_document"] == "academic_evaluation"
        assert salida_json["general_result"] == "cumple"
        assert salida_json["code_student"] == "T00063198"
    finally:
        Path(tf_path).unlink(missing_ok=True)


def test_cli_con_stdin_pipe():
    pdf_bytes = crear_pdf_banner(
        periodos=[
            {"periodo": "2024-1", "cumple": "No", "total": 16, "aprobados": 13, "faltantes": 3},
        ]
    )
    proc = subprocess.run(
        [sys.executable, "-m", "modules.malla_curricular", "-"],
        input=pdf_bytes,
        capture_output=True,
    )
    assert proc.returncode == 0
    salida_texto = proc.stdout.decode("utf-8")
    salida_json = json.loads(salida_texto)
    assert salida_json["general_result"] == "no_cumple"
    assert "tiene 3 créditos pendientes" in salida_json["motivo"]
