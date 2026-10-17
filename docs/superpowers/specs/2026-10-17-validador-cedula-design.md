# Validador de cédula (Tarea 08a)

**Fecha:** 17/10/2026 · **Autor:** Héctor Cabarcas · **Issue:** ISCOUTB/check_u#12 · **Rama:** `tarea_08a_cedula` (sale de `tarea_08e_saber_pro`, PR #43, porque reutiliza su estructura)

Contexto: `docs/PROMPT_BASE.md`, `docs/gap_analysis.md`, los contratos de la Tarea 02 y el spec de la 08e (`docs/superpowers/specs/2026-10-17-validador-saber-pro-design.md`), cuya estructura se reutiliza.

## 1. Objetivo y éxito

Un validador que recibe la cédula que sube el estudiante (PDF o imagen) y devuelve un `DocumentValidationResult`. **Adapta el código que ya existe** (`modules/cedula`, `modules/mrz`, `modules/check_id/rui`) a la estructura de `modules/validadores/`, sin reescribir la lectura.

**Criterios de la issue:**
- [ ] Extracción y reglas separadas.
- [ ] Reglas con cumple / no_cumple / no_evaluable.
- [ ] Registro en el `pipeline_registry`: **pendiente de la Tarea 07**, como en la 08e.
- [ ] Pruebas pasan.
- [ ] Resumen de lo verificado frente a lo simulado o pendiente.

Sin frontend.

## 2. Decisiones (Héctor, 17/10/2026)

| # | Tema | Decisión |
|---|---|---|
| 1 | Estructura | La misma de la 08e: `modules/validadores/cedula/` con `extraccion.py`, `reglas.py`, `__init__.py` y `__main__.py`. `resultado.py` y la fixture `validar_esquema` son compartidos. Pruebas con pytest y el esquema del contrato. |
| 2 | Versiones aceptadas | Las 3: **digital** (MRZ con dígitos de control), **amarilla con hologramas** (PDF417, o el texto del frente por OCR si el código no se lee) y **extranjería**. Un código presente pero ilegible, o un MRZ que no cuadra, deja la cédula **por revisar**. Solo es incumplimiento si el archivo no es una cédula. |
| 3 | RUI | Sale de `webapp/` a un adaptador propio, probado con respuestas simuladas. Entra como **regla informativa**: compara el nombre con un umbral del 85 % (configurable); si el RUI no responde, `no_evaluable` / `source_unavailable`. La discrepancia formal (`inconsistent`) es de la Tarea 09. |
| 4 | Calidad de imagen | **Regla informativa**: mide resolución y nitidez, con umbrales provisionales hasta tener más fotos para calibrar. |
| 5 | Confianza | MRZ válido y PDF417 valen 1.0. El OCR guarda el valor con su confianza (0 a 1) y las reglas exigen **0.8**; por debajo, `no_evaluable` / `low_confidence`. Un dato de OCR sin confianza queda nulo. |
| 6 | Datos de prueba | Las 2 muestras de `modules/test_data/` son de muestra, no de una persona real (Héctor, 17/10). Ya están en el repo y sus valores esperados pueden ir en el código de las pruebas. Además se usa un PDF que no es una cédula (el Paz y Salvo de `firma_electronica/test/samples/`). No se fabrican documentos. |
| 7 | Sin frontend | `webapp/` no se toca. |

## 3. Lo que hace hoy el código (17/10/2026)

`leer_cedula(paginas)` (en `modules/cedula/lectura.py`) devuelve:
- `formato`: `digital`, `amarilla_hologramas` o `desconocido`;
- `campos` (`numero_documento`, `nombre_completo`, `fecha_nacimiento`, `sexo`), cada uno con `valor`, `fuente` (`mrz`, `pdf417`, `ocr`, `etiqueta`) y `confianza` (0 a 100, o nula);
- `mrz.valido`, `texto_ocr`, `avisos` y `errores`.

Con las muestras:
- `cedula_alexander_veha_rocha.png`: amarilla, PDF417 leído (los 4 datos), 2 s;
- `cc_escaneada.pdf`: amarilla, PDF417 ilegible, el OCR toma "DEPARTAMENTOX DDMMYYYY" como nombre (sin confianza) y no lee el número, 3 s.

Problemas que hay que manejar:
- **Todo lo que no tiene MRZ se trata como amarilla**, aunque no sea una cédula.
- **La cédula de extranjería no existe en el código** y no hay muestras.
- **El RUI se consulta dentro de `webapp/app.py`.**

## 4. Archivos

```
modules/validadores/
  fuentes/__init__.py, fuentes/rui.py     adaptador del RUI (usa modules/check_id/rui/consultar.py)
  cedula/
    __init__.py      validar_cedula(contenido, *, id_student, document_version, ...)
    __main__.py      python -m modules.validadores.cedula <archivo|carpeta> [--json]
    paginas.py       PDF (PyMuPDF a 200 ppp) o imagen -> páginas
    extraccion.py    llama a leer_cedula y lo convierte a datos con confianza; reconoce extranjería
    calidad.py       resolución y nitidez de cada página
    reglas.py        las 5 reglas, VERSION = "cedula@1.0.0"
    tests/
```

## 5. Datos extraídos (`extracted_data`)

| Clave | De dónde sale | Valor |
|---|---|---|
| `full_name` | `nombre_completo` | espacios normalizados |
| `identification_type` | el formato: CC (digital o amarilla) o CE (extranjería) | `C.C.` o `C.E.`, como en la 08e |
| `identification_number` | `numero_documento` | solo dígitos, como texto |
| `birth_date` | `fecha_nacimiento` | `aaaa-mm-dd` |
| `sex` | `sexo` | `M` o `F` |

Confianza:
- fuente `mrz` con MRZ válido, o `pdf417`: **1.0**;
- `ocr`: la de Tesseract dividida por 100;
- sin confianza, como la fuente `etiqueta`: **valor y confianza nulos**.

**Extranjería:** se reconoce por el texto ("CÉDULA DE EXTRANJERÍA", "MIGRACIÓN COLOMBIA"). Sin muestras no se sabe dónde están sus datos, así que solo se toman los que vengan de un MRZ válido; los demás quedan nulos y la cédula queda por revisar.

## 6. Reglas

| Regla | Obligatoria | Cumple | No cumple | No evaluable |
|---|---|---|---|---|
| `identification_document` | sí | Hay MRZ o PDF417, o el texto dice que es una cédula: de extranjería ("EXTRANJERÍA", "MIGRACIÓN COLOMBIA") o de ciudadanía, con **al menos 2 palabras distintas** del frente o del reverso ("REPÚBLICA DE COLOMBIA", "IDENTIFICACIÓN PERSONAL", "FECHA DE NACIMIENTO", "LUGAR DE NACIMIENTO", "ESTATURA", "G.S. RH", "ÍNDICE DERECHO"…), comparando solo letras porque el OCR pega palabras. Corregido al probar: las muestras son el reverso y no traen las palabras del frente | Hay texto legible (40 caracteres o más) pero no es una cédula | Sin texto legible, o el archivo está vacío o dañado (`low_confidence`) |
| `required_fields_present` | sí | Nombre, tipo y número con confianza ≥ 0.8 | (nunca) | Falta alguno o está bajo 0.8 (`low_confidence`) |
| `machine_readable_code` | sí | Digital o extranjería: MRZ con dígitos de control válidos. Amarilla: PDF417 leído | (nunca: un código ilegible no prueba nada) | No se leyó el código o el MRZ no cuadra (`low_confidence`) |
| `image_quality` | **no** | Resolución y nitidez sobre los umbrales provisionales | Por debajo de alguno (con los valores medidos en el mensaje) | Sin páginas que medir (`missing_dependency`) |
| `rui_name_match` | **no** | Nombre igual al del RUI en ≥ 85 % | < 85 % | El RUI no respondió o no tiene registro (`source_unavailable`); extranjería, porque falta definir la consulta (`source_pending`); sin nombre o número (`missing_dependency`) |

- Si `identification_document` no cumple, las demás quedan `no_evaluable` / `missing_dependency`.
- Umbrales provisionales de calidad, sobre la imagen original de cada página:
  - ancho de al menos 1000 px;
  - varianza del laplaciano de al menos 100.
  
  Quedan como constantes en `calidad.py`, para calibrarlos.
- La consulta al RUI envía el tipo de documento `"3"`, un supuesto sin verificar contra el DNP que queda **pendiente**. El adaptador recibe la función de consulta, así que las pruebas no usan la red.

## 7. Clasificación, acción y mensajes

Se usa `resultado.armar_resultado` de la 08e:
- una regla obligatoria que no cumple → `invalid` y `upload_new_version`;
- alguna obligatoria `no_evaluable` → `to_check` y `wait_for_review`;
- todo cumple → `valid`.

Nunca `inconsistent`. Mensajes clave:
- no es una cédula: "El archivo no es una cédula. Sube una foto o un PDF de tu cédula por ambas caras.";
- código ilegible: "No se pudo leer el código de la cédula (MRZ o PDF417); un funcionario la revisará.";
- válida: "Se leyó la cédula: {formato}."

## 8. Pruebas

- **Muestras del repo:**
  - el PNG da `valid`, con los 4 datos del PDF417 y confianza 1.0;
  - `cc_escaneada.pdf` da `to_check`: el código no se leyó y el nombre de plantilla queda nulo;
  - el Paz y Salvo da `invalid`, porque no es una cédula.
  
  Las tres usan Tesseract: sin él, se saltan con un aviso.
- **En memoria:** la conversión de `ResultadoCedula` (fuentes y confianzas, datos bajo 0.8, extranjería, MRZ inválido), cada regla en sus tres resultados, el RUI (coincide, no coincide, sin respuesta, sin registro, extranjería), la calidad (bajo umbral, sin páginas) y bytes vacíos o dañados.
- Cada resultado se valida contra el esquema del contrato.
- El comando `__main__` se prueba como el de la 08e.

## 9. Pendiente

- Registro en el `pipeline_registry` (07), cola (06) y base de datos (03).
- Muestras de cédula digital y de extranjería; calibrar los umbrales de calidad.
- Verificar el tipo de documento del RUI con el DNP. Definir la consulta para extranjería.
- No se promete ninguna tasa de acierto sin probar con escaneos reales.
