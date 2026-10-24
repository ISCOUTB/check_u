"""
Servicio HTTP interno del motor OCR/Validación de CheckU.

Fase 1: expone POST /analizar para NestJS. No persiste documentos,
resultados ni casos. Recibe la solicitud, la procesa en memoria y
devuelve una respuesta JSON conforme a DocumentAnalysisResponse.
"""

import json
import uuid
from datetime import datetime, timezone

from flask import Flask, jsonify, request

app = Flask(__name__)

MAPEO_DOCUMENTOS = {
    "cedula": "identification",
    "evaluacion_grado": "academic_evaluation",
    "paz_y_salvo": "paz_y_salvo_bib",
    "estampilla": "estampilla_pro_cultura",
    "saber_pro": "saber_pro",
}

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

    id_estudiante = str(datos.get("numeroDocumento") or "desconocido")
    ahora = datetime.now(timezone.utc).isoformat()

    documentos = []

    for campo in DOCUMENTOS_POR_NIVEL[nivel]:
        documentos.append(_documento_pendiente(campo, id_estudiante, ahora))

    return jsonify(
        {
            "analysis_id": str(uuid.uuid4()),
            "level": nivel,
            "status": "partial",
            "documents": documentos,
            "cross_validations": [],
            "warnings": [
                "El procesamiento real del motor OCR aún no está integrado."
            ],
            "errors": [],
            "generated_at": ahora,
        }
    )


def _documento_pendiente(campo: str, id_estudiante: str, ahora: str) -> dict:
    return {
        "id_student": id_estudiante,
        "type_document": MAPEO_DOCUMENTOS[campo],
        "document_version": 1,
        "extracted_data": {},
        "rules": [
            {
                "rule": "motor_ocr_processing",
                "result": "no_evaluable",
                "no_evaluable_reason": "source_pending",
                "mandatory": True,
                "message": "El documento está pendiente de procesamiento por el motor OCR.",
                "timestamp": ahora,
                "errors": [],
            }
        ],
        "errors": [],
        "document_classification": "to_check",
        "validation_status": "pending",
        "validation_version": "motor-ocr-fase-1",
        "timestamp": ahora,
        "resubmission_allowed": False,
        "required_action": "wait_for_processing",
        "resubmission_reason": None,
    }


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, debug=True)