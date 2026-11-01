# Tarea 42a: validación integral de la solicitud

Issue: #102. Diseño: `docs/superpowers/specs/2026-10-31-tarea42-validacion-integral-design.md`.

## Qué cambió

- **Estado calculado.** Al terminar cada envío y cada reenvío (una sola vez), la solicitud toma el
  estado de sus documentos requeridos, en este orden de prioridad:
  1. No válida;
  2. Inconsistente;
  3. Por revisar (también si falta un documento);
  4. Válida.

  Ya no queda en `EN_PROCESO`.
- **Documentos por tipo de solicitud.** Están en `backend/src/solicitudes/requisitos-documentales.ts`:

  | Tipo | Documentos | Cuáles |
  |---|:-:|---|
  | Pregrado, un programa | 5 | cédula, evaluación de Banner, Paz y Salvo, estampilla, Saber Pro |
  | Pregrado, doble programa | 7 | los 5, más la evaluación y la estampilla del programa 2 |
  | Posgrado | 3 | cédula, Paz y Salvo, estampilla |

  El formulario del estudiante ya pide los 7 en doble programa.
- **Paz y Salvo.** Lo decide `BibliotecaService` (`backend/src/biblioteca/`). Hoy es un demo con
  códigos inventados en `paz-y-salvo-demo.ts`; `T00000001` está a paz y salvo.
  - Un código que no está en la lista queda **No válido**.
  - Si Biblioteca no responde, queda **Por revisar**.
  - Cuando exista ALMA, se cambia solo la implementación registrada en `BibliotecaModule`.
- **Reenvíos:**
  - se permiten hasta `fecha_fin − 7` inclusive, en hora de Bogotá;
  - siguen el límite de 3 por día y la regla de no reemplazar documentos válidos.
- **Funcionaria:**
  - solo puede **aceptar** una solicitud Válida, y la deja `ACEPTADA`, que es un estado nuevo
    y final;
  - puede **anular** cualquier solicitud no final;
  - en el detalle, cada documento Por revisar tiene «Marcar válido» y «Marcar no válido» (este
    último con motivo obligatorio). Se avisa al estudiante y se recalcula la solicitud.
- **Al cierre del plazo.** Cada 15 minutos `PlazosSolicitudService` hace dos cosas:
  - anula las solicitudes No válida o Inconsistente cuyo `fecha_fin − 7` ya pasó, con un aviso de
    tipo `error`;
  - recalcula las solicitudes viejas que quedaron en `EN_PROCESO`.

  Las Por revisar y Válida esperan a la funcionaria.

## Base de datos

`db/migrations/009-estado-solicitud.sql` va después de `008-cancelacion-preinscripcion.sql`
(Tarea 44) y se puede repetir sin problema. Hace lo siguiente:

- agrega el estado `ACEPTADA` y la resolución manual (`MANUAL` en validaciones,
  `DOCUMENTO_RESUELTO` en revisiones), con su aviso;
- pasa a `ACEPTADA` las solicitudes que se aceptaron antes de esta tarea, que quedaron en `VALIDA`
  con una revisión `APROBADA`;
- ajusta la cancelación de la Tarea 44 al estado calculado: el estudiante puede cancelar cualquier
  solicitud enviada que la funcionaria no haya decidido (`EN_PROCESO`, `POR_REVISAR`, `NO_VALIDA`,
  `INCONSISTENTE` y `VALIDA`), porque después del envío ya no queda en `EN_PROCESO`.

Para una base existente:

```bash
psql -d checku -v ON_ERROR_STOP=1 -f db/migrations/009-estado-solicitud.sql
```

## Cómo probarlo en local

- Backend:
  - `cd backend && npx vitest run`;
  - `npx vitest run --config ./vitest.config.e2e.ts`. Usa PGlite con el esquema real, sin Docker,
    y las pruebas de esta tarea están en `test/validacion-integral.e2e-spec.ts`.
- Frontend: `cd frontend && npx playwright test e2e/detalle.spec.ts e2e/documentos_requeridos.spec.ts`.
  Necesita `frontend/.env.local`, que es una copia de `.env.example`.

## Fuera de alcance (avisos para el equipo)

- **El límite diario de reenvíos:** el servicio lo cuenta por solicitud, como pide la issue, y el
  trigger `checku_validar_limite_reenvios` por estudiante. Solo difieren si un estudiante tiene
  dos solicitudes con reenvíos el mismo día.
- **La fecha de corte del primer envío:** sigue en `fecha < fecha_fin − 7`
  (`asignacion-periodo.ts`), así que el día `fecha_fin − 7` se puede corregir pero no enviar por
  primera vez.
- **La regla `distinct_receipt`:** la segunda estampilla se analiza sola, así que esa regla de
  `validar_estampillas` no se aplica en el envío.
- **Una solicitud nueva tras la anulación:** un estudiante con la solicitud anulada todavía no
  puede abrir una nueva en otro periodo, porque `enviarPreinscripcion` toma la última solicitud y
  exige `BORRADOR`.
- **`documentos/validar-solicitud.ts`:** ya usa la configuración nueva, pero ningún endpoint lo
  usa. `POST /documentos/analizar` va por `DocumentosService`.
