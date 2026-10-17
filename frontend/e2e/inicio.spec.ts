import { expect, test } from "@playwright/test";
import { ANCHOS, revisarAxe, revisarPagina, sesionComo, TEMAS } from "./soporte";

const INICIO = "/estudiante/home";

test.describe("inicio del estudiante", () => {
    for (const tema of TEMAS)
        for (const ancho of ANCHOS)
            test(`accesible y sin desborde (${tema}, ${ancho}px)`, async ({ page }) => {
                await sesionComo(page, "estudiante");
                await revisarPagina(page, INICIO, tema, ancho);
            });

    test("sin sesión redirige al login", async ({ page }) => {
        await sesionComo(page, null);
        await page.goto(INICIO);
        await expect(page).toHaveURL("/");
    });

    test("un funcionario termina en su dashboard", async ({ page }) => {
        await sesionComo(page, "funcionario");
        await page.goto(INICIO);
        await expect(page).toHaveURL("/funcionario/dashboard");
    });

    test("los estados se leen como texto, no solo como color", async ({ page }) => {
        await sesionComo(page, "estudiante");
        await page.goto(INICIO);
        for (const etiqueta of ["Válido", "Por revisar", "Falta cargar"])
            await expect(page.locator("[data-estado]", { hasText: etiqueta }).first()).toBeVisible();
    });

    test("la barra de progreso expone su valor", async ({ page }) => {
        await sesionComo(page, "estudiante");
        await page.goto(INICIO);
        const barra = page.getByRole("progressbar");
        await expect(barra).toHaveAttribute("aria-valuemin", "0");
        await expect(barra).toHaveAttribute("aria-valuetext", /de 5 documentos cargados/);
    });

    test("el menú de usuario abre con Enter, cierra con Esc y devuelve el foco", async ({ page }) => {
        await sesionComo(page, "estudiante");
        await page.goto(INICIO);
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
        await page.goto(INICIO);
        await page.locator('main#contenido:not([aria-busy="true"])').waitFor();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await expect(page.getByRole("button", { name: new RegExp(nombre) })).toBeVisible();
    });

    test("el foco no queda tapado por la barra fija", async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 600 });
        await sesionComo(page, "estudiante");
        await page.goto(INICIO);
        await page.locator('main#contenido:not([aria-busy="true"])').waitFor();
        // Al final de la página de un salto: la tecla Fin anima el desplazamiento y la animación
        // seguiría moviendo la página mientras se tabula.
        await page.evaluate(() =>
            window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }),
        );
        for (let i = 0; i < 40; i++) {
            await page.keyboard.press("Shift+Tab");
            // Tapado = lo que se ve en el centro del elemento enfocado es otra cosa (WCAG 2.4.11).
            const tapado = await page.evaluate(async () => {
                // Se mide después de los dos cuadros en que la página termina de desplazarse.
                await new Promise((listo) => requestAnimationFrame(() => requestAnimationFrame(listo)));
                const foco = document.activeElement!;
                const caja = foco.getBoundingClientRect();
                if (foco === document.body || caja.bottom <= 0 || caja.top >= innerHeight) return false;
                const visible = document.elementFromPoint(caja.left + caja.width / 2, caja.top + caja.height / 2);
                return !!visible && !foco.contains(visible) && !visible.contains(foco);
            });
            expect(tapado).toBe(false);
        }
    });

    for (const tema of TEMAS)
        test(`el menú de usuario abierto y con el puntero encima pasa axe (${tema})`, async ({ page }) => {
            await page.setViewportSize({ width: 1280, height: 900 });
            await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" });
            await sesionComo(page, "estudiante");
            await page.goto(INICIO);
            const boton = page.getByRole("button", { name: /Ana Prueba/ });
            await boton.click();
            await expect(boton).toHaveAttribute("aria-expanded", "true");
            await revisarAxe(page);
            await page.keyboard.press("Escape");
            await boton.hover();
            await revisarAxe(page);
        });
});
