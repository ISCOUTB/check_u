import { expect, test } from "@playwright/test";
import { ANCHOS, API, revisarPagina, sesionComo, TEMAS } from "./soporte";

test.describe("prueba de conexión", () => {
    for (const tema of TEMAS)
        for (const ancho of ANCHOS)
            test(`accesible y sin desborde (${tema}, ${ancho}px)`, async ({ page }) => {
                await sesionComo(page, null);
                await revisarPagina(page, "/connect", tema, ancho);
            });

    test("anuncia el resultado", async ({ page }) => {
        await sesionComo(page, null);
        await page.goto("/connect");
        await expect(page.locator("main").getByRole("status")).toContainText("Conexión exitosa");
    });

    test("anuncia el error si el backend no responde", async ({ page }) => {
        await sesionComo(page, null);
        await page.route(`${API}/health`, (r) => r.abort("connectionrefused"));
        await page.goto("/connect");
        await expect(page.locator("main").getByRole("alert")).toBeVisible();
    });
});
