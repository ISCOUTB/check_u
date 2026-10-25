"""
Servicio Flask del motor de validación documental.

Expone el motor (modules/validadores) por HTTP para que NestJS y el
Playground lo consuman. No implementa reglas: solo recibe archivos,
llama al validador y devuelve el DocumentValidationResult del contrato.

Arranque (desde la raíz del repo):
    python -m modules.api.app
    # o
    flask --app modules.api.app run --port 5001
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from flask import Flask, jsonify, request

# Raíz del repo en sys.path (igual que webapp/app.py)
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from modules.api.validacion import (  # noqa: E402
    VALIDADORES,
    analizar_documento,
    clasificar_estado_general,
)

app = Flask(__name__)

# Límite razonable de subida (ajusta si hace falta)
app.config["MAX_CONTENT_LENGTH"] = 25 * 1024 * 1024  # 25 MB


@app.get("/salud")
def salud():
    return jsonify(
        {
            "ok": True,
            "servicio": "motor-validacion",
            "tipos_soportados": sorted(VALIDADORES.keys()),
        }
    )


@app.post("/analizar")
def analizar():
    """
    multipart/form-data:
      - estudiante: JSON string  {"id_student": "T00012345", "nivel": "PREGRADO"}
      - documentos: uno o varios archivos
      - tipos: lista separada por comas, en el mismo orden que los archivos
               ej. "identification,saber_pro,estampilla_pro_cultura"
    """
    # --- estudiante ---
    raw_estudiante = request.form.get("estudiante")
    if not raw_estudiante:
        return jsonify({"error": "Falta el campo 'estudiante' (JSON)."}), 400

    try:
        estudiante = json.loads(raw_estudiante)
    except json.JSONDecodeError:
        return jsonify({"error": "El campo 'estudiante' no es JSON válido."}), 400

    id_student = (estudiante.get("id_student") or "").strip()
    if not id_student:
        return jsonify({"error": "estudiante.id_student es obligatorio."}), 400

    # --- archivos y tipos ---
    archivos = request.files.getlist("documentos")
    if not archivos:
        return jsonify({"error": "Debe adjuntar al menos un archivo en 'documentos'."}), 400

    tipos_raw = (request.form.get("tipos") or "").strip()
    if not tipos_raw:
        return jsonify(
            {
                "error": "Falta el campo 'tipos' (lista separada por comas, "
                "mismo orden que los archivos)."
            }
        ), 400

    tipos = [t.strip() for t in tipos_raw.split(",") if t.strip()]
    if len(tipos) != len(archivos):
        return jsonify(
            {
                "error": (
                    f"La cantidad de tipos ({len(tipos)}) no coincide "
                    f"con la de archivos ({len(archivos)})."
                )
            }
        ), 400

    resultados: list[dict] = []
    errores: list[dict] = []

    for indice, (archivo, tipo) in enumerate(zip(archivos, tipos)):
        try:
            contenido = archivo.read()
            if not contenido:
                raise ValueError("Archivo vacío.")

            resultado = analizar_documento(
                contenido,
                type_document=tipo,
                id_student=id_student,
                document_version=1,
            )
            resultados.append(resultado)
        except ValueError as e:
            # Tipo no soportado o datos inválidos
            errores.append(
                {
                    "indice": indice,
                    "nombre": archivo.filename,
                    "type_document": tipo,
                    "error": str(e),
                }
            )
        except Exception as e:
            # Error interno del motor
            errores.append(
                {
                    "indice": indice,
                    "nombre": archivo.filename,
                    "type_document": tipo,
                    "error": f"Error al procesar: {e}",
                }
            )

    return jsonify(
        {
            "id_student": id_student,
            "nivel": estudiante.get("nivel"),
            "resultados": resultados,
            "errores": errores,
            "estado_general": clasificar_estado_general(resultados),
        }
    )


def main():
    # Puerto distinto a webapp (5000) para no chocar
    app.run(host="0.0.0.0", port=5001, debug=True)


if __name__ == "__main__":
    main()