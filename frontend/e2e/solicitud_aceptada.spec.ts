import { expect, test, type Page } from "@playwright/test";
import { presentarEstado } from "@/app/estudiante/solicitudes/listado";
import { API, DETALLE_ESTUDIANTE, PERIODO_DEMO, sesionComo } from "./soporte";

// Tarea 57 (#150, H-03): una solicitud aceptada es un estado final en el inicio del estudiante.

const ID = "21";

const TIPOS_PREGRADO = [
    "identification",
    "academic_evaluation",
    "paz_y_salvo_bib",
    "estampilla_pro_cultura",
    "saber_pro",
] as const;

/** Detalle con los cinco requisitos válidos y sin reenvíos, como queda al aceptarla. */
function detalle(estadoSolicitud: string) {
    return {
        ...DETALLE_ESTUDIANTE,
        id: ID,
        estadoSolicitud,
        documentos: TIPOS_PREGRADO.map((tipo, indice) => ({
            ...DETALLE_ESTUDIANTE.documentos[0],
            id: String(30 + indice),
            tipo,
            orden: 1,
            nombre: `Documento ${tipo}`,
            resultados: [{ estado: "valido", mensaje: "Cumple los requisitos revisados." }],
            resubmission_allowed: false,
        })),
    };
}

async function preparar(page: Page, estado: string, activa: boolean) {
    await sesionComo(page, "estudiante");
    await page.route(`${API}/estudiante/solicitudes`, (ruta) =>
        ruta.fulfill({
            status: 200,
            json: {
                solicitudes: [
                    {
                        id: ID,
                        nivel: "PREGRADO",
                        estado,
                        activa,
                        fechaSolicitud: "2026-10-04T15:00:00.000Z",
                        fechaCreacion: "2026-10-01T15:00:00.000Z",
                        canceladaEn: estado === "CANCELADA" ? "2026-10-06T15:00:00.000Z" : null,
                        periodo: { ...PERIODO_DEMO, fechaCorte: "2026-10-24" },
                    },
                ],
            },
        }),
    );
    await page.route(`${API}/estudiante/solicitudes/${ID}/analisis`, (ruta) =>
        ruta.fulfill({ status: 200, json: detalle(estado) }),
    );
    await page.goto("/estudiante/home");
    await expect(page.locator("#mi-solicitud")).toContainText("requisitos válidos");
}

const bienvenida = (page: Page) => page.getByRole("region", { name: /Tu solicitud/ });

test.describe("solicitud aceptada en el inicio del estudiante", () => {
    test("ACEPTADA se presenta como Aceptada", () => {
        expect(presentarEstado("ACEPTADA")).toEqual({ etiqueta: "Aceptada", tono: "aceptada" });
    });

    test("dice que fue aceptada, muestra el estado y no la ofrece como en curso", async ({ page }) => {
        // El backend la marca activa: impide iniciar otra preinscripción.
        await preparar(page, "ACEPTADA", true);

        await expect(
            page.getByRole("heading", { name: "Tu solicitud de grado fue aceptada" }),
        ).toBeVisible();
        await expect(bienvenida(page)).toContainText(
            "Tu solicitud de pregrado fue aceptada. Puedes consultar su detalle y el historial completo.",
        );
        await expect(page.getByRole("heading", { name: "Tu solicitud de grado está en curso" })).toHaveCount(0);
        await expect(page.getByRole("link", { name: "Continuar mi preinscripción" })).toHaveCount(0);
        await expect(page.getByRole("link", { name: "Nueva preinscripción" })).toHaveCount(0);

        const tarjeta = page.locator("#mi-solicitud");
        await expect(tarjeta).toContainText("Estado:");
        await expect(tarjeta.locator("[data-estado]", { hasText: "Aceptada" })).toBeVisible();
        await expect(tarjeta.getByRole("link", { name: /^Subir/ })).toHaveCount(0);
    });

    test("permite consultar el detalle en solo lectura", async ({ page }) => {
        await preparar(page, "ACEPTADA", true);

        const revisar = bienvenida(page).getByRole("link", { name: "Revisar" });
        await expect(revisar).toHaveAttribute("href", `/estudiante/preinscripcion?solicitud=${ID}`);
        await revisar.click();
        await expect(page).toHaveURL(`/estudiante/preinscripcion?solicitud=${ID}`);
        await expect(page.getByLabel("Estado de la preinscripción")).toContainText("Aceptada");
        await expect(page.getByRole("button", { name: "Cancelar preinscripción" })).toHaveCount(0);
    });

    test("una solicitud en curso no cambia", async ({ page }) => {
        await preparar(page, "VALIDA", true);

        await expect(
            page.getByRole("heading", { name: "Tu solicitud de grado está en curso" }),
        ).toBeVisible();
        await expect(page.getByRole("link", { name: "Continuar mi preinscripción" })).toBeVisible();
        await expect(page.locator("#mi-solicitud")).not.toContainText("Estado:");
    });

    test("una solicitud anulada no cambia", async ({ page }) => {
        await preparar(page, "CERRADA", false);

        await expect(
            page.getByRole("heading", { name: "Tu solicitud más reciente está anulada" }),
        ).toBeVisible();
        await expect(bienvenida(page).getByRole("link")).toHaveCount(0);
        await expect(page.getByRole("link", { name: "Nueva preinscripción" })).toBeVisible();
        await expect(page.locator("#mi-solicitud [data-estado]", { hasText: "Anulada" })).toBeVisible();
    });

    test("una solicitud cancelada no cambia", async ({ page }) => {
        await preparar(page, "CANCELADA", false);

        await expect(
            page.getByRole("heading", { name: "Tu solicitud más reciente está cancelada" }),
        ).toBeVisible();
        await expect(bienvenida(page).getByRole("link", { name: "Revisar" })).toBeVisible();
        await expect(page.getByRole("link", { name: "Nueva preinscripción" })).toBeVisible();
    });
});
