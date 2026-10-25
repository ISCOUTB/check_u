# Endpoint: Análisis documental

## `POST /api/documentos/analizar`

Endpoint definitivo y reutilizable para analizar y validar los documentos de una preinscripción.

Lo consumen el Playground (`/estudiante/prueba_ocr`) y el flujo real de preinscripción. No requiere registro previo del estudiante cuando se usa desde el Playground.

## Solicitud

`Content-Type: multipart/form-data`

| Campo              | Tipo          | Descripción                                       |
| ------------------ | ------------- | ------------------------------------------------- |
| `datos`            | JSON (string) | Información del estudiante para las comparaciones |
| `nivel`            | texto         | `PREGRADO` o `POSGRADO`                           |
| `cedula`           | archivo PDF   | Cédula de ciudadanía                              |
| `evaluacion_grado` | archivo PDF   | Solo pregrado: Evaluación de Grado de Banner      |
| `paz_y_salvo`      | archivo PDF   | Paz y Salvo de Biblioteca                         |
| `estampilla`       | archivo PDF   | Estampilla Pro-Cultura                            |
| `saber_pro`        | archivo PDF   | Solo pregrado: Resultados Saber Pro               |

### Ejemplo de `datos`

```json
{
  "nombres": "Ana María",
  "apellidos": "Pérez Gómez",
  "tipoDocumento": "CC",
  "numeroDocumento": "1001234567",
  "fechaNacimiento": "2001-05-14",
  "codigoEstudiantil": "T00012345",
  "programa": "Ingeniería de Sistemas",
  "correo": "ana.perez@utb.edu.co"
}
```

## Documentos por nivel

### Pregrado

- `cedula`
- `evaluacion_grado`
- `paz_y_salvo`
- `estampilla`
- `saber_pro`

### Posgrado

- `cedula`
- `paz_y_salvo`
- `estampilla`

## Respuesta

El backend devuelve el resultado consolidado del motor OCR/Validación conforme a los esquemas de `contratos/esquemas/`, en especial `request-result-response.schema.json` y `document-validation-result.schema.json`.

La respuesta incluye, como mínimo:

- Datos extraídos por documento.
- Estado de validación por documento.
- Nivel de confianza, cuando aplique.
- Mensajes de error, advertencias y observaciones.
- Comparaciones cruzadas entre documentos y datos del estudiante.
- Estado general del análisis.

## Integración con el motor

NestJS reenvía los archivos y los datos al motor OCR/Validación en Python mediante HTTP, usando la variable de entorno `OCR_ENGINE_URL`.

La comunicación queda encapsulada en un servicio reutilizable; el controlador y el Playground no conocen los detalles del motor.

## Errores

| Situación                          | Respuesta |
| ---------------------------------- | --------- |
| JSON inválido o nivel no soportado | `400`     |
| Falta un documento requerido       | `400`     |
| Archivo no permitido o ilegible    | `400`     |
| Motor no disponible o timeout      | `503`     |
| Respuesta del motor inválida       | `502`     |
| Error interno                      | `500`     |

Los errores no exponen rutas internas ni detalles de infraestructura.
