# Analizador de Cumplimiento de la Malla Curricular - Evaluación de Grado Banner (Tarea 27)

Issue: ISCOUTB/check_u#57. Rama: `programa_cunplimiento_malla_curricular`.

## 1. Objetivo

Analizar un archivo PDF correspondiente a la **Evaluación de Grado expedida por Banner**, extraer la información académica del estudiante y determinar si cumple con los requisitos de aprobación de la malla curricular.

El programa procesa el contenido del PDF y devuelve exclusivamente un objeto JSON válido, sin texto adicional, explicaciones ni bloques de código Markdown, compatible con `JSON.parse()`.

## 2. Decisiones de diseño

| # | Tema | Decisión |
|---|---|---|
| 1 | Ubicación del código | `modules/malla_curricular/` siguiendo la estructura de `modules/estampilla_pro` (Tarea 22) y el motor en Python de CheckU. |
| 2 | Motor de lectura PDF | PyMuPDF (`fitz`), ya instalado y probado en el proyecto (utilizado en `saber_pro` y `estampilla`). |
| 3 | Extracción robusta | No lanza excepciones no controladas ante PDF vacíos, encriptados, corruptos o escaneos sin capa de texto; reporta el motivo correspondiente. |
| 4 | Detección de Banner | Valida si el PDF contiene encabezados y términos característicos de la Evaluación de Grado de Banner (`EVALUACIÓN DE GRADO`, `BANNER`, `CAPP`, etc.). |
| 5 | Normalización de periodos | Extrae y normaliza el identificador de periodo a formato `AAAA-1` o `AAAA-2` (e.g. `202410` -> `2024-1`, `202420` -> `2024-2`, `2024-I` -> `2024-1`). Si no es determinable con certeza, asigna `null`. |
| 6 | Cálculo de faltantes | `faltantes = credits_total - credits_approved`. Si faltantes < 0, se acota a 0. No se inventan valores si faltan datos. |
| 7 | Redacción del motivo | Sigue con exactitud la plantilla y ejemplos de la issue #57: plural/singular, lista de periodos y créditos faltantes respectivos. |
| 8 | Interfaz CLI y stdin | Ejecutable como módulo (`python -m modules.malla_curricular archivo.pdf`) o mediante canal estándar (stdin). Salida 100% JSON puro. |
| 9 | Suite de pruebas | Pruebas unitarias completas en `modules/malla_curricular/tests/` con generación de documentos PDF sintéticos en memoria vía PyMuPDF. |

## 3. Estructura de salida JSON

La salida generada cumple estrictamente con el esquema especificado en la issue #57:

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

## 4. Reglas para los campos y tipos de datos

- `type_document`: constante `"academic_evaluation"`.
- `full_name_student`: cadena con el nombre completo o `null`.
- `code_student`: código institucional del estudiante (ej. `T00063198`) o `null`.
- `program`: nombre del programa curricular o `null`.
- `general_result`: `"cumple"` si todos los periodos evaluados cumplen; `"no_cumple"` si al menos uno presenta créditos pendientes, `Cumple: No`, o faltan datos esenciales.
- `motivo`:
  - Cumple: `"El estudiante cumple con todos los niveles o periodos académicos evaluados y no presenta créditos pendientes de aprobación según la evaluación de Banner."`
  - No cumple con periodos y créditos pendientes:
    - Varios periodos: `"En los periodos 2024-1 y 2025-2, el estudiante tiene 3 y 2 créditos pendientes de aprobación, respectivamente, por lo que no cumple con el requisito de aprobación de todos los créditos del programa académico."`
    - Un periodo: `"En el periodo 2024-1, el estudiante tiene 3 créditos pendientes de aprobación, por lo que no cumple con el requisito de aprobación de todos los créditos del programa académico."`
  - Documento no válido o ilegible: explicación concisa del error.
- `max_credits`: número entero con el total de créditos exigidos por el programa, o `null`.
- `credits_approved`: número entero con los créditos aprobados, o `null`.
- `periods`: lista de objetos por periodo evaluado:
  - `period`: cadena normalizada `AAAA-1` o `AAAA-2`, o `null` si no es seguro.
  - `credits_approved`: número entero o `null`.
  - `credits_total`: número entero o `null`.
  - `faltantes`: número entero calculado o `null`.
  - `result`: `"cumple"` o `"no_cumple"`.

## 5. Módulos y componentes

```
modules/malla_curricular/
├── __init__.py        # Exposición de analizar_evaluacion_grado y clases principales
├── __main__.py        # Punto de entrada CLI (salida JSON pura)
├── analizador.py      # Lógica de cálculo, reglas de cumplimiento y redacción del motivo
├── extractor.py       # Lectura con PyMuPDF, detección de Banner y extracción de patrones
├── modelos.py         # Clases de datos y conversión a diccionario JSON
├── README.md          # Documentación técnica de uso y desarrollo
└── tests/             # Suite de pruebas unitarias automatizadas
    ├── __init__.py
    ├── conftest.py
    ├── test_analizador.py
    ├── test_cli.py
    └── test_extractor.py
```
