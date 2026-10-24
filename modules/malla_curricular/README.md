# Módulo de Cumplimiento de Malla Curricular - Evaluación de Grado Banner (Tarea 27)

Este módulo analiza archivos PDF correspondientes a la **Evaluación de Grado expedida por Banner**, extrae la información académica del estudiante y determina si cumple con los requisitos de aprobación de la malla curricular.

Forma parte del motor en Python de CheckU (`modules/malla_curricular/`) y da solución a la [Issue #57](https://github.com/ISCOUTB/check_u/issues/57).

---

## 1. Características principales

- **Extracción precisa y tolerante**: Lee texto estructurado con `PyMuPDF` (fitz) y procesa encabezados de Banner, datos del estudiante y bloques de periodos/niveles.
- **Normalización de periodos**: Convierte códigos Banner de periodo (ej. `202410`, `202420`, `2024-I`) al formato normalizado `AAAA-1` o `AAAA-2`.
- **Cálculo de créditos**: Aplica la fórmula obligatoria `faltantes = credits_total - credits_approved` y valida coherencia entre créditos requeridos y aprobados.
- **Salida JSON pura**: Diseñado para ser consumido por orquestadores o llamadas de procesos (compatible con `JSON.parse()`), sin texto adicional ni bloques markdown.
- **Manejo seguro de errores**: Ante archivos corruptos, escaneos sin texto digital o documentos que no pertenecen a Banner, reporta el resultado `no_cumple` con el motivo explicativo correspondiente sin lanzar excepciones no controladas.

---

## 2. Uso

### A. Desde Python

```python
from modules.malla_curricular import analizar_malla_curricular

# A partir de una ruta en disco o de bytes en memoria
resultado = analizar_malla_curricular("ruta/a/evaluacion_banner.pdf")

print(resultado["general_result"])  # "cumple" o "no_cumple"
print(resultado["motivo"])
```

### B. Por consola (CLI)

```bash
# Procesar archivo directamente:
python -m modules.malla_curricular "ruta/a/evaluacion_banner.pdf"

# Procesar vía stdin:
cat evaluacion_banner.pdf | python -m modules.malla_curricular
```

---

## 3. Estructura de salida JSON

La respuesta respeta exactamente la especificación de la Issue #57:

```json
{
  "type_document": "academic_evaluation",
  "full_name_student": "Javier Enrique Mercado Bolívar",
  "code_student": "T00063198",
  "program": "Ingeniería de Sistemas y Computación",
  "general_result": "cumple",
  "motivo": "El estudiante cumple con todos los niveles o periodos académicos evaluados y no presenta créditos pendientes de aprobación según la evaluación de Banner.",
  "max_credits": 160,
  "credits_approved": 160,
  "periods": [
    {
      "period": "2024-1",
      "credits_approved": 16,
      "credits_total": 16,
      "faltantes": 0,
      "result": "cumple"
    }
  ]
}
```

---

## 4. Pruebas unitarias

Ejecución de la suite completa de pruebas:

```bash
python -m pytest modules/malla_curricular
```
