# Validador de cédula: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `validar_cedula` adapta la lectura que ya existe (`leer_cedula`, el PDF417, el MRZ y el RUI) a la estructura de `modules/validadores/` y devuelve un `DocumentValidationResult`.

**Architecture:** Las piezas son:
- `cedula/paginas.py` convierte los bytes en páginas;
- `extraccion.py` llama a `leer_cedula` y traduce su resultado a datos con confianza;
- `calidad.py` mide cada página;
- `fuentes/rui.py` es el adaptador del RUI;
- `reglas.py` tiene las 5 reglas;
- `__init__.py` une todo con `resultado.armar_resultado` (de la 08e).

El comando de consola de la 08e pasa a `validadores/consola.py` y lo comparten los dos validadores.

**Tech Stack:** Python 3.11 (`venv/`), PyMuPDF, Pillow, OpenCV y Tesseract (los usa `modules/cedula`), pytest y jsonschema.

**Spec:** `docs/superpowers/specs/2026-10-17-validador-cedula-design.md`

## Global Constraints

- Lo mismo que la 08e:
  - comandos desde la raíz, con `venv/Scripts/python.exe -m pytest`;
  - imports `modules.validadores…`;
  - campos del JSON en inglés y mensajes en español;
  - fechas `-05:00`;
  - cada resultado se valida con `validar_esquema`;
  - las pruebas no usan internet.
- `VERSION = "cedula@1.0.0"`, `UMBRAL_CONFIANZA = 0.8`, umbral del RUI `85.0` (el `UMBRAL_SIMILITUD` de `modules.cedula.similitud`), `ANCHO_MINIMO = 1000`, `NITIDEZ_MINIMA = 100.0`.
- No se tocan `webapp/` ni la lógica de lectura de `modules/cedula`, `modules/mrz` ni `modules/check_id`: solo se usan.
- No se fabrican documentos. Las muestras son `modules/test_data/cc_escaneada.pdf`, `modules/test_data/cedula_alexander_veha_rocha.png` y `firma_electronica/test/samples/PAZ Y SALVO BIBLIOTECA.pdf`.
- Las pruebas que corren Tesseract se saltan con un aviso si no está instalado (`pytesseract.get_tesseract_version()` falla).
- Confianza de cada dato:
  - fuente `pdf417`, o `mrz` con `mrz.valido is True`, vale **1.0**;
  - las demás fuentes con confianza (`etiqueta`, `produccion`, `estructura`) usan **confianza/100**;
  - sin confianza, o `mrz` con un MRZ inválido: **valor y confianza nulos**.

## Review Focus

1. **Una imagen que no es un PDF ni una imagen válida** (bytes basura, un PDF con contraseña): sale `to_check` y no lanza una excepción (Task 2: `test_bytes_que_no_son_documento`).
2. **Fechas en los dos formatos** (`dd/mm/aaaa` del PDF417 y `aaaa-mm-dd` u otros del MRZ) y fechas imposibles: la fecha se normaliza o queda nula (Task 3: `test_fechas`).
3. **Número con puntos o espacios** ("79.937.877"): se guardan solo los dígitos (Task 3: `test_numero_con_puntos`).
4. **El RUI responde algo raro** (JSON sin "ok", HTML, una excepción de red): queda `sin_respuesta`, nunca una discrepancia (Task 1: `test_respuestas_raras`).
5. **Un archivo que no es cédula, con mucho texto** (el Paz y Salvo): da `invalid` y no se toma como cédula amarilla (Task 5: `test_paz_y_salvo_no_es_cedula`).

---

### Task 1: Adaptador del RUI

**Files:**
- Create: `modules/validadores/fuentes/__init__.py`
- Create: `modules/validadores/fuentes/rui.py`
- Test: `modules/validadores/fuentes/tests/test_rui.py`

**Interfaces:**
- Produces:
  - `@dataclass(frozen=True) class RespuestaRui`, con `estado: Literal["encontrado", "sin_registro", "sin_respuesta"]`, `nombre: str | None` y `detalle: str`;
  - `consultar_rui(numero: str, *, consulta: Callable[[dict], dict] | None = None) -> RespuestaRui`. Por defecto `consulta` es `modules.check_id.rui.consultar.consultar`, que se importa dentro de la función.

- [ ] **Step 1: Write the failing tests.** Las respuestas son simuladas con el formato que arma `consultar.py`; no se grabaron de la red.
  - `test_encontrado`: `{"success": True, "data": {"nombre_completo": "ANA PRUEBA"}}` da `encontrado` y `"ANA PRUEBA"`.
  - `test_sin_registro`: `success False` da `sin_registro` y `nombre None`.
  - `test_respuestas_raras`: una consulta que lanza `requests.ConnectionError`, una que lanza `ValueError` (JSON inválido) y una que devuelve `{}` dan `sin_respuesta`, y el detalle explica la causa.
  - `test_envia_el_numero`: la consulta recibe `{"id": "1000000001"}`.
- [ ] **Step 2:** `venv/Scripts/python.exe -m pytest modules/validadores/fuentes -v`. Expected: FAIL (`ModuleNotFoundError`).
- [ ] **Step 3:** Implementar. `success True` sin nombre da `sin_registro`. Cualquier excepción da `sin_respuesta`.
- [ ] **Step 4:** Repetir el comando. Expected: PASS.
- [ ] **Step 5: Commit** — "Tarea 08a: adaptador del RUI".

### Task 2: Páginas y calidad de imagen

**Files:**
- Create: `modules/validadores/cedula/__init__.py` (en esta tarea, solo docstring)
- Create: `modules/validadores/cedula/paginas.py`
- Create: `modules/validadores/cedula/calidad.py`
- Create: `modules/validadores/cedula/tests/conftest.py`: rutas de las 3 muestras y la fixture `requiere_tesseract`, que salta si falta Tesseract
- Test: `modules/validadores/cedula/tests/test_paginas_calidad.py`

**Interfaces:**
- Produces:
  - `cargar_paginas(contenido: bytes) -> list[PIL.Image.Image]`: un PDF (por los bytes `%PDF`) se convierte con PyMuPDF a 200 ppp; lo demás se abre con Pillow; vacío, ilegible o protegido devuelve `[]`;
  - `@dataclass(frozen=True) class Calidad`, con `ancho: int` y `nitidez: float`;
  - `medir(paginas) -> list[Calidad]`: la nitidez es la varianza del laplaciano en escala de grises (OpenCV);
  - `es_suficiente(calidad: Calidad) -> bool`;
  - `ANCHO_MINIMO` y `NITIDEZ_MINIMA`.

- [ ] **Step 1: Write the failing tests.**
  - `test_png_una_pagina`: la muestra PNG da 1 página de 1024 px de ancho.
  - `test_pdf_una_pagina`: `cc_escaneada.pdf` da 1 página o más.
  - `test_bytes_que_no_son_documento`: `b""`, `b"basura"` y `b"%PDF-1.7 roto"` dan `[]`.
  - `test_medir_devuelve_valores`: con la muestra PNG, `ancho == 1024` y `nitidez > 0`.
  - `test_es_suficiente` (en memoria): `Calidad(999, 500)` no basta; `Calidad(1000, 100)` sí; `Calidad(2000, 99.9)` no.
- [ ] **Step 2:** `venv/Scripts/python.exe -m pytest modules/validadores/cedula/tests/test_paginas_calidad.py -v`. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Repetir. Expected: PASS.
- [ ] **Step 5: Commit** — "Tarea 08a: páginas y calidad de imagen".

### Task 3: Extracción de la cédula

**Files:**
- Create: `modules/validadores/cedula/extraccion.py`
- Test: `modules/validadores/cedula/tests/test_extraccion.py`

**Interfaces:**
- Consumes:
  - `leer_cedula(paginas) -> ResultadoCedula` y `ResultadoCedula`, de `modules.cedula.lectura`;
  - `cargar_paginas` (Task 2).
- Produces:
  - `CAMPOS = ("full_name", "identification_type", "identification_number", "birth_date", "sex")`;
  - `@dataclass(frozen=True) class ExtraccionCedula`, con:
    - `legible: bool`;
    - `es_cedula: bool | None`;
    - `formato: Literal["digital", "amarilla_hologramas", "extranjeria"] | None`;
    - `codigo_leido: bool`;
    - `datos: dict[str, dict]`;
    - `errores: list[str]`;
  - `desde_lectura(resultado: ResultadoCedula) -> ExtraccionCedula`;
  - `extraer(paginas: list, *, leer=leer_cedula) -> ExtraccionCedula`: sin páginas, devuelve el error `"El archivo está vacío o dañado."`.

Reglas de `desde_lectura`. El texto `resultado.texto_ocr` se compara en mayúsculas y sin tildes:
- **Extranjería:** contiene "EXTRANJERIA" o "MIGRACION COLOMBIA".
- **Ciudadanía por texto:** contiene "CEDULA DE CIUDADANIA", "IDENTIFICACION PERSONAL" o "REGISTRADURIA".
- **`formato`:**
  - `"extranjeria"` si es extranjería;
  - si no, `"digital"` si `resultado.formato == "digital"`;
  - si no, `"amarilla_hologramas"` si hay un campo con fuente `pdf417` o el texto dice ciudadanía;
  - si no, `None`.
- **`es_cedula`:**
  - `True` si `formato` no es `None`;
  - si no, `False` si el texto sin espacios de los bordes tiene 40 caracteres o más;
  - si no, `None`.
- **`codigo_leido`:** en digital y extranjería, `mrz.valido is True`; en amarilla, que haya un campo con fuente `pdf417`.
- **`legible`:** `es_cedula is not None`.
- **Extranjería sin MRZ válido:** todos los datos quedan nulos.
- **`identification_type`:** `"C.C."` (digital o amarilla) o `"C.E."`, con confianza 1.0 cuando `formato` no es `None`.
- **Normalización:**
  - número: solo dígitos;
  - fecha: acepta `dd/mm/aaaa`, `aaaa-mm-dd` y `aammdd` (MRZ), y queda `aaaa-mm-dd`; si es imposible, queda nula;
  - sexo: solo `M` o `F`;
  - nombre: espacios normalizados.

- [ ] **Step 1: Write the failing tests** (en memoria, con `ResultadoCedula` armados a mano y `paginas=[]`):
  - `test_pdf417_vale_uno`: los campos con fuente `pdf417` y confianza 100 dan sus valores con confianza 1.0, `formato "amarilla_hologramas"` y `codigo_leido True`.
  - `test_ocr_divide_por_cien`: fuente `etiqueta` con confianza 62 da 0.62.
  - `test_sin_confianza_queda_nulo`: el nombre "DEPARTAMENTOX DDMMYYYY" con `confianza None` da `{"value": None, "confidence": None}`.
  - `test_mrz_valido_y_invalido`: `formato "digital"` con `mrz {"valido": True}` y fuente `mrz` da 1.0 y `codigo_leido True`; con `valido False`, los datos de fuente `mrz` quedan nulos y `codigo_leido False`.
  - `test_extranjeria`: texto "CÉDULA DE EXTRANJERÍA", sin MRZ, da `formato "extranjeria"`, `identification_type "C.E."` y los demás datos nulos.
  - `test_no_es_cedula`: `formato "amarilla_hologramas"` sin PDF417, con 80 caracteres de texto de otro documento, da `es_cedula False` y `formato None`.
  - `test_sin_texto`: texto `""` y sin campos da `es_cedula None` y `legible False`.
  - `test_fechas`: `03/04/1978`, `1978-04-03` y `780403` dan `1978-04-03`; `31/02/1978` da nulo.
  - `test_numero_con_puntos`: `"79.937.877"` da `"79937877"`.
  - `test_sin_paginas`: `extraer([])` da `legible False` y el error de archivo vacío.
  - `test_muestra_png` (con `requiere_tesseract`): `extraer(cargar_paginas(png))` da `full_name "ESTEBAN ALBERTO RODRIGUEZ HERNANDEZ"`, `identification_number "79937877"`, `birth_date "1978-04-03"`, `sex "M"`, todos con 1.0, y `codigo_leido True`.
  - `test_muestra_pdf_escaneado` (con `requiere_tesseract`): `cc_escaneada.pdf` da `codigo_leido False` y `full_name` nulo.
- [ ] **Step 2:** `venv/Scripts/python.exe -m pytest modules/validadores/cedula/tests/test_extraccion.py -v`. Expected: FAIL.
- [ ] **Step 3:** Implementar según las reglas de arriba.
- [ ] **Step 4:** Repetir. Expected: PASS.
- [ ] **Step 5: Commit** — "Tarea 08a: extracción de la cédula".

### Task 4: Reglas de la cédula

**Files:**
- Create: `modules/validadores/cedula/reglas.py`
- Test: `modules/validadores/cedula/tests/test_reglas.py`

**Interfaces:**
- Consumes: `ExtraccionCedula` (Task 3), `Calidad` y `es_suficiente` (Task 2), `RespuestaRui` (Task 1), `evaluacion` y `BOGOTA` (de `resultado.py`) y `comparar_nombres` (de `modules.cedula.similitud`).
- Produces:
  - `VERSION = "cedula@1.0.0"` y `UMBRAL_CONFIANZA = 0.8`;
  - `evaluar(extraccion, calidades: list[Calidad], rui: RespuestaRui | None, *, ahora: datetime, umbral_rui: float = UMBRAL_SIMILITUD) -> list[dict]`, con las reglas en este orden: `identification_document`, `required_fields_present`, `machine_readable_code` (obligatorias), `image_quality` y `rui_name_match` (informativas).

Mensajes fijos:
- no es una cédula: "El archivo no es una cédula. Sube una foto o un PDF de tu cédula por ambas caras.";
- código ilegible: "No se pudo leer el código de la cédula (MRZ o PDF417); un funcionario la revisará.";
- `identification_document` cumple: "Se leyó la cédula: {nombre del formato}.", con "Cédula digital", "Cédula amarilla con hologramas" o "Cédula de extranjería".

- [ ] **Step 1: Write the failing tests** (todo en memoria):
  - `test_cedula_completa_todo_cumple`, con PDF417, datos en 1.0, calidad suficiente y RUI que coincide.
  - `test_no_es_cedula`: `identification_document` da `no_cumple` con el mensaje fijo, y las otras 4 `missing_dependency`.
  - `test_ilegible`: `es_cedula None` da `no_evaluable` / `low_confidence`, y las otras 4 `missing_dependency`.
  - `test_dato_bajo_umbral`: el número con 0.79 da `required_fields_present` `no_evaluable` / `low_confidence` y nombra el número; con 0.8 cumple.
  - `test_codigo_no_leido`: `codigo_leido False` da `machine_readable_code` `no_evaluable` con el mensaje fijo.
  - `test_calidad`:
    - una página bajo el umbral da `no_cumple` informativa, y el mensaje trae ancho y nitidez;
    - todas suficientes dan `cumple`;
    - `[]` da `missing_dependency`.
  - `test_rui`:
    - `encontrado` con el mismo nombre da `cumple`;
    - otro nombre da `no_cumple` (`mandatory False`) y el mensaje trae el porcentaje;
    - `sin_respuesta` y `sin_registro` dan `source_unavailable`;
    - `None` con extranjería da `source_pending`;
    - `None` sin extranjería da `missing_dependency`.
  - `test_reglas_cumplen_el_contrato`: cada regla se valida contra `rule-evaluation`.
- [ ] **Step 2:** `venv/Scripts/python.exe -m pytest modules/validadores/cedula/tests/test_reglas.py -v`. Expected: FAIL.
- [ ] **Step 3:** Implementar según la sección 6 del spec.
- [ ] **Step 4:** Repetir. Expected: PASS.
- [ ] **Step 5: Commit** — "Tarea 08a: reglas de la cédula".

### Task 5: `validar_cedula`, consola compartida y documentación

**Files:**
- Modify: `modules/validadores/cedula/__init__.py`
- Create: `modules/validadores/cedula/__main__.py`
- Create: `modules/validadores/consola.py`: `ejecutar(argv: list[str], validar: Callable[[bytes], dict], extensiones: tuple[str, ...], uso: str) -> int`, sacado del `__main__` de la 08e
- Modify: `modules/validadores/saber_pro/__main__.py` para que use `consola.ejecutar` (sus pruebas no cambian y deben seguir pasando)
- Modify: `modules/validadores/README.md`, con una sección de la cédula
- Test: `modules/validadores/cedula/tests/test_validar.py` y `modules/validadores/cedula/tests/test_comando.py`

**Interfaces:**
- Produces: `validar_cedula(contenido: bytes, *, id_student: str, document_version: int, ahora: datetime | None = None, consultar: Callable[[str], RespuestaRui] = consultar_rui, leer=leer_cedula) -> dict`. Valida `id_student` y `document_version` igual que la 08e.
- El RUI se consulta solo si `es_cedula`, el formato no es extranjería y nombre y número tienen confianza ≥ 0.8; si no, `rui=None`.

- [ ] **Step 1: Write the failing tests.**
  - `test_png_valida` (con `requiere_tesseract`, y `consultar` falso que devuelve `encontrado` con el mismo nombre): `valid`, `required_action "none"` y pasa el esquema.
  - `test_png_rui_caido_sigue_valida`: con `consultar` que devuelve `sin_respuesta`, sigue `valid` y `rui_name_match` da `source_unavailable`.
  - `test_pdf_escaneado_por_revisar` (con Tesseract): `to_check` y `wait_for_review`.
  - `test_paz_y_salvo_no_es_cedula` (con Tesseract): `invalid`, `upload_new_version` y el motivo de "no es una cédula".
  - `test_bytes_vacios`: `b""` da `to_check` sin consultar el RUI (el `consultar` falso falla si lo llaman).
  - `test_id_y_version`: `type_document "identification"` y `validation_version "cedula@1.0.0"`; un id en blanco o una versión 0 dan `ValueError`.
  - `test_comando.py`: las mismas 5 pruebas del comando de la 08e, con `modules.validadores.cedula.__main__.main`, aceptando `.png` y `.jpg` en carpetas.
- [ ] **Step 2:** `venv/Scripts/python.exe -m pytest modules/validadores/cedula -v`. Expected: FAIL.
- [ ] **Step 3:** Implementar. El comando de la cédula **solo consulta el RUI con `--rui`**: por defecto no envía números de documento a un servicio externo y la regla queda `missing_dependency` con el mensaje "No se consultó el RUI". Las pruebas automáticas lo reemplazan siempre.
- [ ] **Step 4:** Toda la suite: `venv/Scripts/python.exe -m pytest`. Expected: PASS, incluidas las 100 de la 08e.
- [ ] **Step 5: Commit** — "Tarea 08a: validar_cedula, consola compartida y documentación".
