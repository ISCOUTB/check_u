import { expect, test } from "@playwright/test";
import { ANCHOS, API, revisarPagina, sesionComo, TEMAS, USUARIOS } from "./soporte";

const RUTA_BIENVENIDA = "/estudiante/bienvenida";

test.describe("página de bienvenida para estudiante sin preinscripciones", () => {
    // Verificación de accesibilidad y diseño responsive en temas y anchos requeridos
    for (const tema of TEMAS) {
        for (const ancho of ANCHOS) {
            test(`accesible y sin desborde (${tema}, ${ancho}px)`, async ({ page }) => {
                await sesionComo(page, "estudiante");
                await revisarPagina(page, RUTA_BIENVENIDA, tema, ancho);
            });
        }
    }

    test("caso sin nivel: muestra ambos bloques de acción (Pregrado y Posgrado)", async ({ page }) => {
        await sesionComo(page, "estudiante");
        await page.goto(RUTA_BIENVENIDA);

        // Encabezado con h1 único
        const encabezadoH1 = page.locator("h1");
        await expect(encabezadoH1).toHaveCount(1);
        await expect(encabezadoH1).toHaveText(/¡Hola, Ana Prueba!/);

        // Dos títulos h2 para los bloques
        const titulosH2 = page.locator("h2");
        await expect(titulosH2).toHaveCount(2);
        await expect(page.getByRole("heading", { level: 2, name: "Pregrado" })).toBeVisible();
        await expect(page.getByRole("heading", { level: 2, name: "Posgrado" })).toBeVisible();

        // Botones de acción con enlaces y nombres distintos
        const botonPregrado = page.getByRole("link", { name: "Iniciar preinscripción para pregrado" });
        const botonPosgrado = page.getByRole("link", { name: "Iniciar preinscripción para posgrado" });

        await expect(botonPregrado).toBeVisible();
        await expect(botonPregrado).toHaveAttribute("href", "/estudiante/iniciar_preinscripcion?nivel=PREGRADO");

        await expect(botonPosgrado).toBeVisible();
        await expect(botonPosgrado).toHaveAttribute("href", "/estudiante/iniciar_preinscripcion?nivel=POSGRADO");

        // Listas ordenadas semánticas (<ol>)
        const listas = page.locator("ol");
        await expect(listas).toHaveCount(2);

        // Documentos de pregrado y posgrado
        await expect(page.getByText("Cédula de ciudadanía.")).toBeVisible();
        await expect(page.getByText("Evaluación de grado expedida por Banner.")).toBeVisible();
        await expect(page.getByText("Paz y Salvo Biblioteca.")).toHaveCount(2);
        await expect(page.getByText("Comprobante de pago estampilla Pro Cultura.")).toHaveCount(2);
        await expect(page.getByText("(En caso de doble programa, 2 comprobantes.)")).toBeVisible();
        await expect(page.getByText("Resultados Pruebas Saber Pro.")).toBeVisible();
        await expect(page.getByText("Documento de identidad.")).toBeVisible();

        // Paz y Salvo NO debe mostrar la nota interna [próximo a retirar]
        await expect(page.getByText(/próximo a retirar/i)).toHaveCount(0);
    });

    test("caso PREGRADO: muestra únicamente el bloque 1", async ({ page }) => {
        // Simular estudiante con nivel PREGRADO en /auth/me
        await page.route(`${API}/auth/me`, (ruta) =>
            ruta.fulfill({
                status: 200,
                json: { user: { ...USUARIOS.estudiante, nivel: "PREGRADO" } },
            }),
        );
        await page.goto(RUTA_BIENVENIDA);

        await expect(page.getByRole("heading", { level: 2, name: "Pregrado" })).toBeVisible();
        await expect(page.getByRole("heading", { level: 2, name: "Posgrado" })).toHaveCount(0);

        const botonPregrado = page.getByRole("link", { name: "Iniciar preinscripción para pregrado" });
        await expect(botonPregrado).toBeVisible();
        await expect(page.getByRole("link", { name: "Iniciar preinscripción para posgrado" })).toHaveCount(0);
    });

    test("caso POSGRADO: muestra únicamente el bloque 2", async ({ page }) => {
        // Simular estudiante con nivel POSGRADO en /auth/me
        await page.route(`${API}/auth/me`, (ruta) =>
            ruta.fulfill({
                status: 200,
                json: { user: { ...USUARIOS.estudiante, nivel: "POSGRADO" } },
            }),
        );
        await page.goto(RUTA_BIENVENIDA);

        await expect(page.getByRole("heading", { level: 2, name: "Posgrado" })).toBeVisible();
        await expect(page.getByRole("heading", { level: 2, name: "Pregrado" })).toHaveCount(0);

        const botonPosgrado = page.getByRole("link", { name: "Iniciar preinscripción para posgrado" });
        await expect(botonPosgrado).toBeVisible();
        await expect(page.getByRole("link", { name: "Iniciar preinscripción para pregrado" })).toHaveCount(0);

        // Documentos de posgrado
        await expect(page.getByText("Documento de identidad.")).toBeVisible();
        await expect(page.getByText("Paz y Salvo Biblioteca.")).toBeVisible();
        await expect(page.getByText("Comprobante de pago estampilla Pro Cultura.")).toBeVisible();
    });

    test("un funcionario es redirigido a su dashboard", async ({ page }) => {
        await sesionComo(page, "funcionario");
        await page.goto(RUTA_BIENVENIDA);
        await expect(page).toHaveURL("/funcionario/dashboard");
    });

    test("sin sesión redirige al login", async ({ page }) => {
        await sesionComo(page, null);
        await page.goto(RUTA_BIENVENIDA);
        await expect(page).toHaveURL("/");
    });

    test("home sin solicitud redirige a bienvenida", async ({ page }) => {
        await sesionComo(page, "estudiante");
        await page.route(`${API}/estudiante/solicitud`, (ruta) =>
            ruta.fulfill({
                status: 200,
                json: { tiene_solicitud: false, solicitud: null },
            }),
        );
        // Inyectar escenario sin_solicitud en la ventana
        await page.addInitScript(() => {
            (window as unknown as { __CHECKU_ESCENARIO__: string }).__CHECKU_ESCENARIO__ = "sin_solicitud";
        });
        await page.goto("/estudiante/home");
        await expect(page).toHaveURL(RUTA_BIENVENIDA);
    });
});
