# modules/validadores — validadores de documentos

Cada validador recibe el archivo que subió el estudiante y devuelve un `DocumentValidationResult` del contrato de la Tarea 02 (`contratos/esquemas/document-validation-result.schema.json`):
- la **extracción** (datos con su confianza), separada de las **reglas** (cumple / no_cumple / no_evaluable);
- la clasificación del documento (`valid`, `invalid` o `to_check`);
- la acción que debe tomar el estudiante.

Hoy existe el de **Saber Pro** (Tarea 08e). Diseño: `docs/superpowers/specs/2026-10-17-validador-saber-pro-design.md`.

## Archivos

| Archivo | Qué hace |
|---|---|
| `resultado.py` | Compartido por todos los validadores: arma cada `RuleEvaluation` y el resultado del contrato, clasifica con las reglas obligatorias y aplica la regla de reenvío. |
| `conftest.py` | Fixture `validar_esquema` de las pruebas: valida contra los esquemas del contrato. |
| `saber_pro/__init__.py` | `validar_saber_pro(contenido, id_student=…, document_version=…)`. |
| `saber_pro/extraccion.py` | Lee el texto del PDF con PyMuPDF, solo desde "Reporte de resultados" (la página 1 repite el puntaje como ejemplo). |
| `saber_pro/firma.py` | Firma del ICFES con el `SignatureValidator` de `firma_electronica/`. Distingue firma ausente, no verificable (archivo guardado de nuevo) y presente. |
| `saber_pro/reglas.py` | Las 5 reglas, `VERSION = "saber_pro@1.0.0"` y `PUNTAJE_MINIMO = 100`. |
| `saber_pro/certificados/` | Certificados públicos de Camerfirma Colombia (ver su README). |

## Uso

```python
from modules.validadores.saber_pro import validar_saber_pro

resultado = validar_saber_pro(pdf_en_bytes, id_student="T00012345", document_version=1)
resultado["document_classification"]  # "valid" | "invalid" | "to_check"
```

La raíz del repositorio debe estar en `sys.path` (igual que en `webapp/app.py`).

## Instalar y probar

Desde la raíz del repositorio, con el `venv`:

```bash
venv/Scripts/python.exe -m pip install -r modules/requirements-dev.txt
venv/Scripts/python.exe -m pytest
```

`pytest.ini` (en la raíz) limita las pruebas a `modules/validadores` y al verificador de firma de `firma_electronica/`. Las pruebas no usan internet.

### Muestras reales (solo en tu PC)

Las pruebas con reportes reales leen `modules/test_data/saber_pro/`. Git ignora `test_data/`, así que la carpeta no está en el repositorio.

Para correrlas:
1. Pon ahí los PDF.
2. Escribe a mano `esperados.json`, con el formato de abajo.

```json
{
  "<archivo>.pdf": {
    "tipo": "reporte",
    "datos": {
      "full_name": "…",
      "identification_type": "C.C.",
      "identification_number": "…",
      "registration_number": "EK…",
      "exam_date": "aaaa-mm-dd",
      "global_score": 0
    },
    "clasificacion": "to_check"
  },
  "<otro>.pdf": { "tipo": "corrupto", "clasificacion": "to_check" }
}
```

Sin esa carpeta, esas pruebas se saltan con un aviso.

## Pendiente

- Registrar el validador en el `pipeline_registry` cuando exista la Tarea 07 (#11). La cola y el trabajador son de la Tarea 06, y guardar los resultados de la Tarea 03.
- Instalar pyHanko en el compose del servidor cuando el trabajador ejecute validadores.
- El certificado con el que firma el ICFES venció el 02/12/2025. Las copias de reportes abiertas en el navegador y guardadas de nuevo pierden la firma verificable y quedan por revisar.
