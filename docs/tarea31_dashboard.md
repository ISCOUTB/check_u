# Tarea 31 — Dashboard del funcionario: filtros unificados y periodos

El dashboard agrupa en un solo panel el periodo de grado, el nivel académico, el
rango de fechas y el estado de la solicitud. La gestión de periodos se abre desde
ese mismo panel, sin agregar otro bloque suelto a la página.

## Organización de la interfaz

- **Filtros de búsqueda:** tarjeta única con cuatro grupos (`fieldset` + `legend`):
  periodo, nivel, fechas y estado.
- **Fechas:** se conservan los campos inicial y final, la validación del rango y
  los botones Aplicar fechas y Limpiar fechas.
- **Estado:** se conservan los botones con `aria-pressed` y la opción Todas.
- **Periodos:** el botón Gestionar periodos abre el formulario y la lista de
  periodos dentro de la misma tarjeta. Al abrir o al pulsar Editar, el foco pasa
  al primer campo del formulario.
- **Listado:** la tarjeta de solicitudes ya no repite los filtros; muestra el
  conteo, la tabla de escritorio o las tarjetas de celular según el ancho.
- **Responsive:** los grupos pasan de una columna a dos desde 900 px y los
  controles ocupan el ancho disponible en pantallas pequeñas.

No se eliminaron filtros, opciones ni acciones. Los datos de demostración y las
reglas de consulta de solicitudes se mantienen iguales.

## Pruebas

Se actualizaron las pruebas de navegador para el dashboard actual:

```powershell
cd frontend
npm run lint
npm run build
npx playwright test e2e/dashboard.spec.ts
npx playwright test e2e/base.spec.ts e2e/colores.spec.ts
```

Resultados comprobados al preparar el parche:

- ESLint y `next build` pasan.
- `e2e/dashboard.spec.ts`: 19 pruebas aprobadas, incluidas accesibilidad y
  desborde en 320, 360, 768 y 1280 px, en tema claro y oscuro.
- `e2e/base.spec.ts` y `e2e/colores.spec.ts`: 35 pruebas aprobadas.
- Las pruebas nuevas cubren el panel unificado, el filtro de nivel, el rango de
  fechas y la creación de un periodo desde el dashboard.

### Fallos anteriores de main

La suite completa de Playwright conserva tres fallos de `iniciar_preinscripcion.spec.ts`
que ya se reproducen sobre main sin los cambios de esta tarea:

- escribir puntos en el número de documento no encuentra `#campo-numeroDocumento-error`;
- pegar con puntos no encuentra el mismo error del campo;
- la prueba de campos obligatorios no encuentra `#campo-numeroDocumento`.

Esos fallos pertenecen al formulario de preinscripción y no se modificaron aquí.
