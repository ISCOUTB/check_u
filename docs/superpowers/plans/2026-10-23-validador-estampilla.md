# Validador de Estampilla Pro-Cultura — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir `validar_estampilla`, que recibe el certificado de pago de la Estampilla Pro-Cultura (PDF) y devuelve un `DocumentValidationResult`. Lo confirma en la Gobernación de Bolívar con el adaptador de la Tarea 22 y coteja el PDF con el registro oficial.

**Architecture:** Hay tres piezas en `modules/validadores/estampilla/`:
- `extraccion.py` lee el PDF con PyMuPDF y extrae los datos, sin juzgar.
- `reglas.py` evalúa 5 reglas obligatorias y traduce lo que devuelve el adaptador al contrato.
- `__init__.py` llama a la consulta (inyectable) y arma el resultado con `armar_resultado`.

`__main__.py` es la consola: solo consulta a la Gobernación con `--consultar`. `modules/estampilla_pro/` (Tarea 22) se usa tal cual.

**Tech Stack:** Python 3.11 (el `venv` de la raíz), PyMuPDF, pytest con `--import-mode=importlib` (`pytest.ini` en la raíz) y jsonschema (con la fixture `validar_esquema` de `modules/validadores/conftest.py`).

**Spec:** `docs/superpowers/specs/2026-10-23-validador-estampilla-design.md`

## Global Constraints

- Comandos desde la raíz del repositorio. Pruebas: `venv/Scripts/python.exe -m pytest <ruta>`. Las de `main` pasan hoy: 229.
- Sin dependencias nuevas. No se tocan `modules/estampilla_pro/`, `webapp/`, `firma_electronica/` ni `frontend/`.
- **Datos reales:** nunca en el repositorio. El comprobante real, la respuesta oficial guardada y sus variantes viven solo en `C:\Users\hectr\OneDrive\Documentos\UTB\checku_datos_locales\estampilla_pro_cultura\`. Las pruebas del repo usan datos inventados.
- **Revisión del diff antes de cada commit:** buscar el nombre, la cédula y los números del comprobante real. Están en el PDF de esa carpeta: no los copies a ningún archivo del repo, ni siquiera a este plan.
- **Sin internet:** las pruebas nunca lo usan. La consulta se inyecta, y el adaptador se prueba con un cliente falso.
- `TYPE_DOCUMENT = "estampilla_pro_cultura"`. `VERSION = "estampilla_pro_cultura@1.0.0"`.
- Claves de `extracted_data`, en este orden: `receipt_number`, `identification_number`, `full_name`, `payment_date` (`AAAA-MM-DD`) y `pro_cultura_amount` (pesos enteros). Cada una es `{"value", "confidence"}`, con confianza 1.0, o nula cuando no se encuentra.
- Reglas, en este orden y todas con `mandatory=True`: `payment_certificate_document`, `required_fields_present`, `pro_cultura_paid`, `official_record` y `official_record_matches`.
- Motivos de no evaluable: solo los del contrato (`low_confidence`, `source_unavailable`, `source_pending` y `missing_dependency`).
- Los mensajes al estudiante son los de la sección 7 del spec, copiados al pie de la letra.
- Cada commit termina con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Valor con decimales** ("$ 70.036,00"): da 70036, no 7003600. Lo prueba la Task 1, `test_valor_con_decimales`.
2. **Nombre oficial sin asteriscos** (como el de las pruebas de la Tarea 22, "ESTUDIANTE ANONIMO PRUEBA") o con máscara ("ESA****ANO****PRU****"): los dos coinciden con el mismo nombre del PDF. Lo prueba la Task 2, `test_cotejo_nombre_con_y_sin_mascara`.
3. **Tildes de un lado y no del otro:** el PDF dice "NUÑEZ" y la Gobernación "NUN****". Coinciden. Lo prueba la Task 2, `test_cotejo_sin_tildes`.
4. **Documento oficial sin dígitos visibles** ("**********"): no se da por coincidente, es "documento" sin cotejar. Lo prueba la Task 2, `test_cotejo_documento_sin_digitos_visibles`.
5. **La línea del contribuyente termina en su salto de línea:** el nombre no se come "Fecha de Pago". Lo prueba la Task 1, `test_nombre_termina_en_su_linea`.

---

### Task 1: Extracción

**Files:**
- Create: `modules/validadores/estampilla/__init__.py`. Por ahora solo el docstring del paquete; la Task 3 lo completa.
- Create: `modules/validadores/estampilla/extraccion.py`
- Create: `modules/validadores/estampilla/tests/conftest.py`
- Test: `modules/validadores/estampilla/tests/test_extraccion.py`

**Interfaces:**
- Produces:
  - `CAMPOS: tuple[str, ...]`, con las 5 claves de las Global Constraints.
  - Los mensajes `DANADO = "El archivo está vacío o dañado."`, `SIN_TEXTO = "El PDF no tiene texto."` y `PROTEGIDO = "El PDF está protegido con contraseña."`
  - `@dataclass(frozen=True) class ExtraccionEstampilla`, con estos campos:
    - `tiene_texto: bool`
    - `es_certificado: bool | None`: `None` si no hay texto suficiente.
    - `fila_pro_cultura: bool`
    - `estado_pro_cultura: str | None`: en mayúsculas y sin tildes, por ejemplo `"PAGADO"`.
    - `datos: dict[str, dict]`
    - `errores: list[str]`
  - `extraer_de_texto(texto: str) -> ExtraccionEstampilla`
  - `extraer(contenido: bytes) -> ExtraccionEstampilla`: nunca lanza.
- Fixtures de `tests/conftest.py`:
  - `texto_certificado() -> str`: el certificado inventado de abajo.
  - `crear_pdf() -> Callable[[str], bytes]`: escribe cada línea del texto a 14 puntos de la anterior, con `insert_text`. Acepta `comprimido=False`, que pasa `deflate` a `tobytes`.

El certificado inventado tiene una línea por renglón; ninguno de sus datos es real:

```
DEPARTAMENTO DE BOLÍVAR
SECRETARÍA DE HACIENDA
CERTIFICADO DE PAGO
FECHA DE EXPEDICIÓN: 2026-01-15 10:20:30
Recibo Oficial: 000000000001
Contribuyente: 1000000001 - ANA MARIA PRUEBA NUÑEZ
Fecha de Pago: 15 Ene 2026
Entidad Recaudadora: 77 - Pse Gou
Renta: 165 - Estampilla Departamental
Valor Base de Liquidacion: $ 0
Renta Conceptos Liquidados Valor Pagado Estado
165 - Expedición Títulos Estampilla Pro-Cultura $ 70.036 Pagado
165 - Expedición Títulos Estampilla Prodesarrollo (Liquidacion $ 21.000 Pagado
Total $ 91.036 Pagado
FIN DEL CERTIFICADO
```

- [ ] **Step 1: Write the failing tests** in `test_extraccion.py`. `valores(e)` es `{c: d["value"] for c, d in e.datos.items()}`; los reemplazos se hacen sobre `texto_certificado`.
  - `test_certificado_inventado`:
    - `valores(...) == {"receipt_number": "000000000001", "identification_number": "1000000001", "full_name": "ANA MARIA PRUEBA NUÑEZ", "payment_date": "2026-01-15", "pro_cultura_amount": 70036}`;
    - todas las confianzas son 1.0;
    - `es_certificado is True`, `fila_pro_cultura is True` y `estado_pro_cultura == "PAGADO"`.
  - `test_meses`, parametrizada con "15 Ene 2026" y "15 Jan 2026" (2026-01-15), "3 Abr 2026" y "3 Apr 2026" (2026-04-03), "30 Ago 2026" y "30 Aug 2026" (2026-08-30), "1 Dic 2026" y "1 Dec 2026" (2026-12-01), "1 Set 2026" (2026-09-01) y "2026-06-30" (2026-06-30). Además, "15 Xyz 2026" y "31 Feb 2026" dan `None`.
  - `test_valor_con_punto_de_miles`: "$ 1.070.036" da 1070036, "$ 70,036" da 70036 y "$ 0" da 0.
  - `test_valor_con_decimales`: "$ 70.036,00" y "$ 70,036.00" dan 70036.
  - `test_fila_pendiente`: con "Pagado" cambiado por "Pendiente" solo en la fila Pro-Cultura, `estado_pro_cultura == "PENDIENTE"`.
  - `test_sin_fila_pro_cultura`: sin la fila Pro-Cultura, `fila_pro_cultura is False`, `pro_cultura_amount` es `None` y el valor de la Prodesarrollo no se toma.
  - `test_nombre_con_particulas`: "MARÍA DEL PILAR DE LA HOZ PRUEBA" se extrae completo.
  - `test_lo_que_no_parece_un_nombre`: "EMPRESA 123 S.A.S" y "ANA" dan `full_name` nulo.
  - `test_nombre_termina_en_su_linea`: con el texto `"Contribuyente: 1000000001 - ANA PRUEBA\nFecha de Pago: 15 Ene 2026"`, el nombre es "ANA PRUEBA".
  - `test_otro_documento`: un texto de 40 caracteres o más sin "CERTIFICADO DE PAGO" da `es_certificado is False`. Uno de menos de 40 da `None`.
  - `test_pdf_en_memoria`: `extraer(crear_pdf(texto_certificado))` da los mismos valores que `test_certificado_inventado`.
  - `test_lee_en_orden_visual`: un PDF donde la línea del contribuyente se escribe de última, pero a la altura que le toca, da los mismos valores.
  - `test_no_es_pdf_es_danado`: un HTML con el texto del certificado da `errores == [DANADO]`.
  - `test_truncado_sin_texto_es_danado`: un PDF comprimido cortado 30 bytes después del primer `b"stream"` da `errores == [DANADO]`.
  - `test_con_contrasena`: un PDF guardado con `user_pw` da `errores == [PROTEGIDO]`.
  - `test_vacio_y_basura`, parametrizada con `b""` y `b"basura"`: `errores == [DANADO]` y `es_certificado is None`.
  - `test_pdf_sano_sin_texto`: un PDF de una página vacía da `errores == [SIN_TEXTO]`.

- [ ] **Step 2: Run them to verify they fail**

Run: `venv/Scripts/python.exe -m pytest modules/validadores/estampilla/tests/test_extraccion.py -q`
Expected: FAIL. Todas fallan con `ModuleNotFoundError` o `ImportError` de `extraccion`.

- [ ] **Step 3: Implement `extraccion.py`**

Sigue el mismo patrón que la 08c (rama `tarea_08c_paz_y_salvo`, `modules/validadores/paz_y_salvo/extraccion.py`):
- `_normalizar` pasa el texto a mayúsculas y le quita las tildes carácter por carácter, de modo que las posiciones coinciden con el original.
- El nombre son de 2 a 6 palabras propias que solo tienen letras (se admiten guion y apóstrofo). Las partículas `{"DE", "DEL", "LA", "LAS", "LOS", "Y"}` no cuentan.
- `extraer`:
  - si no es PDF (`is_pdf` falso), devuelve `DANADO`;
  - si necesita contraseña (`needs_pass`), `PROTEGIDO`;
  - lee el texto con `get_text(sort=True)`;
  - si el PDF quedó reparado (`is_repaired`) y sin texto, devuelve `DANADO`;
  - cualquier excepción de PyMuPDF también da `DANADO`.

Expresiones, sobre el texto normalizado:

| Qué | Expresión o regla |
|---|---|
| Certificado | `CERTIFICADO DE PAGO`, `BOLIVAR` y `HACIENDA` aparecen en el texto. Si no, `False` con 40 caracteres o más y `None` con menos. |
| Recibo | `\bRECIBO\s+OFICIAL\s*:\s*(\d{6,20})\b` |
| Contribuyente | `\bCONTRIBUYENTE\s*:\s*(\d{5,15})\s*-\s*([^\n]+)`. El nombre se toma del texto original, en esas mismas posiciones. |
| Fecha | `\bFECHA\s+DE\s+PAGO\s*:\s*(?:(\d{4})-(\d{2})-(\d{2})\|(\d{1,2})\s+([A-Z]{3})[A-Z]*\.?\s+(\d{4}))` |
| Meses | ENE/JAN 1, FEB 2, MAR 3, ABR/APR 4, MAY 5, JUN 6, JUL 7, AGO/AUG 8, SEP/SET 9, OCT 10, NOV 11, DIC/DEC 12. La fecha se valida con `datetime.date`: si no existe, queda `None`. |
| Fila Pro-Cultura | `ESTAMPILLA\s+PRO-?\s*CULTURA\b[^\n$]*\$\s*([\d.,]+)\s+([A-Z]+)` |
| Valor | Si termina en `[.,]\d{2}`, se quita esa parte decimal. Después se dejan solo los dígitos. |

- [ ] **Step 4: Run the tests to verify they pass**

Run: `venv/Scripts/python.exe -m pytest modules/validadores/estampilla/tests/test_extraccion.py -q`
Expected: PASS. Después corre todo `venv/Scripts/python.exe -m pytest -q`: deben pasar las 229 de antes más las nuevas.

- [ ] **Step 5: Commit**

```bash
git add modules/validadores/estampilla/
git commit -m "Tarea 08d: extracción de la Estampilla Pro-Cultura"
```

### Task 2: Reglas, traducción del adaptador y cotejo

**Files:**
- Create: `modules/validadores/estampilla/reglas.py`
- Test: `modules/validadores/estampilla/tests/test_reglas.py`

**Interfaces:**
- Consumes: de la Task 1, `ExtraccionEstampilla` y `CAMPOS`. El `registro` es un `dict` con la forma de lo que devuelve `modules.estampilla_pro.consultar_comprobante`. Las claves que se usan son `estado_consulta`, `pagado`, `etiqueta_exists`, `fecha_pago`, `valor_pro_cultura`, `documento_parcial`, `nombre_anonimizado`, `resultado` y `motivo`. Con `None`, no se consultó.
- Produces:
  - `VERSION = "estampilla_pro_cultura@1.0.0"`
  - `ORDEN: list[str]`, con las 5 reglas.
  - `evaluar(extraccion: ExtraccionEstampilla, registro: dict | None, *, ahora: datetime) -> list[dict]`
  - `accion_por_revisar(reglas: list[dict]) -> str`: devuelve `"wait_for_external_validation"` o `"wait_for_review"`.
  - `cotejar(extraccion: ExtraccionEstampilla, registro: dict) -> list[str]`: las etiquetas de lo que no coincide, en este orden: `"fecha de pago"`, `"valor"`, `"documento"` y `"nombre"`.
  - Constantes con los mensajes de la sección 7 del spec, exactos:
    - `NO_ES_CERTIFICADO`, `SIN_PRO_CULTURA`, `NO_PAGADA`, `VALOR_CERO`;
    - `NO_ENCONTRADO`, `REGISTRO_SIN_PRO_CULTURA`, `REGISTRO_SIN_PAGAR`;
    - `NO_DISPONIBLE`, `NO_CONSULTADO`;
    - `NO_COINCIDE`, con el marcador `{campos}`.

**Mensajes de "cumple" y de "no evaluable"** (el spec no los fija; se fijan aquí):

| Caso | Mensaje |
|---|---|
| `payment_certificate_document` cumple | "El archivo es un certificado de pago de la Gobernación de Bolívar." |
| `required_fields_present` cumple | "El comprobante trae el recibo, el contribuyente, la fecha de pago y el valor de la Estampilla Pro-Cultura." |
| `required_fields_present` no evaluable | "No se encontraron en el comprobante: {lista}." |
| `pro_cultura_paid` cumple | "La Estampilla Pro-Cultura figura pagada en el comprobante." |
| `pro_cultura_paid` sin valor | "No se encontró el valor de la Estampilla Pro-Cultura; un funcionario lo revisará." |
| `official_record` cumple | "El comprobante está en los registros oficiales de la Gobernación de Bolívar, con la Estampilla Pro-Cultura pagada." |
| `official_record` con `low_confidence` | "El número de recibo del comprobante no se pudo consultar; un funcionario lo revisará." |
| `official_record_matches` cumple | "Los datos del comprobante coinciden con los registros oficiales." |
| Documento sin identificar (`missing_dependency`) | "No se evalúa porque el archivo no se pudo identificar como un certificado de pago." |
| Sin recibo (`missing_dependency`) | "No se consulta porque no se encontró el número de recibo." |
| Cotejo sin registro confirmado (`missing_dependency`) | "No se coteja porque el comprobante no se confirmó en los registros oficiales." |

Las etiquetas de `{lista}` son: "número de recibo", "documento del contribuyente", "nombre del contribuyente", "fecha de pago" y "valor de la Estampilla Pro-Cultura".

- [ ] **Step 1: Write the failing tests** in `test_reglas.py`. Hay tres ayudantes:
  - `extraccion(**cambios)` arma una `ExtraccionEstampilla` completa con los datos del certificado inventado de la Task 1.
  - `registro(**cambios)` arma lo que devuelve el adaptador para el comprobante inventado, encontrado y pagado:
    - `estado_consulta="encontrado"`, `pagado=True`, `etiqueta_exists=True`, `resultado="cumple"`, `motivo=None`;
    - `fecha_pago="2026-01-15"`, `valor_pro_cultura=70036`;
    - `documento_parcial="100******"`, `nombre_anonimizado="ANA****MAR****PRU****NUÑ****"`.
  - `por_regla(reglas)` es un `dict` por nombre de regla.

  Las pruebas:
  - `test_version_y_orden`: `VERSION` y `ORDEN` exactos; las 5 reglas son obligatorias.
  - `test_todo_cumple`: las 5 dan `cumple`.
  - `test_no_es_certificado`: con `es_certificado=False`, la primera da `no_cumple` con `NO_ES_CERTIFICADO` y las otras 4 dan `missing_dependency`. Con `None` (sin texto), la primera da `no_evaluable`/`low_confidence` y las demás `missing_dependency`.
  - `test_falta_un_dato`: parametrizada por cada clave de `CAMPOS`. `required_fields_present` da `no_evaluable`/`low_confidence`, y el mensaje nombra la etiqueta de esa clave.
  - `test_pro_cultura_paid`, parametrizada:
    - sin fila: `no_cumple` con `SIN_PRO_CULTURA`;
    - "PENDIENTE": `no_cumple` con `NO_PAGADA`;
    - valor 0: `no_cumple` con `VALOR_CERO`;
    - valor `None` con estado "PAGADO": `no_evaluable`/`low_confidence`.
  - `test_official_record`, parametrizada sobre las filas de la tabla de la sección 8 del spec:
    - `cumple`;
    - `no_encontrado` con `no_cumple`: `NO_ENCONTRADO`;
    - `etiqueta_exists=False`: `REGISTRO_SIN_PRO_CULTURA`;
    - `pagado=False`: `REGISTRO_SIN_PAGAR`;
    - `source_unavailable` e `incomplete_data`: `no_evaluable`/`source_unavailable` con `NO_DISPONIBLE`;
    - `invalid_input`: `no_evaluable`/`low_confidence`;
    - `registro=None`: `no_evaluable`/`source_pending` con `NO_CONSULTADO`.
  - `test_sin_recibo_no_se_consulta`: con `receipt_number` nulo, `official_record` da `missing_dependency` aunque haya registro.
  - `test_cotejo_detecta_cada_campo`, parametrizada:
    - `fecha_pago="2026-01-16"` da `["fecha de pago"]`;
    - `valor_pro_cultura=70000` da `["valor"]`;
    - `documento_parcial="200******"` da `["documento"]`;
    - `nombre_anonimizado="LUI****PRU****"` da `["nombre"]`.

    En los cuatro casos, `official_record_matches` da `no_evaluable`/`low_confidence` con `NO_COINCIDE.format(campos=...)`.
  - `test_cotejo_con_datos_faltantes`: `fecha_pago=None` y `valor_pro_cultura=None` dan `["fecha de pago", "valor"]`.
  - `test_cotejo_nombre_con_y_sin_mascara`: "ANA****MAR****PRU****NUÑ****" y "ANA MARIA PRUEBA NUÑEZ" coinciden; "ANA****PRU****" no.
  - `test_cotejo_sin_tildes`: "ANA****MAR****PRU****NUN****" coincide con "ANA MARIA PRUEBA NUÑEZ".
  - `test_cotejo_documento_sin_digitos_visibles`: "**********" y `None` dan `["documento"]`.
  - `test_cotejo_solo_si_el_registro_cumple`: con `official_record` en `no_cumple` o `no_evaluable`, `official_record_matches` da `missing_dependency`.
  - `test_accion_por_revisar`:
    - con el registro sin consultar o caído: `"wait_for_external_validation"`;
    - si además falta un dato del PDF: `"wait_for_review"`;
    - sin texto: `"wait_for_review"`.
  - `test_varias_fallas_a_la_vez`: "PENDIENTE" en el PDF más `no_encontrado` en la Gobernación. Con `armar_resultado`, da `invalid`, y el motivo es el de `pro_cultura_paid` (`NO_PAGADA`).
  - `test_reglas_cumplen_el_contrato(validar_esquema)`: cada evaluación de 4 casos variados se valida con `"rule-evaluation"`.

- [ ] **Step 2: Run them to verify they fail**

Run: `venv/Scripts/python.exe -m pytest modules/validadores/estampilla/tests/test_reglas.py -q`
Expected: FAIL con `ImportError` de `reglas`.

- [ ] **Step 3: Implement `reglas.py`**

Usa `evaluacion` de `..resultado`, con `mandatory=True`.

`pro_cultura_paid` revisa en este orden: que exista la fila, que diga `"PAGADO"`, que haya valor y que el valor sea mayor que 0.

`official_record`:
- Primero, si falta el recibo: `missing_dependency`.
- Si el `registro` es `None`: `source_pending`.
- Con `resultado == "no_cumple"`, se elige el mensaje en este orden:
  1. `estado_consulta == "no_encontrado"`;
  2. `etiqueta_exists is False`;
  3. `pagado is False`;
  4. si ninguna aplica, `NO_ENCONTRADO`.
- Con un `resultado` desconocido, falla cerrado: `source_unavailable`.

`cotejar`:
- **Documento:** los dígitos visibles son `re.match(r"\d*", documento_parcial or "")`. Si no hay ninguno, no coincide. Si los hay, el documento del PDF tiene que empezar con ellos.
- **Nombre:** se toma, de cada palabra oficial, lo que va antes del primer `*`, sin tildes y en mayúsculas. Coincide si el nombre del PDF tiene el mismo número de palabras y cada una empieza con su prefijo. Un prefijo vacío no coincide.

`accion_por_revisar`: se toman los motivos de las obligatorias `no_evaluable`, sin contar `missing_dependency`. Si quedan motivos y todos son `source_unavailable` o `source_pending`, devuelve `wait_for_external_validation`. Si no, `wait_for_review`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `venv/Scripts/python.exe -m pytest modules/validadores/estampilla/tests -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add modules/validadores/estampilla/
git commit -m "Tarea 08d: reglas, consulta a la Gobernación y cotejo"
```

### Task 3: validar_estampilla, consola, integración con la Tarea 22 y README

**Files:**
- Modify: `modules/validadores/estampilla/__init__.py`
- Create: `modules/validadores/estampilla/__main__.py`
- Modify: `modules/validadores/README.md`. Agrega una sección "Estampilla Pro-Cultura (Tarea 08d)", con el mismo formato que las otras: qué hace, que la consola solo consulta con `--consultar`, el comando y el enlace al spec.
- Test: `tests/test_validar.py`, `tests/test_integracion_tarea22.py` y `tests/test_comando.py`, todos en `modules/validadores/estampilla/`.

**Interfaces:**
- Consumes: `extraer` (Task 1); `evaluar`, `accion_por_revisar` y `VERSION` (Task 2); `armar_resultado` y `ahora_bogota` de `..resultado`; `ejecutar` y `preparar_salida` de `..consola`; `consultar_comprobante` de `modules.estampilla_pro`.
- Produces:
  - `TIPO_DOCUMENTO = "estampilla_pro_cultura"`
  - `consultar_gobernacion(numero: str, document_version: int) -> dict`, que llama a `consultar_comprobante(numero, None, document_version=document_version)`.
  - `validar_estampilla(contenido: bytes, *, id_student: str, document_version: int, ahora: datetime | None = None, consultar_registro: Callable[[str, int], dict] | None = consultar_gobernacion) -> dict`:
    - `id_student` en blanco o con espacios a los lados, o `document_version < 1`, da `ValueError`, como en la 08c;
    - solo consulta si `es_certificado` es verdadero y hay recibo;
    - le pasa a `armar_resultado` `accion_por_revisar=accion_por_revisar(reglas)`.
  - `__main__.main(argv: list[str] | None = None) -> int`. Usa `consultar_gobernacion` si `"--consultar"` está en `argv`; si no, `None`. Le quita esa opción a `argv` antes de llamar a `ejecutar` con `(".pdf",)`.

- [ ] **Step 1: Write the failing tests**
  - `test_validar.py`, con PDF creados con `crear_pdf` y una consulta falsa que devuelve el `registro()` de la Task 2:
    - `test_valido`: `valid` y `required_action == "none"`, con el esquema.
    - `test_no_consultado_espera_validacion_externa`: con `consultar_registro=None` da `to_check` y `wait_for_external_validation`.
    - `test_no_encontrado_no_valido`: `invalid`, `upload_new_version` y `resubmission_reason == NO_ENCONTRADO`.
    - `test_no_coincide_por_revisar`: con otra fecha en el registro, `to_check` y `wait_for_review`.
    - `test_danado_por_revisar`, parametrizada con `b""` y `b"basura"`: `to_check`, `wait_for_review` y un error "vacío o dañado". La consulta no se llama: la falsa lanza `AssertionError`.
    - `test_tipo_version_y_entradas_invalidas`: `type_document` y `validation_version`, y `ValueError` con `("", 1)`, `(" T1", 1)` y `("T1", 0)`.
  - `test_integracion_tarea22.py`, con el adaptador real y un cliente falso, sin internet:
    - importa `HTML_PAGADO_VALIDO`, `HTML_SOLO_PRODESARROLLO` y `HTML_NO_PAGADO` de `modules.estampilla_pro.tests.conftest`;
    - `consultar_registro = lambda numero, version: consultar_comprobante(numero, None, cliente=ClienteFalso(html))`, donde `ClienteFalso.consultar(numero, **_)` devuelve `{"success": True, "message": "success", "html": html}`;
    - el PDF inventado lleva "Contribuyente: 1000000001 - ESTUDIANTE ANONIMO PRUEBA", "Fecha de Pago: 13 Oct 2026" y "$ 70.036", porque así coincide con esos HTML.
    - Resultados esperados:
      - pagado: `valid`;
      - solo Prodesarrollo: `invalid` con `REGISTRO_SIN_PRO_CULTURA`;
      - no pagado: `invalid` con `REGISTRO_SIN_PAGAR`;
      - un cliente que devuelve `{"success": False, "message": "No se encontraron liquidaciones", "type": "error"}`: `invalid` con `NO_ENCONTRADO`.
  - `test_comando.py`, con `from modules.validadores.estampilla import __main__ as comando`:
    - sin argumentos, muestra el uso y devuelve 1;
    - un PDF da un resumen con la clasificación;
    - `--json` imprime el resultado del contrato;
    - sin `--consultar`, una `consultar_gobernacion` reemplazada con `monkeypatch.setattr(comando, ...)` que lanza no se llama;
    - con `--consultar`, sí se llama una vez.

- [ ] **Step 2: Run them to verify they fail**

Run: `venv/Scripts/python.exe -m pytest modules/validadores/estampilla/tests -q`
Expected: FAIL en las tres pruebas nuevas, con `ImportError` de `validar_estampilla` y de `__main__`.

- [ ] **Step 3: Implement** `__init__.py` y `__main__.py` con las firmas de arriba, y escribe la sección del README. El docstring de `__main__` es el texto de uso: dice que sin `--consultar` no se envía el número de recibo a ningún servicio externo.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `venv/Scripts/python.exe -m pytest -q`
Expected: todo pasa, las 229 de antes más las de la 08d, sin advertencias nuevas.

- [ ] **Step 5: Commit**

Antes, revisa el diff en busca de datos reales (ver Global Constraints).

```bash
git add modules/validadores/estampilla/ modules/validadores/README.md
git commit -m "Tarea 08d: validar_estampilla, consola e integración con la Tarea 22"
```

### Task 4: Prueba local con el comprobante real (no se sube nada)

**Files** (todos fuera del repo, en `C:\Users\hectr\OneDrive\Documentos\UTB\checku_datos_locales\estampilla_pro_cultura\`):
- Create: `generar_variantes.py`. Se adapta del de `..\paz_y_salvo\`.
- Create: `probar_variantes.py`
- Create: `LEEME.txt`
- Usa: `real\estampilla_real.pdf` y `respuesta_<recibo>.json`, la respuesta oficial guardada.

**Interfaces:**
- Consumes: `validar_estampilla` (Task 3).
- `probar_variantes.py` usa una consulta simulada: devuelve `consultar_comprobante` sobre el JSON guardado (con un cliente falso) para el recibo real, y "no encontrado" para cualquier otro. **No hace ninguna consulta nueva a la Gobernación.**

- [ ] **Step 1: Generate the variants** con `python -I generar_variantes.py real\estampilla_real.pdf variantes`:
  - las dañadas de la 08c: vacío, truncados, bytes al azar, encabezado o xref rotos, sin `%%EOF`, PNG, HTML o DOCX renombrados, basura al final, dos PDF pegados, escaneado, con contraseña;
  - las parecidas:
    - sin fila Pro-Cultura, "Pendiente" y $0;
    - otro nombre, otra fecha, otro valor y otro documento, que deben quedar por revisar por el cotejo;
    - otro número de recibo, que debe dar no válido por "no encontrado";
    - otro documento (constancia).

- [ ] **Step 2: Run them**

Run: `python -I probar_variantes.py <raíz del repo> real variantes`
Expected:
- 0 excepciones y 0 fuera del contrato;
- el real da `valid`;
- cada variante parecida da la clasificación y el motivo de arriba;
- las dañadas dan `to_check` con su error.

Si una variante sale distinta, se diagnostica: es un defecto del código o del generador. El hallazgo va al ledger.

- [ ] **Step 3: Record the result.** Agrega la tabla de resultados al ledger; no se hace commit en el repo. Confirma con `git status` que no quedó ningún archivo real dentro del repo.
