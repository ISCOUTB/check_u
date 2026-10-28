# Tarea 35: periodo automático de inscripción

Issue: https://github.com/ISCOUTB/check_u/issues/83

Base de implementación: `a6566fac0917e8251e82ac443896b0319f59654b`.

## Comportamiento

El backend consulta `periodos_grado` y utiliza la fecha calendario de `America/Bogota`,
independientemente de la zona horaria del servidor o del navegador.

Un periodo es elegible cuando:

- Su estado administrativo es `ABIERTO`.
- `fecha_inicio <= hoy`.
- `hoy < fecha_fin - 7`.

El día de inicio está incluido. El día de corte está excluido. Si el periodo termina
el 30 de noviembre, desde el 23 de noviembre no recibe nuevas asignaciones. La resta
se realiza con fechas de PostgreSQL, en días calendario.

Si varios periodos son elegibles, se elige el primero por `fecha_inicio ASC`, después
`fecha_fin ASC` y finalmente `id ASC`. Esta regla hace determinista el resultado.

Los periodos futuros habilitados se muestran por fecha ascendente, hasta cinco.
No se asignan automáticamente. Se sigue la regla explícita de los criterios finales
del issue: el futuro es informativo. Esto resuelve la contradicción con el paso 1.2.6,
que sugería buscar un futuro para asignarlo.

## Persistencia y compatibilidad

La selección se ejecuta dentro de la transacción de guardado. `FOR SHARE` mantiene
estable el periodo seleccionado frente a un cierre o edición concurrente hasta
confirmar la transacción. El guardado conserva el bloqueo existente del estudiante
y de su solicitud para evitar crear borradores duplicados.

El periodo queda persistido en `solicitud_grado.id_periodo`, con la relación existente
a `periodos_grado.id`. No se agregan columnas, dependencias ni migraciones nuevas.
La base de datos local debe tener aplicado el esquema actual de `main`.

- Un borrador con periodo conserva su identificador aunque cambien las fechas o
  la funcionaria cierre ese periodo. Guardar y recargar no lo reasignan.
- Un borrador histórico con `id_periodo NULL` recibe su primera asignación en el
  siguiente guardado, si existe un periodo elegible. No se reasigna ningún periodo
  previamente vinculado ni se realiza un relleno masivo de registros históricos.
- Abrir el formulario mediante GET no crea ni modifica solicitudes.
- Sin periodo elegible, POST devuelve HTTP 409 y `SIN_PERIODO_DISPONIBLE`. La
  transacción revierte cualquier creación o cambio, y el frontend conserva lo
  diligenciado en memoria. Al recargar sin haber guardado, esos cambios se pierden.
- El envío directo también comprueba que la solicitud tenga su periodo, para no
  permitir omitir la regla saltándose el guardado del borrador.
- El identificador del periodo enviado por el cliente no se utiliza para asignar.
- La condición de fechas válidas ya está protegida por los tipos y restricciones
  del esquema. Las consultas también descartan rangos con inicio posterior al fin.

## API e interfaz

Se reutilizan GET y POST `/api/solicitudes/borrador`, con sesión y rol estudiante.
Sus respuestas incluyen un objeto `periodos` separado de los campos editables:

```text
fechaActual
periodoAsignado       objeto o null
periodoDisponible     candidato vigente o null
proximosPeriodos      lista informativa
```

Cada periodo contiene `id`, `nombre`, `fechaInicio`, `fechaFin`, `fechaGraduacion`,
`fechaCorte` y `estado`. Las fechas son cadenas `AAAA-MM-DD`, sin conversión a UTC
en el frontend. No se realizan consultas adicionales desde el formulario.

El componente `PeriodoInscripcion` se integra en `FormularioPreinscripcion`, que
es el formulario renderizado por `page.tsx`. Antes del primer guardado muestra el
periodo disponible como candidato; tras confirmarse el guardado muestra el periodo
asignado. Incluye inicio, fin, corte y próximos periodos, sin selector para el estudiante.

Los fallos de carga muestran el error existente del formulario. La ausencia de un
periodo es un resultado informativo válido, diferente de un error de consulta.
La falta de periodo al guardar tiene un mensaje propio, sin confundirse con una
solicitud ya enviada ni mostrar SQL.

## Verificación

Desde la raíz del repositorio:

```powershell
npm --prefix backend run build
npm --prefix backend test -- src/periodos/asignacion-periodo.spec.ts src/solicitudes/errores-borrador.spec.ts
npm --prefix backend run test:e2e -- --no-file-parallelism
```

Desde `frontend`:

```powershell
npx next typegen
npx tsc --noEmit
npx playwright test e2e/periodo_inscripcion.spec.ts e2e/borrador_mensajes.spec.ts e2e/preinscripcion_api.spec.ts e2e/preinscripcion_validacion.spec.ts
```

Si Playwright solicita el navegador: `npx playwright install chromium`, ejecutado
desde `frontend`. No necesita un backend real para estas pruebas del navegador.
Las pruebas de la API utilizan PostgreSQL embebido PGlite y el esquema real, sin Docker.
Los periodos sintéticos se crean únicamente en las bases aisladas de las pruebas;
no se agregan al seed de la aplicación ni a la base del desarrollador.

Resultados de la implementación:

- Compilación del backend y tipos del frontend correctos.
- 49 pruebas unitarias focalizadas aprobadas, excluyendo los cuatro casos previos
  del bloque de segundo programa descritos más abajo.
- 42 pruebas de API aprobadas, incluidas 19 de esta tarea.
- 78 pruebas del frontend aprobadas: 65 de lógica, 8 de mensajes y 5 de periodos.
- Límites temporales, cambio de día de Bogotá, conservación del periodo, futura
  inscripción informativa, rechazo sin periodo, protección de sesión/rol y rollback.
- Accesibilidad y ausencia de desborde a 320 px, tanto en tema claro como oscuro.

La suite unitaria completa conserva cinco fallas previas de `main`: una de
`contratos/exportar.spec.ts` por el contrato exportado desactualizado y cuatro del
bloque de segundo programa en `solicitudes.service.spec.ts`, cuyos mocks no incluyen
el bloqueo inicial y las consultas del guardado actual. Esta tarea no corrige ese
comportamiento ajeno a la asignación de periodos. No debe reportarse la suite completa
como aprobada. Los casos nuevos y las pruebas afectadas fuera de ese bloque sí pasan.

## Prueba manual breve

1. Arrancar PostgreSQL, backend en 3000 y frontend en 3001 con la configuración habitual.
2. Revisar que `solicitud_grado` tenga `id_periodo`. Un `git pull` actualiza archivos,
   pero no modifica las tablas del contenedor. Si la base es antigua, aplicar el
   esquema compatible actual `db/init/01-schema.sql`, que ya incluye el ALTER y la FK.
   No borrar la base ni su volumen.
3. Ingresar como funcionaria a `/funcionario/dashboard` y gestionar periodos. Crear
   uno ABIERTO que incluya hoy y cuya finalización esté a más de siete días. Crear
   otro futuro para comprobar la lista informativa.
4. Ingresar como estudiante a `/estudiante/iniciar_preinscripcion?nivel=PREGRADO`.
   Guardar un cambio y comprobar que el periodo pasa de disponible a asignado.
5. Recargar y comprobar que se conserva. Un borrador que ya tenía periodo mostrará
   directamente el asignado. Puede comprobarse la FK con la siguiente consulta.

```sql
SELECT sg.id_solicitud, sg.id_estudiante, sg.estado, sg.id_periodo, pg.nombre
FROM solicitud_grado sg
LEFT JOIN periodos_grado pg ON pg.id = sg.id_periodo;
```

Las pruebas automáticas cubren el caso sin periodo y el día exacto de corte sin
necesidad de cambiar el reloj del equipo ni borrar solicitudes existentes.

## Ajuste de presentación

El formulario muestra una línea con el nombre del periodo y un botón circular `?`.
El botón abre el diálogo informativo existente, conservando todos los detalles,
las fechas y los próximos periodos del bloque original. Se cierra mediante X,
Escape o clic fuera y devuelve el foco al botón de ayuda. La asignación automática
y las validaciones del backend mantienen su comportamiento.

Validación del ajuste: generación de tipos de Next.js y `tsc --noEmit` correctos.
Las pruebas de navegador se actualizaron para abrir el modal y comprobar sus
cierres, pero no pudieron ejecutarse en este entorno: Chromium no está instalado
y su descarga devolvió un ZIP incompleto. No se reportan como aprobadas.
