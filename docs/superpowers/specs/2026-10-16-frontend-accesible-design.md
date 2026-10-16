# Frontend accesible y responsive (issue #36)

**Fecha:** 16/10/2026 · **Autor:** Héctor Cabarcas · **Issue:** ISCOUTB/check_u#36 · **Rama:** `frontend_accesible` (desde `main`)

Contexto obligatorio: `docs/PROMPT_BASE.md` y `frontend/AGENTS.md`. Este Next.js (16.x) tiene cambios incompatibles con versiones anteriores: antes de escribir código se lee la guía que aplique en `frontend/node_modules/next/dist/docs/`.

## 1. Objetivo y éxito

Rehacer el frontend de CheckU **manteniendo su estética y sus colores**: la paleta azul y minimalista de `estudiante/home`. El resultado tiene que ser **accesible (WCAG 2.2 AA)** y **responsive**, del celular al escritorio, **en tema claro y en tema oscuro**.

No cambian las pantallas, las rutas, el flujo ni los datos que se muestran. Cambia cómo están construidas.

**Criterios de aceptación:** los de la issue, más los de este diseño.
- [ ] Las mismas pantallas y el mismo flujo, con la estética y la paleta actuales.
- [ ] Ningún color fijo en los módulos del alcance: todos salen de los tokens de `globals.css`.
- [ ] axe (reglas WCAG 2.2 A/AA) sin violaciones en cada página, en los dos temas y a 360, 768 y 1280 px.
- [ ] Sin scroll horizontal a 360, 768 y 1280 px.
- [ ] Navegación completa con teclado y foco siempre visible.
- [ ] Corregidos los 3 errores conocidos y el diseño roto del login.
- [ ] `npm run lint`, `npm run build` y `npm run test:e2e` del frontend en verde.
- [ ] Resumen final: verificado / simulado / pendiente.

## 2. Lo que hay hoy

Revisado en el navegador el 16/10/2026:

1. **Clases muertas:** `layout.tsx` usa clases de Tailwind (`h-full`, `flex`, `min-h-full`, `antialiased`), pero `globals.css` no importa Tailwind, así que no hacen nada. *(Corrección del 16/10: este punto decía que por eso el login de escritorio ocupaba solo la esquina superior izquierda. Era una lectura equivocada del panel del navegador, que achica la ventana emulada; las capturas de `docs/capturas/issue-36/antes/` muestran que el login de antes se veía bien.)*
2. **Fondo:** `body` usa `var(--background)`, que no está definida, y queda transparente. Con el navegador en modo oscuro se ve negro debajo del contenido.
3. **Tipografía:** `layout.tsx` carga Geist, pero `body` usa Arial.
4. **Paletas:**
   - `estudiante/home` usa la paleta azul;
   - `globals.css` define una gris (`--primary: #1f2937`);
   - el dashboard y el detalle usan esa gris;
   - `detalle.css` escribe sus colores fijos.

   En total hay 140 colores fijos distintos.
5. **Contraste:**
   - 4 de los 5 chips de estado no llegan a AA (por ejemplo, "inconsistente" `#d9a928` sobre `#fff9e7`, 2.07:1);
   - el texto apagado `#94a3b8` queda en 2.56:1;
   - el borde de los campos `#e2e8f0`, en 1.23:1.
6. **Móvil:** a 375 px, la tabla del dashboard y las pestañas del detalle se salen de la pantalla. El inicio del estudiante sí se adapta.
7. **Errores:**
   - "Visualizar" del dashboard lleva a `/funcionario/detalle-preinscripcion?id=…` (404);
   - el detalle se abre sin sesión;
   - "¿Olvidaste tu contraseña?" es un `<a href="#">` que no hace nada.
8. **Estilos globales sueltos:** `detalle.css` es una hoja global. Sus clases (`.page-header`, `.tab-content`, `.outline-button`…) afectan a toda la aplicación.

## 3. Decisiones

| # | Tema | Decisión |
|---|---|---|
| 1 | Alcance | Todo el frontend **menos** `app/estudiante/preinscripcion/` (Tarea 16, #25, de Jorge, en curso). Absorbe la Tarea 17 (#28, de Javier: unificar colores); Héctor lo acuerda con él. |
| 2 | Estética | Se mantiene la de `estudiante/home`: paleta, jerarquía, radios, sombras suaves y tono minimalista. |
| 3 | Tipografía | **Geist**, con `next/font`, como ya se carga hoy. |
| 4 | Temas | **Claro y oscuro.** El oscuro se activa con `prefers-color-scheme: dark`, con la misma identidad en azul noche. Se declara `color-scheme: light dark`. |
| 5 | Enfoque | **Base compartida:** tokens + componentes que hoy se repiten + `useSesion`; las páginas se rehacen encima. |
| 6 | Pruebas | **Playwright + `@axe-core/playwright`**, como dependencias de desarrollo. |
| 7 | Tecnología | CSS Modules y variables, sin Tailwind ni librerías de interfaz, como piden las demás tareas del frontend. Chart.js se mantiene. |
| 8 | Contratos con la Tarea 16 | `Navbar` (`tipoUsuario`, `nombreUsuario`, `nivel?`) y `DocumentAnalysis` (`open`, `onClose`, `data`, y los tipos `DocumentAnalysisData`, `ExtractedField` y `ValidationResult`) **conservan sus props y tipos**. |
| 9 | "¿Olvidaste tu contraseña?" | Se queda. Al pulsarlo muestra el aviso "La recuperación de contraseña todavía no está disponible" en una región que se anuncia (`role="status"`). La recuperación es de la Tarea 13. |
| 10 | Datos | Siguen simulados en `api.ts` y `data.ts`, con sus marcas "SIMULADO". Los nombres de los estados en el código (`valido`, `no_valido`…) no cambian; pasarlos a los contratos de la Tarea 02 es de la Tarea 12. |
| 11 | Entrega | Un PR (`Closes #36`) con un commit por parte: base, login, navbar e inicio, dashboard, y detalle con análisis y conexión. |

## 4. Tokens y temas (`app/globals.css`)

Nombres semánticos: un componente nunca usa un color por su nombre, sino por su papel. Los valores claros son los de hoy donde ya cumplen.

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--color-bg` | `#f7f9fc` | `#0b1324` | Fondo de página |
| `--color-surface` | `#ffffff` | `#111c33` | Tarjetas, barra, diálogos |
| `--color-surface-muted` | `#f1f5f9` | `#18243f` | Zonas secundarias, filas alternas |
| `--color-title` | `#172554` | `#f1f5ff` | Títulos |
| `--color-text` | `#1e293b` | `#e2e8f0` | Texto |
| `--color-text-secondary` | `#64748b` | `#a5b4cb` | Texto secundario. Reemplaza al apagado `#94a3b8`. |
| `--color-accent` | `#2563eb` | `#2563eb` | Botón principal, que lleva texto blanco (5.17:1) |
| `--color-accent-hover` | `#1d4ed8` | `#1d4ed8` | Botón principal al pasar el mouse |
| `--color-accent-text` | `#2563eb` | `#7cb0ff` | Enlaces y texto de acento |
| `--color-accent-soft` | `#eff6ff` | `#142445` | Fondos de acento |
| `--color-border` | `#e2e8f0` | `#26324d` | Bordes decorativos (tarjetas, divisores) |
| `--color-border-control` | `#8090a6` | `#5b6b86` | Borde de campos y controles (≥ 3:1) |
| `--color-focus` | `#2563eb` | `#7cb0ff` | Anillo de foco |

**Estados.** Cada uno tiene tres tokens: `--status-<estado>-text`, `--status-<estado>-bg` y `--status-<estado>-mark`. El último es para puntos, íconos y gráficos (≥ 3:1).

| Estado | Texto (claro / oscuro) | Fondo (claro / oscuro) | Marca |
|---|---|---|---|
| `valid` | `#15803d` / `#6ee7a0` | `#edf8f2` / `#10291f` | `#2e9d67` |
| `invalid` | `#b91c1c` / `#fca5a5` | `#fff0f0` / `#33151a` | `#d95353` |
| `inconsistent` | `#854d0e` / `#fcd34d` | `#fff9e7` / `#2e2410` | `#b7791f` |
| `review` | `#1d4ed8` / `#93c5fd` | `#edf4fc` / `#142445` | `#638fc7` |
| `neutral` (procesando, falta cargar) | `#475569` / `#cbd5e1` | `#f1f5f9` / `#18243f` | `#64748b` |

**Contraste medido** (WCAG 2.x):
- texto principal: 13.9:1 en claro y 15:1 en oscuro;
- secundario: 4.76:1 en claro y 8:1 en oscuro;
- chips en claro: entre 4.61 y 6.51:1;
- chips en oscuro: más de 8:1;
- borde de los controles: 3.25:1 en claro y 3.14:1 en oscuro.

**Otros tokens:**
- **Tipografía:** `--font-sans` (Geist) y `font-variant-numeric: tabular-nums` para las cifras. Texto base de 15 px como mínimo; los campos llevan 16 px para que el celular no haga zoom.
- **Radios:** `--radius-control` 8 px, `--radius-icon` 12 px y `--radius-card` 14 px.
- **Sombra:** `--shadow-card` = `0 2px 8px rgba(15, 23, 42, 0.03)`, que se apaga en oscuro.
- **Espacios:** escala de 4 px (`--space-1` a `--space-8`).
- **Movimiento:**
  - curva `--ease-out` = `cubic-bezier(0.23, 1, 0.32, 1)` y duraciones de 160 a 200 ms;
  - el botón se presiona con `scale(0.97)`;
  - el hover solo aplica con `@media (hover: hover) and (pointer: fine)`;
  - con `prefers-reduced-motion` no hay movimiento, solo cambios de opacidad o color.

## 5. Componentes base (`app/components/ui/`)

Solo lo que hoy se repite. Cada componente lleva su `.module.css` y usa solo tokens.

| Componente | Responsabilidad |
|---|---|
| `Button` | Variantes `primary`, `secondary` y `ghost`. Es `<button>`, o un `Link` cuando lleva `href`. Mide como mínimo 44×44 px y tiene foco visible. En el estado `cargando` usa `aria-busy` y queda deshabilitado. |
| `StatusBadge` | `estado`: `valido`, `no_valido`, `inconsistente`, `por_revisar`, `procesando` o `falta_cargar`. Muestra texto + ícono SVG (`aria-hidden`). Las etiquetas son "Válido", "No válido", "Inconsistente" y "Por revisar" (las de `mapeo.json`), más "Procesando" y "Falta cargar" (las de hoy en el inicio). Reemplaza las 4 implementaciones actuales. |
| `Card` | `<section>` con un título opcional enlazado por `aria-labelledby`. |
| `PageHeader` | Ruta de navegación opcional (`nav` con `aria-label="Ruta"` y `aria-current="page"`), etiqueta, un `h1` y descripción. |
| `Field` | Etiqueta visible, campo de 16 px, ayuda y error, enlazados con `aria-describedby`. Lleva `aria-invalid` cuando hay error. |
| `Dialog` | Sobre `<dialog>` nativo con `showModal()`: atrapa el foco, se cierra con Esc y deja el fondo inerte. Al cerrar devuelve el foco al disparador. El título va enlazado por `aria-labelledby`. Entra con opacidad y `scale(0.97)` en 200 ms. |
| `Tabs` | Patrón ARIA `tablist`: tabulación itinerante (solo la pestaña activa entra en el orden de Tab), flechas, Inicio y Fin. Cada panel es `tabpanel` y lleva `aria-labelledby`. |

**`app/lib/useSesion.ts`:** `useSesion(rolRequerido: "estudiante" | "funcionario")` devuelve `{ usuario, cargando }`.
- Consulta `GET ${NEXT_PUBLIC_API_URL}/auth/me` con `credentials: "include"`.
- Sin sesión, o si falla, redirige a `/`.
- Con el otro rol, redirige al inicio de ese rol.
- Mientras carga, la página muestra un esqueleto (`aria-busy` en `main`).

Reemplaza el bloque copiado en cada página. Jorge puede usarlo en la Tarea 16.

**`app/layout.tsx`:** se quitan las clases muertas de Tailwind y se aplica Geist con `className` en `<html>`. Se agrega un enlace "Saltar al contenido", que aparece al recibir el foco y lleva a `#contenido`. `<html lang="es">` se mantiene.

## 6. Páginas

Se construyen para celular primero, con cortes en 768 px (tableta), 1024 px (dos columnas) y un ancho máximo de contenido de unos 1200 px. Cada página tiene un único `<main id="contenido">`.

| Página | Cambios |
|---|---|
| **Login** (`app/page.tsx`) | **Distribución:** ocupa toda la pantalla; desde 1024 px el formulario y la foto van lado a lado, y en celular la foto pasa a ser una franja arriba. **Formulario:** campos con `Field`; el error se anuncia (`role="alert"`) y se enlaza a los campos; el botón muestra "Ingresando…" con `aria-busy`. **Foto:** es decorativa (`alt=""`), porque su mensaje ya está en el texto. **Contraseña olvidada:** "¿Olvidaste tu contraseña?" pasa a ser un botón que muestra el aviso de la decisión 9. |
| **Navbar** | Mismas props. Va en `<header>` con `<nav aria-label="Principal">`. **Menú de usuario:** es un botón con `aria-expanded` y `aria-controls`; se cierra con Esc o al hacer clic afuera, y devuelve el foco. **Logo:** lleva un `alt` útil. En celular cabe sin desbordarse. |
| **Inicio del estudiante** | Misma distribución: dos columnas desde 1024 px y una en celular. **Estados:** los chips pasan a `StatusBadge`. **Progreso:** la barra expone `aria-valuenow`, `aria-valuemin`, `aria-valuemax` y `aria-valuetext`. **Notificaciones:** son una lista (`ul`) con `<time>`. Los botones "Subir documento" y "Subir nueva versión" siguen llevando a `/estudiante/preinscripcion`. |
| **Dashboard** | **Contadores:** las 4 tarjetas son figuras con etiqueta, marca de color y texto. **Gráficos:** siguen con Chart.js; toman los colores de los tokens leyéndolos en tiempo de ejecución, así que funcionan en oscuro. Cada uno va en un `<figure>` con `figcaption`, un resumen y una tabla de datos que solo leen los lectores de pantalla. **Filtros:** son botones con `aria-pressed`; el conteo ("5 solicitudes") se anuncia con `aria-live="polite"`. **Tabla:** desde 768 px es una tabla real, con `caption` y encabezados `scope="col"`; en celular cada fila es una tarjeta. **Botón "Visualizar":** lleva a `/funcionario/detalle_preinscripcion/<id>` y su nombre accesible es "Ver solicitud GR-2026-001". |
| **Detalle de la solicitud** | **Estilos:** `detalle.css` pasa a ser `detalle.module.css` y deja de haber clases globales. **Comportamiento:** usa `useSesion("funcionario")`; las tres pestañas usan `Tabs`. **Contenido:** la ruta de navegación usa `PageHeader`; los campos de solo lectura (`ReadOnlyField`) son una lista `dl`/`dt`/`dd`; el estado general es una caja con título; las pestañas se ajustan al ancho del celular. **Botón "Revisar":** abre `DocumentAnalysis`. |
| **Análisis automático** (`DocumentAnalysis`) | Mismas props y tipos, construido sobre `Dialog`. Cada validación muestra ícono + texto ("Cumple" / "No cumple"); los campos extraídos son una lista `dl`. |
| **Prueba de conexión** (`app/connect`) | Tokens y `PageHeader`. El resultado se anuncia con `role="status"` y el error con `role="alert"`. |

## 7. Pruebas (Playwright, en `frontend/`)

**Herramientas:**
- dependencias de desarrollo: `@playwright/test` y `@axe-core/playwright`;
- configuración en `frontend/playwright.config.ts`;
- pruebas en `frontend/e2e/`;
- comando `npm run test:e2e`.

**Arranque y backend falso:**
- Playwright levanta `next dev -p 3001` (`webServer`), y la primera vez se instala su Chromium con `npx playwright install chromium`.
- **El backend no hace falta:** las pruebas interceptan `**/api/auth/me`, `**/api/auth/login`, `**/api/auth/logout` y `**/api/health` con `page.route`. Un ayudante, `sesionComo(page, rol | null)`, fija el usuario.

**Matriz:** las 5 páginas × los 2 temas (`page.emulateMedia({ colorScheme })`) × los 3 anchos (360, 768 y 1280). En cada combinación:
- `new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])` da **0 violaciones**;
- `document.documentElement.scrollWidth <= innerWidth`: sin scroll horizontal.

**Comportamientos:**
- **Navegación:**
  - el primer Tab enfoca "Saltar al contenido", y al activarlo el foco pasa a `#contenido`;
  - el menú del Navbar se abre con Enter, se cierra con Esc y devuelve el foco al botón;
  - el foco siempre es visible: el elemento enfocado tiene `outline` o `box-shadow` distintos de `none`.
- **Diálogo y pestañas:**
  - el diálogo de análisis atrapa el foco con Tab, se cierra con Esc y devuelve el foco al botón "Revisar";
  - las pestañas del detalle se mueven con las flechas y solo la activa tiene `tabindex="0"`.
- **Sesión:**
  - el detalle sin sesión redirige a `/`;
  - el estudiante que entra al dashboard termina en su inicio, y viceversa.
- **Correcciones:**
  - "Visualizar" lleva a `/funcionario/detalle_preinscripcion/GR-2026-001`;
  - "¿Olvidaste tu contraseña?" muestra su aviso;
  - un login fallido anuncia el error y marca los campos con `aria-invalid`.

**Al final:** `npm run lint`, `npm run build` y `npm run test:e2e`; el detector de Impeccable sobre los archivos cambiados; capturas de cada página en los dos temas, en celular y escritorio, para el PR; y una revisión final de toda la rama con un revisor independiente.

## 8. Fuera de alcance

- `app/estudiante/preinscripcion/` (Tarea 16). Cuando se fusione, se le aplican los tokens; eso queda fuera de este PR.
- Conectar las pantallas a datos reales (tareas 05 y 12) y renombrar los estados a los contratos de la Tarea 02 (Tarea 12).
- La recuperación de contraseña y los roles reales (Tarea 13).
- Cambiar rutas, salvo el enlace roto de "Visualizar".
- Un selector manual de tema: el tema sigue al sistema.

## 9. Riesgos

- **Next.js 16:** tiene cambios incompatibles. Se lee la guía de `node_modules/next/dist/docs/` antes de tocar `layout.tsx`, la carga de fuentes y los componentes de cliente.
- **Choque con la Tarea 16:** la rama de Jorge solo toca `estudiante/preinscripcion/`, pero usa `Navbar`, que conserva sus props. Su página quedará con los colores viejos hasta que adopte los tokens.
- **Chart.js y el tema oscuro:** el `canvas` no lee variables CSS. Los colores se leen con `getComputedStyle` al dibujar, y el gráfico se redibuja si cambia el tema.
- **Tamaño del cambio:** son unas 5.000 líneas. Para que se pueda revisar por partes va un commit por parte, y la suite de Playwright protege el resultado.
