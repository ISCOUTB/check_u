# Tarea 43 — Mi solicitud de grado con datos reales

Issue: [#105](https://github.com/ISCOUTB/check_u/issues/105). Base: `main`, commit `c336ab9` (tarea 41 integrada mediante PR #104).

## Comportamiento

El bloque **Mi solicitud de grado** del inicio del estudiante dejó de usar datos de demostración. Ahora consulta `GET /api/estudiante/solicitud/analisis` y presenta la solicitud y el análisis documental realmente persistidos.

- **Tipo de solicitud:** muestra `PREGRADO` o `POSGRADO` según `estudiante.nivel` del detalle. En pregrado con doble programa añade `· doble programa`.
- **Periodo:** usa el periodo asignado a la solicitud; si aún no tiene uno, muestra el disponible. Presenta nombre, fecha de apertura y fecha de cierre como fechas calendario, sin convertir a UTC.
- **Progreso:** cuenta únicamente los requisitos en estado `valido` sobre el total exigido por el catálogo. La barra expone `aria-valuemin`, `aria-valuemax`, `aria-valuenow` y un `aria-valuetext` con el texto visible.
- **Requisitos:** combina el catálogo compartido `documentosRequeridos(nivel, segundoPrograma)` con los documentos reales del backend. Los documentos del catálogo sin registro se muestran como `falta_cargar`; los documentos reales que no estén en el catálogo se conservan al final.
- **Estados:** cada requisito muestra su estado real y sus observaciones. Un documento es `valido` solo si todas sus comprobaciones lo son. Si hay varias, se prioriza `no_valido`, luego `inconsistente`, luego `por_revisar`; un documento sin resultados queda `por_revisar`.
- **Observaciones:** se muestran los mensajes persistidos del backend, sin repetirlos. Si no hay mensaje, se usa el texto de referencia del estado. El estudiante ve `Corrección requerida` donde el sistema dice `no_valido`.
- **Carga de versiones:** un requisito `falta_cargar` ofrece `Subir documento`; uno con `resubmission_allowed` del backend ofrece `Subir nueva versión`. Ambos enlaces llevan a `/estudiante/preinscripcion`, donde ya existe el flujo de corrección y reenvío. La decisión de permitir el reenvío es exclusivamente del backend.
- **Errores:** si falla la consulta del análisis, la tarjeta muestra un error recuperable con `Reintentar`; no inventa requisitos ni estados.

## Requisitos por modalidad

| Modalidad | Requisitos |
| --- | --- |
| Pregrado | 5: identificación, evaluación Banner, paz y salvo, estampilla y Saber Pro. |
| Pregrado con doble programa | 6: los 5 anteriores más el segundo comprobante de estampilla (`estampilla_pro_cultura-2`). |
| Posgrado | 3: identificación, paz y salvo y estampilla. El doble programa no añade una segunda estampilla. |

El segundo comprobante se muestra al final, en el mismo orden que el catálogo y el formulario de preinscripción. El backend actual solo registra una segunda estampilla; no se asume una segunda evaluación Banner.

## Implementación

- `frontend/app/estudiante/home/resumen.ts`: lógica pura de construcción de requisitos, estados, observaciones, progreso y periodo.
- `frontend/app/estudiante/home/page.tsx`: consulta real, render del resumen y enlaces de carga.
- `frontend/app/estudiante/home/api.ts`: reexporta el detalle real y mantiene el cliente de notificaciones y los utilitarios de presentación.
- `frontend/app/estudiante/home/home.module.css`: estilos del panel de metadatos, progreso y observaciones.
- `frontend/app/estudiante/documentos-requeridos.ts`: catálogo compartido, sin cambios de contrato.

No se agregó un endpoint nuevo ni se duplicó la lógica de carga de documentos en el inicio.

## Pruebas automatizadas

```powershell
cd frontend
npx tsc --noEmit
npx eslint app/estudiante/home e2e/resumen_solicitud.spec.ts e2e/soporte.ts
npx playwright test
```

La suite completa del navegador queda en **356 pruebas aprobadas**. Incluye:

- `e2e/resumen_solicitud.spec.ts`: lógica de pregrado, doble programa y posgrado; prioridad de estados; observaciones; faltantes; progreso; periodo; formato de fechas; render real; enlaces de carga y error recuperable.
- `e2e/inicio.spec.ts`: accesibilidad, reflujo, estados como texto y valor de la barra de progreso.
- `e2e/solicitud_redireccion.spec.ts`, `e2e/bienvenida.spec.ts`, `e2e/carga_preinscripcion.spec.ts` e `e2e/iniciar_preinscripcion.spec.ts`: navegación según `/solicitudes/estado`, incluida la bienvenida sin solicitud y el detalle inexistente.
- `e2e/soporte.ts`: mocks compartidos de `/solicitudes/estado` y del detalle real del análisis, reemplazables por cada prueba.

## Archivos incluidos

- `frontend/app/estudiante/home/api.ts`
- `frontend/app/estudiante/home/home.module.css`
- `frontend/app/estudiante/home/page.tsx`
- `frontend/app/estudiante/home/resumen.ts`
- `frontend/e2e/bienvenida.spec.ts`
- `frontend/e2e/carga_preinscripcion.spec.ts`
- `frontend/e2e/iniciar_preinscripcion.spec.ts`
- `frontend/e2e/inicio.spec.ts`
- `frontend/e2e/resumen_solicitud.spec.ts`
- `frontend/e2e/solicitud_redireccion.spec.ts`
- `frontend/e2e/soporte.ts`
- `docs/tarea43_mi_solicitud_grado.md`
