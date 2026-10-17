import { expect, test } from "@playwright/test";
import { ANCHOS, revisarAxe, revisarPagina, sesionComo, TEMAS } from "./soporte";

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

    for (const [ancho, alto] of [[1280, 720], [360, 740]] as const)
        for (const tema of TEMAS)
            test(`el análisis abierto pasa axe y se recorre con el teclado (${tema}, ${ancho}px)`, async ({ page }) => {
                await page.setViewportSize({ width: ancho, height: alto });
                await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" });
                await sesionComo(page, "funcionario");
                await page.goto(DETALLE);
                await page.getByRole("tab", { name: "Documentos" }).click();
                await page.getByRole("button", { name: /Ver análisis automático/ }).nth(2).click();
                const dialogo = page.getByRole("dialog");
                await expect(dialogo).toBeVisible();
                await revisarAxe(page);
                // La región que se desplaza lleva el nombre del diálogo (el documento abierto).
                const contenido = dialogo.getByRole("region", {
                    name: "Comprobante de pago de estampilla Pro-Cultura",
                    exact: true,
                });
                await page.keyboard.press("Tab");
                await expect(contenido).toBeFocused();
                await page.keyboard.press("End");
                await expect.poll(() => contenido.evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
            });

    for (const tema of TEMAS)
        for (const nombre of ["Información del estudiante", "Documentos"])
            test(`la pestaña «${nombre}» pasa axe (${tema})`, async ({ page }) => {
                await page.setViewportSize({ width: 1280, height: 900 });
                await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" });
                await sesionComo(page, "funcionario");
                await page.goto(DETALLE);
                await page.getByRole("tab", { name: nombre }).click();
                await revisarAxe(page);
            });
});
