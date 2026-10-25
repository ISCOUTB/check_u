"""Integración inicial de los extractores existentes, sin persistencia."""

from __future__ import annotations

import logging
import math
import uuid
from datetime import datetime, timezone
from typing import Any

import pymupdf
from PIL import Image

logger = logging.getLogger(__name__)

DOCUMENTOS_POR_NIVEL = {
    "pregrado": [
        ("cedula", "identification"),
        ("evaluacion_grado", "academic_evaluation"),
        ("paz_y_salvo", "paz_y_salvo_bib"),
        ("estampilla", "estampilla_pro_cultura"),
        ("saber_pro", "saber_pro"),
    ],
    "posgrado": [
        ("cedula", "identification"),
        ("paz_y_salvo", "paz_y_salvo_bib"),
        ("estampilla", "estampilla_pro_cultura"),
    ],
}


def _regla(nombre, mensaje, ahora):
    return {
        "rule": nombre,
        "result": "no_evaluable",
        "no_evaluable_reason": "missing_dependency",
        "mandatory": True,
        "message": mensaje,
        "timestamp": ahora,
        "errors": [],
    }


def _documento_base(tipo, id_estudiante, ahora):
    return {
        "id_student": id_estudiante,
        "type_document": tipo,
        "document_version": 1,
        "extracted_data": {},
        "rules": [
            _regla(
                "integracion_validacion",
                "La validación documental completa aún no está integrada.",
                ahora,
            )
        ],
        "errors": [],
        "document_classification": "to_check",
        "validation_status": "pending",
        "validation_version": "integracion-extractores-v1",
        "timestamp": ahora,
        "resubmission_allowed": False,
        "required_action": "contact_administration",
        "resubmission_reason": None,
    }


def _extraer_cedula(contenido: bytes) -> tuple[dict, list[str]]:
    from modules.cedula import leer_cedula

    paginas = []

    try:
        with pymupdf.open(stream=contenido, filetype="pdf") as pdf:
            if pdf.needs_pass or pdf.page_count == 0:
                raise ValueError("PDF protegido o sin páginas")

            if pdf.page_count > 4:
                raise ValueError("PDF de cédula supera el límite de esta integración")

            for pagina in pdf:
                pixmap = pagina.get_pixmap(
                    dpi=150,
                    colorspace=pymupdf.csRGB,
                    alpha=False,
                )
                paginas.append(
                    Image.frombytes(
                        "RGB",
                        (pixmap.width, pixmap.height),
                        pixmap.samples,
                    )
                )

        resultado = leer_cedula(paginas)
    finally:
        for imagen in paginas:
            imagen.close()

    for nombre, campo in resultado.campos.items():
        confianza = campo.get("confianza")
        logger.warning(
            "Diagnóstico cédula: campo=%s presente=%s fuente=%s confianza=%s",
            nombre,
            campo.get("valor") is not None,
            campo.get("fuente"),
            confianza,
        )

        campos = {}
    sin_confianza = 0

    for nombre, campo in resultado.campos.items():
        valor = campo.get("valor")
        confianza = campo.get("confianza")

        if valor is None:
            campos[nombre] = {
                "value": None,
                "confidence": None,
            }
            continue

        confianza_normalizada = None

        if (
            isinstance(confianza, (int, float))
            and not isinstance(confianza, bool)
            and math.isfinite(confianza)
            and 0 <= confianza <= 100
        ):
            confianza_normalizada = confianza / 100
        else:
            sin_confianza += 1

        campos[nombre] = {
            "value": valor,
            "confidence": confianza_normalizada,
        }

    avisos = []

    if sin_confianza:
        avisos.append(
            "Cédula: algunos valores extraídos no tienen una confianza "
            "numérica disponible; se conservan con confidence=null "
            "y no deben considerarse verificados."
        )

    if resultado.errores:
        avisos.append(
            "Cédula: el extractor informó dificultades de lectura."
        )

    return campos, avisos


def _extraer_evaluacion(contenido: bytes) -> tuple[dict, list[str]]:
    from modules.malla_curricular import analizar_evaluacion_grado

    resultado = analizar_evaluacion_grado(contenido)
    resultado.to_dict()

    return {}, [
        "Evaluación de grado: el analizador fue ejecutado, pero la "
        "adaptación de sus campos y reglas al contrato común sigue pendiente. "
        "No se ha inventado confianza para sus datos."
    ]


def analizar_documentos(
    nivel: str,
    datos: dict[str, Any],
    archivos: dict[str, Any],
) -> dict[str, Any]:
    if nivel not in DOCUMENTOS_POR_NIVEL:
        raise ValueError("Nivel no soportado")

    ahora = datetime.now(timezone.utc).isoformat()
    analysis_id = str(uuid.uuid4())
    id_estudiante = str(
        datos.get("numeroDocumento") or f"analisis-{analysis_id}"
    ).strip()

    if not id_estudiante:
        id_estudiante = f"analisis-{analysis_id}"

    documentos = []
    advertencias = [
        "Integración parcial: no se han completado las validaciones "
        "documentales ni las comparaciones cruzadas."
    ]

    extractores = {
        "cedula": _extraer_cedula,
        "evaluacion_grado": _extraer_evaluacion,
    }

    for campo, tipo in DOCUMENTOS_POR_NIVEL[nivel]:
        documento = _documento_base(tipo, id_estudiante, ahora)
        archivo = archivos.get(campo)

        if archivo is None:
            documento["validation_status"] = "failed"
            documento["errors"] = ["No se recibió el archivo requerido."]
            documentos.append(documento)
            continue

        extractor = extractores.get(campo)

        if extractor is None:
            documentos.append(documento)
            continue

        try:
            contenido = archivo.read()

            if not contenido:
                raise ValueError("Archivo vacío")

            extraidos, avisos = extractor(contenido)
            documento["extracted_data"] = extraidos
            advertencias.extend(avisos)

        except Exception as error:
            logger.error(
                "Fallo de extracción: analysis_id=%s tipo=%s error=%s",
                analysis_id,
                tipo,
                type(error).__name__,
            )
            documento["validation_status"] = "failed"
            documento["errors"] = [
                "No fue posible ejecutar la extracción. "
                "Puede deberse al archivo o al entorno del motor."
            ]

        documentos.append(documento)

    return {
        "analysis_id": analysis_id,
        "level": nivel,
        "status": "partial",
        "documents": documentos,
        "cross_validations": [],
        "warnings": advertencias,
        "errors": [],
        "generated_at": ahora,
    }