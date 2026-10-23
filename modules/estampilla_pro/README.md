# Módulo de Verificación de Estampilla Pro-Cultura (Tarea 22)

Este módulo conecta CheckU con el servicio público de verificación de recibos de la Gobernación de Bolívar para validar comprobantes de la estampilla **Pro-Cultura**.

Forma parte del motor de Python de CheckU (`modules/estampilla_pro/`) y es utilizado por el validador del documento `estampilla_pro_cultura` (Tarea 08d) y la validación cruzada de identidad (Tarea 09).

---

## 1. Endpoint y Formato de la Petición

- **URL:**
  ```http
  GET https://impuestos.bolivar.gov.co/gobol_web/liquidaciones/verificar-recibo/{numero_factura}/web?id={numero_factura}&tipo=web&txtAjax=true
  ```

- **Parámetros de consulta (Query Params):**
  | Parámetro | Valor | Descripción |
  |---|---|---|
  | `id` | `{numero_factura}` | Número oficial de recibo/liquidación codificado |
  | `tipo` | `web` | Indicador de consulta web |
  | `txtAjax` | `true` | Solicita respuesta en formato JSON |

- **Cabeceras HTTP enviadas:**
  - `User-Agent`: `CheckU/1.0 (+https://github.com/ISCOUTB/check_u)`
  - `Accept`: `application/json, text/javascript, */*; q=0.01`
  - `X-Requested-With`: `XMLHttpRequest`

---

## 2. Respuestas del Servicio

### A. Sin comprobante asociado (No encontrado)

```json
{
  "message": "No se encontraron liquidaciones",
  "success": false,
  "type": "error"
}
```

### B. Con comprobante asociado (Encontrado)

```json
{
  "message": "success",
  "success": true,
  "html": "<div class=\"container col-lg-10\" id=\"liquidaciones-content\">...</div>"
}
```

#### Estructura del HTML (Anonimizada)

El campo `html` contiene el contenedor `#liquidaciones-content`:
- **Insignia general:** `<span class="badge">Pagado</span>` dentro del encabezado `card-header`.
- **Datos generales:** Etiquetas `<label>` con valores en `<span>` adyacentes:
  - `Recibo Oficial:` Número de recibo oficial.
  - `Contribuyente:` Documento parcial y nombre (ej. `100****** - NOMBRE ESTUDIANTE`).
  - `Fecha De Pago:` Fecha en formato `AAAA-MM-DD` o `DD/MM/AAAA`.
  - `Entidad Recaudadora:`, `Renta:`, `Valor Base Liquidación:`.
- **Tabla de conceptos liquidados:** Filas en `table.table tbody tr` con 4 columnas:
  - Renta
  - Concepto liquidado (ej. `Estampilla Pro-Cultura` o `Estampilla Prodesarrollo (Liquidacion Recibo)`)
  - Valor (ej. `$ 70,036`)
  - Estado (ej. `Pagado`)

> **Privacidad y robustez:** El HTML original suele tener etiquetas sin cerrar y comillas mal escapadas en atributos. El módulo utiliza `lxml.html` para parsearlo de forma tolerante, extrae solo los datos requeridos y **nunca guarda el HTML completo ni el enlace de descarga del certificado**.

---

## 3. Variables de Entorno

| Variable | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `ESTAMPILLA_BASE_URL` | String | `https://impuestos.bolivar.gov.co/gobol_web/liquidaciones/verificar-recibo` | URL base del servicio público |
| `ESTAMPILLA_TIMEOUT_S` | Float | `10.0` | Tiempo de espera máximo por petición |
| `ESTAMPILLA_MAX_REINTENTOS` | Int | `2` | Cantidad de reintentos con backoff ante fallos transitorios |
| `ESTAMPILLA_MIN_INTERVAL_S` | Float | `0.5` | Intervalo mínimo entre peticiones (rate limiting) |

No requiere claves de API ni contraseñas (el servicio de la Gobernación es público). Verificación TLS siempre activa.

---

## 4. Uso del Módulo

### A. Desde Python

```python
from modules.estampilla_pro import consultar_comprobante

# Consulta directa (alta confianza)
resultado = consultar_comprobante("0012345678")

# Consulta con confianza OCR (ej. si fue leído con 75% de confianza)
resultado = consultar_comprobante("0012345678", confianza_ocr=0.75)
```

También disponible como adaptador puente en:
```python
from modules.validadores.fuentes.estampilla import consultar_comprobante
```

### B. Por argumentos de consola (CLI)

```bash
# Salida en JSON estándar
python -m modules.estampilla_pro 0012345678

# Con nivel de confianza OCR
python -m modules.estampilla_pro 0012345678 --confianza 0.95

# Formato de texto legible
python -m modules.estampilla_pro 0012345678 --texto
```

### C. Por tubería estándar (stdin / stdout para orquestadores)

```bash
echo '{"numero_factura": "0012345678", "confianza_ocr": 0.95}' | python -m modules.estampilla_pro
```

---

## 5. Estructura de Salida JSON

```json
{
  "type_document": "estampilla_pro_cultura",
  "referencia": "0012345678",
  "estado_consulta": "encontrado",
  "pagado": true,
  "fecha_pago": "2026-10-13",
  "nombre_anonimizado": "NOMBRE ANONIMIZADO",
  "documento_parcial": "100******",
  "etiqueta_exists": true,
  "valor_pro_cultura": 70036,
  "moneda": "COP",
  "resultado": "cumple",
  "motivo": null,
  "mensaje": "El comprobante fue verificado correctamente.",
  "consultado_en": "2026-10-21T23:30:00-05:00",
  "fuente": "impuestos.bolivar.gov.co"
}
```

---

## 6. Matriz de Reglas de Decisión

| Situación | `estado_consulta` | `pagado` | `etiqueta_exists` | `resultado` | `motivo` |
|---|---|---|---|---|---|
| Comprobante con concepto Pro-Cultura pagado | `encontrado` | `true` | `true` | `cumple` | `null` |
| Comprobante sin concepto Pro-Cultura (ej. solo Prodesarrollo) | `encontrado` | según recibo | `false` | `no_cumple` | `null` |
| Concepto Pro-Cultura en estado distinto a "Pagado" | `encontrado` | `false` | `true` | `no_cumple` | `null` |
| Estructura distinta o campos ausentes | `encontrado` | `null` | `null` | `no_evaluable` | `incomplete_data` |
| No encontrado (alta confianza OCR o manual) | `no_encontrado` | `null` | `null` | `no_cumple` | `null` |
| No encontrado (baja confianza OCR < 0.8) | `no_encontrado` | `null` | `null` | `no_evaluable` | `low_confidence` |
| Error HTTP, 5xx, tiempo agotado o respuesta no JSON | `no_disponible` | `null` | `null` | `no_evaluable` | `source_unavailable` |
| Formato de número inválido (caracteres no permitidos) | `no_disponible` | `null` | `null` | `no_evaluable` | `invalid_input` |

---

## 7. Pruebas Unitarias

Ejecución de la suite completa de pruebas:
```bash
python -m pytest modules/estampilla_pro
```
Las pruebas no realizan llamadas a internet; utilizan mocks y HTML anonimizado para asegurar reproducibilidad y velocidad.
