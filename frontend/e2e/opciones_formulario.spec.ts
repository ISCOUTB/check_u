import { expect, test, type Page } from "@playwright/test";
import { API, revisarAxe, sesionComo } from "./soporte";

// Tarea 40: panel del funcionario para administrar las opciones del formulario.
// El backend se simula en soporte.ts (catálogo en memoria).

const RUTA = "/funcionario/opciones";
const FORMULARIO = "/estudiante/iniciar_preinscripcion?nivel=PREGRADO";

function bloque(page: Page, titulo: string) {
    return page.getByRole("region", { name: titulo });
}

async function abrirPanel(page: Page): Promise<void> {
    await sesionComo(page, "funcionario");
    await page.goto(RUTA);
    await expect(
        page.getByRole("heading", { level: 1, name: "Opciones del formulario de preinscripción" }),
    ).toBeVisible();
    await expect(bloque(page, "Tipo de documento")).toBeVisible();
}

test.describe("opciones del formulario", () => {
    test("el funcionario llega desde la barra de navegación", async ({ page }) => {
        await sesionComo(page, "funcionario");
        await page.goto("/funcionario/dashboard");
        await page.getByRole("button", { name: /Rafael Prueba/ }).click();
        await page.getByRole("link", { name: "Opciones del formulario" }).click();
        await expect(page).toHaveURL(RUTA);
        await expect(
            page.getByRole("heading", { level: 1, name: "Opciones del formulario de preinscripción" }),
        ).toBeVisible();
    });

    test("crea, reordena y elimina una opción sin afectar los demás bloques", async ({ page }) => {
        await abrirPanel(page);

        const tipoDocumento = bloque(page, "Tipo de documento");
        const lista = tipoDocumento.getByRole("list", { name: "Opciones de Tipo de documento" });
        const genero = bloque(page, "Género");

        await tipoDocumento.getByLabel("Nueva opción").fill("Cédula diplomática");
        await tipoDocumento.getByRole("button", { name: "Agregar" }).click();
        await expect(tipoDocumento.getByRole("status")).toHaveText("Se agregó «Cédula diplomática».");
        await expect(lista.getByRole("listitem").last()).toContainText("Cédula diplomática");
        await expect(genero).not.toContainText("Cédula diplomática");

        for (let veces = 0; veces < 4; veces++) {
            await tipoDocumento.getByRole("button", { name: "Subir Cédula diplomática" }).click();
        }
        await expect(lista.getByRole("listitem").first()).toContainText("Cédula diplomática");
        await expect(tipoDocumento.getByRole("status")).toHaveText("Se actualizó el orden de las opciones.");

        await tipoDocumento.getByRole("button", { name: "Eliminar Cédula diplomática" }).click();
        const dialogo = page.getByRole("dialog", { name: "Eliminar opción" });
        await expect(dialogo).toBeVisible();
        await dialogo.getByRole("button", { name: "Eliminar", exact: true }).click();
        await expect(page.getByRole("status").filter({ hasText: "Se eliminó «Cédula diplomática»." })).toBeVisible();
        await expect(lista).not.toContainText("Cédula diplomática");
    });

    test("importa un CSV separado por punto y coma e informa duplicados", async ({ page }) => {
        await abrirPanel(page);
        const genero = bloque(page, "Género");

        await genero.locator('input[type="file"]').setInputFiles({
            name: "generos.csv",
            mimeType: "text/csv",
            buffer: Buffer.from("Nuevo género;NUEVO_GENERO\nOtro nuevo género\nFemenino\n"),
        });

        await expect(genero.getByRole("status")).toHaveText("Se importaron 2 opciones.");
        await expect(genero).toContainText("Nuevo género");
        await expect(genero).toContainText("Otro nuevo género");
        await expect(genero).toContainText("Duplicadas:");
        await expect(genero).toContainText("«Femenino» (línea 3)");
    });

    test("rechaza un archivo que no es CSV", async ({ page }) => {
        await abrirPanel(page);
        const genero = bloque(page, "Género");

        await genero.locator('input[type="file"]').setInputFiles({
            name: "generos.txt",
            mimeType: "text/plain",
            buffer: Buffer.from("Nuevo género"),
        });

        await expect(genero.getByRole("alert")).toHaveText("Selecciona un archivo con extensión .csv.");
        await expect(genero).not.toContainText("Nuevo género");
    });

    test("el formulario respeta el orden configurado en el panel", async ({ page }) => {
        await sesionComo(page, "estudiante");
        await page.route(`${API}/opciones-campo`, (ruta) =>
            ruta.fulfill({
                status: 200,
                json: [
                    { id: 2, campo: "TIPO_DOCUMENTO", valor: "PASAPORTE", etiqueta: "Pasaporte", orden: 1 },
                    { id: 1, campo: "TIPO_DOCUMENTO", valor: "CC", etiqueta: "Cédula de ciudadanía", orden: 2 },
                    { id: 10, campo: "PROGRAMA", valor: "INGENIERIA", etiqueta: "Ingeniería", orden: 1 },
                ],
            }),
        );
        await page.goto(FORMULARIO);

        const tipoDocumento = page.getByLabel("Tipo de documento (obligatorio)");
        await expect(tipoDocumento.locator("option")).toHaveText([
            "Selecciona una opción",
            "Pasaporte",
            "Cédula de ciudadanía",
        ]);
        await expect(page.getByLabel("Programa (obligatorio)").locator("option")).toHaveText([
            "Selecciona una opción",
            "Ingeniería",
        ]);
    });

    test("el panel es accesible y no desborda en móvil", async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 900 });
        await sesionComo(page, "funcionario");
        await page.goto(RUTA);
        await page.locator('main#contenido:not([aria-busy="true"])').waitFor();
        await revisarAxe(page);
        const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(desborde, "scroll horizontal en píxeles").toBeLessThanOrEqual(0);
    });
});
