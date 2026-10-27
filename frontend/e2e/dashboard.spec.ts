import { expect, test, type Page } from "@playwright/test";
import { ANCHOS, revisarAxe, revisarPagina, sesionComo, TEMAS } from "./soporte";

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
        await page.getByRole("link", { name: "Ver solicitud GR-2026-001" }).click();
        await expect(page).toHaveURL("/funcionario/detalle_preinscripcion/GR-2026-001");
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
        await expect(boton).toHaveAttribute("aria-expanded", "false");
        await boton.click();
        await expect(page.getByRole("button", { name: "Ocultar filtros" })).toHaveAttribute("aria-expanded", "true");
        const panel = page.getByRole("region", { name: "Filtros de búsqueda" });
        await expect(panel).toBeVisible();
        await expect(panel.getByLabel("Periodo de grado")).toBeVisible();
        await expect(panel.getByLabel("Nivel académico")).toBeVisible();
        await expect(panel.getByLabel("Fecha inicial")).toBeVisible();
        await expect(panel.getByLabel("Fecha final")).toBeVisible();
        await expect(panel.getByRole("group", { name: "Estado de la solicitud" })).toBeVisible();
    });

    test("el filtro de nivel académico sigue disponible", async ({ page }) => {
        await sesionComo(page, "funcionario");
        await page.goto(DASHBOARD);
        await abrirFiltros(page);
        await page.getByLabel("Nivel académico").selectOption("POSGRADO");
        await expect(page.locator("[aria-live=polite]")).toHaveText("2 solicitudes");
        await expect(page.getByRole("cell", { name: "GR-2026-003", exact: true })).toBeVisible();
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
