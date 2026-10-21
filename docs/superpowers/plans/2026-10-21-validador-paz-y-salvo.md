# Validador de Paz y Salvo: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `validar_paz_y_salvo` devuelve un `DocumentValidationResult`, con la firma de la Biblioteca verificada por integridad y nombre del firmante.

**Architecture:** Se reutiliza la estructura de la 08e y la 08a.
- La parte genérica de la firma (sin firma / no verificable / presente) sale de `saber_pro/firma.py` a `validadores/firma_pdf.py`.
- `paz_y_salvo/` tiene la extracción (PyMuPDF), la firma, las 4 reglas y el comando.

**Tech Stack:** Python 3.11 (`venv/`), PyMuPDF, pyHanko (por `firma_electronica`), pytest y jsonschema.

**Spec:** `docs/superpowers/specs/2026-10-21-validador-paz-y-salvo-design.md`

## Global Constraints

- Lo mismo que la 08e y la 08a:
  - `venv/Scripts/python.exe -m pytest`;
  - imports `modules.validadores…`;
  - JSON en inglés y mensajes en español;
  - fechas `-05:00`;
  - `validar_esquema`;
  - sin internet;
  - sin fabricar documentos.
- `VERSION = "paz_y_salvo_bib@1.0.0"`, `TIPO_DOCUMENTO = "paz_y_salvo_bib"`.
- Muestras: `firma_electronica/test/samples/PAZ Y SALVO BIBLIOTECA{, firmado, modificado}.pdf`.
- Las pruebas de Saber Pro y de `firma_electronica/test/test_sign_validator.py` siguen pasando sin cambios en sus aserciones.

## Review Focus

1. **Texto con tildes o mayúsculas distintas** ("CÓDIGO", "código", "Paz Y Salvo"): se reconoce igual (Task 2: `test_mayusculas_y_tildes`).
2. **La frase negada no cuenta como afirmativa:** "no se encuentra paz y salvo" contiene "se encuentra paz y salvo" (Task 2: `test_negacion_no_es_afirmacion`).
3. **Nombre que ocupa dos líneas** en el PDF: se une (Task 2: `test_nombre_en_dos_lineas`).
4. **Firma de otra entidad cuyo nombre contiene "biblioteca"** (por ejemplo, "Biblioteca Municipal"): pasa. Es el riesgo aceptado (decisión 2), y debe quedar escrito en la regla y en el README (Task 3: `test_cualquier_biblioteca_pasa_riesgo_aceptado`).
5. **Varias reglas que no cumplen a la vez:** las dos aparecen, y el motivo es el de la primera obligatoria (Task 4: `test_varias_fallas_a_la_vez`).

---

### Task 1: Firma compartida y nombre común del firmante

**Files:**
- Modify: `firma_electronica/infra/sign_validator.py`: clave `signer_common_name` (en el caso sin firma, `None`)
- Modify: `firma_electronica/test/test_sign_validator.py`: el firmado da `signer_common_name == "Biblioteca"`
- Create: `modules/validadores/firma_pdf.py`
- Modify: `modules/validadores/saber_pro/firma.py` para usar `firma_pdf`
- Test: `modules/validadores/tests/test_firma_pdf.py`

**Interfaces:**
- Produces:
  - `RESTOS_DE_FIRMA` (la regex de saber_pro);
  - `@dataclass(frozen=True) class LecturaFirma`, con `presencia: Literal["ausente", "no_verificable", "presente"]`, `resultado: dict | None` y `detalle: str`;
  - `leer_firma(contenido: bytes, validador, *, allow_fetching: bool = False) -> LecturaFirma`: nunca lanza;
  - `esta_intacta(resultado: dict) -> bool` (`signature_valid` y no `modified` y `entire_file`).

- [ ] **Step 1: Write the failing tests** (`test_firma_pdf.py`, con las muestras de `firma_electronica` y `SignatureValidator(trusted_cert_paths=[])`):
  - sin firma da `ausente`;
  - firmado da `presente` y `esta_intacta` True;
  - modificado da `presente` y `esta_intacta` False;
  - `b""` da `ausente`;
  - bytes con `/Type /Sig` pero sin firma legible dan `no_verificable`;
  - y en `test_sign_validator`, `signer_common_name`.
- [ ] **Step 2:** `venv/Scripts/python.exe -m pytest modules/validadores/tests/test_firma_pdf.py firma_electronica/test/test_sign_validator.py -v`. Expected: FAIL.
- [ ] **Step 3:** Implementar. `saber_pro/firma.verificar` usa `leer_firma` y `esta_intacta`.
- [ ] **Step 4:** `venv/Scripts/python.exe -m pytest`. Expected: PASS (las 100 de Saber Pro intactas).
- [ ] **Step 5: Commit** — "Tarea 08c: firma de PDF compartida y nombre común del firmante".

### Task 2: Extracción del Paz y Salvo

**Files:**
- Create: `modules/validadores/paz_y_salvo/__init__.py` (por ahora, solo docstring)
- Create: `modules/validadores/paz_y_salvo/extraccion.py`
- Create: `modules/validadores/paz_y_salvo/tests/conftest.py`: fixtures `sin_firma`, `firmado` y `modificado` (bytes de las muestras)
- Test: `modules/validadores/paz_y_salvo/tests/test_extraccion.py`

**Interfaces:**
- Produces:
  - `CAMPOS = ("full_name", "code_student")`;
  - `@dataclass(frozen=True) class ExtraccionPazYSalvo`, con:
    - `tiene_texto: bool`;
    - `es_paz_y_salvo: bool | None`;
    - `estado: Literal["paz_y_salvo", "no_paz_y_salvo"] | None`;
    - `datos: dict[str, dict]`;
    - `errores: list[str]`;
  - `extraer(contenido: bytes) -> ExtraccionPazYSalvo`;
  - `extraer_de_texto(texto: str) -> ExtraccionPazYSalvo`.
- Reglas de la extracción. El texto se compara en mayúsculas, sin tildes y con los espacios normalizados:
  - `es_paz_y_salvo` es True si contiene "PAZ Y SALVO" y "BIBLIOTECA"; False si tiene 40 caracteres o más sin eso; None sin texto.
  - **Estado:** "NO SE ENCUENTRA PAZ Y SALVO" da `no_paz_y_salvo`, y tiene prioridad; "SE ENCUENTRA PAZ Y SALVO" da `paz_y_salvo`; si no, None.
  - **Nombre:** se toma entre "EL ALUMNO" o "LA ALUMNA" o "EL ESTUDIANTE" o "LA ESTUDIANTE" y "IDENTIFICAD"; necesita al menos 2 palabras con letras. Se devuelve con las mayúsculas y tildes del texto original.
  - **Código:** `CODIGO\s*(?:NO\.?\s*)?(T\d{6,10})`.

- [ ] **Step 1: Write the failing tests:**
  - `test_muestra_sin_firma`: `full_name "ANDRES BELTRAN MENECES"`, `code_student "T000123123"` con 1.0, `estado "paz_y_salvo"` y `es_paz_y_salvo True`.
  - `test_negacion_no_es_afirmacion`: la frase negada da `no_paz_y_salvo`.
  - `test_sin_frase`: sin ninguna frase, `estado None`.
  - `test_mayusculas_y_tildes`: "Código" y "Paz Y Salvo" en otra capitalización dan lo mismo.
  - `test_nombre_en_dos_lineas`: "el alumno ANA MARIA\nPRUEBA NUÑEZ identificado" da "ANA MARIA PRUEBA NUÑEZ".
  - `test_campos_ausentes`: sin código ni nombre, los dos quedan nulos.
  - `test_otro_documento`: 80 caracteres de otro texto dan `es_paz_y_salvo False`.
  - `test_sin_texto_y_danado`: `extraer(b"")` y `extraer(b"basura")` dan `tiene_texto False` y un error "vacío o dañado".
- [ ] **Step 2:** `venv/Scripts/python.exe -m pytest modules/validadores/paz_y_salvo -v`. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Repetir. Expected: PASS.
- [ ] **Step 5: Commit** — "Tarea 08c: extracción del Paz y Salvo".

### Task 3: Firma de la Biblioteca

**Files:**
- Create: `modules/validadores/paz_y_salvo/firma.py`
- Test: `modules/validadores/paz_y_salvo/tests/test_firma.py`

**Interfaces:**
- Consumes: `leer_firma` y `esta_intacta` (Task 1).
- Produces:
  - `@dataclass(frozen=True) class FirmaBiblioteca`, con `presencia`, `intacta: bool | None`, `firmante: str | None` y `firmante_es_biblioteca: bool | None`;
  - `verificar(contenido: bytes, *, validador=None) -> FirmaBiblioteca`: por defecto usa `SignatureValidator(trusted_cert_paths=[])` y no consulta internet;
  - `es_biblioteca(organizacion: str | None, nombre_comun: str | None) -> bool`.

- [ ] **Step 1: Write the failing tests:**
  - las 3 muestras dan ausente / presente e intacta, firmante "Biblioteca" y es de la Biblioteca / presente y no intacta;
  - `es_biblioteca`:
    - `("Biblioteca", None)`, `(None, "UTB - Biblioteca")` y `("BIBLIOTÉCA", None)` dan True;
    - `("ICFES", "ICFES")` y `(None, None)` dan False;
  - `test_cualquier_biblioteca_pasa_riesgo_aceptado`: `("Biblioteca Municipal", None)` da True. Documenta el riesgo de la decisión 2.
- [ ] **Step 2:** Correr. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Correr. Expected: PASS.
- [ ] **Step 5: Commit** — "Tarea 08c: firma de la Biblioteca".

### Task 4: Reglas, `validar_paz_y_salvo`, comando y documentación

**Files:**
- Create: `modules/validadores/paz_y_salvo/reglas.py` y `modules/validadores/paz_y_salvo/__main__.py`
- Modify: `modules/validadores/paz_y_salvo/__init__.py` y `modules/validadores/README.md`
- Test: `modules/validadores/paz_y_salvo/tests/test_reglas.py`, `test_validar.py` y `test_comando.py`

**Interfaces:**
- Produces:
  - `evaluar(extraccion, firma, *, ahora) -> list[dict]`, con las 4 reglas en el orden del spec;
  - `validar_paz_y_salvo(contenido, *, id_student, document_version, ahora=None, verificar_firma=verificar) -> dict`, que valida el id y la versión como las otras.
- Mensajes fijos: los de la sección 6 del spec.

- [ ] **Step 1: Write the failing tests:**
  - `test_reglas.py`, en memoria:
    - cada regla en sus tres resultados;
    - `test_no_es_paz_y_salvo` (las otras 3 quedan `missing_dependency`);
    - `test_varias_fallas_a_la_vez`: la firma no intacta y `no_paz_y_salvo` dan las dos `no_cumple`, y luego con `armar_resultado`, `invalid` con el motivo de la primera obligatoria que falla (`clearance_status`);
    - el contrato `rule-evaluation`.
  - `test_validar.py`:
    - sin firma → `to_check` y `wait_for_review`;
    - firmado → `valid` y `none`;
    - modificado → `invalid` y `upload_new_version`, con el mensaje de modificado;
    - `b""` → `to_check`;
    - `type_document "paz_y_salvo_bib"` y `validation_version`;
    - id y versión inválidos dan `ValueError`;
    - todos con `validar_esquema`.
  - `test_comando.py`: las 5 pruebas del comando de la 08e, con `.pdf`.
- [ ] **Step 2:** `venv/Scripts/python.exe -m pytest modules/validadores/paz_y_salvo -v`. Expected: FAIL.
- [ ] **Step 3:** Implementar. El README agrega la sección de Paz y Salvo con el comando y el riesgo de la decisión 2.
- [ ] **Step 4:** `venv/Scripts/python.exe -W error -m pytest`. Expected: PASS.
- [ ] **Step 5: Commit** — "Tarea 08c: reglas, validar_paz_y_salvo y documentación".
