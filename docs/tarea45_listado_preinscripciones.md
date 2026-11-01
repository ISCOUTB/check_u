# Tarea 45 — Listado de preinscripciones del estudiante

Issue: [#106](https://github.com/ISCOUTB/check_u/issues/106). Base: `main`, commit `50d28fa`.

## Comportamiento

El estudiante dispone de **Mis solicitudes de grado** (`/estudiante/solicitudes`), una vista que reúne todas sus preinscripciones, incluidas las canceladas y las anuladas. La información proviene de `GET /api/estudiante/solicitudes`; no hay registros de demostración ni datos estáticos.

- **Registros propios:** el backend identifica al estudiante por la sesión, de modo que el cliente nunca envía un ID. Si la sesión expira (`401`), se redirige al inicio de sesión.
- **Columnas:** número de solicitud (`id`), nivel (`PREGRADO` o `POSGRADO`), estado, fecha de solicitud, periodo de grado y acción `Ver detalle`.
- **Periodo:** muestra el nombre del periodo asignado y sus fechas de apertura y cierre. Sin periodo, indica `Sin periodo asignado`.
- **Fecha de solicitud:** `fechaSolicitud` es la fecha de la entrega inicial. Un `null` se presenta como `Sin enviar`. Las marcas de tiempo se convierten al día calendario de Bogotá; las fechas `DATE` (`YYYY-MM-DD`) se muestran tal cual, sin desplazamiento de zona horaria.
- **Orden:** se respeta el orden del backend, de la solicitud más reciente a la más antigua.
- **Historial:** las solicitudes con `activa: false` siguen visibles y se distinguen con la etiqueta `Historial`, un fondo atenuado y el estado persistido (`Cancelada` o `Anulada`). No se eliminan ni se ocultan.
- **Detalle:** `Ver detalle` abre `/estudiante/preinscripcion?solicitud=ID`, el detalle documental existente de la tarea 44. Funciona igual para solicitudes activas e históricas.
- **Actualización:** el botón `Actualizar` vuelve a consultar el listado y conserva el foco. La página también se refresca al regresar a la pestaña (`visibilitychange`), de modo que un cambio de estado del proceso se refleja sin recargar manualmente.
- **Estados vacío y de error:** sin solicitudes se explica cómo iniciar una preinscripción; si falla la consulta se muestra un mensaje recuperable con `Reintentar`, sin inventar filas.
- **Adaptabilidad:** tabla con desplazamiento horizontal desde 768 px y tarjetas equivalentes por debajo de ese ancho. Ambas vistas exponen el mismo contenido y las mismas acciones.

## Contrato consultado

```http
GET /api/estudiante/solicitudes
Cookie: sesión del estudiante
```

```json
{
  "solicitudes": [
    {
      "id": "9",
      "nivel": "PREGRADO",
      "estado": "VALIDA",
      "activa": true,
      "fechaSolicitud": "2026-10-31T02:00:00.000Z",
      "fechaCreacion": "2026-10-28T15:00:00.000Z",
      "canceladaEn": null,
      "periodo": {
        "id": "periodo-2026-2",
        "nombre": "Grado diciembre 2026",
        "fechaInicio": "2026-11-01",
        "fechaFin": "2026-11-30",
        "fechaCorte": "2026-11-23"
      }
    }
  ]
}
```

`periodo` puede ser `null`. El cliente valida cada fila y descarta la respuesta completa si el contrato no se cumple; una fila inválida no se completa con valores inventados.

## Estados

| Estado del backend | Etiqueta del estudiante | Tono del distintivo |
| --- | --- | --- |
| `VALIDA` | Válida | `valido` |
| `NO_VALIDA` | Inválida | `no_valido` |
| `INCONSISTENTE` | Inconsistente | `inconsistente` |
| `POR_REVISAR` | Por revisar | `por_revisar` |
| `CANCELADA` | Cancelada | `cancelada` |
| `CERRADA` | Anulada | `anulada` |
| `EN_PROCESO` | En proceso | `en_proceso` |
| `BORRADOR` | Borrador | `borrador` |
| Otro valor | El valor recibido o `Sin estado` | `por_revisar` |

`CERRADA` se presenta como **Anulada** y `NO_VALIDA` como **Inválida**, igual que en el resto del módulo del estudiante (tarea 44). Los estados `CANCELADA` y `CERRADA` son los que el backend marca con `activa: false` y, por tanto, los que reciben la marca de historial.

## Implementación

- `frontend/app/estudiante/solicitudes/page.tsx`: consulta, estados de carga/error/vacío, tabla, tarjetas, historial y actualización manual o al volver a la pestaña.
- `frontend/app/estudiante/solicitudes/listado.ts`: normalización del contrato, traducción de estados y formato de fechas y periodos. Lógica pura, sin acceso a red.
- `frontend/app/estudiante/solicitudes/api.ts`: cliente de `GET /estudiante/solicitudes` con cookies de sesión, `no-store`, cancelación y tiempo límite de 15 s.
- `frontend/app/estudiante/solicitudes/solicitudes.module.css`: tabla desplazable, tarjetas para móvil y atenuación del historial.
- `frontend/app/estudiante/solicitudes/layout.tsx`: metadatos de la ruta.
- `frontend/app/components/ui/StatusBadge.tsx` y `StatusBadge.module.css`: estados `cancelada`, `anulada`, `en_proceso` y `borrador`.
- `frontend/app/components/ui/Icono.tsx`: iconos de los estados anteriores.
- `frontend/app/components/navbar/Navbar.tsx`: `Mis solicitudes` apunta a `/estudiante/solicitudes`.
- `frontend/app/estudiante/home/page.tsx`: la tarjeta de la solicitud incluye `Ver todas mis solicitudes`.

No se agregó ni modificó ningún endpoint. Se reutiliza el listado y el detalle ya existentes de la tarea 44, por lo que la cancelación sigue siendo compatible: una solicitud cancelada permanece en este listado y su detalle se abre por ID.

## Pruebas automatizadas

```powershell
cd frontend
npx tsc --noEmit
npx eslint app/estudiante/solicitudes app/components/ui app/components/navbar e2e/listado_solicitudes.spec.ts e2e/soporte.ts
npx playwright test
```

Resultados de esta revisión:

- `e2e/listado_solicitudes.spec.ts`: **19 pruebas aprobadas**.
- Suite completa de Playwright del frontend: **408 pruebas aprobadas**.
- Comprobación de tipos (`tsc --noEmit`) y ESLint sin errores.
- `git diff --check` sin espacios problemáticos.

Las pruebas de `listado_solicitudes.spec.ts` cubren:

- traducción de los ocho estados y de un estado desconocido;
- día de Bogotá para marcas de tiempo y fechas `DATE` sin desplazamiento;
- normalización del contrato y conservación del historial;
- rechazo de filas incompletas;
- render de todas las solicitudes con ID, nivel, estado, fecha, periodo y `Ver detalle`;
- tabla y tarjetas equivalentes, historial visible y distinguido;
- apertura del detalle de una solicitud cancelada;
- estado vacío, error con reintento y actualización manual del estado;
- redirección de un funcionario a su dashboard;
- accesibilidad y ausencia de desbordamiento en 320, 360, 768 y 1280 px, en tema claro y oscuro.

Las respuestas del backend en la suite de navegador son fixtures de `e2e/soporte.ts`; la aplicación no contiene datos de demostración.
