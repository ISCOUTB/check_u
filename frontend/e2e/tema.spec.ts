import { expect, test, type Page } from "@playwright/test";
import { sesionComo } from "./soporte";

const FONDO_CLARO = "rgb(247, 249, 252)";
const FONDO_OSCURO = "rgb(11, 19, 36)";

const fondo = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.describe("botón de tema", () => {
    test("en el login pasa a oscuro y lo recuerda al recargar", async ({ page }) => {
        await page.emulateMedia({ colorScheme: "light" });
        await sesionComo(page, null);
        await page.goto("/");
        const boton = page.getByRole("button", { name: "Modo oscuro" });
        await expect(boton).toHaveAttribute("aria-pressed", "false");
        await boton.click();
        await expect(boton).toHaveAttribute("aria-pressed", "true");
        expect(await fondo(page)).toBe(FONDO_OSCURO);
        await page.reload();
        expect(await fondo(page)).toBe(FONDO_OSCURO);
        await expect(page.getByRole("button", { name: "Modo oscuro" })).toHaveAttribute("aria-pressed", "true");
    });

    test("con el sistema en oscuro, el botón fuerza el claro", async ({ page }) => {
        await page.emulateMedia({ colorScheme: "dark" });
        await sesionComo(page, null);
        await page.goto("/");
        expect(await fondo(page)).toBe(FONDO_OSCURO);
        await page.getByRole("button", { name: "Modo oscuro" }).click();
        expect(await fondo(page)).toBe(FONDO_CLARO);
        expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe("light");
    });

    test("está en la barra superior de las páginas con sesión", async ({ page }) => {
        await sesionComo(page, "funcionario");
        await page.goto("/funcionario/dashboard");
        await expect(page.locator("header").getByRole("button", { name: "Modo oscuro" })).toBeVisible();
    });

    test("los gráficos se redibujan al cambiar con el botón", async ({ page }) => {
        await page.emulateMedia({ colorScheme: "light" });
        await sesionComo(page, "funcionario");
        await page.goto("/funcionario/dashboard");
        const figura = page.locator("figure").first();
        await expect(figura).toHaveAttribute("data-tema", "light");
        await page.getByRole("button", { name: "Modo oscuro" }).click();
        await expect(figura).toHaveAttribute("data-tema", "dark");
    });

    test("el oscuro forzado usa los mismos tokens que el oscuro del sistema", async ({ page }) => {
        const TOKENS = [
            "--color-bg", "--color-surface", "--color-surface-muted", "--color-title", "--color-text",
            "--color-text-secondary", "--color-accent-text", "--color-accent-soft", "--color-border",
            "--color-border-control", "--color-focus", "--status-valid-text", "--status-valid-bg",
            "--status-invalid-text", "--status-invalid-bg", "--status-inconsistent-text",
            "--status-inconsistent-bg", "--status-review-text", "--status-review-bg",
            "--status-neutral-text", "--status-neutral-bg", "--shadow-card", "--shadow-popover",
        ];
        const leer = () =>
            page.evaluate((nombres) => {
                const estilos = getComputedStyle(document.documentElement);
                return nombres.map((n) => `${n}: ${estilos.getPropertyValue(n).trim()}`);
            }, TOKENS);

        await sesionComo(page, null);
        await page.emulateMedia({ colorScheme: "dark" });
        await page.goto("/connect");
        const delSistema = await leer();

        await page.emulateMedia({ colorScheme: "light" });
        await page.evaluate(() => (document.documentElement.dataset.tema = "oscuro"));
        expect(await leer()).toEqual(delSistema);
    });
});
