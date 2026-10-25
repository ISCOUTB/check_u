"""Servicio HTTP interno del motor OCR/Validación de CheckU."""

import json
import uuid
from datetime import datetime, timezone

from flask import Flask, jsonify, request

from motor_ocr.orquestador import analizar_documentos

app = Flask(__name__)

DOCUMENTOS_POR_NIVEL = {
    "pregrado": [
        "cedula",
        "evaluacion_grado",
        "paz_y_salvo",
        "estampilla",
        "saber_pro",
    ],
    "posgrado": ["cedula", "paz_y_salvo", "estampilla"],
}


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.post("/analizar")
def analizar():
    nivel = request.form.get("nivel", "").strip().lower()

    if nivel not in DOCUMENTOS_POR_NIVEL:
        return jsonify({"error": "invalid_level"}), 400

    try:
        datos = json.loads(request.form.get("datos", "{}"))
    except json.JSONDecodeError:
        return jsonify({"error": "invalid_data"}), 400

    if not isinstance(datos, dict):
        return jsonify({"error": "invalid_data"}), 400

    archivos = {
        campo: archivos[0]
        for campo in DOCUMENTOS_POR_NIVEL[nivel]
        if (archivos := request.files.getlist(campo))
    }

    respuesta = analizar_documentos(nivel, datos, archivos)
    return jsonify(respuesta)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, debug=True)