# Validador de Estampilla Pro-Cultura (Tarea 08d)

Issue: ISCOUTB/check_u#15. Rama: `tarea_08d_estampilla`, que sale de `main` y no depende de la 08c.

## 1. Objetivo

Un validador recibe el certificado de pago de la Estampilla Pro-Cultura (un PDF) y devuelve un `DocumentValidationResult` del contrato.

El PDF no trae firma digital, así que lo único que prueba el pago es la consulta a la Gobernación de Bolívar. Para hacerla se usa el adaptador de la Tarea 22 (`modules/estampilla_pro/`, de Javier). También se coteja el PDF con lo que devuelve la Gobernación, para detectar un número de recibo real puesto en un PDF editado.

No tiene frontend. Aquí nunca se declara `inconsistent`: la correspondencia con el estudiante es de la Tarea 09.

## 2. Decisiones (Héctor, 23/10/2026)

| # | Tema | Decisión |
|---|---|---|
| 1 | Consulta a la Gobernación | Regla **obligatoria** (`official_record`), hecha con el adaptador de la Tarea 22. |
| 2 | Cotejo del PDF con el registro oficial | Se cotejan la fecha de pago, el valor de la Pro-Cultura, los dígitos visibles del documento y el nombre. Si algo no coincide, queda **por revisar**. |
| 3 | Valor | Se exige que la Pro-Cultura valga **más de $0**. El valor exacto no se inventa: queda como pregunta para la universidad. |
| 4 | Consulta real de prueba | Se hizo una vez, con el comprobante real y su **recibo oficial (12 dígitos)**: la Gobernación lo aceptó. La respuesta se guardó solo en local. |
| 5 | Uso del adaptador | `consultar_comprobante` se usa tal cual y su resultado se traduce al contrato. `modules/estampilla_pro/` no se toca. |
| 6 | Carpeta | `modules/validadores/estampilla/`, la misma clave de `mapeo.json`. |
| 7 | Si solo falta la Gobernación | Si el servicio está caído o no se consultó, `required_action` es `wait_for_external_validation` (caso C de la issue). |
| 8 | Rama | Sale de `main`. Tiene su propia lectura robusta del PDF, con el mismo patrón de la 08c (PR #59). Cuando las dos estén fusionadas, esa lectura se junta en una función compartida. |
| 9 | Datos reales | El comprobante real, su respuesta oficial y sus variantes viven **solo en local**, en `checku_datos_locales/estampilla_pro_cultura/`. Las pruebas del repo usan datos inventados. |
| 10 | Firma | No hay regla de firma: el comprobante real no trae firma digital. |
| 11 | Consola | Solo consulta a la Gobernación con `--consultar`, como `--rui` en la cédula. |
| 12 | Prodesarrollo | La línea de la Estampilla Prodesarrollo, que viene en el mismo recibo, se ignora. |
| 13 | Doble programa | Cada comprobante se valida por separado. Que no sean el mismo comprobante dos veces es de la Tarea 09. |
| 14 | Lectura de la fila Pro-Cultura (tras la revisión final) | La etiqueta se busca sola: con guion, raya o espacio, o partida en dos renglones. El valor (con o sin "$" o "COP", hasta 20 caracteres) y el estado se leen en su fila. Solo valen estados conocidos: "Pagado"/"Pagada" cumplen; "Pendiente", "Anulado", "Vencido" y "Reversado" no cumplen. Un estado que no se puede leer queda por revisar. Una respuesta de la consulta sin `resultado` falla cerrado (`source_unavailable`). |

## 3. Lo que hay hoy

- **El certificado real:**
  - lo genera el sistema de la Gobernación con FPDF: una página con texto, sin firma digital;
  - encabezado "DEPARTAMENTO DE BOLÍVAR / SECRETARÍA DE HACIENDA / CERTIFICADO DE PAGO / FECHA DE EXPEDICIÓN: AAAA-MM-DD hh:mm:ss";
  - datos generales:
    - "Recibo Oficial: N";
    - "Contribuyente: DOCUMENTO - NOMBRE";
    - "Fecha de Pago: DD Mmm AAAA" (por ejemplo "15 Ene 2026");
    - "Entidad Recaudadora";
    - "Renta: 165 - Estampilla Departamental";
    - "Valor Base de Liquidacion";
  - una tabla con las columnas Renta, Conceptos Liquidados, Valor Pagado y Estado. Una de sus filas dice "Estampilla Pro-Cultura $ 70.036 Pagado".
  - Después de la tabla vienen el total y "FIN DEL CERTIFICADO".
- **El adaptador de la Tarea 22:**
  - `consultar_comprobante(numero_factura, confianza_ocr=None, *, document_version=None, cliente=None, ...)` devuelve:
    - `estado_consulta` (`encontrado`, `no_encontrado` o `no_disponible`);
    - `pagado`, `etiqueta_exists`, `fecha_pago` (ISO) y `valor_pro_cultura` (pesos);
    - `documento_parcial` (los dígitos visibles, por ejemplo "100******");
    - `nombre_anonimizado` (las 3 primeras letras de cada palabra, por ejemplo "ABC****DEF****");
    - `resultado` (`cumple`, `no_cumple` o `no_evaluable`) y `motivo`.
  - Sus motivos `invalid_input` e `incomplete_data` no están en el contrato y hay que traducirlos.
  - Con el comprobante real, devolvió encontrado, pagado, Pro-Cultura incluida y `cumple`.
- **El contrato:** `NoEvaluableReason` admite `low_confidence`, `source_unavailable`, `source_pending` y `missing_dependency`. `armar_resultado` acepta `accion_por_revisar`.

## 4. Archivos

```
modules/validadores/estampilla/
  __init__.py      validar_estampilla(contenido, *, id_student, document_version, ahora=None, consultar_registro=...)
  __main__.py      python -m modules.validadores.estampilla <archivo|carpeta> [--json] [--consultar]
  extraccion.py    lee el PDF con PyMuPDF y extrae los datos, sin juzgar
  reglas.py        las 5 reglas, VERSION = "estampilla_pro_cultura@1.0.0"
  tests/
modules/validadores/README.md   agrega la sección de la Estampilla
```

## 5. Datos extraídos

| Clave | De dónde sale | Formato para confianza 1.0 |
|---|---|---|
| `receipt_number` | "Recibo Oficial: N" | 6 a 20 dígitos |
| `identification_number` | "Contribuyente: DOCUMENTO - …" | 5 a 15 dígitos |
| `full_name` | "Contribuyente: … - NOMBRE", hasta el fin de la línea | Como en la 08c: de 2 a 6 palabras propias, solo con letras (se admiten guion y apóstrofo); "de", "del", "la", "las", "los" e "y" no cuentan |
| `payment_date` | "Fecha de Pago: DD Mmm AAAA" | `AAAA-MM-DD`. Meses abreviados en español o en inglés (Ene/Jan, Abr/Apr, Ago/Aug, Dic/Dec…); también se acepta `AAAA-MM-DD` |
| `pro_cultura_amount` | La fila "Estampilla Pro-Cultura … $ V" | Pesos enteros ("70.036" es 70036) |

Lo que no se encuentra va con valor y confianza nulos. Para la regla 3, la extracción guarda además, fuera de `extracted_data`, el estado de la fila Pro-Cultura ("Pagado", "Pendiente"…) y si la fila existe.

**Lectura robusta**, con el mismo patrón de la 08c:
- vacío, no es PDF (`is_pdf` falso) o dañado: "El archivo está vacío o dañado.";
- con contraseña: "El PDF está protegido con contraseña.";
- un PDF que hubo que reparar y quedó sin texto: dañado;
- sin texto: "El PDF no tiene texto.";
- el texto se lee en el orden en que se ve (`get_text(sort=True)`);
- nada de esto lanza una excepción.

## 6. Reglas (todas obligatorias)

| Regla | Cumple | No cumple | No evaluable |
|---|---|---|---|
| `payment_certificate_document` | El texto dice "CERTIFICADO DE PAGO", "BOLÍVAR" y "HACIENDA" | Hay texto (40 caracteres o más) de otro documento | Sin texto, vacío, dañado o protegido (`low_confidence`) |
| `required_fields_present` | Están los 5 datos | — | Falta alguno (`low_confidence`) |
| `pro_cultura_paid` | La fila Pro-Cultura existe, dice "Pagado" y su valor es mayor que 0 | No hay fila Pro-Cultura, su estado es otro conocido ("Pendiente", "Anulado"…) o vale $0 | No se pudo leer el valor o el estado (`low_confidence`) |
| `official_record` | La Gobernación lo encuentra, pagado y con Pro-Cultura | No lo encuentra; o lo encuentra sin Pro-Cultura o sin pagar | Ver la sección 8 |
| `official_record_matches` | Coinciden la fecha, el valor, el documento y el nombre (sección 8) | — | Algo no coincide, o la Gobernación no devolvió el dato (`low_confidence`) |

**Dependencias:**
- Si `payment_certificate_document` no cumple, las otras 4 quedan `no_evaluable` / `missing_dependency`.
- Sin `receipt_number`, `official_record` queda `missing_dependency`.
- `official_record_matches` solo se evalúa si `official_record` cumple; si no, queda `missing_dependency`.

**Clasificación y acción:**
- Cumplen las 5: `valid`.
- Una obligatoria no cumple: `invalid`, y el motivo es la primera que no cumple.
- Si no, `to_check`. La acción es `wait_for_external_validation` si todas las obligatorias no evaluables lo son por `source_unavailable` o `source_pending`; si no, `wait_for_review`.

## 7. Mensajes al estudiante

- **No es un certificado:** "El archivo no es un certificado de pago de la Estampilla Pro-Cultura. Sube el certificado de pago que descargaste de la Gobernación de Bolívar."
- **Sin fila Pro-Cultura:** "El comprobante no incluye la Estampilla Pro-Cultura. Sube el comprobante de pago de la Estampilla Pro-Cultura."
- **No dice "Pagado":** "La Estampilla Pro-Cultura no figura pagada en el comprobante. Sube el comprobante cuando el pago esté confirmado."
- **Valor $0:** "La Estampilla Pro-Cultura figura en $0 en el comprobante. Sube el comprobante de pago correcto."
- **No encontrado** (el de la Tarea 22): "No fue posible encontrar el comprobante en los registros oficiales."
- **Encontrado sin Pro-Cultura:** "En los registros oficiales, el comprobante no incluye la Estampilla Pro-Cultura."
- **Encontrado sin pagar:** "En los registros oficiales, la Estampilla Pro-Cultura no figura pagada."
- **Servicio no disponible:** "No fue posible consultar el comprobante en la Gobernación de Bolívar; se volverá a intentar."
- **No consultado:** "El comprobante todavía no se ha consultado en la Gobernación de Bolívar."
- **No coincide:** "Los datos del comprobante no coinciden con los registros oficiales ({campos}); un funcionario lo revisará." Nombra los campos ("fecha de pago", "valor", "documento", "nombre"), sin repetir los datos.

## 8. Consulta y cotejo

`consultar_registro(receipt_number, document_version)` es inyectable:
- por defecto llama a `consultar_comprobante` con `confianza_ocr=None`, porque el texto viene de un PDF digital;
- con `None` no se consulta;
- las pruebas usan una consulta falsa.

Solo sale hacia la Gobernación el número de recibo. El adaptador no guarda el HTML.

**Cómo se traduce lo que devuelve el adaptador en `official_record`:**

| Del adaptador | `official_record` |
|---|---|
| `resultado = cumple` | `cumple` |
| `estado_consulta = no_encontrado` y `no_cumple` | `no_cumple`, "no encontrado" |
| `encontrado` con `etiqueta_exists` falso | `no_cumple`, "sin Pro-Cultura" |
| `encontrado` con `pagado` falso | `no_cumple`, "sin pagar" |
| `no_evaluable` con `source_unavailable` o `incomplete_data` | `no_evaluable` / `source_unavailable` |
| `no_evaluable` con `invalid_input` o `low_confidence` | `no_evaluable` / `low_confidence` |
| No se consultó (`consultar_registro=None`) | `no_evaluable` / `source_pending` |

**Cotejo (`official_record_matches`):**
- **Fecha:** `payment_date` es igual a `fecha_pago`.
- **Valor:** `pro_cultura_amount` es igual a `valor_pro_cultura`.
- **Documento:** `identification_number` empieza con los dígitos visibles de `documento_parcial`. La máscara de asteriscos no conserva la longitud, así que solo se cotejan esos dígitos.
- **Nombre:** se compara en mayúsculas y sin tildes. Tiene el mismo número de palabras que `nombre_anonimizado` y cada una empieza con las letras visibles que le corresponden.

## 9. Pruebas

**En el repo, con datos inventados y sin internet:**
- Extracción, con textos en memoria y PDF creados en memoria que imitan el certificado:
  - cada dato, y los meses en español y en inglés;
  - valores con punto de miles;
  - un nombre con partículas;
  - el caso que no parece un nombre;
  - un texto desordenado en el PDF;
  - un PDF vacío, dañado, que no es PDF, truncado, con contraseña o sin texto.
- Reglas, con una extracción en memoria y una consulta falsa:
  - un caso por fila de las tablas de las secciones 6 y 8, con su mensaje;
  - la acción `wait_for_external_validation` frente a `wait_for_review`;
  - varias reglas fallando a la vez;
  - cada evaluación validada contra el esquema `rule-evaluation`.
- **Integración con el adaptador real**, sin internet: `consultar_comprobante` con un cliente falso que devuelve el HTML anonimizado de las pruebas de la Tarea 22 (pagado, solo Prodesarrollo, no pagado). Así se comprueba que la traducción funciona con lo que el adaptador devuelve de verdad.
- **El validador completo:** valid, invalid y to_check, siempre contra el esquema `document-validation-result`.
- **Consola:** sin `--consultar` no se llama a la consulta; con `--json` imprime el resultado del contrato.

**En local, sin subir nada** (`checku_datos_locales/estampilla_pro_cultura/`):
- el comprobante real y sus variantes:
  - dañadas, como en la 08c;
  - parecidas: sin fila Pro-Cultura, "Pendiente", $0, otro nombre, otra fecha, otro valor, otro número de recibo, otro documento;
- la consulta se simula con la respuesta real guardada (y "no encontrado" para cualquier otro número), así que no se hacen más consultas a la Gobernación;
- en ninguno debe haber excepción ni salirse del contrato.

## 10. Pendiente

- **Valor exacto:** el valor exigido y desde cuándo rige son una pregunta para la universidad.
- **Vigencia:** no se evalúa por la fecha de pago ni por la de expedición.
- **Otros estados:** no hay muestra de cómo dice la Gobernación "pendiente" o "anulado"; la Tarea 22 solo tenía una pagada.
- **Integración:** registro en el `pipeline_registry` (Tarea 07), la cola (Tarea 06) y la base de datos (Tarea 03).
- **Lectura compartida:** juntar la lectura robusta del PDF con la de la 08c cuando las dos estén fusionadas.
