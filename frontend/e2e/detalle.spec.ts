import { expect, test } from "@playwright/test";
import { ANCHOS, revisarPagina, sesionComo, TEMAS } from "./soporte";

const DETALLE = "/funcionario/detalle_preinscripcion/GR-2026-001";

test.describe("detalle", () => {
    for (const tema of TEMAS)
        for (const ancho of ANCHOS)
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

    test("«Revisar» en una alerta lleva a la pestaña Documentos", async ({ page }) => {
        await sesionComo(page, "funcionario");
        await page.goto(DETALLE);
        await page.getByRole("button", { name: /^Revisar/ }).first().click();
        await expect(page.getByRole("tab", { name: "Documentos" })).toHaveAttribute("aria-selected", "true");
    });

    test("el análisis atrapa el foco, cierra con Esc y devuelve el foco al botón que lo abrió", async ({ page }) => {
        await sesionComo(page, "funcionario");
        await page.goto(DETALLE);
        await page.getByRole("tab", { name: "Documentos" }).click();
        const abrir = page.getByRole("button", { name: /Ver análisis automático/ }).first();
        await abrir.click();
        const dialogo = page.getByRole("dialog");
        await expect(dialogo).toBeVisible();
        for (let i = 0; i < 15; i++) {
            await page.keyboard.press("Tab");
            expect(await dialogo.evaluate((d) => d.contains(document.activeElement))).toBe(true);
        }
        await page.keyboard.press("Escape");
        await expect(dialogo).toBeHidden();
        await expect(abrir).toBeFocused();
    });
});
