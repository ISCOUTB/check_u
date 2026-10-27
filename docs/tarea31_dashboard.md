# Tarea 31 — Dashboard del funcionario: filtros y periodos

El dashboard reúne la consulta de solicitudes en un panel de filtros desplegable y
la gestión de periodos en un diálogo modal. No se agregaron bloques sueltos a la
página.

## Organización de la interfaz

- **Filtros de búsqueda:** tarjeta con un botón de icono (filtro) que despliega
  cuatro grupos (`fieldset` + `legend`): periodo, nivel, fechas y estado. El botón
  usa `aria-expanded` y `aria-controls`, y el panel está oculto por defecto. Con el
  panel cerrado la cabecera no conserva el margen inferior; al abrirlo se recupera
  el espaciado entre el título y los filtros. La apertura y el cierre animan la
  altura, la opacidad y ese margen; con `prefers-reduced-motion` la transición se
  desactiva.
- **Fechas:** se conservan los campos inicial y final, la validación del rango y
  los botones Aplicar fechas y Limpiar fechas.
- **Estado:** se conservan los botones con `aria-pressed` y la opción Todas.
- **Periodos:** el botón Gestionar periodos abre un diálogo modal dividido en dos
  secciones: el formulario (nombre, fechas de inicio, finalización y graduación,
  estado) y el listado de periodos con la acción Editar. Al abrir el diálogo o al
  pulsar Editar, el foco pasa al primer campo del formulario.
- **Accesibilidad del diálogo:** usa `<dialog>` nativo con `showModal`, atrapa el
  foco, se cierra con Esc o con un clic en el fondo y devuelve el foco al botón que
  lo abrió.
- **Listado:** la tarjeta de solicitudes ya no repite los filtros; muestra el
  conteo, la tabla de escritorio o las tarjetas de celular según el ancho.
- **Responsive:** los filtros pasan de una columna a dos desde 900 px. El diálogo
  muestra formulario y listado en dos columnas desde 900 px y apilados en pantallas
  pequeñas, donde ocupa toda la pantalla.

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
- `e2e/dashboard.spec.ts`: 28 pruebas aprobadas. Incluyen accesibilidad y
  desborde en 320, 360, 768 y 1280 px, en tema claro y oscuro, con los filtros
  desplegados y el diálogo de periodos abierto.
- `e2e/base.spec.ts` y `e2e/colores.spec.ts`: 35 pruebas aprobadas.
- Las pruebas nuevas cubren el panel desplegable, el filtro de nivel, el rango de
  fechas, la creación de un periodo desde el modal y su edición desde el listado.
- Suite completa: 286 pruebas aprobadas y los 3 fallos preexistentes descritos
  abajo.

### Fallos anteriores de main

La suite completa de Playwright conserva tres fallos de `iniciar_preinscripcion.spec.ts`
que ya se reproducen sobre main sin los cambios de esta tarea:

- escribir puntos en el número de documento no encuentra `#campo-numeroDocumento-error`;
- pegar con puntos no encuentra el mismo error del campo;
- la prueba de campos obligatorios no encuentra `#campo-numeroDocumento`.

Esos fallos pertenecen al formulario de preinscripción y no se modificaron aquí.
