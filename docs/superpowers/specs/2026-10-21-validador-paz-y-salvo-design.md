# Validador de Paz y Salvo de Biblioteca (Tarea 08c)

**Fecha:** 21/10/2026 · **Autor:** Héctor Cabarcas · **Issue:** ISCOUTB/check_u#14 · **Rama:** `tarea_08c_paz_y_salvo` (desde `main`, que ya tiene los validadores 08e y 08a)

Contexto: `docs/PROMPT_BASE.md`, `docs/gap_analysis.md`, los contratos de la Tarea 02 y los specs de la 08e y la 08a, cuya estructura se reutiliza.

## 1. Objetivo y éxito

Un validador que recibe el Paz y Salvo de Biblioteca (PDF) y devuelve un `DocumentValidationResult`. Integra la verificación de firma de `firma_electronica/` y distingue **sin firma**, **no verificable** e **inválida**. Sin frontend.

**Criterios de la issue:**
- [ ] Extracción y reglas separadas.
- [ ] Reglas con cumple / no_cumple / no_evaluable.
- [ ] Registro en el `pipeline_registry`: pendiente de la Tarea 07, como en las otras.
- [ ] Pruebas pasan.
- [ ] Resumen de lo verificado frente a lo simulado o pendiente.

## 2. Decisiones (21/10/2026)

| # | Tema | Decisión |
|---|---|---|
| 1 | Muestras | Las 3 de `firma_electronica/test/samples/` ("Documento de pruebas": sin firma, firmado y modificado). Héctor no tiene un Paz y Salvo real: **el formato real de la Biblioteca queda sin probar**. |
| 2 | Confianza en la firma | **Solo integridad y nombre del firmante**, sin validar el certificado. El certificado de la Biblioteca no está en el repo y la issue prohíbe subir certificados. ⚠️ **Riesgo aceptado por Héctor:** un certificado propio cuyo nombre diga "Biblioteca" pasaría. |
| 3 | Extracción | Sí, con el formato de la muestra: nombre y código del estudiante, y la frase de paz y salvo. Es **provisional** hasta ver un documento real. |
| 4 | Correspondencia con el estudiante | En la Tarea 09: este validador extrae nombre y código, y la 09 los compara con la solicitud y la cédula. Aquí nunca se declara `inconsistent`. |
| 5 | Sin firma | Por revisar (`no_evaluable`). |
| 6 | Firmado y modificado después | No válido, se pide el original. |
| 7 | Firmado por otro | No válido. |
| 8 | Copia guardada de nuevo (restos de firma no verificables) | Por revisar, como en Saber Pro. |
| 9 | Entrada | Solo PDF con texto. Un escaneo o foto sin texto queda por revisar. |
| 10 | Estado de paz y salvo | Decidido con la muestra (Héctor lo delegó). Cumple con "se encuentra paz y salvo"; no cumple con su negación directa, "no se encuentra paz y salvo"; si no aparece ninguna, no evaluable. No se inventan otras frases de deuda. |
| 11 | Firmante | Decidido con la muestra (Héctor lo delegó). La organización (`O`) o el nombre común (`CN`) del certificado contienen "BIBLIOTECA", sin importar mayúsculas ni tildes. El certificado de pruebas dice `O=Biblioteca, CN=Biblioteca`. |

### Ajustes tras ver un Paz y Salvo real (23/10/2026)

Héctor pasó un Paz y Salvo real para probar en local. No se sube al repositorio porque tiene datos personales; tampoco las variantes generadas a partir de él.
- **Cómo es:**
  - una página con texto;
  - generado con una plantilla de la Biblioteca e impreso con "Microsoft: Print To PDF";
  - **sin firma digital** (ni `/ByteRange` ni `/Sig`);
  - el texto confirma el formato de la decisión 3: "El Sistema de Bibliotecas … hace constar que el alumno NOMBRE identificado con el código T… se encuentra paz y salvo.".
- **Robustez:** se probó con 31 variantes locales. Ninguna lanzó excepciones y todas cumplieron el contrato. Las variantes fueron:
  - **dañados:** vacío, truncados, bytes al azar, encabezado o xref rotos, PNG, HTML o DOCX renombrados, basura al final, dos PDF pegados;
  - **parecidos:** "no se encuentra", sin nombre, sin código o sin estado, otro documento, escaneado, con contraseña, con solo permisos, dos páginas, guardado de nuevo;
  - **firmados con certificados autofirmados:** a nombre de la Biblioteca, de otra persona, modificado y guardado de nuevo.

| # | Tema | Decisión (Héctor, 23/10/2026) |
|---|---|---|
| 12 | Firma | **Ninguna firma aprueba sola.** Una firma intacta a nombre de la Biblioteca queda `no_evaluable` (`low_confidence`): el certificado no se puede confirmar y, como los reales no vienen firmados, una firma "de la Biblioteca" podría ser falsa. Una firma rota o de otra persona sigue dando no válido. Reemplaza el riesgo aceptado de la decisión 2. La consulta a ALMA (Tarea 21) se suma después, en otro PR. |
| 13 | Nombres largos | "de", "del", "la", "las", "los" e "y" no cuentan para el tope de 6 palabras ("MARÍA DEL PILAR DE LA HOZ PÉREZ" entra). Un nombre necesita al menos 2 palabras propias. |
| 14 | Robustez | Lo que PyMuPDF abre pero no es un PDF (`is_pdf` falso) es dañado. El texto se lee en el orden en que se ve (`get_text(sort=True)`). Un PDF que hubo que reparar y quedó sin texto es dañado, no "sin texto". |

## 3. Lo que hay hoy

- **Las muestras:** PDF de Word de 1 página con texto. "PAZ Y SALVO BIBLIOTECA / Documento de pruebas / El sistema de la biblioteca de la Universidad hace constar que el alumno NOMBRE identificado con el código T000123123 se encuentra paz y salvo. / Atentamente La biblioteca". La versión "modificado" agrega "MODIFICADO PARA PRUEBA" después de la firma.
- **La firma:** la pone la app de escritorio `firma_electronica/` con un certificado autofirmado de pruebas (`O=Biblioteca, CN=Biblioteca, OU=Firma Electronica`). `SignatureValidator` (ampliado en la 08e) ya devuelve si hay firma, si está intacta, si cubre todo el archivo y la organización del firmante. Falta el nombre común.

## 4. Archivos

```
modules/validadores/
  firma_pdf.py          compartido: sin firma / no verificable / presente (sale de saber_pro/firma.py)
  saber_pro/firma.py    usa firma_pdf.py (sin cambiar su comportamiento)
  paz_y_salvo/
    __init__.py         validar_paz_y_salvo(contenido, *, id_student, document_version, ...)
    __main__.py         python -m modules.validadores.paz_y_salvo <archivo|carpeta> [--json]
    extraccion.py       texto con PyMuPDF: nombre, código, frase de estado, si es un Paz y Salvo
    firma.py            firma de la Biblioteca con firma_pdf.py
    reglas.py           las 4 reglas, VERSION = "paz_y_salvo_bib@1.0.0"
    tests/
firma_electronica/infra/sign_validator.py   agrega signer_common_name (sin cambiar lo demás)
```

## 5. Datos extraídos

| Clave | De dónde sale | Formato para confianza 1.0 |
|---|---|---|
| `full_name` | "el alumno NOMBRE identificado" | texto con letras, espacios normalizados |
| `code_student` | "identificado con el código CÓDIGO" | `T` seguida de 6 a 10 dígitos |

Lo que no se encuentra va con valor y confianza nulos.

## 6. Reglas (todas obligatorias)

| Regla | Cumple | No cumple | No evaluable |
|---|---|---|---|
| `paz_y_salvo_document` | El texto dice "PAZ Y SALVO" y "BIBLIOTECA" | Hay texto (40 caracteres o más) de otro documento | Sin texto, vacío o dañado (`low_confidence`) |
| `required_fields_present` | Nombre y código | — | Falta alguno (`low_confidence`) |
| `clearance_status` | "se encuentra paz y salvo" | "no se encuentra paz y salvo" | Ninguna de las dos (`low_confidence`) |
| `library_signature_intact` | Nunca (decisión 12) | Modificado después de firmarse, o firmado por otro | Sin firma, restos de firma no verificables, o firma intacta a nombre de la Biblioteca (`low_confidence`) |

Si `paz_y_salvo_document` no cumple, las otras 3 quedan `no_evaluable` / `missing_dependency`. Varias reglas pueden fallar a la vez (por ejemplo, modificado y "no se encuentra paz y salvo"); la clasificación usa la primera obligatoria que no cumple como motivo.

Mensajes al estudiante:
- no es un Paz y Salvo: "El archivo no es un Paz y Salvo de la Biblioteca. Sube el Paz y Salvo que te entregó la Biblioteca.";
- no está a paz y salvo: "La Biblioteca indica que no estás a paz y salvo. Resuelve tus pendientes y sube un nuevo Paz y Salvo.";
- modificado: "El Paz y Salvo fue modificado después de que la Biblioteca lo firmó. Sube el original que te entregó la Biblioteca.";
- otro firmante: "El Paz y Salvo no está firmado por la Biblioteca (firmante: X).".

## 7. Pruebas

- **Con las 3 muestras del repo:**
  - sin firma → `to_check` (firma `no_evaluable`);
  - firmado → `to_check` (decisión 12: ninguna firma aprueba sola);
  - modificado → `invalid` con el motivo de modificado.
  
  En las tres, `full_name` y `code_student` salen con confianza 1.0.
- **En memoria:** la frase negada, nombre o código ausentes, otro documento, sin texto, otro firmante, copia no verificable, varias reglas fallando a la vez y bytes vacíos o dañados.
- **Contrato:** cada resultado se valida contra el esquema.
- **Saber Pro:** sus pruebas siguen pasando después de mover la parte de firma a `firma_pdf.py`.

## 8. Pendiente

- Sumar la consulta a ALMA (Tarea 21) como regla, para que un Paz y Salvo correcto pueda salir válido sin revisión humana.
- Validar el certificado de la Biblioteca (decisión 2), cuando exista uno institucional.
- Fecha o vigencia del Paz y Salvo: la muestra no tiene.
- Registro en el `pipeline_registry` (07), cola (06) y base de datos (03).
