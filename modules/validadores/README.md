# modules/validadores — validadores de documentos

Cada validador recibe el archivo que subió el estudiante y devuelve un `DocumentValidationResult` del contrato de la Tarea 02 (`contratos/esquemas/document-validation-result.schema.json`):
- la **extracción** (datos con su confianza), separada de las **reglas** (cumple / no_cumple / no_evaluable);
- la clasificación del documento (`valid`, `invalid` o `to_check`);
- la acción que debe tomar el estudiante.

Hoy existen el de **Saber Pro** (Tarea 08e), el de **cédula** (Tarea 08a) y el de **Paz y Salvo de Biblioteca** (Tarea 08c). Diseño: `docs/superpowers/specs/2026-10-17-validador-saber-pro-design.md`.

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
| `firma_pdf.py` | Compartido: lee la firma de un PDF y distingue sin firma / no verificable (copia guardada de nuevo) / presente. |
| `paz_y_salvo/__init__.py` | `validar_paz_y_salvo(contenido, id_student=…, document_version=…)`. |
| `paz_y_salvo/extraccion.py` | Texto del PDF: nombre y código del estudiante, y si dice "se encuentra paz y salvo". |
| `paz_y_salvo/firma.py` | Firma de la Biblioteca: integridad y nombre del firmante. |
| `paz_y_salvo/reglas.py` | Las 4 reglas y `VERSION = "paz_y_salvo_bib@1.0.0"`. |

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

## Paz y Salvo de Biblioteca (Tarea 08c)

`validar_paz_y_salvo(contenido, id_student=…, document_version=…)` recibe el PDF que generó la Biblioteca (con texto).
- Extrae el nombre y el código del estudiante.
- Revisa que diga "se encuentra paz y salvo" (con "no se encuentra paz y salvo" no cumple).
- Verifica la firma con el `SignatureValidator` de `firma_electronica/`. **Ninguna firma aprueba sola:**
  - sin firma, copia guardada de nuevo o firmado a nombre de la Biblioteca → por revisar;
  - modificado después de firmar o firmado por otro → no válido.
- Lo que no es un PDF (un HTML renombrado, por ejemplo) o un PDF cortado se informa como dañado.
- Diseño: `docs/superpowers/specs/2026-10-21-validador-paz-y-salvo-design.md`.

Los Paz y Salvo reales **no traen firma digital**: la Biblioteca los genera con una plantilla y los imprime con Microsoft Print to PDF. Por eso hoy todo Paz y Salvo correcto queda por revisar. El formato del texto se confirmó con uno real; la muestra real no se sube al repositorio (tiene datos personales).

```bash
venv/Scripts/python.exe -m modules.validadores.paz_y_salvo "firma_electronica/test/samples/PAZ Y SALVO BIBLIOTECA firmado.pdf"
```

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
