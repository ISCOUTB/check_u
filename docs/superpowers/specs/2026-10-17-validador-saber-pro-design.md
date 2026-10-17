# Validador de Saber Pro (Tarea 08e)

**Fecha:** 17/10/2026 · **Autor:** Héctor Cabarcas · **Issue:** ISCOUTB/check_u#16 · **Rama:** `tarea_08e_saber_pro`

Contexto obligatorio: `docs/PROMPT_BASE.md`, `docs/gap_analysis.md` (decisión D1: NestJS es la aplicación y el motor de Python corre como proceso trabajador del mismo despliegue) y los contratos de la Tarea 02 (`docs/contratos.md`, `contratos/esquemas/`).

## 1. Objetivo y éxito

Un validador de Python que recibe el PDF de Saber Pro de un estudiante y devuelve un `DocumentValidationResult` del contrato:
- la **extracción** (datos con su confianza) separada de las **reglas** (cumple / no_cumple / no_evaluable);
- la clasificación individual del documento (`valid`, `invalid` o `to_check`; nunca `inconsistent`, que es de la validación cruzada);
- la acción que debe tomar el estudiante.

Solo aplica a pregrado.

**Criterios de aceptación** (los de la issue):
- [ ] Extracción y reglas separadas.
- [ ] Reglas devuelven cumple / no_cumple / no_evaluable.
- [ ] Registrado en el `pipeline_registry`. **Queda pendiente**: el registro es de la Tarea 07 (#11), que no existe todavía (decisión 3).
- [ ] Pruebas pasan. La issue pide datos ficticios; por decisión del equipo se prueba con reportes reales del equipo (decisión 4).
- [ ] Resumen final de lo verificado frente a lo simulado o pendiente.

## 2. Decisiones

Todas las tomó Héctor el 17/10/2026, con opciones y una recomendación.

| # | Tema | Decisión |
|---|---|---|
| 1 | Orden | Saber Pro es el primer validador. |
| 2 | Cédulas de `modules/test_data/` | Son de muestra (no de una persona real); se pueden usar en la 08a. |
| 3 | Tarea 07 | El validador se hace primero, como módulo independiente con una interfaz clara; el registro en el `pipeline_registry` queda pendiente y documentado. |
| 4 | Datos de prueba | **No se fabrican documentos.** Las pruebas usan solo los PDF reales que manda el equipo (son sus propios reportes). |
| 5 | Dónde están los PDF | `modules/test_data/saber_pro/`. Héctor quería subirlos, pero `.gitignore` excluye `test_data/` (regla de Lisandro): **no se toca el `.gitignore` hasta que Lisandro conteste**. Mientras tanto los PDF quedan locales. |
| 6 | Formato de entrada | Solo el PDF descargado de icfes.gov.co (con texto). |
| 7 | Librería | PyMuPDF (ya está en el `venv` y en el compose del servidor). |
| 8 | Datos extraídos | Los 5 de la issue (nombre, identificación, número de registro, fecha de aplicación, puntaje global) **más el tipo de identificación**, que la validación cruzada necesita. |
| 9 | Confianza | **1.0 o nula.** 1.0 si el dato está junto a su etiqueta y con el formato esperado; si no, valor y confianza nulos. |
| 10 | Reglas | La de la issue (puntaje global ≥ 100) más las tres elegidas: es un reporte Saber Pro, datos obligatorios presentes y **firma del ICFES**, esta última dividida en dos reglas (decisión 17). |
| 11 | Mínimo de 100 | Es un parámetro de la regla, atado a la versión del conjunto de reglas: si cambia el mínimo, cambia la versión. |
| 12 | Puntaje < 100 | Documento no válido; se permite subir un nuevo reporte. |
| 13 | Archivo ilegible (vacío, dañado, sin texto) | Por revisar (`to_check`): lo decide un funcionario. |
| 14 | Confianza en la firma | Certificados públicos de Camerfirma Colombia (raíz y SUBCA) guardados en el repo, y el firmante debe ser el ICFES (NIT 860024301-6). |
| 15 | Verificador de firma | Se amplía `firma_electronica/infra/sign_validator.py` (varias raíces y quién firmó) sin cambiar cómo lo usa la app de escritorio. La Tarea 08c lo reutilizará. |
| 16 | Revocación | Se consulta en internet (OCSP/CRL); si no responde, la regla queda `no_evaluable` con motivo `source_unavailable`, nunca `no_cumple`. |
| 17 | Certificado del ICFES vencido | Ver la sección 6. La firma se divide en `icfes_signature_intact` (obligatoria) y `icfes_certificate_valid` (informativa, no obligatoria). |
| 18 | Ubicación | `modules/validadores/saber_pro/`, con lo compartido por los 5 validadores en `modules/validadores/`. |
| 19 | Pruebas | pytest, y cada resultado se valida contra `contratos/esquemas/document-validation-result.schema.json` con `jsonschema`. |
| 20 | Versión de las reglas | `saber_pro@1.0.0`: mayor si cambia una regla obligatoria o el mínimo, menor si se agrega una regla, parche si solo cambia un mensaje. |
| 21 | Dependencias | `modules/requirements.txt` (y `modules/requirements-dev.txt` para las de prueba), con versiones fijas. |
| 22 | Valores esperados | En `modules/test_data/saber_pro/esperados.json`, local como los PDF: el código de las pruebas no lleva datos personales. |
| 23 | Casos sin PDF | Las reglas y la clasificación se prueban también con datos en memoria (por ejemplo, puntaje 99). No se crea ningún PDF. |
| 24 | Copia guardada de nuevo | Si el PDF conserva restos de la firma pero ya no se puede verificar (sección 6), `icfes_signature_intact` queda `no_evaluable` y el documento queda **por revisar**, igual que sin firma. Decidido el 17/10/2026, después de revisar los PDF del equipo. |
| 25 | Certificado vencido | `icfes_certificate_valid` da `no_cumple` (informativa). Aprobado con el "construye y prueba" del 17/10/2026. |

## 3. Lo que se sabe del reporte (de los PDF del equipo)

- Es el "Reporte de resultados" que se descarga de icfes.gov.co: un PDF 1.7 con texto (4 o 5 páginas), firmado por el ICFES en el momento de la descarga.
- **Página 1:** guía "¿Cómo entender mis resultados?". **Repite el puntaje global y los módulos del estudiante como "Ejemplo"**, con los números partidos ("1 54"). El extractor no debe leer esta página.
- **Página 2 en adelante:** "Reporte de resultados" con etiquetas: `Nombre Completo:`, `Identificación:` (por ejemplo `C.C. 1234567890` o `T.I. …`), `Número de registro:` (`EK` + 12 dígitos), `Aplicación del examen:` (dd/mm/aaaa) y `Puntaje global` (`NNN /300`). Después vienen los resultados por módulo.
- No todos los reportes traen lo mismo: uno de los dos no tiene SNIES, institución, programa ni el percentil del grupo de referencia (NBC). Ninguno de esos datos se extrae.

## 4. Archivos

```
modules/
  requirements.txt           PyMuPDF, pyHanko, pyhanko-certvalidator (versiones fijas)
  requirements-dev.txt       pytest, jsonschema
  validadores/
    __init__.py
    resultado.py             compartido: arma el DocumentValidationResult, clasifica y decide la acción
    saber_pro/
      __init__.py            validar_saber_pro(...)
      extraccion.py          PDF -> datos con confianza; no juzga
      firma.py               adaptador al verificador de firma_electronica/
      reglas.py              las 5 reglas, VERSION y PUNTAJE_MINIMO
      certificados/          raíz y SUBCA de Camerfirma Colombia (.crt públicos) + README con origen y huellas
      tests/
firma_electronica/infra/sign_validator.py   acepta varias raíces y devuelve el firmante
.gitignore                                  excepción solo para modules/validadores/saber_pro/certificados/
```

Los PDF y `esperados.json` viven en `modules/test_data/saber_pro/` y no se suben (decisión 5).

## 5. Interfaz y flujo

```python
def validar_saber_pro(contenido: bytes, *, id_student: str, document_version: int) -> dict
```

Devuelve un `dict` listo para JSON que cumple `DocumentValidationResult`. Las fechas van en hora de Bogotá (`-05:00`).

1. `extraccion.extraer(contenido)`: PyMuPDF lee el texto solo desde "Reporte de resultados". Devuelve los 6 campos, si el PDF tiene texto, si parece un reporte Saber Pro y los errores del documento (por ejemplo, "El archivo está vacío o dañado"). Nunca lanza una excepción por un PDF dañado: lo informa.
2. `firma.verificar(contenido)`: usa el verificador ampliado de `firma_electronica/`. Devuelve si hay firma, si está intacta, si el firmante es el ICFES, y la validez del certificado (cadena, vigencia y revocación).
3. `reglas.evaluar(extraccion, firma)`: las 5 reglas, cada una independiente.
4. `resultado.armar(...)`: clasificación, acción y armado del resultado.

**Errores inesperados del programa** (no un PDF dañado) no se convierten en un resultado: suben como excepción para que la cola los reintente (Tarea 06).

### Datos extraídos (`extracted_data`)

Siempre están las 6 claves; lo que no se encontró va con `value` y `confidence` en `null`.

| Clave | Etiqueta en el reporte | Formato exigido para confianza 1.0 | Valor |
|---|---|---|---|
| `full_name` | `Nombre Completo:` | texto no vacío | espacios normalizados; no se parte en nombres y apellidos (lo hace la Tarea 09) |
| `identification_type` | `Identificación:` | `C.C.`, `T.I.`, `C.E.`, `P.P.` u otra sigla antes del número | la sigla |
| `identification_number` | `Identificación:` | solo dígitos | texto (conserva ceros) |
| `registration_number` | `Número de registro:` | `EK` + 12 dígitos | texto |
| `exam_date` | `Aplicación del examen:` | fecha real dd/mm/aaaa | `aaaa-mm-dd` |
| `global_score` | `Puntaje global` | entero de 0 a 300 antes de `/300` | número |

## 6. Firma del ICFES: el certificado está vencido

Los dos reportes del equipo se firmaron el 17/10/2026, al descargarlos, **con un certificado del ICFES que venció el 02/12/2025**. Además:
- la firma no trae sello de tiempo de confianza (solo la hora que declara el firmante);
- solo trae el certificado del ICFES, no la cadena;
- el certificado lo emitió "SUBCA CAMERFIRMA COLOMBIA SAS v2".

Una regla estricta daría "no válida" o "no verificable" a **todo reporte auténtico**. Por eso la firma se divide (decisión 17):
- **`icfes_signature_intact`** es obligatoria: protege contra el estudiante que edita su reporte.
- **`icfes_certificate_valid`** es informativa: el funcionario ve el estado del certificado, pero no bloquea al estudiante.

Cuando el certificado está vencido no se consulta la revocación, porque las autoridades certificadoras no responden por certificados vencidos.

### Los PDF del equipo son copias guardadas de nuevo

Los dos reportes que mandó el equipo no son el archivo que firmó el ICFES:
- la firma dice cubrir unos 3 MB (3.023.356 y 2.817.554 bytes), pero los archivos pesan 279 KB y 269 KB;
- los dos dicen `Producer: PDFium`, el motor de PDF de Chrome y Edge, que aparece cuando un PDF se abre en el navegador y se guarda de nuevo;
- conservan el dibujo y el diccionario de la firma, pero no el formulario de firmas (`/AcroForm`): pyHanko no encuentra ninguna firma.

Héctor los recibió de otra persona; no hay un original para comparar. No se puede distinguir una copia inocente de una editada, así que la firma de una copia así se trata como **no verificable** (decisión 24). Por eso `firma.verificar` distingue tres casos:
- **sin firma:** no hay rastro de firma;
- **no verificable:** hay restos de firma (`/Type /Sig` o `/FT /Sig`), pero pyHanko no encuentra una firma que pueda validar;
- **presente:** pyHanko la encuentra y la valida.

## 7. Reglas

Todas devuelven el `RuleEvaluation` del contrato. El mensaje incluye la evidencia (por ejemplo, "Puntaje global: 154; mínimo: 100").

| Regla | Obligatoria | Cumple | No cumple | No evaluable (motivo) |
|---|---|---|---|---|
| `saber_pro_report` | sí | Tiene texto, dice "Reporte de resultados" y trae un registro `EK` | Tiene texto pero es otro documento (por ejemplo, un Saber 11 con registro `AC`) | Vacío, dañado o sin texto (`low_confidence`) |
| `required_fields_present` | sí | Están nombre, tipo y número de identificación, registro y fecha | (nunca) | Falta alguno (`low_confidence`) |
| `global_score_minimum` | sí | Puntaje ≥ `PUNTAJE_MINIMO` (100) | Puntaje < 100 | No se encontró el puntaje (`low_confidence`) |
| `icfes_signature_intact` | sí | Hay firma, el PDF no cambió después de firmarse y la firmó el ICFES (NIT 860024301-6) | El PDF se modificó después de firmarse, o lo firmó otro | Sin firma, o firma no verificable porque el archivo se guardó de nuevo (`low_confidence`) |
| `icfes_certificate_valid` | **no** | Cadena hasta la raíz de Camerfirma, certificado vigente al firmar y no revocado | ⚠️ Certificado vencido al firmar, revocado, o de otra autoridad | Sin firma (`missing_dependency`), o no se pudo consultar la revocación (`source_unavailable`) |

- Si `saber_pro_report` no cumple o no es evaluable, las otras 4 quedan `no_evaluable` con motivo `missing_dependency`.
- El certificado vencido da **`no_cumple`** (decisión 25): el contrato no tiene un motivo para "vencido", y que el certificado estaba vencido al firmar es un hecho confirmado, no falta de información. Como la regla es informativa, no cambia la clasificación.
- `icfes_certificate_valid` solo se evalúa cuando la firma está **presente**; si no, queda `no_evaluable` con motivo `missing_dependency`.

## 8. Clasificación y acción

Solo cuentan las reglas obligatorias:
- **Alguna `no_cumple` → `invalid`.**
  - `resubmission_allowed: true`, `required_action: upload_new_version`.
  - `resubmission_reason` es el mensaje de la primera regla obligatoria que no cumple.
- **Si no, alguna `no_evaluable` → `to_check`.**
  - `resubmission_allowed: false`, `required_action: wait_for_review` (caso B: revisión humana), `resubmission_reason: null`.
  - El caso C (fuente externa pendiente) no se da en Saber Pro, porque la única regla que consulta afuera es informativa.
- **Si no → `valid`**, con `required_action: none`.
- `validation_status` es `completed` siempre que el validador corre, también con un PDF dañado.
- `errors` lleva los problemas del documento ("El archivo está vacío o dañado", "El PDF no tiene texto").
- `validation_version` es `saber_pro@1.0.0`.

`resultado.py` se escribe para que las otras 08 lo reutilicen: recibe las reglas evaluadas y la acción para `to_check`, y aplica la regla de reenvío del contrato.

### Mensajes al estudiante

| Caso | Mensaje |
|---|---|
| Válido | "Tu reporte Saber Pro cumple con el puntaje mínimo requerido." |
| Puntaje < 100 | "Tu puntaje global es menor a 100. Si vuelves a presentar el examen, sube el nuevo reporte." |
| No es un Saber Pro | "El archivo no es un reporte de resultados Saber Pro. Sube el PDF descargado de icfes.gov.co." |
| PDF modificado | "El reporte fue modificado después de que el ICFES lo firmó. Sube el PDF original descargado de icfes.gov.co." |
| Por revisar | Sin `resubmission_reason`; el mensaje de cada regla explica qué faltó. |

## 9. Pruebas

- **pytest** en `modules/validadores/saber_pro/tests/`.
- Cada resultado se valida contra el esquema del contrato con `jsonschema`.
- **Con los PDF del equipo** (`modules/test_data/saber_pro/`):
  - los 6 datos de cada reporte real coinciden con `esperados.json`;
  - cada reporte real da `to_check`: sus otras reglas obligatorias cumplen, pero la firma no se puede verificar porque son copias guardadas de nuevo (sección 6);
  - el archivo vacío da `to_check` sin lanzar una excepción.
  - Si faltan los PDF o `esperados.json`, esas pruebas se **saltan con un aviso**: no fallan ni pasan en silencio.
- **Con datos en memoria** (sin crear documentos):
  - cada regla en cumple, no cumple y no evaluable;
  - puntaje 99, 100 y 300;
  - un campo ausente;
  - firma modificada, de otro firmante o ausente;
  - certificado vencido, revocado o sin respuesta;
  - la clasificación y la regla de reenvío.
- **Trampa de la página 1:** una prueba con el texto de la guía confirma que el puntaje de ejemplo no se toma como puntaje global.
- **Sin internet:** las pruebas no dependen de la red. La consulta de revocación se reemplaza en las pruebas; con el certificado vencido ni siquiera se hace.
- **Firma:** el verificador ampliado de `firma_electronica/` conserva su comportamiento con `biblioteca.crt`, probado con los 3 PDF de `firma_electronica/test/samples/`.

## 10. Fuera de alcance y pendientes

- Registro en el `pipeline_registry` (Tarea 07), la cola y el trabajador (Tarea 06) y guardar resultados (Tarea 03).
- Comparar el nombre y la identificación con la cédula y la solicitud (Tarea 09).
- Casos que la issue pide con documentos y que no tienen PDF: incumplimiento real (< 100), ilegible, campos ausentes y baja confianza. Se prueban con datos en memoria y se reportan como "verificado con datos en memoria, no con un documento".
- Subir los PDF de prueba: depende de lo que conteste Lisandro sobre `test_data/`.
- Avisar al equipo que el certificado de firma del ICFES está vencido desde el 02/12/2025.
- Agregar PyMuPDF y pyHanko al compose del servidor cuando el trabajador ejecute validadores (hoy el compose instala PyMuPDF pero no pyHanko).
- Los certificados de Camerfirma se descargan de su página oficial durante la implementación, **previa aprobación de Héctor**. Su origen y sus huellas SHA-256 quedan en `certificados/README.md`.
