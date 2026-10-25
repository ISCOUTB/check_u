# modules/validadores — validadores de documentos

Cada validador recibe el archivo que subió el estudiante y devuelve un `DocumentValidationResult` del contrato de la Tarea 02 (`contratos/esquemas/document-validation-result.schema.json`):
- la **extracción** (datos con su confianza), separada de las **reglas** (cumple / no_cumple / no_evaluable);
- la clasificación del documento (`valid`, `invalid` o `to_check`);
- la acción que debe tomar el estudiante.

Hoy existen el de **Saber Pro** (Tarea 08e), el de **cédula** (Tarea 08a) y el de **Estampilla Pro-Cultura** (Tarea 08d). Cada uno tiene su diseño en `docs/superpowers/specs/`.

## Archivos

| Archivo | Qué hace |
|---|---|
| `resultado.py` | Compartido por todos los validadores: arma cada `RuleEvaluation` y el resultado del contrato, clasifica con las reglas obligatorias y aplica la regla de reenvío. |
| `conftest.py` | Fixture `validar_esquema` de las pruebas: valida contra los esquemas del contrato. |
| `saber_pro/__init__.py` | `validar_saber_pro(contenido, id_student=…, document_version=…)`. |
| `saber_pro/extraccion.py` | Lee el texto del PDF con PyMuPDF, solo desde "Reporte de resultados" (la página 1 repite el puntaje como ejemplo). |
| `saber_pro/firma.py` | Firma del ICFES con el `SignatureValidator` de `firma_electronica/`. Distingue firma ausente, no verificable (archivo guardado de nuevo) y presente. |
| `saber_pro/reglas.py` | Las 5 reglas, `VERSION = "saber_pro@1.0.0"` y `PUNTAJE_MINIMO = 100`. |
| `saber_pro/certificados/` | Certificados públicos de Camerfirma Colombia (ver su README). |
| `consola.py` | Comando compartido para probar un validador con archivos propios (`python -m modules.validadores.<tipo>`). |
| `fuentes/rui.py` | Adaptador del RUI: `consultar_rui(numero)` → encontrado / sin registro / sin respuesta. |
| `cedula/__init__.py` | `validar_cedula(contenido, id_student=…, document_version=…)`. |
| `cedula/paginas.py`, `cedula/calidad.py` | PDF o imagen → páginas; resolución y nitidez de cada página. |
| `cedula/extraccion.py` | Adapta lo que devuelve `leer_cedula` (modules/cedula) a datos con confianza; reconoce la versión de la cédula. |
| `cedula/reglas.py` | Las 5 reglas de la cédula y `VERSION = "cedula@1.0.0"`. |
| `estampilla/__init__.py` | `validar_estampilla(contenido, id_student=…, document_version=…, consultar_registro=…, document_order=1)` y `validar_estampillas([…], …)` para las dos del doble programa. |
| `estampilla/extraccion.py` | Lee el certificado de pago con PyMuPDF: recibo, contribuyente, fecha de pago y la fila "Estampilla Pro-Cultura". |
| `estampilla/reglas.py` | Las 5 reglas, la traducción de lo que devuelve el adaptador de la Tarea 22 (`modules/estampilla_pro`) y el cotejo con el registro oficial. `VERSION = "estampilla_pro_cultura@1.0.0"`. |

## Uso

```python
from modules.validadores.saber_pro import validar_saber_pro

resultado = validar_saber_pro(pdf_en_bytes, id_student="T00012345", document_version=1)
resultado["document_classification"]  # "valid" | "invalid" | "to_check"
```

La raíz del repositorio debe estar en `sys.path` (igual que en `webapp/app.py`).

### Probarlo con tu propio PDF

Desde la raíz del repositorio:

```bash
venv/Scripts/python.exe -m modules.validadores.saber_pro "ruta/a/tu-reporte.pdf"
```

Muestra la clasificación, los datos extraídos y cada regla con su mensaje. También acepta una carpeta (valida todos sus PDF), y con `--json` muestra el resultado completo del contrato. Nada se guarda ni se envía.

Un consejo para la prueba: descarga el reporte de icfes.gov.co y pásalo **sin abrirlo antes en el navegador**. Si se abre y se guarda desde Chrome o Edge, la firma del ICFES deja de ser verificable y el reporte queda por revisar.

## Cédula (Tarea 08a)

`validar_cedula(contenido, id_student=…, document_version=…)` recibe un PDF o una imagen.
- Adapta la lectura que ya existía (`modules/cedula`: MRZ de la cédula digital, PDF417 y OCR de la amarilla con hologramas) y reconoce la cédula de extranjería.
- Consulta el RUI con el adaptador `fuentes/rui.py`, como regla informativa.
- Diseño: `docs/superpowers/specs/2026-10-17-validador-cedula-design.md`.

Para probarla con tu propia cédula (PDF, PNG o JPG):

```bash
venv/Scripts/python.exe -m modules.validadores.cedula "ruta/a/tu-cedula.png"
```

Sin `--rui` **no** consulta el RUI, así que no envía el número de documento a ningún servicio externo. Con `--rui` sí lo consulta. Necesita Tesseract instalado.

## Estampilla Pro-Cultura (Tarea 08d)

`validar_estampilla(contenido, id_student=…, document_version=…)` recibe el certificado de pago (PDF) que se descarga de la Gobernación de Bolívar. El PDF no trae firma digital, así que lo que prueba el pago es la consulta oficial.
- **Extrae** el recibo oficial, el documento y el nombre del contribuyente, la fecha de pago y el valor de la Estampilla Pro-Cultura. La Prodesarrollo, que viene en el mismo recibo, se ignora.
- **Exige** que la fila Pro-Cultura diga "Pagado" y valga más de $0. El valor exacto no se inventa: queda pendiente.
- **Consulta el recibo** en la Gobernación con el adaptador de la Tarea 22 (`modules/estampilla_pro`), como regla **obligatoria**:
  - no encontrado, sin Pro-Cultura o sin pagar → no válido;
  - servicio caído o sin consultar → `wait_for_external_validation`.
- **Coteja** el PDF con el registro oficial (fecha, valor, dígitos visibles del documento y nombre). Si algo no coincide, queda por revisar.
- **Doble programa (pregrado):** `validar_estampillas([pdf_programa_1, pdf_programa_2], …)` devuelve un resultado por estampilla, cada uno con su `document_order` (1 o 2). El de la segunda lleva además `distinct_receipt`: si es el mismo recibo que el de la primera, queda por revisar, porque un funcionario decide si ese recibo cubre los dos títulos.
- Diseño: `docs/superpowers/specs/2026-10-23-validador-estampilla-design.md`.

Para probarlo con un certificado propio:

```bash
venv/Scripts/python.exe -m modules.validadores.estampilla "ruta/al/certificado.pdf" --consultar
```

Sin `--consultar` **no** consulta a la Gobernación, así que no envía el número de recibo a ningún servicio externo, y el resultado queda esperando la validación externa.

## Instalar y probar

Desde la raíz del repositorio, con el `venv`:

```bash
venv/Scripts/python.exe -m pip install -r modules/requirements-dev.txt
venv/Scripts/python.exe -m pytest
```

`pytest.ini` (en la raíz) limita las pruebas a `modules/validadores` y al verificador de firma de `firma_electronica/`. Las pruebas no usan internet.

### Muestras reales (solo en tu PC)

Las pruebas con reportes reales leen `modules/test_data/saber_pro/`. Git ignora `test_data/`, así que la carpeta no está en el repositorio.

Para correrlas:
1. Pon ahí los PDF.
2. Escribe a mano `esperados.json`, con el formato de abajo.

```json
{
  "<archivo>.pdf": {
    "tipo": "reporte",
    "datos": {
      "full_name": "…",
      "identification_type": "C.C.",
      "identification_number": "…",
      "registration_number": "EK…",
      "exam_date": "aaaa-mm-dd",
      "global_score": 0
    },
    "clasificacion": "to_check"
  },
  "<otro>.pdf": { "tipo": "corrupto", "clasificacion": "to_check" }
}
```

Sin esa carpeta, esas pruebas se saltan con un aviso.

## Pendiente

- Registrar el validador en el `pipeline_registry` cuando exista la Tarea 07 (#11). La cola y el trabajador son de la Tarea 06, y guardar los resultados de la Tarea 03.
- Instalar pyHanko en el compose del servidor cuando el trabajador ejecute validadores.
- El certificado con el que firma el ICFES venció el 02/12/2025. Las copias de reportes abiertas en el navegador y guardadas de nuevo pierden la firma verificable y quedan por revisar.
