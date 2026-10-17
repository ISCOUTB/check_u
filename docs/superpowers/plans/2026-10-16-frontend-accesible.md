# Frontend accesible y responsive: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rehacer el frontend de CheckU con la estética actual, en tema claro y oscuro, accesible (WCAG 2.2 AA) y responsive, con pruebas que lo demuestren.

**Architecture:** Hay tres capas:
- tokens semánticos en `globals.css` (claro y oscuro);
- pocos componentes base en `app/components/ui/` y el hook `useSesion`;
- las páginas, que se rehacen encima conservando sus datos simulados.

Las pruebas de Playwright corren contra `next dev` con el backend falso (`page.route`), y axe revisa cada página en los dos temas y en cuatro anchos.

**Tech Stack:** Next.js 16.3.8 (App Router), React 19.2, TypeScript, CSS Modules, Chart.js 4, `next/font` (Geist), `@playwright/test` 1.64.1 y `@axe-core/playwright` 4.14.0.

**Spec:** `docs/superpowers/specs/2026-10-16-frontend-accesible-design.md`

## Global Constraints

- Lee `frontend/AGENTS.md` y, antes de tocar layouts, fuentes o metadatos, la guía que aplique en `frontend/node_modules/next/dist/docs/` (`01-app/01-getting-started/03-layouts-and-pages.md`, `13-fonts.md` y `14-metadata-and-og-images.md`).
- Sin Tailwind ni librerías de interfaz: CSS Modules y variables. Chart.js se mantiene.
- Fuera de alcance: no se toca nada en `frontend/app/estudiante/preinscripcion/` (Tarea 16).
- `Navbar` conserva sus props (`tipoUsuario: "estudiante" | "funcionario"`, `nombreUsuario: string`, `nivel?: "PREGRADO" | "POSGRADO"`).
- `DocumentAnalysis` conserva sus props (`open`, `onClose`, `data?`) y sus tipos exportados (`DocumentAnalysisData`, `ExtractedField`, `ValidationResult`, con `status: "VALIDO" | "NO_VALIDO" | "INCONSISTENTE" | "POR_REVISAR"`).
- Los datos siguen simulados en `api.ts` y `data.ts`, con sus marcas "SIMULADO". Los nombres de estado del código (`valido`, `no_valido`…) no cambian.
- Colores: solo tokens de `globals.css` (sección 4 del spec), con los valores exactos de las tablas del spec. Ningún `#hex` ni `rgb()` en los `.module.css` del alcance.
- Componentes del alcance:
  - etiquetas de estado: "Válido", "No válido", "Inconsistente", "Por revisar", "Procesando" y "Falta cargar";
  - zonas táctiles de 44×44 px como mínimo;
  - campos de 16 px;
  - movimiento de 200 ms como máximo con `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, hover solo con `@media (hover: hover) and (pointer: fine)` y nada que se mueva con `prefers-reduced-motion: reduce`.
- Aviso de contraseña, texto exacto: "La recuperación de contraseña todavía no está disponible."
- Textos de la interfaz en español; código y nombres como los que ya usa el frontend.
- Commits: un commit por tarea, con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` al final del mensaje.

## Review Focus

1. **Foco tapado por la barra sticky** (WCAG 2.4.11): al tabular hacia arriba, el elemento enfocado nunca queda debajo del `Navbar`. Prueba en la Tarea 3.
2. **Reflujo a 320 px** (WCAG 1.4.10, equivale a un zoom del 400 % en 1280): sin scroll horizontal también a 320, no solo a 360. Se cubre en el ayudante de la Tarea 1, que corre en todas las páginas.
3. **Nombres largos:** un usuario de 45 o más caracteres no desborda el `Navbar` a 320 px, y el nombre completo sigue disponible para el lector de pantalla. Prueba en la Tarea 3.
4. **Backend caído en el login:** si la red falla, se anuncia "No fue posible conectar con el servidor." y el botón vuelve a "Iniciar sesión". Prueba en la Tarea 2.
5. **Cambio de tema con la página abierta:** los gráficos del dashboard se redibujan con los colores del tema nuevo. Prueba en la Tarea 4.

**Rulings respecto al spec** (en el plan, para que el ejecutor no los decida en secreto):
- El reflujo se revisa también a 320 px (Review Focus 2).
- Cada ruta tiene su propio título (WCAG 2.4.2), porque el anunciador de rutas de Next lee `document.title`. Por eso el login se divide en una página servidor que exporta `metadata` y un formulario cliente.

---

## Archivos

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `frontend/playwright.config.ts`, `frontend/e2e/soporte.ts` | Configuración y ayudantes de prueba | 1 |
| `frontend/app/globals.css` | Tokens claro/oscuro, base y utilidad `.solo-lector` | 1 |
| `frontend/app/layout.tsx` | Geist, título por plantilla y enlace "Saltar al contenido" | 1 |
| `frontend/app/{estudiante/home,funcionario/dashboard,funcionario/detalle_preinscripcion/[id],connect}/layout.tsx` | Solo `metadata.title` | 1 |
| `frontend/app/components/ui/Button.tsx`, `Field.tsx` (+ `.module.css`) | Botón y campo | 2 |
| `frontend/app/page.tsx`, `frontend/app/components/login/FormularioLogin.tsx` (+ `.module.css`) | Login: la página servidor y el formulario cliente | 2 |
| `frontend/app/lib/useSesion.ts` | Sesión y redirecciones por rol | 3 |
| `frontend/app/components/ui/StatusBadge.tsx`, `Card.tsx`, `PageHeader.tsx` (+ `.module.css`) | Estado, tarjeta y encabezado | 3 |
| `frontend/app/components/navbar/*`, `frontend/app/estudiante/home/*` | Barra e inicio del estudiante | 3 |
| `frontend/app/funcionario/dashboard/page.tsx`, `dashboard.module.css`, `GraficoEstados.tsx`, `datos.ts` | Dashboard | 4 |
| `frontend/app/components/ui/Dialog.tsx`, `Tabs.tsx` (+ `.module.css`) | Diálogo y pestañas | 5 |
| `frontend/app/components/document_analysis/*` | Análisis automático, sobre `Dialog` | 5 |
| `frontend/app/funcionario/detalle_preinscripcion/[id]/page.tsx`, `detalle.module.css` (reemplaza `detalle.css`), `datos.ts` | Detalle | 5 |
| `frontend/app/connect/page.tsx`, `connect.module.css` | Prueba de conexión | 5 |
| `frontend/e2e/colores.spec.ts`, `frontend/README.md` | Barrera contra colores fijos y documentación | 6 |

---

### Task 1: Base. Pruebas, tokens, temas, Geist, títulos y "Saltar al contenido"

**Files:**
- Create: `frontend/playwright.config.ts`, `frontend/e2e/soporte.ts`, `frontend/e2e/base.spec.ts`
- Create: `frontend/app/estudiante/home/layout.tsx`, `frontend/app/funcionario/dashboard/layout.tsx`, `frontend/app/funcionario/detalle_preinscripcion/[id]/layout.tsx`, `frontend/app/connect/layout.tsx`
- Modify: `frontend/package.json` (devDependencies `@playwright/test@1.64.1` y `@axe-core/playwright@4.14.0`; script `"test:e2e": "playwright test"`), `frontend/.gitignore` (`/test-results/`, `/playwright-report/`), `frontend/tsconfig.json` (`"exclude": ["node_modules", "e2e", "playwright.config.ts"]`: Playwright compila sus pruebas solo y `next build` no debe revisarlas con `@types/node` 20), `frontend/app/globals.css`, `frontend/app/layout.tsx`, `frontend/app/page.tsx` (solo agregar `id="contenido" tabIndex={-1}` a su `<main>`)

**Interfaces:**
- Produces, desde `e2e/soporte.ts`:
  - `type Rol = "estudiante" | "funcionario"`;
  - `USUARIOS: Record<Rol, { id: number; username: string; name: string; role: Rol }>`: `{1, "estudiante@prueba.co", "Ana Prueba", "estudiante"}` y `{2, "funcionario@prueba.co", "Rafael Prueba", "funcionario"}`;
  - `API = "http://localhost:3000/api"`;
  - `sesionComo(page: Page, rol: Rol | null, nombre?: string): Promise<void>`: intercepta `${API}/auth/me` (200 `{ user }` o 401 `{ message: "Sesión no válida o expirada" }`), `${API}/auth/logout` (201) y `${API}/health` (200 `{ status: "ok", service: "CheckU API", message: "Backend conectado correctamente" }`);
  - `TEMAS = ["light", "dark"] as const` y `ANCHOS = [320, 360, 768, 1280] as const`;
  - `revisarPagina(page: Page, ruta: string, tema: "light" | "dark", ancho: number): Promise<void>`: fija el viewport `{ width: ancho, height: 900 }` y `emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })`, navega, espera `main#contenido:not([aria-busy="true"])`, corre axe con las etiquetas `["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]` y espera `violations` igual a `[]` (el mensaje lista `id` y `target`), y espera `scrollWidth <= innerWidth`.
- Produces, desde `globals.css`:
  - todos los tokens de la sección 4 del spec, con los nombres exactos `--color-*`, `--status-<valid|invalid|inconsistent|review|neutral>-<text|bg|mark>`, `--font-sans`, `--radius-control`, `--radius-icon`, `--radius-card`, `--shadow-card`, `--space-1` a `--space-8` y `--ease-out`;
  - la clase global `.solo-lector`, que oculta visualmente sin sacar del árbol de accesibilidad.
- Produces, desde `layout.tsx`: cada página debe tener un único `<main id="contenido" tabIndex={-1}>`.

- [ ] **Step 1: Instalar las herramientas de prueba**

Run: `cd frontend && npm install -D @playwright/test@1.64.1 @axe-core/playwright@4.14.0 && npx playwright install chromium`
Expected: `package.json` y `package-lock.json` con las dos dependencias de desarrollo y Chromium descargado.

- [ ] **Step 2: Escribir `playwright.config.ts` y `e2e/soporte.ts`**

Configuración:
- `testDir: "e2e"`, `use.baseURL: "http://localhost:3001"`, un proyecto `chromium` y `expect.timeout: 10000`;
- `webServer: { command: "npm run dev", url: "http://localhost:3001", reuseExistingServer: !process.env.CI, timeout: 120000 }`.

`soporte.ts` lleva las interfaces de arriba.

- [ ] **Step 3: Escribir la prueba que falla, `e2e/base.spec.ts`**

```ts
test.describe("base", () => {
  for (const [ruta, rol, titulo] of [
    ["/estudiante/home", "estudiante", "Inicio · CheckU"],
    ["/funcionario/dashboard", "funcionario", "Dashboard de preinscripciones · CheckU"],
    ["/funcionario/detalle_preinscripcion/GR-2026-001", "funcionario", "Detalle de preinscripción · CheckU"],
    ["/connect", null, "Prueba de conexión · CheckU"],
  ] as const) {
    test(`${ruta} tiene su propio título`, async ({ page }) => {
      await sesionComo(page, rol);
      await page.goto(ruta);
      await expect(page).toHaveTitle(titulo);
    });
  }

  for (const [tema, fondo, texto] of [
    ["light", "rgb(247, 249, 252)", "rgb(30, 41, 59)"],
    ["dark", "rgb(11, 19, 36)", "rgb(226, 232, 240)"],
  ] as const) {
    test(`fondo y texto salen de los tokens en tema ${tema}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: tema });
      await sesionComo(page, null);
      await page.goto("/connect");
      const estilos = await page.evaluate(() => {
        const s = getComputedStyle(document.body);
        return { fondo: s.backgroundColor, texto: s.color, esquema: getComputedStyle(document.documentElement).colorScheme };
      });
      expect(estilos).toEqual({ fondo, texto, esquema: "light dark" });
    });
  }

  test("la tipografía es Geist", async ({ page }) => {
    await sesionComo(page, null);
    await page.goto("/connect");
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toMatch(/Geist/);
  });

  test("el primer Tab enfoca «Saltar al contenido» y lleva al contenido", async ({ page }) => {
    await sesionComo(page, null);
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toHaveText("Saltar al contenido");
    await page.keyboard.press("Enter");
    expect(await page.evaluate(() => document.activeElement?.id)).toBe("contenido");
  });
});
```

- [ ] **Step 4: Verificar que falla**

Run: `cd frontend && npx playwright test e2e/base.spec.ts`
Expected: FAIL. Los títulos son "CheckU - Gestiona tu solicitud de grado", el fondo es `rgba(0, 0, 0, 0)`, la fuente es Arial y no hay enlace "Saltar al contenido".

- [ ] **Step 5: Implementar la base**

- **`globals.css`:**
  - los tokens claros en `:root` y los oscuros en `@media (prefers-color-scheme: dark) { :root { … } }`, con los valores exactos de la sección 4 del spec;
  - `:root { color-scheme: light dark; }`;
  - `html { scroll-padding-top: var(--altura-barra, 72px); }`;
  - `body` con `background: var(--color-bg)`, `color: var(--color-text)` y `font-family: var(--font-sans)`;
  - el foco global en `:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }`;
  - `.solo-lector`;
  - la regla de `prefers-reduced-motion`.

  Se eliminan `--background-e`, `--primary` y los tokens viejos `--valid` y similares. Por ahora se dejan alias temporales con los nombres viejos que apuntan a los nuevos, para que el inicio y el detalle no se rompan antes de las tareas 3 y 5; esas tareas los quitan.
- **`layout.tsx`:**
  - `Geist({ subsets: ["latin"], variable: "--font-geist-sans" })`, con `className={geist.variable}` en `<html lang="es">`;
  - `--font-sans: var(--font-geist-sans), system-ui, sans-serif` en `globals.css`;
  - se quitan las clases de Tailwind y `Geist_Mono`;
  - `metadata.title = { default: "CheckU", template: "%s · CheckU" }`;
  - el primer hijo de `<body>` es `<a href="#contenido" className="saltar-al-contenido">Saltar al contenido</a>`, una clase global visible solo con `:focus`.
- **Títulos de cada ruta:** cada `layout.tsx` de ruta exporta solo `metadata = { title: "<título sin sufijo>" }` y devuelve `children`.
- **`app/page.tsx`:** su `<main>` recibe `id="contenido" tabIndex={-1}`.

- [ ] **Step 6: Verificar que pasa**

Run: `cd frontend && npx playwright test e2e/base.spec.ts && npm run lint && npm run build`
Expected: 8 passed; lint y build sin errores.

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/.gitignore frontend/tsconfig.json frontend/playwright.config.ts frontend/e2e frontend/app/globals.css frontend/app/layout.tsx frontend/app/page.tsx frontend/app/estudiante/home/layout.tsx frontend/app/funcionario/dashboard/layout.tsx "frontend/app/funcionario/detalle_preinscripcion/[id]/layout.tsx" frontend/app/connect/layout.tsx
git commit -m "Frontend accesible: base de tokens, temas, Geist, títulos y pruebas"
```

---

### Task 2: Login

**Files:**
- Create: `frontend/app/components/ui/Button.tsx` + `Button.module.css`, `frontend/app/components/ui/Field.tsx` + `Field.module.css`, `frontend/app/components/login/FormularioLogin.tsx` + `FormularioLogin.module.css` (reemplaza a `app/page.module.css`, que se borra), `frontend/e2e/login.spec.ts`
- Modify: `frontend/app/page.tsx` (pasa a ser un componente servidor)

**Interfaces:**
- Consumes: `soporte.ts` y los tokens de la Tarea 1.
- Produces:
  - `Button` (default export):
    - `props = ButtonHTMLAttributes<HTMLButtonElement> & { variante?: "primario" | "secundario" | "sutil"; cargando?: boolean; textoCargando?: string; href?: string }`;
    - con `href` renderiza `next/link`;
    - con `cargando` muestra `textoCargando`, y lleva `aria-busy="true"` y `disabled`.
  - `Field` (default export):
    - `props = InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; error?: string; ayuda?: string }`;
    - el `id` sale de `useId()` si no se pasa;
    - el error va en un `<p id>` enlazado por `aria-describedby`, con `aria-invalid` cuando hay error.

- [ ] **Step 1: Escribir la prueba que falla, `e2e/login.spec.ts`**

```ts
test.describe("login", () => {
  for (const tema of TEMAS) for (const ancho of ANCHOS)
    test(`accesible y sin desborde (${tema}, ${ancho}px)`, async ({ page }) => {
      await sesionComo(page, null);
      await revisarPagina(page, "/", tema, ancho);
    });

  test("tiene su título", async ({ page }) => {
    await sesionComo(page, null);
    await page.goto("/");
    await expect(page).toHaveTitle("Iniciar sesión · CheckU");
  });

  test("a 1280px ocupa toda la pantalla, con el formulario y la foto lado a lado", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await sesionComo(page, null);
    await page.goto("/");
    const caja = await page.locator("main#contenido").boundingBox();
    expect(caja!.width).toBeGreaterThanOrEqual(1270);
    expect(caja!.height).toBeGreaterThanOrEqual(890);
    const form = await page.getByRole("form", { name: "Iniciar sesión" }).boundingBox();
    const foto = await page.getByTestId("login-foto").boundingBox();
    expect(foto!.x).toBeGreaterThan(form!.x + form!.width);
  });

  test("credenciales inválidas: se anuncia el error y los campos quedan marcados", async ({ page }) => {
    await sesionComo(page, null);
    await page.route(`${API}/auth/login`, (r) => r.fulfill({ status: 401, json: { message: "Usuario o contraseña incorrectos" } }));
    await page.goto("/");
    await page.getByLabel("Correo institucional o usuario de prueba").fill("x@prueba.co");
    await page.getByLabel("Contraseña").fill("mala");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.getByRole("alert")).toHaveText("Usuario o contraseña incorrectos");
    await expect(page.getByLabel("Contraseña")).toHaveAttribute("aria-invalid", "true");
  });

  test("backend caído: se anuncia el error de conexión y el botón vuelve", async ({ page }) => {
    await sesionComo(page, null);
    await page.route(`${API}/auth/login`, (r) => r.abort("connectionrefused"));
    await page.goto("/");
    await page.getByLabel("Correo institucional o usuario de prueba").fill("x@prueba.co");
    await page.getByLabel("Contraseña").fill("x");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.getByRole("alert")).toHaveText("No fue posible conectar con el servidor.");
    await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeEnabled();
  });

  for (const [rol, destino] of [["estudiante", "/estudiante/home"], ["funcionario", "/funcionario/dashboard"]] as const)
    test(`login correcto de ${rol} lleva a ${destino}`, async ({ page }) => {
      await sesionComo(page, rol);
      await page.route(`${API}/auth/login`, (r) => r.fulfill({ status: 201, json: { user: USUARIOS[rol] } }));
      await page.goto("/");
      await page.getByLabel("Correo institucional o usuario de prueba").fill(USUARIOS[rol].username);
      await page.getByLabel("Contraseña").fill("x");
      await page.getByRole("button", { name: "Iniciar sesión" }).click();
      await expect(page).toHaveURL(destino);
    });

  test("el foco siempre se ve", async ({ page }) => {
    await sesionComo(page, null);
    await page.goto("/");
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      const visible = await page.evaluate(() => {
        const s = getComputedStyle(document.activeElement!);
        return s.outlineStyle !== "none" || s.boxShadow !== "none";
      });
      expect(visible).toBe(true);
    }
  });

  test("«¿Olvidaste tu contraseña?» muestra su aviso", async ({ page }) => {
    await sesionComo(page, null);
    await page.goto("/");
    await page.getByRole("button", { name: "¿Olvidaste tu contraseña?" }).click();
    await expect(page.getByRole("status")).toHaveText("La recuperación de contraseña todavía no está disponible.");
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `cd frontend && npx playwright test e2e/login.spec.ts`
Expected: FAIL. El `main` no ocupa la pantalla, no hay `form` con nombre, no hay `role="alert"`, "¿Olvidaste…" es un enlace y axe reporta violaciones de contraste.

- [ ] **Step 3: Implementar `Button`, `Field` y el login**

- **`app/page.tsx`:** es un componente servidor con `export const metadata = { title: "Iniciar sesión" }` que renderiza `<FormularioLogin />`.
- **`FormularioLogin`:**
  - conserva el flujo actual: `POST ${API_URL}/auth/login` con `credentials: "include"` y redirección por rol;
  - conserva los mensajes del backend y "No fue posible conectar con el servidor." cuando falla la red;
  - el `<form aria-labelledby>` apunta al `h1` "Iniciar sesión";
  - el error va en `<p role="alert">`, enlazado a los dos campos.
- **Botones del formulario:**
  - el principal muestra "Ingresando…" mientras espera;
  - "¿Olvidaste tu contraseña?" es un `Button variante="sutil" type="button"` que escribe el aviso en un `<p role="status">`.
- **Distribución:** CSS grid de una columna, con la foto como franja de 160 px arriba. Desde 1024 px son dos columnas `minmax(0, 1fr) minmax(0, 1.1fr)`, y el `main` ocupa `min-height: 100dvh`.
- **Foto:** `next/image` con `alt=""` y `data-testid="login-foto"` en su contenedor.

- [ ] **Step 4: Verificar que pasa**

Run: `cd frontend && npx playwright test e2e/login.spec.ts e2e/base.spec.ts`
Expected: todo en verde (8 de base + 16 de login).

- [ ] **Step 5: Commit**

```bash
git add -A frontend/app/page.tsx frontend/app/page.module.css frontend/app/components/ui frontend/app/components/login frontend/e2e/login.spec.ts
git commit -m "Frontend accesible: login"
```

---

### Task 3: Navbar, sesión e inicio del estudiante

**Files:**
- Create: `frontend/app/lib/useSesion.ts`, `frontend/app/components/ui/StatusBadge.tsx` + `.module.css`, `frontend/app/components/ui/Card.tsx` + `.module.css`, `frontend/app/components/ui/PageHeader.tsx` + `.module.css`, `frontend/e2e/inicio.spec.ts`
- Modify: `frontend/app/components/navbar/Navbar.tsx`, `Navbar.module.css`, `frontend/app/estudiante/home/page.tsx`, `home.module.css` (`api.ts` no cambia)

**Interfaces:**
- Consumes: `Button` (Tarea 2) y `soporte.ts`.
- Produces:
  - **`useSesion.ts`:**
    - `export type Rol = "estudiante" | "funcionario"`;
    - `export interface UsuarioSesion { id: number; username: string; name: string; role: Rol; nivel?: "PREGRADO" | "POSGRADO" }`;
    - `export const INICIO_POR_ROL: Record<Rol, string> = { estudiante: "/estudiante/home", funcionario: "/funcionario/dashboard" }`;
    - `export function useSesion(rolRequerido: Rol): { usuario: UsuarioSesion | null; cargando: boolean }`: sin sesión, `router.replace("/")`; con el otro rol, `router.replace(INICIO_POR_ROL[role])`.
  - **`StatusBadge.tsx`:**
    - `export type EstadoVisible = "valido" | "no_valido" | "inconsistente" | "por_revisar" | "procesando" | "falta_cargar"`;
    - `export const ETIQUETA_ESTADO: Record<EstadoVisible, string>`, con las etiquetas de las Global Constraints;
    - default export `StatusBadge({ estado }: { estado: EstadoVisible })`: un `span` con `data-estado`, un ícono SVG `aria-hidden` y el texto.
  - **`Card.tsx`:** default export `Card({ titulo?: string; nivelTitulo?: 2 | 3; acciones?: ReactNode; className?: string; children })`, una `section` con `aria-labelledby` cuando hay título.
  - **`PageHeader.tsx`:** default export `PageHeader({ etiqueta?: string; titulo: string; descripcion?: string; ruta?: { texto: string; href?: string }[] })`. La ruta es un `nav aria-label="Ruta"`, y su último elemento lleva `aria-current="page"`.

- [ ] **Step 1: Escribir la prueba que falla, `e2e/inicio.spec.ts`**

```ts
test.describe("inicio del estudiante", () => {
  for (const tema of TEMAS) for (const ancho of ANCHOS)
    test(`accesible y sin desborde (${tema}, ${ancho}px)`, async ({ page }) => {
      await sesionComo(page, "estudiante");
      await revisarPagina(page, "/estudiante/home", tema, ancho);
    });

  test("sin sesión redirige al login", async ({ page }) => {
    await sesionComo(page, null);
    await page.goto("/estudiante/home");
    await expect(page).toHaveURL("/");
  });

  test("un funcionario termina en su dashboard", async ({ page }) => {
    await sesionComo(page, "funcionario");
    await page.goto("/estudiante/home");
    await expect(page).toHaveURL("/funcionario/dashboard");
  });

  test("los estados se leen como texto, no solo como color", async ({ page }) => {
    await sesionComo(page, "estudiante");
    await page.goto("/estudiante/home");
    for (const etiqueta of ["Válido", "Por revisar", "Falta cargar"])
      await expect(page.locator("[data-estado]", { hasText: etiqueta }).first()).toBeVisible();
  });

  test("la barra de progreso expone su valor", async ({ page }) => {
    await sesionComo(page, "estudiante");
    await page.goto("/estudiante/home");
    const barra = page.getByRole("progressbar");
    await expect(barra).toHaveAttribute("aria-valuemin", "0");
    await expect(barra).toHaveAttribute("aria-valuetext", /de 5 documentos cargados/);
  });

  test("el menú de usuario abre con Enter, cierra con Esc y devuelve el foco", async ({ page }) => {
    await sesionComo(page, "estudiante");
    await page.goto("/estudiante/home");
    const boton = page.getByRole("button", { name: /Ana Prueba/ });
    await boton.focus();
    await page.keyboard.press("Enter");
    await expect(boton).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(boton).toHaveAttribute("aria-expanded", "false");
    await expect(boton).toBeFocused();
  });

  test("nombre largo a 320px: no desborda y se lee completo", async ({ page }) => {
    const nombre = "María Fernanda de los Ángeles Rodríguez Castellanos";
    await page.setViewportSize({ width: 320, height: 800 });
    await sesionComo(page, "estudiante", nombre);
    await page.goto("/estudiante/home");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole("button", { name: new RegExp(nombre) })).toBeVisible();
  });

  test("el foco no queda tapado por la barra fija", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 600 });
    await sesionComo(page, "estudiante");
    await page.goto("/estudiante/home");
    await page.keyboard.press("End");
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Shift+Tab");
      const tapado = await page.evaluate(() => {
        const barra = document.querySelector("header")!.getBoundingClientRect();
        const foco = document.activeElement!.getBoundingClientRect();
        return foco.bottom > 0 && foco.top < barra.bottom && !document.querySelector("header")!.contains(document.activeElement);
      });
      expect(tapado).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `cd frontend && npx playwright test e2e/inicio.spec.ts`
Expected: FAIL. axe reporta el contraste de los chips, el menú no tiene `aria-expanded`, no existe `data-estado` y el nombre largo desborda.

- [ ] **Step 3: Implementar**

- **Hook y componentes:** `useSesion`, `StatusBadge`, `Card` y `PageHeader` según sus interfaces.
- **`Navbar`:**
  - va en `<header>` con `<nav aria-label="Principal">`;
  - el logo es `next/image` con `alt="CheckU"`;
  - el menú de usuario es un `<button aria-expanded aria-controls aria-haspopup="menu">`, y su nombre accesible incluye el nombre completo;
  - el texto visible se recorta con `text-overflow: ellipsis` y `min-width: 0`;
  - se cierra con Esc (devolviendo el foco) o con un clic afuera;
  - "Cerrar sesión" conserva `POST /auth/logout`.
- **Inicio:**
  - usa `useSesion("estudiante")` en lugar del bloque `/auth/me`;
  - los chips pasan a `StatusBadge`, las tarjetas a `Card` y el encabezado a `PageHeader`;
  - la barra de progreso lleva `aria-valuenow`, `aria-valuemin`, `aria-valuemax` y `aria-valuetext="{n} de {total} documentos cargados"`;
  - las notificaciones son un `ul` con `<time dateTime>`;
  - el `main` lleva `id="contenido" tabIndex={-1}` y `aria-busy` mientras `cargando`;
  - `home.module.css` solo usa tokens.
- **Alias:** se borran de `globals.css` los alias de los nombres viejos que ya nadie use; el detalle todavía usa los suyos hasta la Tarea 5.

- [ ] **Step 4: Verificar que pasa**

Run: `cd frontend && npx playwright test e2e/inicio.spec.ts e2e/login.spec.ts e2e/base.spec.ts`
Expected: todo en verde.

- [ ] **Step 5: Commit**

```bash
git add -A frontend/app/lib frontend/app/components/ui frontend/app/components/navbar frontend/app/estudiante/home frontend/app/globals.css frontend/e2e/inicio.spec.ts
git commit -m "Frontend accesible: Navbar, useSesion e inicio del estudiante"
```

---

### Task 4: Dashboard del funcionario

**Files:**
- Create: `frontend/app/funcionario/dashboard/GraficoEstados.tsx` + `GraficoEstados.module.css`, `frontend/app/funcionario/dashboard/datos.ts` (los datos simulados que hoy están dentro de `page.tsx`, con su marca "SIMULADO"), `frontend/e2e/dashboard.spec.ts`
- Modify: `frontend/app/funcionario/dashboard/page.tsx`, `dashboard.module.css`

**Interfaces:**
- Consumes: `useSesion`, `StatusBadge`, `EstadoVisible`, `Card`, `PageHeader`, `Button` y `soporte.ts`.
- Produces: `GraficoEstados({ tipo, titulo, datos })` (default export):
  - `tipo: "barras" | "dona"`, `titulo: string`, `datos: { estado: EstadoVisible; cantidad: number }[]`;
  - va dentro de un `<figure data-tema="light|dark">` con `figcaption` y una tabla `.solo-lector`;
  - el canvas lleva `role="img"` y un `aria-label` con el resumen ("Válidas: 2, No válidas: 1…");
  - lee `--status-<valid|invalid|inconsistent|review>-mark` con `getComputedStyle` y se redibuja cuando cambia `matchMedia("(prefers-color-scheme: dark)")`.

- [ ] **Step 1: Escribir la prueba que falla, `e2e/dashboard.spec.ts`**

```ts
test.describe("dashboard", () => {
  for (const tema of TEMAS) for (const ancho of ANCHOS)
    test(`accesible y sin desborde (${tema}, ${ancho}px)`, async ({ page }) => {
      await sesionComo(page, "funcionario");
      await revisarPagina(page, "/funcionario/dashboard", tema, ancho);
    });

  test("un estudiante termina en su inicio", async ({ page }) => {
    await sesionComo(page, "estudiante");
    await page.goto("/funcionario/dashboard");
    await expect(page).toHaveURL("/estudiante/home");
  });

  test("«Ver solicitud» lleva al detalle correcto", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await sesionComo(page, "funcionario");
    await page.goto("/funcionario/dashboard");
    await page.getByRole("link", { name: "Ver solicitud GR-2026-001" }).click();
    await expect(page).toHaveURL("/funcionario/detalle_preinscripcion/GR-2026-001");
  });

  test("los filtros indican cuál está activo y anuncian el conteo", async ({ page }) => {
    await sesionComo(page, "funcionario");
    await page.goto("/funcionario/dashboard");
    const validas = page.getByRole("button", { name: "Válidas", exact: true });
    await validas.click();
    await expect(validas).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[aria-live=polite]")).toHaveText("2 solicitudes");
  });

  test("a 1280px es una tabla con encabezados; a 360px son tarjetas", async ({ page }) => {
    await sesionComo(page, "funcionario");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/funcionario/dashboard");
    await expect(page.getByRole("table", { name: /Preinscripciones/ })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Estudiante" })).toBeVisible();
    await page.setViewportSize({ width: 360, height: 800 });
    await expect(page.getByRole("table", { name: /Preinscripciones/ })).toBeHidden();
    await expect(page.getByRole("list", { name: "Preinscripciones" }).getByRole("listitem")).toHaveCount(5);
  });

  test("los gráficos tienen alternativa en texto y se redibujan al cambiar de tema", async ({ page }) => {
    await sesionComo(page, "funcionario");
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/funcionario/dashboard");
    const figuras = page.locator("figure");
    await expect(figuras).toHaveCount(2);
    await expect(figuras.first().locator("canvas")).toHaveAttribute("aria-label", /Válidas: 2/);
    await expect(figuras.first()).toHaveAttribute("data-tema", "light");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(figuras.first()).toHaveAttribute("data-tema", "dark");
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `cd frontend && npx playwright test e2e/dashboard.spec.ts`
Expected: FAIL. El enlace se llama "Visualizar" y lleva a una ruta 404, los filtros no tienen `aria-pressed`, la tabla desborda a 360 px y no hay `figure`.

- [ ] **Step 3: Implementar**

- **Página:**
  - usa `useSesion("funcionario")` y `PageHeader` ("Dashboard de preinscripciones", "Resumen y seguimiento de las solicitudes de grado.");
  - las 4 tarjetas de conteo usan la marca, `StatusBadge` y cifras con `tabular-nums`;
  - los dos `GraficoEstados` son "Distribución de solicitudes" (barras) y "Distribución porcentual" (dona).
- **Filtros y conteo:**
  - los filtros son botones con `aria-pressed`;
  - el conteo va en `<p aria-live="polite">{n} solicitudes</p>`.
- **Tabla y tarjetas:**
  - desde 768 px, una `<table>` con `<caption>Preinscripciones…</caption>` y `scope="col"`;
  - por debajo de 768 px, un `<ul aria-label="Preinscripciones">` de tarjetas;
  - cada vista se oculta con `display: none` en el corte contrario.
- **Botón "Ver solicitud":** reemplaza a "Visualizar" con `<Button href={`/funcionario/detalle_preinscripcion/${id}`} aria-label={`Ver solicitud ${id}`}>Ver solicitud</Button>`.
- **Estados:** los datos usan `EstadoVisible`.

- [ ] **Step 4: Verificar que pasa**

Run: `cd frontend && npx playwright test e2e/dashboard.spec.ts e2e/inicio.spec.ts e2e/login.spec.ts e2e/base.spec.ts`
Expected: todo en verde.

- [ ] **Step 5: Commit**

```bash
git add -A frontend/app/funcionario/dashboard frontend/e2e/dashboard.spec.ts
git commit -m "Frontend accesible: dashboard del funcionario"
```

---

### Task 5: Detalle, análisis automático y prueba de conexión

**Files:**
- Create: `frontend/app/components/ui/Dialog.tsx` + `.module.css`, `frontend/app/components/ui/Tabs.tsx` + `.module.css`, `frontend/app/funcionario/detalle_preinscripcion/[id]/detalle.module.css` (reemplaza a `detalle.css`, que se borra), `frontend/app/funcionario/detalle_preinscripcion/[id]/datos.ts` (los datos simulados que hoy están dentro de `page.tsx`), `frontend/app/connect/connect.module.css`, `frontend/e2e/detalle.spec.ts`, `frontend/e2e/conexion.spec.ts`
- Modify: `frontend/app/funcionario/detalle_preinscripcion/[id]/page.tsx`, `frontend/app/components/document_analysis/DocumentAnalysis.tsx` + `.module.css`, `frontend/app/connect/page.tsx`, `frontend/app/globals.css` (se quitan los últimos alias)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces:
  - **`Dialog`** (default export): `Dialog({ abierto, alCerrar, titulo, descripcion?, children })`, con `abierto: boolean` y `alCerrar: () => void`:
    - usa un `<dialog>` nativo que abre con `showModal()`;
    - el evento `cancel` (Esc) llama a `alCerrar`;
    - el foco vuelve al elemento enfocado antes de abrir.
  - **`Tabs`** (default export): `Tabs({ etiqueta, pestanas, inicial? })`, con `etiqueta: string`, `pestanas: { id: string; titulo: string; contenido: ReactNode }[]` e `inicial?: string`:
    - `tablist` con tabulación itinerante, flechas, Inicio y Fin;
    - cada panel es `tabpanel` con `aria-labelledby` y `tabIndex={0}`.

- [ ] **Step 1: Escribir las pruebas que fallan, `e2e/detalle.spec.ts` y `e2e/conexion.spec.ts`**

```ts
const DETALLE = "/funcionario/detalle_preinscripcion/GR-2026-001";

test.describe("detalle", () => {
  for (const tema of TEMAS) for (const ancho of ANCHOS)
    test(`accesible y sin desborde (${tema}, ${ancho}px)`, async ({ page }) => {
      await sesionComo(page, "funcionario");
      await revisarPagina(page, DETALLE, tema, ancho);
    });

  test("sin sesión redirige al login", async ({ page }) => {
    await sesionComo(page, null);
    await page.goto(DETALLE);
    await expect(page).toHaveURL("/");
  });

  test("las pestañas se recorren con flechas y solo la activa entra en el orden de Tab", async ({ page }) => {
    await sesionComo(page, "funcionario");
    await page.goto(DETALLE);
    const pestanas = page.getByRole("tab");
    await expect(pestanas).toHaveCount(3);
    await pestanas.first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(pestanas.nth(1)).toBeFocused();
    await expect(pestanas.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(page.locator('[role=tab][tabindex="0"]')).toHaveCount(1);
    await page.keyboard.press("End");
    await expect(pestanas.nth(2)).toBeFocused();
  });

  test("el análisis atrapa el foco, cierra con Esc y devuelve el foco a «Revisar»", async ({ page }) => {
    await sesionComo(page, "funcionario");
    await page.goto(DETALLE);
    await page.getByRole("tab", { name: "Documentos" }).click();
    const revisar = page.getByRole("button", { name: /Revisar/ }).first();
    await revisar.click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo).toBeVisible();
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
      expect(await dialogo.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialogo).toBeHidden();
    await expect(revisar).toBeFocused();
  });
});

test.describe("prueba de conexión", () => {
  for (const tema of TEMAS) for (const ancho of ANCHOS)
    test(`accesible y sin desborde (${tema}, ${ancho}px)`, async ({ page }) => {
      await sesionComo(page, null);
      await revisarPagina(page, "/connect", tema, ancho);
    });

  test("anuncia el resultado", async ({ page }) => {
    await sesionComo(page, null);
    await page.goto("/connect");
    await expect(page.getByRole("status")).toContainText("Conexión exitosa");
  });

  test("anuncia el error si el backend no responde", async ({ page }) => {
    await sesionComo(page, null);
    await page.route(`${API}/health`, (r) => r.abort("connectionrefused"));
    await page.goto("/connect");
    await expect(page.getByRole("alert")).toBeVisible();
  });
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `cd frontend && npx playwright test e2e/detalle.spec.ts e2e/conexion.spec.ts`
Expected: FAIL. El detalle no redirige sin sesión, no hay `role="tab"`, axe reporta contraste y las pestañas desbordan a 360 px; la conexión no tiene `status` ni `alert`.

- [ ] **Step 3: Implementar**

- **Componentes:** `Dialog` y `Tabs` según sus interfaces.
- **`DocumentAnalysis`:**
  - mismas props y tipos, construido sobre `Dialog`;
  - mapea `"VALIDO"` → `"valido"` y los demás, para `StatusBadge`;
  - cada validación muestra ícono + texto "Cumple" o "No cumple";
  - los campos extraídos son una lista `dl`.
- **Detalle:**
  - `detalle.css` pasa a `detalle.module.css`; no queda ninguna clase global;
  - los datos van a `datos.ts`;
  - usa `useSesion("funcionario")` y `PageHeader`, con la ruta Funcionarios → Preinscripciones → Detalle;
  - las tres pestañas son "Resumen documental", "Información del estudiante" y "Documentos", sobre `Tabs`;
  - `ReadOnlyField` pasa a `dl`/`dt`/`dd`;
  - el estado general es una caja con `h2`;
  - cada "Revisar" abre `DocumentAnalysis` y su nombre accesible incluye el documento ("Revisar Cédula de ciudadanía").
- **Conexión:**
  - `PageHeader` y `connect.module.css`;
  - el éxito va en `role="status"` con "Conexión exitosa" y el error en `role="alert"`.
- **Tokens:** `globals.css` queda sin alias viejos.

- [ ] **Step 4: Verificar que pasa la suite completa**

Run: `cd frontend && npx playwright test`
Expected: todo en verde.

- [ ] **Step 5: Commit**

```bash
git add -A frontend/app/components/ui frontend/app/components/document_analysis "frontend/app/funcionario/detalle_preinscripcion/[id]" frontend/app/connect frontend/app/globals.css frontend/e2e/detalle.spec.ts frontend/e2e/conexion.spec.ts
git commit -m "Frontend accesible: detalle, análisis automático y prueba de conexión"
```

---

### Task 6: Barrera contra colores fijos, documentación y verificación final

**Files:**
- Create: `frontend/e2e/colores.spec.ts`
- Modify: `frontend/README.md` (sección "Pruebas" con `npm run test:e2e` y `npx playwright install chromium`; sección "Diseño" con los tokens y los componentes de `app/components/ui/`)

- [ ] **Step 1: Escribir la barrera `e2e/colores.spec.ts`**

```ts
// Ningún color fijo en el alcance de la issue #36: todos salen de los tokens de globals.css.
const ALCANCE = globSync("app/**/*.css", { cwd: process.cwd() })
  .filter((f) => !f.replaceAll("\\", "/").startsWith("app/estudiante/preinscripcion/") && !f.endsWith("globals.css"));

test("hay hojas de estilo en el alcance", () => expect(ALCANCE.length).toBeGreaterThan(5));
for (const archivo of ALCANCE)
  test(`${archivo} no tiene colores fijos`, () => {
    const css = readFileSync(archivo, "utf8");
    expect(css.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g) ?? []).toEqual([]);
  });
```

`globSync` viene de `node:fs` (Node 22).

- [ ] **Step 2: Correrla**

Run: `cd frontend && npx playwright test e2e/colores.spec.ts`
Expected: PASS si las tareas 1 a 5 cumplieron. Esta prueba es una barrera de verificación, no TDD: si algo falla, se corrige en el CSS que nombre.

- [ ] **Step 3: Verificación completa**

Run: `cd frontend && npm run lint && npm run build && npx playwright test`
Expected: lint sin errores, build sin errores y la suite completa en verde.

Run: `C:/Users/hectr/.claude/skills/impeccable/scripts/impeccable detect --json frontend/app`
Expected: sin hallazgos de severidad alta. Los demás se anotan o se corrigen.

- [ ] **Step 4: Capturas para el PR**

Login, inicio, dashboard y detalle, en claro y oscuro, a 360 y 1280 px. Se generan con un script de Playwright de un solo uso que no se versiona, en `frontend/test-results/capturas/`.

- [ ] **Step 5: Commit**

```bash
git add frontend/e2e/colores.spec.ts frontend/README.md
git commit -m "Frontend accesible: barrera contra colores fijos y documentación"
```
