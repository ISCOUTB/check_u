import { expect, test } from "@playwright/test";
import { sesionComo } from "./soporte";

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
                return {
                    fondo: s.backgroundColor,
                    texto: s.color,
                    esquema: getComputedStyle(document.documentElement).colorScheme,
                };
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
