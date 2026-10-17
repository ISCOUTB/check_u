# CheckU · frontend

Interfaz web de CheckU en **Next.js 16** (React 19). Tiene las pantallas del estudiante y del personal de grados, y consume la API del [backend](../backend/README.md).

> Esta versión de Next.js tiene cambios importantes frente a versiones anteriores: antes de programar, lee [`AGENTS.md`](AGENTS.md) y la documentación en `node_modules/next/dist/docs/`.

## Requisitos

- **Node.js 22 LTS** (como mínimo 20.9, que es lo que exige Next.js).
- El **backend** corriendo en http://localhost:3000. Sin él no funciona el inicio de sesión.

## Instalación

Desde `frontend/`:

```bash
npm ci
```

## Configuración

Copia `.env.example` como `.env.local`, que no se sube a git:

| Variable | Valor en desarrollo | Para qué |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000/api` | URL de la API del backend, con el prefijo `/api`. Sin ella, el login muestra "No está configurada la URL del backend." |

## Ejecutar

```bash
npm run dev
```

Abre **http://localhost:3001**. El frontend usa el puerto 3001 porque el backend ocupa el 3000, y el CORS del backend solo acepta `localhost:3001`.

**Usuarios de prueba:** los del [README del backend](../backend/README.md#endpoints).

Para producción: `npm run build` y luego `npm run start`. `start` no fija puerto: usa el 3000, o el que indique `PORT`.

## Pruebas y calidad

```bash
npm run test:e2e
```
Pruebas de accesibilidad y responsive con Playwright y axe (`e2e/`). Levantan `npm run dev` solas, o reutilizan el que ya esté corriendo en el 3001. **No necesitan el backend:** cada prueba simula sus respuestas.

La primera vez hay que descargar el navegador de Playwright:

```bash
npx playwright install chromium
```

Qué se revisa:
- **axe:** cada página pasa las reglas WCAG 2.2 A/AA en los temas claro y oscuro, a 320, 360, 768 y 1280 px.
- **Desborde:** a ninguno de esos anchos hay scroll horizontal.
- **Teclado:** saltar al contenido, el menú de usuario, las pestañas y el diálogo (atrapa el foco, Esc lo cierra y el foco vuelve). Además, el foco nunca queda tapado por la barra superior.
- **Sesión:** sin sesión la página lleva al login, y con el otro rol, a su propio inicio.
- **Colores fijos:** no hay ninguno en los `.css` (`e2e/colores.spec.ts`).

```bash
npm run lint
```
ESLint (configuración de Next.js).

```bash
npm run build
```
Compila y comprueba los tipos.

## Diseño

La estética es la del inicio del estudiante: la paleta azul, tarjetas blancas y un estilo minimalista. Tiene **tema claro y oscuro**, y sigue la preferencia del sistema.

- **Colores:** solo los tokens de [`app/globals.css`](app/globals.css), nombrados por su papel (`--color-text`, `--color-accent`, `--status-valid-text`…). Cada par de colores tiene su contraste AA medido en el [spec](../docs/superpowers/specs/2026-10-16-frontend-accesible-design.md).
  - Nada de `#hex` ni `rgb()` en los módulos: si falta un color, se agrega un token en los dos temas.
  - No uses `--color-text-secondary` sobre `--color-surface-muted`: en claro no llega a 4.5:1.
- **Componentes base** en [`app/components/ui/`](app/components/ui):

  | Componente | Para qué |
  |---|---|
  | `Button` | Botón o enlace (con `href`), de 44 px como mínimo y con estado de carga |
  | `Field` | Campo con etiqueta visible y error enlazado |
  | `Card` | Sección con título |
  | `PageHeader` | Título de página, con ruta de navegación opcional |
  | `StatusBadge` | Estado con ícono y texto (nunca solo color) |
  | `Dialog` | Diálogo modal sobre `<dialog>` nativo |
  | `Tabs` | Pestañas con el patrón ARIA |
  | `Icono` | Íconos SVG de trazo |

- **Sesión:** `useSesion(rol)` en [`app/lib/useSesion.ts`](app/lib/useSesion.ts) consulta `/auth/me` y redirige según el rol. Úsalo en vez de copiar el `fetch`.
- **Estructura de cada página:** un único `<main id="contenido" tabIndex={-1}>`, y `aria-busy` mientras carga. Cada ruta tiene su título en un `layout.tsx`.
- **Movimiento:** 200 ms como máximo con `--ease-out`, hover solo con mouse (`@media (hover: hover)`), y nada se mueve con `prefers-reduced-motion`.

## Páginas

| Ruta | Qué es | Estado |
|---|---|---|
| `/` | Inicio de sesión | Conectado al backend |
| `/connect` | Prueba de conexión con el backend | Conectado |
| `/estudiante/home` | Inicio del estudiante | La sesión es real (`/auth/me`); la solicitud activa, las notificaciones y la política de reenvíos son datos simulados (ver `app/estudiante/home/api.ts`) |
| `/estudiante/preinscripcion` | Carga de documentos | Página provisional; la real es otra tarea |
| `/funcionario/dashboard` | Solicitudes del personal de grados | La sesión es real; las solicitudes son datos simulados (`datos.ts`) |
| `/funcionario/detalle_preinscripcion/[id]` | Detalle de una solicitud | La sesión es real; los datos son simulados (`datos.ts`) y son los mismos para cualquier número |
