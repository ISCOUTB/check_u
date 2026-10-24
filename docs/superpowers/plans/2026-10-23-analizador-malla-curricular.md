# Plan de Implementación: Analizador de Malla Curricular (Tarea 27)

Issue: ISCOUTB/check_u#57. Rama: `programa_cunplimiento_malla_curricular`.
Documento de diseño: `docs/superpowers/specs/2026-10-23-analizador-malla-curricular-design.md`.

## Fases de Implementación

### Fase 1: Modelos de Datos y Normalización
- Definir `PeriodoEvaluacion` y `ResultadoMallaCurricular` en `modules/malla_curricular/modelos.py`.
- Implementar validaciones de tipos y serialización estricta a JSON con nombres exactos de claves.
- Soporte para normalización de periodos (`AAAA10` -> `AAAA-1`, `AAAA20` -> `AAAA-2`, `AAAA-I` -> `AAAA-1`, etc.).

### Fase 2: Extractor de PDF de Banner
- Implementar lectura segura de PDF con `PyMuPDF` en `modules/malla_curricular/extractor.py`.
- Manejo de casos de borde: archivo vacío, archivo corrupto, archivo encriptado/protegido con contraseña, escaneo sin texto.
- Heurísticas de identificación de documento Banner ("EVALUACIÓN DE GRADO", "BANNER", "CAPP", "PROGRAMA", "CRÉDITOS").
- Extracción de datos de estudiante: `full_name_student`, `code_student`, `program`.
- Extracción de créditos del programa: `max_credits`, `credits_approved`.
- Extracción de bloques de periodos o niveles con créditos y estado de cumplimiento.

### Fase 3: Analizador y Motor de Reglas
- Implementar `modules/malla_curricular/analizador.py`.
- Evaluación de periodos individuales y cálculo de `faltantes = credits_total - credits_approved`.
- Evaluación general (`general_result` en `"cumple"` / `"no_cumple"`).
- Redacción automática y precisa del `motivo` según las especificaciones de la issue #57 (plural, singular, lista de periodos y faltantes respectivos).
- Validación de coherencia interna.

### Fase 4: Punto de Entrada CLI y Módulo Principal
- Implementar `modules/malla_curricular/__init__.py` y `modules/malla_curricular/__main__.py`.
- Soporte para argumento por línea de comandos y entrada estándar (`sys.stdin.buffer`).
- Garantizar salida JSON pura sin textos de depuración ni delimitadores markdown.
- Documentación en `modules/malla_curricular/README.md`.

### Fase 5: Suite de Pruebas y Configuración
- Configurar pruebas unitarias completas en `modules/malla_curricular/tests/`.
- Casos de prueba para extractor, analizador, modelos y CLI.
- Actualizar `pytest.ini` para incluir `modules/malla_curricular`.
- Ejecutar suite de pruebas con `pytest`.
