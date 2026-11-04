# Tarea 50: Paz y Salvo por consulta a ALMA (simulada)

Issue: #125. Diseño: `docs/superpowers/specs/2026-11-04-tarea50-paz-y-salvo-alma-design.md`.

## Qué cambió

- **Ya no se sube el PDF de Paz y Salvo.** El formulario pide 4 documentos en pregrado, 6 con doble
  programa y 2 en posgrado. La solicitud sigue teniendo 5, 7 o 3 requisitos, porque el Paz y Salvo
  lo agrega el sistema.
- **Al enviar,** el backend consulta ALMA a través del motor (`POST /biblioteca/paz-y-salvo`) y guarda
  el Paz y Salvo como un documento sin archivo (`documentos.origen = 'CONSULTA'`). El estado
  depende del resultado:

  | Resultado | Estado |
  |---|---|
  | `cumple` | Válido |
  | `no_cumple` (préstamos, multas o solicitudes pendientes) | No válido |
  | `inconsistente` (el documento o el nombre de ALMA no coinciden con CheckU) | Inconsistente (la funcionaria puede resolverlo a mano) |
  | `no_encontrado`, `no_evaluable` o sin respuesta del motor en 5 s | Por revisar |
- **«Consultar de nuevo»:**
  - El estudiante lo tiene en el inicio y en su preinscripción. Cuenta como uno de los 3 reenvíos
    del día y se permite hasta `fecha_fin − 7`.
  - La funcionaria lo tiene en el detalle y no gasta intentos del estudiante.
- **Resolución manual de un Inconsistente:** volver a consultar daría lo mismo, así que la funcionaria
  puede marcar válido o no válido un Paz y Salvo Inconsistente, como un documento Por revisar. Queda
  en el historial con estado anterior `INCONSISTENTE`. Los demás documentos Inconsistentes no se
  resuelven a mano.
- **La tabla de Biblioteca (`TablaPazYSalvo`)** muestra préstamos, multas, solicitudes pendientes y
  la opción de grado, esta última solo como información. Aparece en `estudiante/home`, en
  `estudiante/preinscripcion` y en `funcionario/detalle_preinscripcion/[id]`, y en las tres vistas
  sale del mismo resultado guardado.
- **Motor (`modules/validadores/fuentes/alma`):**
  - cliente simulado (`AlmaClienteSimulado`), con la misma interfaz que `AlmaCliente`;
  - criterio nuevo de solicitudes pendientes;
  - contraste de identidad con CheckU (`consultar_para_checku`).

**Aviso para la Tarea 21 (Jorge).** La consolidación ahora usa préstamos, multas y solicitudes. La
opción de grado se informa aparte (`informativo: true`), porque mientras su fuente siga
`source_pending` nadie podría quedar a paz y salvo. `consultar_paz_y_salvo` crea el cliente según
`ALMA_MODO` (por defecto, `simulado`).

## Variables

| Variable | Valor |
|---|---|
| `ALMA_MODO` | `simulado` (por defecto) o `real`. Con `real` se usan `ALMA_API_KEY` y `ALMA_BASE_URL`, igual que antes. |
| `ALMA_SIMULACION_ARCHIVO` | Ruta al JSON de simulación. Sin el archivo, el Paz y Salvo queda Por revisar. |
| `ALMA_SIMULACION_DIR` | Solo para `docker-compose.local.yml`: la carpeta del host que se monta en el motor. |

## El JSON de simulación (fuera del repositorio)

- **No se sube:** `.gitignore` bloquea `alma_simulacion*.json` y `**/datos_locales/`.
- **Datos:** solo datos inventados.
- **Forma:** es la de la API Users de Ex Libris, por código de estudiante:

```json
{
  "usuarios": {
    "T00000001": {
      "user": {
        "primary_id": "T00000001", "first_name": "Nombre", "last_name": "Apellido",
        "user_identifier": [{ "id_type": { "value": "CC" }, "value": "1000000001" }]
      },
      "loans":    { "item_loan": [], "total_record_count": 0 },
      "fees":     { "fee": [], "total_record_count": 0, "total_sum": 0, "currency": "COP" },
      "requests": { "user_request": [], "total_record_count": 0 }
    }
  }
}
```

**Estados que reconoce la simulación:**

| Elemento | Pendiente | Terminado |
|---|---|---|
| Préstamo (`loan_status`) | `ACTIVE` | `COMPLETE` |
| Multa (`status`) | `ACTIVE` (o `balance > 0`) | `CLOSED` / `PAID` |
| Solicitud (`request_status`) | `NOT_STARTED`, `IN_PROCESS`, `ON_HOLD_SHELF` | `COMPLETED`, `CANCELED`, `HISTORY` |

**Contraste de identidad:** el documento se compara con algún `user_identifier.value`, solo con
letras y dígitos. El nombre se compara contra `first_name` + `last_name`, sin tildes ni mayúsculas.

**Escenarios del archivo local de Héctor**
(`checku_datos_locales\alma\alma_simulacion.json`):

| Código | Escenario |
|---|---|
| `T00000001` | Paz y salvo |
| `T00000101` | Con préstamos |
| `T00000102` | Con solicitudes |
| `T00000103` | Con multas |
| `T00000104` | Combinado |
| `T00000105` | Inconsistente |

Un código que no esté en el archivo da «no encontrado».

Para ver otro escenario con el usuario de prueba (`T00000001`), se copia el bloque de ese escenario
bajo `T00000001`. El documento y el nombre del bloque deben coincidir con los que tenga el
estudiante en CheckU, o el resultado será «inconsistente».

## Probarlo en local

- **Motor:**
  `ALMA_SIMULACION_ARCHIVO=<ruta> venv/Scripts/python.exe -m modules.validadores.fuentes.alma T00000104 --json`
- **Docker local:** se define `ALMA_SIMULACION_DIR` con la carpeta del JSON (por ejemplo en `.env`) y
  se ejecuta `levantar.ps1`.
- **Pruebas:**
  - Python: `venv/Scripts/python.exe -m pytest modules/validadores/fuentes/alma`;
  - backend: `npx vitest run` y `npx vitest run --config ./vitest.config.e2e.ts`;
  - frontend: `npx playwright test e2e/tabla_paz_y_salvo.spec.ts`.

  Las pruebas generan su propio JSON temporal.

## Base de datos

`db/migrations/010-paz-y-salvo-consulta.sql` hace lo siguiente:
- agrega `documentos.origen`;
- permite que un documento `CONSULTA` no tenga archivo;
- se puede repetir, y el mismo bloque está al final de `01-schema.sql`.

Los Paz y Salvo en PDF que ya existen quedan como histórico (`origen = 'ARCHIVO'`).

## Fuera de alcance

- **La conexión real con ALMA:** queda lista para activarse con `ALMA_MODO=real`.
- **La fuente de «opción de grado»:** sigue sin definirse.
- **El `docker-compose.yml` de producción:** no se modificó. Sin el JSON, el Paz y Salvo queda Por
  revisar y lo resuelve la funcionaria.
