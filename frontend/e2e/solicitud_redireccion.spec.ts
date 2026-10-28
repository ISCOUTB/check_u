import { expect, test } from "@playwright/test";
import { API, sesionComo } from "./soporte";

const RUTA_BIENVENIDA = "/estudiante/bienvenida";
const RUTA_HOME = "/estudiante/home";
const RUTA_PREINSCRIPCION = "/estudiante/preinscripcion";

test.describe("decisión de bienvenida basada en solicitud_grado", () => {
    test.describe("en /estudiante/home", () => {
        test("sin solicitud redirige a /estudiante/bienvenida", async ({ page }) => {
            await sesionComo(page, "estudiante");
            await page.route(`${API}/estudiante/solicitud`, (ruta) =>
                ruta.fulfill({
                    status: 200,
                    json: { tiene_solicitud: false, solicitud: null },
                }),
            );

            await page.goto(RUTA_HOME);
            await expect(page).toHaveURL(RUTA_BIENVENIDA);
        });

        test("con solicitud permanece en /estudiante/home y no redirige", async ({ page }) => {
            await sesionComo(page, "estudiante");
            await page.route(`${API}/estudiante/solicitud`, (ruta) =>
                ruta.fulfill({
                    status: 200,
                    json: {
                        tiene_solicitud: true,
                        solicitud: { id_solicitud: 1, tipo_solicitud: "PREGRADO", estado: "BORRADOR" },
                    },
                }),
            );

            await page.goto(RUTA_HOME);
            await expect(page).toHaveURL(RUTA_HOME);
            await expect(page.getByRole("heading", { name: "Tu solicitud de grado está en curso" })).toBeVisible();
        });

        test("si la consulta falla (error de BD), no redirige y muestra error con opción de reintentar", async ({ page }) => {
            await sesionComo(page, "estudiante");
            await page.route(`${API}/estudiante/solicitud`, (ruta) =>
                ruta.fulfill({
                    status: 503,
                    json: { message: "Base de datos no disponible" },
                }),
            );

            await page.goto(RUTA_HOME);
            await expect(page).toHaveURL(RUTA_HOME);
            await expect(page.getByText("No fue posible cargar la solicitud. Intenta recargar la página.")).toBeVisible();
            await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
        });
    });

    test.describe("en /estudiante/preinscripcion", () => {
        test("sin solicitud redirige a /estudiante/bienvenida", async ({ page }) => {
            await sesionComo(page, "estudiante");
            await page.route(`${API}/estudiante/solicitud`, (ruta) =>
                ruta.fulfill({
                    status: 200,
                    json: { tiene_solicitud: false, solicitud: null },
                }),
            );

            await page.goto(RUTA_PREINSCRIPCION);
            await expect(page).toHaveURL(RUTA_BIENVENIDA);
        });

        test("con solicitud permanece en /estudiante/preinscripcion y no redirige", async ({ page }) => {
            await sesionComo(page, "estudiante");
            await page.route(`${API}/estudiante/solicitud`, (ruta) =>
                ruta.fulfill({
                    status: 200,
                    json: {
                        tiene_solicitud: true,
                        solicitud: { id_solicitud: 1, tipo_solicitud: "PREGRADO", estado: "BORRADOR" },
                    },
                }),
            );

            await page.goto(RUTA_PREINSCRIPCION);
            await expect(page).toHaveURL(RUTA_PREINSCRIPCION);
            await expect(page.getByRole("heading", { name: "Detalle de mi preinscripción" })).toBeVisible();
        });

        test("la pestaña Tu información muestra la discapacidad y las necesidades de asistencia", async ({ page }) => {
            await sesionComo(page, "estudiante");
            await page.route(`${API}/estudiante/solicitud`, (ruta) =>
                ruta.fulfill({
                    status: 200,
                    json: {
                        tiene_solicitud: true,
                        solicitud: { id_solicitud: 1, tipo_solicitud: "PREGRADO", estado: "BORRADOR" },
                    },
                }),
            );

            await page.goto(RUTA_PREINSCRIPCION);
            await page.getByRole("tab", { name: "Tu información" }).click();
            await expect(page.getByLabel("¿Posee alguna discapacidad?")).toHaveValue("true");
            await expect(page.getByLabel("Tipo de discapacidad")).toHaveValue("Física");
            await expect(page.getByLabel("Detalles y necesidades de asistencia")).toHaveValue(/silla de ruedas/);
        });

        test("si la consulta falla (error de BD), no redirige y muestra error con opción de reintentar", async ({ page }) => {
            await sesionComo(page, "estudiante");
            await page.route(`${API}/estudiante/solicitud`, (ruta) =>
                ruta.fulfill({
                    status: 503,
                    json: { message: "Base de datos no disponible" },
                }),
            );

            await page.goto(RUTA_PREINSCRIPCION);
            await expect(page).toHaveURL(RUTA_PREINSCRIPCION);
            await expect(page.getByText("No fue posible cargar la preinscripción. Intenta recargar la página.")).toBeVisible();
            await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
        });
    });
});
