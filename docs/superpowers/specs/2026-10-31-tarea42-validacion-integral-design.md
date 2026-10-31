# Tarea 42: validación integral de la solicitud y dashboard con datos reales — Diseño

Issue: ISCOUTB/check_u#102 (sub-issues 42a, 42b, 42c y 42d). Parte de `main` en `c336ab9`.

## 1. Objetivo

Que la solicitud de preinscripción tenga un estado real, calculado a partir de sus documentos
(42a), y que el dashboard de la funcionaria muestre ese estado en sus contadores, gráficas y
listado (42b, 42c y 42d).

Hoy el dashboard ya carga las solicitudes reales (`GET /funcionario/solicitudes`, Tarea 41), pero
los estados no son reales. Nada recalcula el estado de la solicitud: después del envío y de cada
reenvío queda en `EN_PROCESO`, y el dashboard lo muestra como «Por revisar».

## 2. Lo que se encontró en `main`

Verificado el 31/10/2026: el backend compila, pasan las 342 pruebas de vitest y las 87 de
Playwright del dashboard, el detalle, la base y los colores (con `frontend/.env.local`).

| # | Hallazgo | Se corrige en |
|---|---|---|
| 1 | El estado de la solicitud nunca se calcula: queda en `EN_PROCESO` tras el envío y cada reenvío. | §4 |
| 2 | `VALIDA` significa «aceptada por la funcionaria». Si se calcula, la funcionaria ya no puede aceptar. | §3 |
| 3 | Paz y Salvo siempre queda «Por revisar» (`pendiente_integracion`): ninguna solicitud puede ser Válida. | §5 |
| 4 | La funcionaria no tiene cómo resolver un documento «Por revisar». | §8 |
| 5 | Aceptar no revisa los requisitos: se puede aceptar una solicitud `NO_VALIDA` o `EN_PROCESO`. | §8 |
| 6 | La segunda evaluación de Banner (doble programa) no existe en el formulario, el envío, `validarArchivos` (solo admite `-2` para la estampilla y hasta 6 archivos) ni los reenvíos (hasta 6). | §6 |
| 7 | El reenvío no revisa el plazo `fecha_fin − 7`. | §7 |
| 8 | No existe la anulación automática al cierre del plazo. | §9 |
| 9 | Tres listas distintas de documentos requeridos: `solicitudes.service.ts`, `documentos/validar-solicitud.ts` (pregrado sin Paz y Salvo) y la del frontend. | §4.1 |
| 10 | El dashboard incluye los borradores y los cuenta como «Por revisar». | §10 |
| 11 | El filtro de fechas usa la fecha en UTC (`slice(0, 10)`) y la de creación del borrador, no la del envío. | §10 |
| 12 | Una solicitud anulada (`CERRADA`) se cuenta como «No válida». | §10 |

Fuera de alcance, se avisa en el PR:
- El límite diario: el servicio lo cuenta por solicitud (como pide la issue) y el trigger
  `checku_validar_limite_reenvios` por estudiante. Solo difieren si el estudiante tiene dos
  solicitudes con reenvíos el mismo día.
- El primer envío se corta con `fecha < fecha_fin − 7` (`asignacion-periodo.ts`), y el reenvío irá
  hasta `fecha_fin − 7` inclusive. Se deja igual porque es código de otra tarea.
- La segunda estampilla se analiza sola, así que la regla `distinct_receipt` de
  `validar_estampillas` no se aplica en el envío.
- Un estudiante con la solicitud anulada no puede abrir una nueva en otro periodo:
  `enviarPreinscripcion` toma la última solicitud y exige `BORRADOR`.

## 3. Estados de la solicitud

Migración `db/migrations/008-estado-solicitud.sql` (y el mismo cambio en `01-schema.sql`): se
agrega `ACEPTADA` a `chk_estado_solicitud`.

| Estado | Quién lo pone | Significado |
|---|---|---|
| `BORRADOR` | Sistema | No se ha enviado. |
| `EN_PROCESO` | — | Ya no se escribe. Se conserva en el CHECK por las filas viejas, que se recalculan (§4.4). |
| `NO_VALIDA`, `INCONSISTENTE`, `POR_REVISAR`, `VALIDA` | Sistema (§4) | Resultado calculado de los documentos. |
| `POR_REVISAR` | Funcionaria | También al pedir una corrección («Solicitar corrección»), como hoy. |
| `ACEPTADA` | Funcionaria | Aceptó una solicitud `VALIDA`. Cierra la solicitud. |
| `CERRADA` | Funcionaria o sistema | Anulada (a mano, o al cierre del plazo, §9). |

`ACEPTADA` y `CERRADA` son finales: no admiten reenvíos, decisiones ni recálculo.

## 4. 42a: estado calculado

### 4.1 Configuración de documentos requeridos

Nuevo `backend/src/solicitudes/requisitos-documentales.ts`, única fuente de verdad del backend:

```ts
export type TipoSolicitud = 'PREGRADO_UN_PROGRAMA' | 'PREGRADO_DOBLE_PROGRAMA' | 'POSGRADO';
export interface DocumentoRequerido { tipo: TypeDocument; orden: 1 | 2 }
export const DOCUMENTOS_POR_TIPO: Readonly<Record<TipoSolicitud, readonly DocumentoRequerido[]>>;
export function tipoSolicitud(nivel: 'PREGRADO' | 'POSGRADO', doblePrograma: boolean): TipoSolicitud;
export function documentosRequeridos(nivel, doblePrograma): readonly DocumentoRequerido[];
/** Clave del transporte: 'saber_pro', 'estampilla_pro_cultura-2', 'academic_evaluation-2'. */
export function claveDocumento(d: DocumentoRequerido): string;
```

| Documento | Pregrado 1 | Pregrado 2 | Posgrado |
|---|:-:|:-:|:-:|
| `identification` | ✅ | ✅ | ✅ |
| `academic_evaluation` orden 1 | ✅ | ✅ | |
| `academic_evaluation` orden 2 | | ✅ | |
| `paz_y_salvo_bib` | ✅ | ✅ | ✅ |
| `estampilla_pro_cultura` orden 1 | ✅ | ✅ | ✅ |
| `estampilla_pro_cultura` orden 2 | | ✅ | |
| `saber_pro` | ✅ | ✅ | |
| **Total** | **5** | **7** | **3** |

La usan:
- el envío (`enviarPreinscripcion`: los archivos esperados);
- `validarRequisitosCompletos`;
- `validarArchivos`: un `-2` solo para los tipos que la configuración pide dos veces, y el máximo de
  archivos es el mayor total (7);
- los reenvíos (máximo 7);
- el cálculo del estado;
- `documentos/validar-solicitud.ts` (`POST /documentos/analizar`). Este endpoint cambia: ahora pide
  también Paz y Salvo en pregrado, y se avisa en el PR.

Doble programa significa pregrado con fila `solicitud_programa` de orden 2. Desde #74 esa fila
solo existe si `segundoPrograma === true`.

### 4.2 Cálculo

Nuevo `backend/src/solicitudes/estado-solicitud.ts`, sin acceso a la base:

```ts
export type EstadoDocumento = 'VALIDO' | 'NO_VALIDO' | 'INCONSISTENTE' | 'POR_REVISAR' | 'POR_VALIDAR' | 'CARGADO';
export type EstadoCalculado = 'VALIDA' | 'NO_VALIDA' | 'INCONSISTENTE' | 'POR_REVISAR';
export function calcularEstadoSolicitud(
  requeridos: readonly DocumentoRequerido[],
  actuales: readonly { tipo: string; orden: number; estado: EstadoDocumento }[],
): EstadoCalculado;
```

- Solo cuenta la versión actual de cada documento requerido, es decir, la de mayor `version` por
  (tipo, orden) con `id_entrega`. Los documentos que el tipo no pide se ignoran.
- Se evalúa en este orden, y gana el primer estado que se cumpla:
  1. `NO_VALIDA`: algún requerido está `NO_VALIDO`.
  2. `INCONSISTENTE`: algún requerido está `INCONSISTENTE`.
  3. `POR_REVISAR`: algún requerido está `POR_REVISAR`, `POR_VALIDAR` o `CARGADO`, o falta.
  4. `VALIDA`: todos los requeridos están `VALIDO`.
- En doble programa, cada evaluación y cada estampilla es un requerido. Por eso basta que falle una
  para que la solicitud quede `NO_VALIDA`.

### 4.3 Cuándo se calcula

Una sola vez por envío: al final de la transacción de `enviarPreinscripcion` y de
`ReenviosService.reenviar`, en lugar del `UPDATE … estado='EN_PROCESO'`. La función
`recalcularEstado(client, idSolicitud)` lee el tipo y los documentos actuales, calcula y guarda.
Devuelve el estado y lo incluye en la respuesta del envío.

También se recalcula cuando la funcionaria resuelve un documento (§8.2). No se recalcula sobre
`ACEPTADA`, `CERRADA` ni `BORRADOR`.

### 4.4 Solicitudes existentes

Las filas `EN_PROCESO` que ya existen se recalculan con el mismo `recalcularEstado` en el barrido
periódico (§9). Así no se duplica la regla en SQL.

## 5. 42a: Paz y Salvo de biblioteca (simulado)

Nuevo módulo `backend/src/biblioteca/`:

```ts
export type RespuestaPazYSalvo = 'paz_y_salvo' | 'con_deuda' | 'sin_respuesta';
export abstract class BibliotecaService {
  abstract consultarPazYSalvo(codigoEstudiante: string): Promise<RespuestaPazYSalvo>;
}
export class BibliotecaDemoService extends BibliotecaService { … }
```

- `BibliotecaDemoService` lee `backend/src/biblioteca/paz-y-salvo-demo.json`: una lista de códigos
  inventados que están a paz y salvo. Incluye `T00000001`, el estudiante de prueba de
  `02-userbase.sql`, para que el flujo completo se pueda probar. Si el código no está en la lista,
  responde `con_deuda`. No hay datos reales.
- El módulo registra `{ provide: BibliotecaService, useClass: BibliotecaDemoService }`. Cuando
  exista ALMA, solo cambia esa línea.
- En `AnalisisPreinscripcionService.procesar`, el PDF de Paz y Salvo se sigue guardando, pero su
  estado sale de la consulta:

  | Respuesta | Estado |
  |---|---|
  | `paz_y_salvo` | `VALIDO` |
  | `con_deuda` | `NO_VALIDO` |
  | `sin_respuesta` (también si la consulta lanza un error) | `POR_REVISAR` |

  El `detalle` guarda `{ fuente: 'biblioteca_demo', respuesta }` y un mensaje para el estudiante.
- `etapaDocumento` deja de decir «validación pendiente de integración».

## 6. 42a: doble programa con 7 documentos

- **Frontend** (`documentos-requeridos.ts`): `academic_evaluation` también lleva
  `unoPorPrograma: true`. Con segundo programa se agregan `academic_evaluation-2` («Evaluación de
  Grado (Banner) (segundo programa)») y `estampilla_pro_cultura-2`.
- **Backend**:
  - el envío, `validarArchivos` y los reenvíos usan la configuración (§4.1);
  - `validarRequisitosCompletos` exige cada requerido con su orden;
  - `normalizarTipoDocumento` reconoce `academic_evaluation-2`;
  - `etapaDocumento` nombra la evaluación 1 y la 2.
- `nombre_documento_notificacion` ya agrega «(segundo programa)» para el orden 2, así que no cambia.

## 7. 42a: reenvíos

Lo que ya cumple, y se cubre con pruebas:
- máximo 3 por día por solicitud, y la carga inicial no cuenta;
- un error técnico revierte la transacción y no consume intento;
- un documento `VALIDO` no se reemplaza;
- un documento `POR_REVISAR` sí se puede reenviar;
- `ACEPTADA` y `CERRADA` no admiten reenvíos.

Lo nuevo:
- **Plazo:** se rechaza el reenvío si la fecha en Bogotá es posterior a `fecha_fin − 7` del periodo
  de la solicitud (ese día está permitido). Responde 409 con «El plazo para corregir documentos
  terminó el {fecha}.».
- `detalle-analisis.ts` informa ese mismo plazo y `admite` (si se puede reenviar) lo tiene en
  cuenta.
- Saber Pro con 95 puntos que se reenvía igual sigue `NO_VALIDO`, porque el motor lo vuelve a
  analizar. Hay una prueba con el motor simulado.

## 8. 42a: decisiones de la funcionaria

### 8.1 Aceptar y anular (`POST /funcionario/solicitudes/:id/revisiones`)

- `aceptada`: solo si la solicitud está `VALIDA`. Si no, responde 409 con «Solo se puede aceptar
  una solicitud válida.». Pasa a `ACEPTADA` (antes pasaba a `VALIDA`).
- `anulada`: desde cualquier estado no final distinto de `BORRADOR`. Pasa a `CERRADA`, como hoy.
- `recarga`: queda bloqueada en `ACEPTADA`, como hoy en `VALIDA` y `CERRADA`.
- `comentario`: sigue permitido en cualquier estado.

### 8.2 Resolver un documento «Por revisar»

Nuevo `POST /funcionario/documentos/:id/resolucion` con
`{ resultado: 'VALIDO' | 'NO_VALIDO', comentario?: string }`. El comentario es obligatorio para
`NO_VALIDO` y tiene hasta 5000 caracteres.

- Solo aplica a la versión actual de un documento en `POR_REVISAR`, en una solicitud que no sea
  final. Si no, responde 409.
- En una transacción:
  1. cambia `documentos.estado`;
  2. agrega una `validaciones` de `tipo_validacion = 'MANUAL'` (se agrega al CHECK en 008), con
     `detalle = { funcionario, comentario }`, y su `historial_validaciones` `PENDIENTE → resultado`;
  3. agrega una `revisiones` con `resultado = 'DOCUMENTO_RESUELTO'` (se agrega al CHECK en 008),
     `documentos_ids = [id]` y el comentario;
  4. ejecuta `recalcularEstado`.
- **Aviso:** `notificar_revision()` gana una rama para `DOCUMENTO_RESUELTO`. Genera `success`
  («Documento validado») o `error` («Documento no válido») con el nombre del documento y el
  comentario.
- **Detalle (frontend):** cada documento `POR_REVISAR` muestra «Marcar válido» y «Marcar no
  válido», con confirmación. El selector de acciones solo habilita «Aceptar solicitud» si la
  solicitud está `VALIDA`.

## 9. 42a: anulación automática al cierre

Nuevo `PlazosSolicitudService` (en `SolicitudesModule`). Corre al iniciar y cada 15 minutos, con
el mismo patrón de `NotificacionesPlazosService`. En cada pasada:

1. Recalcula las solicitudes `EN_PROCESO` (§4.4).
2. Anula las solicitudes `NO_VALIDA` o `INCONSISTENTE` cuyo periodo tiene `fecha_fin − 7` anterior
   a hoy en Bogotá. Las deja en `CERRADA` y crea con `crear_notificacion` un aviso `error`,
   «Solicitud anulada»: «El plazo para corregir terminó y tu solicitud tenía documentos sin
   corregir. Puedes inscribirte en un nuevo periodo.». Lo genera `system`, con clave
   `anulacion:{id}`, así que es idempotente.

Las solicitudes `POR_REVISAR` y `VALIDA` no se anulan al cierre: esperan la decisión de la
funcionaria.

## 10. 42b, 42c y 42d: dashboard

**Backend** (`solicitudesFuncionaria`):
- excluye `BORRADOR`;
- agrega `fechaEnvio`, la fecha de la entrega `INICIAL` en Bogotá (`YYYY-MM-DD`), y `envioEn`, su
  instante ISO, para mostrar la hora.

**Frontend** (`solicitudes-api.ts`, `datos.ts`, `page.tsx`, `GraficoEstados.tsx`):

| Estado en la base | Grupo del dashboard | Etiqueta |
|---|---|---|
| `VALIDA` | Válidas | Válida |
| `NO_VALIDA` | No válidas | No válida |
| `INCONSISTENTE` | Inconsistentes | Inconsistente |
| `POR_REVISAR`, `EN_PROCESO` | Por revisar | Por revisar |
| `ACEPTADA` | **Aceptadas** (nuevo) | Aceptada |
| `CERRADA` | **Anuladas** (nuevo) | Anulada |

- 42b: seis contadores con su porcentaje sobre el total filtrado.
- 42c: las barras y la dona incluyen los seis grupos con su alternativa en texto. Aceptada y
  Anulada reciben colores nuevos en `StatusBadge` y en las gráficas, con el contraste que exige
  `colores.spec`, en tema claro y oscuro.
- Filtro de fechas: compara `fechaEnvio`, ya en Bogotá. La columna «Fecha y hora» muestra `envioEn`.
- 42d: «No. solicitud» es el `id_solicitud`, y «Ver solicitud» abre
  `/funcionario/detalle_preinscripcion/{id}`. Ya funciona, y se cubre con prueba.
- El detalle usa las mismas etiquetas: `VALIDA` dice «Válida» (hoy dice «Aceptada»).

## 11. Pruebas

**Backend (vitest):**
- `estado-solicitud.spec.ts`: la tabla de casos de la issue. Posgrado con 3 válidos; posgrado sin
  estampilla; Saber Pro con 95; cédula inconsistente; programa 2 con requisito faltante; biblioteca
  no válida con cédula inconsistente. Además: un documento que el tipo no pide, versiones viejas, y
  `POR_VALIDAR`.
- `requisitos-documentales.spec.ts`: 5, 7 y 3 documentos; claves; `validarArchivos` con
  `academic_evaluation-2` y `saber_pro-2` (rechazado).
- Servicios con la base simulada, como los specs existentes:
  - envío y reenvío dejan el estado calculado y lo recalculan una sola vez;
  - el 4.º reenvío del día se rechaza;
  - `fecha_fin − 7` se permite y `fecha_fin − 6` se rechaza;
  - un envío con 3 documentos cuenta como 1 reenvío;
  - un documento `VALIDO` no se reenvía;
  - `ACEPTADA` bloquea los reenvíos;
  - aceptar solo si está `VALIDA`;
  - la resolución manual;
  - la anulación al cierre;
  - `BibliotecaDemoService` y sus tres respuestas.

**Base:** `db/tests/aceptacion.sql` agrega `ACEPTADA`, `MANUAL` y `DOCUMENTO_RESUELTO`, y su
rechazo de valores desconocidos.

**Frontend (Playwright):**
- el formulario de doble programa pide 7 documentos;
- el dashboard muestra 6 grupos, excluye borradores y filtra por la fecha de envío en Bogotá (una
  solicitud a las 20:00 del 31/10 cuenta el 31/10);
- el detalle resuelve un documento por revisar y solo deja aceptar una solicitud válida;
- axe y desbordes en los anchos existentes.

## 12. Entrega

- **PR 1** (`tarea_42a_validacion_integral` → `main`): §3 a §9.
- **PR 2** (`tarea_42bcd_dashboard`, apilado sobre el PR 1): §10.
- Cada cambio se referencia en un comentario aparte en #102. Héctor aprueba cada comentario antes
  de publicarlo.
