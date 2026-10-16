import { expect, test } from "@playwright/test";
import { ANCHOS, API, revisarPagina, sesionComo, TEMAS, USUARIOS } from "./soporte";

test.describe("login", () => {
    for (const tema of TEMAS)
        for (const ancho of ANCHOS)
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
        await page.route(`${API}/auth/login`, (r) =>
            r.fulfill({ status: 401, json: { message: "Usuario o contraseña incorrectos" } }),
        );
        await page.goto("/");
        await page.getByLabel("Correo institucional o usuario de prueba").fill("x@prueba.co");
        await page.getByLabel("Contraseña").fill("mala");
        await page.getByRole("button", { name: "Iniciar sesión" }).click();
        await expect(page.locator("main").getByRole("alert")).toHaveText("Usuario o contraseña incorrectos");
        await expect(page.getByLabel("Contraseña")).toHaveAttribute("aria-invalid", "true");
    });

    test("backend caído: se anuncia el error de conexión y el botón vuelve", async ({ page }) => {
        await sesionComo(page, null);
        await page.route(`${API}/auth/login`, (r) => r.abort("connectionrefused"));
        await page.goto("/");
        await page.getByLabel("Correo institucional o usuario de prueba").fill("x@prueba.co");
        await page.getByLabel("Contraseña").fill("x");
        await page.getByRole("button", { name: "Iniciar sesión" }).click();
        await expect(page.locator("main").getByRole("alert")).toHaveText("No fue posible conectar con el servidor.");
        await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeEnabled();
    });

    for (const [rol, destino] of [
        ["estudiante", "/estudiante/home"],
        ["funcionario", "/funcionario/dashboard"],
    ] as const)
        test(`login correcto de ${rol} lleva a ${destino}`, async ({ page }) => {
            await sesionComo(page, rol);
            await page.route(`${API}/auth/login`, (r) =>
                r.fulfill({ status: 201, json: { user: USUARIOS[rol] } }),
            );
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
            // El indicador de desarrollo de Next (nextjs-portal) no existe en producción.
            const visible = await page.evaluate(() => {
                const e = document.activeElement!;
                if (e === document.body || e.tagName === "NEXTJS-PORTAL") return true;
                const s = getComputedStyle(e);
                return s.outlineStyle !== "none" || s.boxShadow !== "none";
            });
            expect(visible).toBe(true);
        }
    });

    test("«¿Olvidaste tu contraseña?» muestra su aviso", async ({ page }) => {
        await sesionComo(page, null);
        await page.goto("/");
        await page.getByRole("button", { name: "¿Olvidaste tu contraseña?" }).click();
        await expect(page.getByRole("status")).toHaveText(
            "La recuperación de contraseña todavía no está disponible.",
        );
    });
});
