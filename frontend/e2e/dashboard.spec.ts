import { expect, test } from "@playwright/test";
import { ANCHOS, revisarPagina, sesionComo, TEMAS } from "./soporte";

const DASHBOARD = "/funcionario/dashboard";

test.describe("dashboard", () => {
    for (const tema of TEMAS)
        for (const ancho of ANCHOS)
            test(`accesible y sin desborde (${tema}, ${ancho}px)`, async ({ page }) => {
                await sesionComo(page, "funcionario");
                await revisarPagina(page, DASHBOARD, tema, ancho);
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
        const validas = page.getByRole("button", { name: "Válidas", exact: true });
        await validas.click();
        await expect(validas).toHaveAttribute("aria-pressed", "true");
        await expect(page.locator("[aria-live=polite]")).toHaveText("2 solicitudes");
    });

    test("a 1280px es una tabla con encabezados; a 360px son tarjetas", async ({ page }) => {
        await sesionComo(page, "funcionario");
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto(DASHBOARD);
        await expect(page.getByRole("table", { name: /Preinscripciones/ })).toBeVisible();
        await expect(page.getByRole("columnheader", { name: "Estudiante" })).toBeVisible();
        await page.setViewportSize({ width: 360, height: 800 });
        await expect(page.getByRole("table", { name: /Preinscripciones/ })).toBeHidden();
        await expect(page.getByRole("list", { name: "Preinscripciones" }).getByRole("listitem")).toHaveCount(5);
    });

    test("los gráficos tienen alternativa en texto y se redibujan al cambiar de tema", async ({ page }) => {
        await sesionComo(page, "funcionario");
        await page.emulateMedia({ colorScheme: "light" });
        await page.goto(DASHBOARD);
        const figuras = page.locator("figure");
        await expect(figuras).toHaveCount(2);
        await expect(figuras.first().locator("canvas")).toHaveAttribute("aria-label", /Válidas: 2/);
        await expect(figuras.first()).toHaveAttribute("data-tema", "light");
        await page.emulateMedia({ colorScheme: "dark" });
        await expect(figuras.first()).toHaveAttribute("data-tema", "dark");
    });

    test("activar un contador con el teclado filtra y lleva el foco a la lista, a la vista", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 });
        await sesionComo(page, "funcionario");
        await page.goto(DASHBOARD);
        const contador = page.getByRole("button", { name: /^Válidas 2/ });
        await expect(contador).toHaveAccessibleDescription(/filtra la lista/i);
        await contador.focus();
        await page.keyboard.press("Enter");
        await expect(page.getByRole("button", { name: "Válidas", exact: true })).toHaveAttribute("aria-pressed", "true");
        const titulo = page.getByRole("heading", { name: "Preinscripciones", exact: true });
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
