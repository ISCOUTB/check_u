# Validador de Saber Pro: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** un validador de Python que recibe el PDF de Saber Pro y devuelve un `DocumentValidationResult` del contrato, con extracción, reglas y firma separadas.

**Architecture:** paquete `modules/validadores/`:
- `resultado.py` es compartido: arma las reglas y el resultado del contrato, clasifica y aplica la regla de reenvío;
- `saber_pro/` tiene la extracción (PyMuPDF), la firma (adaptador al `SignatureValidator` ampliado de `firma_electronica/`) y las 5 reglas.

`validar_saber_pro` une todo.

**Tech Stack:** Python 3.11 (`venv/` de la raíz), PyMuPDF 1.28.2, pyHanko 0.37.0 y pyhanko-certvalidator 0.32.1, pytest 9.1.1, jsonschema 4.26.0.

**Spec:** `docs/superpowers/specs/2026-10-17-validador-saber-pro-design.md`

## Global Constraints

- Comandos desde la raíz del repo, con `venv/Scripts/python.exe -m pytest …`. La raíz va en `sys.path`, y los imports son `modules.validadores…` y `firma_electronica.infra.sign_validator` (la misma convención que `webapp/app.py`).
- Campos del JSON en inglés y snake_case. Mensajes, comentarios y nombres internos en español.
- Fechas con zona `-05:00` (America/Bogota). Se usa `timezone(timedelta(hours=-5))`, porque Windows no trae la base de zonas IANA y Colombia no tiene horario de verano.
- `validation_version = "saber_pro@1.0.0"` y `PUNTAJE_MINIMO = 100`.
- NIT del ICFES en el certificado: `serialNumber = 8600243016`.
- **No se crean documentos de prueba (PDF).** Los casos sin PDF se prueban con datos en memoria: texto de páginas, `EstadoFirma`, bytes que no son un PDF.
- Los PDF reales y `esperados.json` viven en `modules/test_data/saber_pro/`, que git ignora. Las pruebas que los usan se saltan con `pytest.skip("…")` si faltan.
- Ningún dato personal en el código ni en las pruebas que se suben.
- Las pruebas no usan internet.
- La app de escritorio de `firma_electronica/` debe seguir funcionando igual: las claves actuales de `SignatureValidator.validate` no cambian.
- Cada `DocumentValidationResult` que produzca el validador se valida contra `contratos/esquemas/document-validation-result.schema.json`.

## Review Focus

1. **Variaciones de formato en el reporte:** etiqueta y valor en la misma línea (`Puntaje global 154/300`), espacios dobles o saltos de línea extra. El dato se lee igual (Task 2: `test_valor_en_la_misma_linea`).
2. **Bytes que no son un PDF o PDF cifrado:** el validador no lanza una excepción; el resultado es `to_check` con un error del documento (Task 2: `test_bytes_que_no_son_pdf`; Task 5: `test_archivo_vacio_da_por_revisar`).
3. **Valores fuera de rango o imposibles:** puntaje `354 /300`, fecha `31/02/2026` o un registro con 11 dígitos dan valor y confianza nulos, nunca un valor inventado (Task 2: `test_valores_imposibles_quedan_nulos`).
4. **Nombres con tildes, ñ o espacios dobles:** se conservan las tildes y la ñ, y se normalizan los espacios (Task 2: `test_nombre_con_tildes_y_espacios`).
5. **Firma presente pero de otro firmante o con un PDF modificado:** se usan las muestras firmadas de `firma_electronica/test/samples/` (la Biblioteca firma, no el ICFES). Una firma de otro da `no_cumple` y un PDF modificado también (Task 3: pruebas sobre las muestras; Task 4: reglas en memoria).

---

### Task 1: Base del paquete y resultado compartido

**Files:**
- Create: `modules/requirements.txt` (`PyMuPDF==1.28.2`, `pyHanko==0.37.0`, `pyhanko-certvalidator==0.32.1`)
- Create: `modules/requirements-dev.txt` (`-r requirements.txt`, `pytest==9.1.1`, `jsonschema==4.26.0`)
- Create: `pytest.ini` en la raíz: `testpaths = modules/validadores firma_electronica/test/test_sign_validator.py`, `pythonpath = .`, `addopts = --import-mode=importlib`
- Create: `modules/validadores/__init__.py` (vacío, con una línea de docstring)
- Create: `modules/validadores/resultado.py`
- Create: `modules/validadores/tests/conftest.py`: la fixture `validar_esquema(resultado: dict) -> None`, que carga el esquema de `contratos/esquemas/` y usa `jsonschema.Draft202012Validator` con `FormatChecker`
- Test: `modules/validadores/tests/test_resultado.py`

**Interfaces:**
- Produces:
  - `BOGOTA: timezone` (UTC−5);
  - `ahora_bogota() -> datetime`;
  - `evaluacion(rule: str, result: str, *, mandatory: bool, message: str, motivo: str | None = None, errors: list[str] | None = None, ahora: datetime) -> dict` (un `RuleEvaluation`). Lanza `ValueError` si `result == "no_evaluable"` sin motivo, o si trae motivo con otro resultado;
  - `clasificar(reglas: list[dict]) -> str` (`"valid" | "invalid" | "to_check"`), donde solo cuentan las reglas con `mandatory: true`;
  - `armar_resultado(*, id_student: str, type_document: str, document_version: int, extracted_data: dict, reglas: list[dict], errores: list[str], validation_version: str, ahora: datetime, accion_por_revisar: str = "wait_for_review") -> dict`.
- Fixture `validar_esquema` para todas las pruebas de `modules/validadores/`.

- [ ] **Step 1: Write the failing tests** (`test_resultado.py`)
  - `test_evaluacion_no_evaluable_exige_motivo`: `pytest.raises(ValueError)` sin motivo, y otro con motivo en `"cumple"`.
  - `test_clasificar_todo_cumple_es_valid`.
  - `test_clasificar_una_obligatoria_no_cumple_es_invalid`, también cuando otra es `no_evaluable`.
  - `test_clasificar_solo_no_evaluable_es_to_check`.
  - `test_clasificar_ignora_reglas_informativas`: una `mandatory: false` con `no_cumple` sigue dando `valid`.
  - `test_invalid_permite_reenvio`: `resubmission_allowed is True`, `required_action == "upload_new_version"` y `resubmission_reason ==` el `message` de la **primera** obligatoria que no cumple.
  - `test_to_check_sin_reenvio`: `False`, `"wait_for_review"`, `None`; y con `accion_por_revisar="wait_for_external_validation"` usa esa acción.
  - `test_valid_sin_accion`: `False`, `"none"`, `None`.
  - `test_resultado_cumple_el_contrato`: con `validar_esquema`, valida los tres casos (`valid`, `invalid`, `to_check`) y `timestamp` termina en `-05:00`.
- [ ] **Step 2:** `venv/Scripts/python.exe -m pytest modules/validadores/tests/test_resultado.py -v`. Expected: FAIL con `ModuleNotFoundError: modules.validadores.resultado`.
- [ ] **Step 3:** Implementar `resultado.py` según Interfaces. `validation_status` siempre es `"completed"` y `document_classification` sale de `clasificar`. Las fechas van con `datetime.isoformat(timespec="seconds")`.
- [ ] **Step 4:** Repetir el comando. Expected: PASS (todas).
- [ ] **Step 5: Commit** — `git add modules/requirements*.txt pytest.ini modules/validadores` y "Tarea 08e: resultado compartido de los validadores".

### Task 2: Extracción de Saber Pro

**Files:**
- Create: `modules/validadores/saber_pro/__init__.py` (en esta tarea solo con docstring)
- Create: `modules/validadores/saber_pro/extraccion.py`
- Create: `modules/validadores/saber_pro/tests/conftest.py`: fixtures `carpeta_muestras` (`modules/test_data/saber_pro/`) y `esperados` (lee `esperados.json`; hace `pytest.skip` si falta)
- Create, **local y no se sube**: `modules/test_data/saber_pro/esperados.json`, escrito a mano a partir del texto de los PDF (no con el extractor). Formato: `{"<archivo>.pdf": {"tipo": "reporte" | "corrupto", "datos": {<6 claves>: valor}, "clasificacion": "to_check"}}`
- Test: `modules/validadores/saber_pro/tests/test_extraccion.py`

**Interfaces:**
- Produces:
  - `CAMPOS = ("full_name", "identification_type", "identification_number", "registration_number", "exam_date", "global_score")`;
  - `@dataclass(frozen=True) class ExtraccionSaberPro`, con:
    - `tiene_texto: bool`;
    - `es_reporte: bool | None`: `True` si hay "Reporte de resultados" y un registro `EK`+12 dígitos; `False` si hay texto sin "Reporte de resultados" o el registro trae otro prefijo (por ejemplo `AC`); `None` si no hay texto, o si está el encabezado pero falta el registro;
    - `datos: dict[str, dict]` (las 6 claves, cada una `{"value", "confidence"}`);
    - `errores: list[str]`;
  - `extraer(contenido: bytes) -> ExtraccionSaberPro`;
  - `extraer_de_paginas(paginas: list[str]) -> ExtraccionSaberPro`.

- [ ] **Step 1: Write the failing tests.** Los textos de las pruebas en memoria son **inventados**: nombre "Ana María Prueba Núñez", `C.C. 1000000001`, `EK202600000001`, `26/04/2026`, `150 /300`. Imitan el formato de la sección 3 del spec, con una etiqueta por línea y el valor en la línea siguiente.
  - `test_extrae_los_seis_campos`: devuelve `full_name "Ana María Prueba Núñez"`, `identification_type "C.C."`, `identification_number "1000000001"`, `registration_number "EK202600000001"`, `exam_date "2026-04-26"` y `global_score 150`, todos con confianza `1.0`; además `es_reporte is True`.
  - `test_ignora_el_ejemplo_de_la_guia`: la página 1 trae la guía con `Puntaje\nglobal\n1 54` y `= 1 54`, y la página 2 el reporte con `150 /300`. Debe dar `global_score == 150`.
  - `test_valor_en_la_misma_linea`: `Puntaje global 150/300` y `Número de registro: EK202600000001` en una sola línea dan los mismos valores.
  - `test_nombre_con_tildes_y_espacios`: `"Ana  María\tPrueba Núñez"` da `"Ana María Prueba Núñez"`.
  - `test_valores_imposibles_quedan_nulos`: `354 /300`, `31/02/2026` y `EK20260000001` (11 dígitos) dan `{"value": None, "confidence": None}`.
  - `test_campo_ausente_queda_nulo`: sin la línea de identificación, `identification_type` e `identification_number` quedan nulos y los demás no cambian.
  - `test_saber_11_no_es_reporte`: registro `AC202600000001` da `es_reporte is False`.
  - `test_texto_sin_reporte_no_es_reporte`: `["Factura de venta…"]` da `es_reporte is False`.
  - `test_sin_texto`: `[]` o `["", "  "]` da `tiene_texto is False`, `es_reporte is None` y un error `"El PDF no tiene texto"`.
  - `test_bytes_que_no_son_pdf`: `extraer(b"")` y `extraer(b"no es un pdf")` no lanzan excepción, dan `tiene_texto is False` y un error que contiene `"vacío o dañado"`.
  - `test_reportes_reales_coinciden_con_esperados` (con `esperados`): por cada archivo de tipo `"reporte"`, `extraer(bytes).datos[k]["value"] == esperado` en las 6 claves, todas con confianza `1.0`; por cada `"corrupto"`, `tiene_texto is False`.
- [ ] **Step 2:** `venv/Scripts/python.exe -m pytest modules/validadores/saber_pro/tests/test_extraccion.py -v`. Expected: FAIL (`ModuleNotFoundError`).
- [ ] **Step 3: Implementar `extraccion.py`.**
  - `extraer` abre con `pymupdf.open(stream=contenido, filetype="pdf")`. Si `contenido` está vacío o PyMuPDF lanza `pymupdf.FileDataError` o `EmptyFileError`, devuelve el error `"El archivo está vacío o dañado."`. Si no, usa `page.get_text()` por página y llama a `extraer_de_paginas`.
  - `extraer_de_paginas` une las páginas y corta desde la primera aparición de `"Reporte de resultados"`.
  - Cada campo se busca por su etiqueta con una expresión regular que acepta el valor en la misma línea o en la siguiente.
  - Formatos que exige cada campo:
    - identificación: `^([A-Z]{1,3}(?:\.[A-Z])?\.?)\s*(\d{5,15})$`, sobre las siglas tal como aparecen (`C.C.`, `T.I.`);
    - registro: `^[A-Z]{2}\d{12}$` (el prefijo `EK` lo juzga `es_reporte`, no el formato);
    - fecha: `dd/mm/aaaa`, validada con `datetime.strptime`;
    - puntaje: `(\d{1,3})\s*/\s*300`, entre 0 y 300.
  - Sin "Reporte de resultados", `es_reporte` es `False` si hay texto. Si el registro existe y no empieza por `EK`, `es_reporte` es `False` y `registration_number` conserva el valor leído.
- [ ] **Step 4:** Repetir el comando. Expected: PASS. La prueba de los reales pasa, o se salta si falta `esperados.json`.
- [ ] **Step 5: Commit** — `git add modules/validadores/saber_pro` (sin `test_data`) y "Tarea 08e: extracción de Saber Pro".

### Task 3: Verificador de firma ampliado y adaptador

**Files:**
- Modify: `firma_electronica/infra/sign_validator.py`
- Create: `firma_electronica/test/test_sign_validator.py`
- Create: `modules/validadores/saber_pro/firma.py`
- Create: `modules/validadores/saber_pro/certificados/README.md`, más los `.crt` de Camerfirma Colombia (raíz y `SUBCA CAMERFIRMA COLOMBIA SAS v2`) **solo si Héctor aprueba la descarga**
- Modify: `.gitignore`: `!modules/validadores/saber_pro/certificados/*.crt`, con un comentario que explica que son certificados públicos de una autoridad certificadora
- Test: `modules/validadores/saber_pro/tests/test_firma.py`

**Interfaces:**
- Produces (`sign_validator.py`):
  - `SignatureValidator(trusted_cert_path: Path = TRUSTED_CERT_PATH, *, trusted_cert_paths: Sequence[Path] | None = None, allow_fetching: bool = False)`. Con `trusted_cert_paths` no lee `trusted_cert_path`.
  - `validate(pdf_path) -> dict` y `validate_bytes(data: bytes, *, allow_fetching: bool | None = None) -> dict`.
  - Claves de siempre: `signed`, `valid`, `modified`, `certificate_trusted`, `message`.
  - Claves nuevas: `signer_organization: str | None`, `signer_serial_number: str | None`, `signer_not_after: datetime | None`, `signer_reported_time: datetime | None`, `revoked: bool`, `trust_problem: str | None` (el `name` de `status.trust_problem_indic`) y `entire_file: bool`.
- Produces (`firma.py`):
  - `NIT_ICFES = "8600243016"`;
  - `@dataclass(frozen=True) class EstadoFirma`, con:
    - `presencia: Literal["ausente", "no_verificable", "presente"]`;
    - `intacta: bool | None`;
    - `firmante: str | None`;
    - `firmante_es_icfes: bool | None`;
    - `certificado: Literal["valido", "vencido", "revocado", "no_confiable", "sin_respuesta", "desconocido"] | None`;
    - `vence: datetime | None`;
    - `detalle: str | None`;
  - `verificar(contenido: bytes, *, consultar_revocacion: bool = True) -> EstadoFirma`.

- [ ] **Step 1: Write the failing tests.**
  - `firma_electronica/test/test_sign_validator.py` usa los 3 PDF de `firma_electronica/test/samples/` con `trusted_cert_paths=[]`:
    - "firmado" da `signed True`, `modified False`, `certificate_trusted False`, `signer_organization == "Biblioteca"` y `entire_file True`;
    - "modificado" da `modified True`;
    - el que no está firmado da `signed False`;
    - `validate(path)` y `validate_bytes(bytes)` devuelven lo mismo.
  - `test_firma.py`:
    - `test_muestra_de_biblioteca_firmante_no_es_icfes`: el PDF "firmado" de la Biblioteca da `presencia "presente"`, `intacta True`, `firmante_es_icfes False` y `certificado "no_confiable"`.
    - `test_muestra_modificada`: `intacta False`.
    - `test_sin_firma`: el PDF sin firmar da `presencia "ausente"`.
    - `test_bytes_dañados`: `verificar(b"")` da `presencia "ausente"` sin excepción.
    - `test_copias_del_equipo_no_verificables` (con `esperados`): cada reporte real da `presencia "no_verificable"`.
    - `test_mapeo_de_problemas_de_confianza`: parametrizada sobre `_estado_certificado(resultado: dict, ahora: datetime) -> str`, con diccionarios en memoria:
      - `trusted True` da `"valido"`;
      - `revoked True` da `"revocado"`;
      - `trust_problem "EXPIRED"` u `"OUT_OF_BOUNDS_NO_POE"` dan `"vencido"`;
      - `signer_not_after` anterior a `signer_reported_time` da `"vencido"` aunque `trust_problem` sea otro;
      - `"NO_CERTIFICATE_CHAIN_FOUND"` o `"CHAIN_CONSTRAINTS_FAILURE"` dan `"no_confiable"`;
      - `"TRY_LATER"` da `"sin_respuesta"`;
      - `"GENERIC"` da `"desconocido"`.
    - `test_vencido_no_consulta_revocacion`: con un `SignatureValidator` falso que registra las llamadas, si `signer_not_after < signer_reported_time` no hay una segunda llamada con `allow_fetching=True`.
- [ ] **Step 2:** `venv/Scripts/python.exe -m pytest firma_electronica/test/test_sign_validator.py modules/validadores/saber_pro/tests/test_firma.py -v`. Expected: FAIL (no existe `validate_bytes` ni `firma`).
- [ ] **Step 3: Implementar.**
  - `sign_validator.py`:
    - `validate` lee el archivo y delega en `validate_bytes`;
    - las claves nuevas salen de `status.signing_cert.subject.native` (`organization_name`, `serial_number`), de la validez del certificado, de `status.signer_reported_dt`, de `status.revoked`, de `status.trust_problem_indic` y de `status.coverage == SignatureCoverageLevel.ENTIRE_FILE`;
    - `modified = not (status.intact and status.valid)`;
    - se silencia el registro de pyHanko con `logging.getLogger("pyhanko").setLevel(logging.CRITICAL)` dentro de la llamada.
  - `firma.py`:
    - `verificar` construye `SignatureValidator(trusted_cert_paths=<.crt de certificados/>)`;
    - si `signed` es falso, revisa los bytes con `re.search(rb"/(?:Type|FT)\s*/Sig\b", contenido)` y devuelve `"no_verificable"` si hay restos, `"ausente"` si no;
    - si pyHanko lanza al leer, también `"no_verificable"` cuando hay restos;
    - con firma, consulta la revocación (segunda llamada con `allow_fetching=True`) solo si `consultar_revocacion` y el certificado no estaba vencido al firmar.
- [ ] **Step 4: Certificados.** **Preguntar a Héctor** antes de descargar, indicando nombre, origen y tamaño. Con su aprobación:
  - se descargan de la página oficial de Camerfirma Colombia (`pkicol.camerfirmacolombia.co`);
  - se guardan como `.crt`;
  - en el README quedan la URL, el emisor, la vigencia y la huella SHA-256 (`openssl x509 -fingerprint -sha256`).
  
  Sin aprobación, se escribe el README explicando que faltan: `verificar` funciona sin raíces y el certificado sale `"no_confiable"`.
- [ ] **Step 5:** Repetir el comando del Step 2. Expected: PASS. También `git check-ignore modules/validadores/saber_pro/certificados/x.crt` no debe imprimir nada.
- [ ] **Step 6: Commit** — "Tarea 08e: firma del ICFES (verificador ampliado de firma_electronica)".

### Task 4: Reglas de Saber Pro

**Files:**
- Create: `modules/validadores/saber_pro/reglas.py`
- Test: `modules/validadores/saber_pro/tests/test_reglas.py`

**Interfaces:**
- Consumes:
  - `ExtraccionSaberPro` y `CAMPOS` (Task 2);
  - `EstadoFirma` (Task 3);
  - `evaluacion` (Task 1).
- Produces:
  - `VERSION = "saber_pro@1.0.0"`;
  - `PUNTAJE_MINIMO = 100`;
  - `evaluar(extraccion: ExtraccionSaberPro, firma: EstadoFirma, *, ahora: datetime, puntaje_minimo: int = PUNTAJE_MINIMO) -> list[dict]`, con las 5 reglas en este orden: `saber_pro_report`, `required_fields_present`, `global_score_minimum`, `icfes_signature_intact` y `icfes_certificate_valid`. Las 4 primeras con `mandatory: true` y la última con `false`.

Mensajes fijos (los que ve el estudiante):
- `global_score_minimum`:
  - cumple: `"Tu reporte Saber Pro cumple con el puntaje mínimo requerido (puntaje global: {p}; mínimo: {m})."`;
  - no cumple: `"Tu puntaje global ({p}) es menor a {m}. Si vuelves a presentar el examen, sube el nuevo reporte."`.
- `saber_pro_report`, no cumple: `"El archivo no es un reporte de resultados Saber Pro. Sube el PDF descargado de icfes.gov.co."`.
- `icfes_signature_intact`:
  - no cumple por un PDF modificado: `"El reporte fue modificado después de que el ICFES lo firmó. Sube el PDF original descargado de icfes.gov.co."`;
  - no cumple por otro firmante: `"El reporte no está firmado por el ICFES (firmante: {firmante})."`;
  - no verificable: `"La firma del ICFES no se puede verificar: el archivo fue guardado de nuevo después de descargarlo."`;
  - ausente: `"El PDF no tiene la firma digital del ICFES."`.
- `icfes_certificate_valid`, vencido: `"El certificado con el que firmó el ICFES estaba vencido al firmar (venció el {dd/mm/aaaa})."`.
- Los demás los redacta quien implementa, con la evidencia del caso.

- [ ] **Step 1: Write the failing tests** (todo en memoria, armando `ExtraccionSaberPro` y `EstadoFirma` a mano):
  - `test_reporte_valido_todo_cumple`: las 4 obligatorias dan `cumple`.
  - `test_puntaje_99_100_300`: 99 da `no_cumple` con el mensaje fijo; 100 y 300 dan `cumple`.
  - `test_minimo_configurable`: `puntaje_minimo=150` con 149 da `no_cumple`.
  - `test_puntaje_ausente_no_evaluable`: `low_confidence`.
  - `test_campo_obligatorio_ausente`: `required_fields_present` da `no_evaluable` / `low_confidence`, y el mensaje nombra el campo.
  - `test_no_es_reporte`: `es_reporte False` da `saber_pro_report` `no_cumple`, y las otras 4 `no_evaluable` / `missing_dependency`.
  - `test_ilegible`: `es_reporte None` da `saber_pro_report` `no_evaluable` / `low_confidence`, y las otras 4 `missing_dependency`.
  - `test_firma`:
    - `presente` + `intacta` + ICFES da `cumple`;
    - `intacta False` da `no_cumple` (mensaje de PDF modificado);
    - `firmante_es_icfes False` da `no_cumple`;
    - `no_verificable` y `ausente` dan `no_evaluable` / `low_confidence` con sus mensajes fijos.
  - `test_certificado`:
    - `valido` da `cumple`;
    - `vencido` da `no_cumple` (mensaje con la fecha);
    - `revocado` o `no_confiable` dan `no_cumple`;
    - `sin_respuesta` da `no_evaluable` / `source_unavailable`;
    - `desconocido` da `no_evaluable` / `low_confidence`;
    - sin firma presente da `no_evaluable` / `missing_dependency`;
    - siempre con `mandatory False`.
  - `test_reglas_cumplen_el_contrato`: cada `RuleEvaluation` de los casos anteriores es válido contra `contratos/esquemas/rule-evaluation.schema.json`.
- [ ] **Step 2:** `venv/Scripts/python.exe -m pytest modules/validadores/saber_pro/tests/test_reglas.py -v`. Expected: FAIL (`ModuleNotFoundError`).
- [ ] **Step 3:** Implementar `reglas.py` según la tabla de la sección 7 del spec y los mensajes fijos.
- [ ] **Step 4:** Repetir el comando. Expected: PASS.
- [ ] **Step 5: Commit** — "Tarea 08e: reglas de Saber Pro".

### Task 5: `validar_saber_pro` de punta a punta, y documentación

**Files:**
- Modify: `modules/validadores/saber_pro/__init__.py`
- Create: `modules/validadores/README.md`: qué hace cada archivo, cómo instalar (`pip install -r modules/requirements-dev.txt`), cómo correr las pruebas, dónde poner las muestras locales y qué falta (el registro de la Tarea 07, entre otros)
- Test: `modules/validadores/saber_pro/tests/test_validar.py`

**Interfaces:**
- Consumes: `extraer` (Task 2), `verificar` (Task 3), `evaluar`, `VERSION` (Task 4) y `armar_resultado`, `ahora_bogota` (Task 1).
- Produces: `validar_saber_pro(contenido: bytes, *, id_student: str, document_version: int, ahora: datetime | None = None, verificar_firma: Callable[[bytes], EstadoFirma] = verificar) -> dict`.

- [ ] **Step 1: Write the failing tests.**
  - `test_reportes_reales_quedan_por_revisar` (con `esperados`). Por cada `"reporte"`:
    - `document_classification == "to_check"` y `required_action == "wait_for_review"`;
    - las reglas `saber_pro_report`, `required_fields_present` y `global_score_minimum` dan `cumple`, e `icfes_signature_intact` da `no_evaluable` con el mensaje de "guardado de nuevo";
    - `extracted_data` coincide con `esperados`;
    - pasa `validar_esquema`.
  - `test_archivo_vacio_da_por_revisar`: el `"corrupto"` real (y también `b""` en memoria) da `to_check` sin excepción, `errors` contiene `"vacío o dañado"`, y pasa `validar_esquema`.
  - `test_firma_inyectada_valida_da_valid`: los bytes de un reporte real con `verificar_firma=lambda _: EstadoFirma("presente", True, "ICFES", True, "vencido", <fecha>, None)` dan `valid`, `required_action "none"` e `icfes_certificate_valid` `no_cumple` (informativa). Usa el PDF real y se salta si falta.
  - `test_firma_modificada_da_invalid`: lo mismo con `intacta False` da `invalid`, `upload_new_version` y `resubmission_reason ==` el mensaje de PDF modificado.
  - `test_id_y_version_viajan`: `id_student`, `document_version`, `type_document == "saber_pro"` y `validation_version == "saber_pro@1.0.0"`.
- [ ] **Step 2:** `venv/Scripts/python.exe -m pytest modules/validadores/saber_pro/tests/test_validar.py -v`. Expected: FAIL (`ImportError: validar_saber_pro`).
- [ ] **Step 3:** Implementar `validar_saber_pro` según el flujo de la sección 5 del spec; `errores` sale de `extraccion.errores`.
- [ ] **Step 4:** Toda la suite: `venv/Scripts/python.exe -m pytest -v`. Expected: PASS, con las pruebas de muestras corriendo (no saltadas) en el PC de Héctor.
- [ ] **Step 5: Commit** — "Tarea 08e: validar_saber_pro y documentación".
