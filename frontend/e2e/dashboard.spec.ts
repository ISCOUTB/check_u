import { expect, test, type Page } from "@playwright/test";
import { ANCHOS, API, PERIODO_DEMO, revisarAxe, revisarPagina, sesionComo, TEMAS } from "./soporte";

const DASHBOARD = "/funcionario/dashboard";

async function abrirFiltros(page: Page): Promise<void> {
    await page.getByRole("button", { name: "Mostrar filtros" }).click();
}

test.describe("dashboard", () => {
    for (const tema of TEMAS)
        for (const ancho of ANCHOS)
            test(`accesible y sin desborde (${tema}, ${ancho}px)`, async ({ page }) => {
                await sesionComo(page, "funcionario");
                await revisarPagina(page, DASHBOARD, tema, ancho);
            });

    for (const tema of TEMAS)
        for (const ancho of ANCHOS)
            test(`filtros desplegables y gestión de periodos accesibles (${tema}, ${ancho}px)`, async ({ page }) => {
                await sesionComo(page, "funcionario");
                await revisarPagina(page, DASHBOARD, tema, ancho);
                await abrirFiltros(page);
                await revisarAxe(page);
                await page.getByRole("button", { name: "Gestionar periodos" }).click();
                await expect(page.getByRole("dialog", { name: "Gestión de periodos de grado" })).toBeVisible();
                await revisarAxe(page);
                const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
                expect(desborde, "scroll horizontal en píxeles").toBeLessThanOrEqual(0);
            });

    test("un estudiante termina en su inicio", async ({ page }) => {
        await sesionComo(page, "estudiante");
        await page.goto(DASHBOARD);
        await expect(page).toHaveURL("/estudiante/home");
    });

    test("«Ver solicitud» lleva al detalle correcto", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 });
        await sesionComo(page, "funcionario");
        await page.goto(DASHBOARD);
        await page.getByRole("link", { name: "Ver solicitud 1" }).click();
        await expect(page).toHaveURL("/funcionario/detalle_preinscripcion/1");
    });

    test("los filtros indican cuál está activo y anuncian el conteo", async ({ page }) => {
        await sesionComo(page, "funcionario");
        await page.goto(DASHBOARD);
        await abrirFiltros(page);
        const validas = page.getByRole("button", { name: "Válidas", exact: true });
        await validas.click();
        await expect(validas).toHaveAttribute("aria-pressed", "true");
        await expect(page.locator("[aria-live=polite]")).toHaveText("1 solicitud");
    });

    test("periodo, nivel, fechas y estado están en un mismo panel de filtros", async ({ page }) => {
        await sesionComo(page, "funcionario");
        await page.goto(DASHBOARD);
        const boton = page.getByRole("button", { name: "Mostrar filtros" });
        const cabecera = page.getByRole("heading", { name: "Filtros de búsqueda" }).locator("..");
        const desplegable = page.locator("#panel-filtros");
        await expect(boton).toHaveAttribute("aria-expanded", "false");
        await expect(cabecera).toHaveCSS("margin-bottom", "0px");
        await expect(desplegable).toHaveCSS("visibility", "hidden");
        expect(await desplegable.evaluate((elemento) => getComputedStyle(elemento).transitionProperty)).toContain("grid-template-rows");
        await boton.click();
        await expect(page.getByRole("button", { name: "Ocultar filtros" })).toHaveAttribute("aria-expanded", "true");
        await expect(cabecera).toHaveCSS("margin-bottom", "16px");
        await expect(desplegable).toHaveCSS("visibility", "visible");
        await expect(desplegable).toHaveCSS("opacity", "1");
        const panel = page.getByRole("region", { name: "Filtros de búsqueda" });
        await expect(panel).toBeVisible();
        await expect(panel.getByLabel("Periodo de grado")).toBeVisible();
        await expect(panel.getByLabel("Nivel académico")).toBeVisible();
        await expect(panel.getByLabel("Fecha inicial")).toBeVisible();
        await expect(panel.getByLabel("Fecha final")).toBeVisible();
        await expect(panel.getByRole("group", { name: "Estado de la solicitud" })).toBeVisible();
        await page.getByRole("button", { name: "Ocultar filtros" }).click();
        await expect(desplegable).toHaveCSS("visibility", "hidden");
        await expect(cabecera).toHaveCSS("margin-bottom", "0px");
    });

    test("el filtro de nivel académico sigue disponible", async ({ page }) => {
        await sesionComo(page, "funcionario");
        await page.goto(DASHBOARD);
        await abrirFiltros(page);
        await page.getByLabel("Nivel académico").selectOption("POSGRADO");
        await expect(page.locator("[aria-live=polite]")).toHaveText("2 solicitudes");
        await expect(page.getByRole("cell", { name: "3", exact: true })).toBeVisible();
    });

    test("el rango de fechas filtra la lista y se puede limpiar", async ({ page }) => {
        await sesionComo(page, "funcionario");
        await page.goto(DASHBOARD);
        await abrirFiltros(page);
        await expect(page.locator("[aria-live=polite]")).toHaveText("3 solicitudes");
        await page.getByLabel("Fecha inicial").fill("2026-10-05");
        await page.getByLabel("Fecha final").fill("2026-10-31");
        await page.getByRole("button", { name: "Aplicar fechas" }).click();
        await expect(page.locator("[aria-live=polite]")).toHaveText("0 solicitudes");
        await expect(page.getByRole("heading", { name: "No hay solicitudes" })).toBeVisible();
        await page.getByRole("button", { name: "Limpiar fechas" }).click();
        await expect(page.locator("[aria-live=polite]")).toHaveText("3 solicitudes");
    });

    test("crea un periodo de grado desde el modal", async ({ page }) => {
        await sesionComo(page, "funcionario");
        await page.goto(DASHBOARD);
        const gestionar = page.getByRole("button", { name: "Gestionar periodos" });
        await expect(gestionar).toHaveAttribute("aria-haspopup", "dialog");
        await gestionar.click();
        const dialogo = page.getByRole("dialog", { name: "Gestión de periodos de grado" });
        await expect(dialogo).toBeVisible();
        await expect(dialogo.getByRole("heading", { name: "Nuevo periodo" })).toBeVisible();
        await expect(dialogo.getByRole("list", { name: "Periodos de grado registrados" })).toContainText("Grado octubre 2026");
        await expect(page.getByLabel("Nombre del periodo")).toBeFocused();
        await page.getByLabel("Nombre del periodo").fill("Grados noviembre 2026");
        await page.getByLabel("Fecha de inicio").fill("2026-11-01");
        await page.getByLabel("Fecha de finalización").fill("2026-11-30");
        await page.getByLabel("Fecha de graduación").fill("2026-12-15");
        await dialogo.getByRole("button", { name: "Registrar periodo" }).click();
        await expect(dialogo.getByRole("status")).toHaveText("Periodo guardado correctamente.");
        await expect(dialogo.getByRole("list", { name: "Periodos de grado registrados" })).toContainText("Grados noviembre 2026");
        await dialogo.getByRole("button", { name: "Cerrar" }).click();
        await expect(dialogo).toBeHidden();
        await expect(gestionar).toBeFocused();
        await abrirFiltros(page);
        await expect(page.getByRole("combobox", { name: "Periodo de grado" })).toContainText("Grados noviembre 2026");
    });

    test("edita un periodo desde el listado del modal", async ({ page }) => {
        await sesionComo(page, "funcionario");
        await page.goto(DASHBOARD);
        await page.getByRole("button", { name: "Gestionar periodos" }).click();
        const dialogo = page.getByRole("dialog", { name: "Gestión de periodos de grado" });
        await dialogo.getByRole("button", { name: "Editar Grado octubre 2026" }).click();
        await expect(dialogo.getByRole("heading", { name: "Editar periodo" })).toBeVisible();
        await expect(dialogo.getByLabel("Nombre del periodo")).toHaveValue("Grado octubre 2026");
        await expect(dialogo.getByLabel("Nombre del periodo")).toBeFocused();
        await dialogo.getByLabel("Nombre del periodo").fill("Grado octubre 2026 ajustado");
        await dialogo.getByRole("button", { name: "Guardar cambios" }).click();
        await expect(dialogo.getByRole("status")).toHaveText("Periodo guardado correctamente.");
        await expect(dialogo.getByRole("list", { name: "Periodos de grado registrados" })).toContainText("Grado octubre 2026 ajustado");
        await expect(dialogo.getByRole("heading", { name: "Nuevo periodo" })).toBeVisible();
    });

    test("el formulario queda fijo y el listado de periodos tiene scroll propio", async ({ page }) => {
        await sesionComo(page, "funcionario");
        const extras = Array.from({ length: 12 }, (_, i) => ({
            ...PERIODO_DEMO,
            id: `periodo-extra-${i}`,
            nombre: `Periodo cerrado ${i + 1}`,
            estado: "CERRADO" as const,
        }));
        // Este mock solo reemplaza el GET inicial; POST y PATCH siguen usando el de soporte.
        await page.route(`${API}/periodos-grado`, (ruta) =>
            ruta.request().method() === "GET"
                ? ruta.fulfill({ status: 200, json: [PERIODO_DEMO, ...extras] })
                : ruta.fallback(),
        );
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto(DASHBOARD);
        await page.getByRole("button", { name: "Gestionar periodos" }).click();
        const dialogo = page.getByRole("dialog", { name: "Gestión de periodos de grado" });
        const lista = dialogo.getByRole("list", { name: "Periodos de grado registrados" });
        await expect(lista).toBeVisible();
        const medida = await lista.evaluate((elemento) => {
            const estilos = getComputedStyle(elemento);
            return { scrollHeight: elemento.scrollHeight, clientHeight: elemento.clientHeight, overflowY: estilos.overflowY };
        });
        expect(medida.overflowY).toBe("auto");
        expect(medida.scrollHeight).toBeGreaterThan(medida.clientHeight);

        const tituloFormulario = dialogo.getByRole("heading", { name: "Nuevo periodo" });
        const antes = await tituloFormulario.boundingBox();
        await lista.evaluate((elemento) => { elemento.scrollTop = elemento.scrollHeight; });
        const despues = await tituloFormulario.boundingBox();
        // Tolerancia de 2 px por el redondeo subpíxel del diálogo.
        expect(Math.abs((despues?.y ?? 0) - (antes?.y ?? 0))).toBeLessThanOrEqual(2);
        await expect(tituloFormulario).toBeVisible();
    });

    test("a 1280px es una tabla con encabezados; a 360px son tarjetas", async ({ page }) => {
        await sesionComo(page, "funcionario");
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto(DASHBOARD);
        await expect(page.getByRole("table", { name: /Solicitudes de grado/ })).toBeVisible();
        await expect(page.getByRole("columnheader", { name: "Estudiante" })).toBeVisible();
        await page.setViewportSize({ width: 360, height: 800 });
        await expect(page.getByRole("table", { name: /Solicitudes de grado/ })).toBeHidden();
        await expect(page.getByRole("list", { name: "Solicitudes de grado" }).getByRole("listitem")).toHaveCount(3);
    });

    test("los gráficos tienen alternativa en texto y se redibujan al cambiar de tema", async ({ page }) => {
        await sesionComo(page, "funcionario");
        await page.emulateMedia({ colorScheme: "light" });
        await page.goto(DASHBOARD);
        const figuras = page.locator("figure");
        await expect(figuras).toHaveCount(2);
        await expect(figuras.first().locator("canvas")).toHaveAttribute("aria-label", /Válidas: 1/);
        await expect(figuras.first()).toHaveAttribute("data-tema", "light");
        await page.emulateMedia({ colorScheme: "dark" });
        await expect(figuras.first()).toHaveAttribute("data-tema", "dark");
    });

    test("activar un contador con el teclado filtra y lleva el foco a la lista, a la vista", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 });
        await sesionComo(page, "funcionario");
        await page.goto(DASHBOARD);
        await abrirFiltros(page);
        const contador = page.getByRole("button", { name: /^Válidas 1/ });
        await expect(contador).toHaveAccessibleDescription(/filtra la lista/i);
        await contador.focus();
        await page.keyboard.press("Enter");
        await expect(page.getByRole("button", { name: "Válidas", exact: true })).toHaveAttribute("aria-pressed", "true");
        const titulo = page.getByRole("heading", { name: "Solicitudes de grado", exact: true });
        await expect(titulo).toBeFocused();
        const tapado = await titulo.evaluate(async (e) => {
            await new Promise((listo) => requestAnimationFrame(() => requestAnimationFrame(listo)));
            const caja = e.getBoundingClientRect();
            const visible = document.elementFromPoint(caja.left + 10, caja.top + caja.height / 2);
            return !visible || !e.contains(visible);
        });
        expect(tapado).toBe(false);
    });

    test("el gráfico se vuelve a pintar con otros colores al cambiar el tema", async ({ page }) => {
        await sesionComo(page, "funcionario");
        await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
        await page.goto(DASHBOARD);
        const lienzo = page.locator("figure canvas").first();
        await expect(page.locator("figure").first()).toHaveAttribute("data-tema", "light");
        const antes = await lienzo.evaluate((c) => (c as HTMLCanvasElement).toDataURL());
        await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
        await expect(page.locator("figure").first()).toHaveAttribute("data-tema", "dark");
        await expect.poll(() => lienzo.evaluate((c) => (c as HTMLCanvasElement).toDataURL())).not.toBe(antes);
    });
});

test('la asociación real al periodo prevalece sobre la fecha de registro', async ({page}) => {
    await sesionComo(page,'funcionario');
    await page.route(`${API}/funcionario/solicitudes`, r => r.fulfill({json:[{
        id:'99',estado:'EN_PROCESO',estudiante:'Solicitud de otro periodo',nivel:'PREGRADO',
        periodId:'otro-periodo',fechaRegistro:'2026-10-04T10:00:00-05:00',
    }]}));
    await page.goto(DASHBOARD);
    await expect(page.getByRole('heading',{name:'No hay solicitudes',exact:true})).toBeVisible();
    await expect(page.getByRole('link',{name:'Ver solicitud 99',exact:true})).toHaveCount(0);
});
test('un error del listado no muestra solicitudes ficticias y permite reintentar', async ({page}) => {
    await sesionComo(page,'funcionario');
    let fallo=true;
    await page.route(`${API}/funcionario/solicitudes`, r => fallo
        ? r.fulfill({status:503,json:{message:'Base no disponible'}}) : r.fallback());
    await page.goto(DASHBOARD);
    await expect(page.locator('main').getByRole('alert')).toContainText('Base no disponible');
    await expect(page.getByRole('link',{name:/Ver solicitud/})).toHaveCount(0);
    fallo=false;
    await page.getByRole('button',{name:'Reintentar solicitudes'}).click();
    await expect(page.getByRole('link',{name:'Ver solicitud 1',exact:true}).first()).toBeVisible();
});
test('el listado no bloquea indefinidamente el dashboard si la API queda pendiente', async ({page}) => {
    await sesionComo(page,'funcionario'); await page.clock.install();
    let liberar!:()=>void;
    const pendiente=new Promise<void>(r=>{liberar=r;});
    await page.route(`${API}/funcionario/solicitudes`, async r=>{await pendiente;await r.abort().catch(()=>{});});
    try {
        const peticion=page.waitForRequest(`${API}/funcionario/solicitudes`);
        await page.goto(DASHBOARD); await peticion;
        await expect(page.getByRole('heading',{name:'Dashboard de solicitudes de grado'})).toBeVisible();
        await page.clock.fastForward(15_001);
        await expect(page.locator('main').getByRole('alert')).toContainText('tardó demasiado');
        await expect(page.getByRole('button',{name:'Reintentar solicitudes'})).toBeVisible();
    } finally {liberar();}
});

/** Una solicitud de cada estado guardado (Tarea 42b), todas de pregrado en el periodo de prueba. */
const SEIS_ESTADOS = ['VALIDA','NO_VALIDA','INCONSISTENTE','POR_REVISAR','ACEPTADA','CERRADA','EN_PROCESO'].map((estado, i) => ({
    id: String(i + 1), estado, estudiante: `Estudiante Prueba ${i + 1}`, nivel: 'PREGRADO', periodId: PERIODO_DEMO.id,
    fechaRegistro: '2026-09-01T10:00:00-05:00', fechaEnvio: '2026-10-04', envioEn: '2026-10-04T15:00:00.000Z',
}));

for (const tema of TEMAS)
    test(`seis grupos: aceptadas y anuladas aparte de los estados calculados (${tema})`, async ({ page }) => {
        await sesionComo(page, 'funcionario');
        await page.route(`${API}/funcionario/solicitudes`, r => r.fulfill({ json: SEIS_ESTADOS }));
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.emulateMedia({ colorScheme: tema, reducedMotion: 'reduce' });
        await page.goto(DASHBOARD);
        for (const [nombre, cantidad] of [['Válidas', 1], ['No válidas', 1], ['Inconsistentes', 1], ['Por revisar', 2], ['Aceptadas', 1], ['Anuladas', 1]] as const)
            await expect(page.getByRole('button', { name: new RegExp(`^${nombre} ${cantidad}\\b`) })).toBeVisible();
        const barras = page.locator('figure canvas').first();
        await expect(barras).toHaveAttribute('aria-label', /Aceptadas: 1/);
        await expect(barras).toHaveAttribute('aria-label', /Anuladas: 1/);
        const tabla = page.getByRole('table', { name: /Solicitudes de grado/ });
        await expect(tabla.getByText('Aceptada', { exact: true })).toBeVisible();
        await expect(tabla.getByText('Anulada', { exact: true })).toBeVisible();
        await expect(tabla.getByText('Válida', { exact: true })).toBeVisible();
        await abrirFiltros(page);
        await page.getByRole('button', { name: 'Anuladas', exact: true }).click();
        await expect(page.locator('[aria-live=polite]')).toHaveText('1 solicitud');
        await revisarAxe(page);
    });

test('el rango de fechas usa el primer envío en hora de Bogotá', async ({ page }) => {
    await sesionComo(page, 'funcionario');
    await page.route(`${API}/funcionario/solicitudes`, r => r.fulfill({ json: [
        // Enviada el 31/10 a las 20:00 de Bogotá (ya es 01/11 en UTC); el borrador se creó en septiembre.
        { ...SEIS_ESTADOS[0], id: '7', fechaRegistro: '2026-09-15T10:00:00-05:00', fechaEnvio: '2026-10-31', envioEn: '2026-11-01T01:00:00.000Z' },
        { ...SEIS_ESTADOS[1], id: '8', fechaEnvio: '2026-11-01', envioEn: '2026-11-01T15:00:00.000Z' },
    ] }));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(DASHBOARD);
    await abrirFiltros(page);
    await page.getByLabel('Fecha inicial').fill('2026-10-31');
    await page.getByLabel('Fecha final').fill('2026-10-31');
    await page.getByRole('button', { name: 'Aplicar fechas' }).click();
    await expect(page.locator('[aria-live=polite]')).toHaveText('1 solicitud');
    const fila = page.getByRole('row', { name: /Estudiante Prueba 1/ });
    await expect(fila).toContainText('31/10/2026');
    await expect(page.getByRole('link', { name: 'Ver solicitud 7', exact: true })).toHaveAttribute('href', '/funcionario/detalle_preinscripcion/7');
});
