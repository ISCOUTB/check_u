import { expect, test, type Page } from "@playwright/test";
import {
    formatearFechaPeriodo,
    formatearFechaSolicitud,
    formatearPeriodo,
    normalizarSolicitud,
    presentarEstado,
} from "@/app/estudiante/solicitudes/listado";
import {
    ANCHOS,
    API,
    DETALLE_ESTUDIANTE,
    LISTADO_ESTUDIANTE,
    revisarPagina,
    sesionComo,
    TEMAS,
} from "./soporte";

const RUTA = "/estudiante/solicitudes";

async function conListado(
    page: Page,
    respuesta: unknown = LISTADO_ESTUDIANTE,
): Promise<void> {
    await sesionComo(page, "estudiante");
    await page.route(`${API}/estudiante/solicitudes`, (ruta) =>
        ruta.fulfill({ status: 200, json: respuesta }),
    );
}

/** La fila empieza por el número de solicitud; evita confundirla con fechas. */
function fila(page: Page, id: string) {
    return page.getByRole("row", { name: new RegExp(`^${id} `) });
}

test.describe("presentación del listado de preinscripciones", () => {
    test("traduce los estados internos del backend a las etiquetas del estudiante", () => {
        expect(presentarEstado("VALIDA")).toEqual({
            etiqueta: "Válida",
            tono: "valido",
        });
        expect(presentarEstado("NO_VALIDA")).toEqual({
            etiqueta: "Inválida",
            tono: "no_valido",
        });
        expect(presentarEstado("INCONSISTENTE")).toEqual({
            etiqueta: "Inconsistente",
            tono: "inconsistente",
        });
        expect(presentarEstado("POR_REVISAR")).toEqual({
            etiqueta: "Por revisar",
            tono: "por_revisar",
        });
        expect(presentarEstado("CANCELADA")).toEqual({
            etiqueta: "Cancelada",
            tono: "cancelada",
        });
        expect(presentarEstado("CERRADA")).toEqual({
            etiqueta: "Anulada",
            tono: "anulada",
        });
        expect(presentarEstado("EN_PROCESO").etiqueta).toBe("En proceso");
        expect(presentarEstado("BORRADOR").etiqueta).toBe("Borrador");
        expect(presentarEstado("OTRO_ESTADO")).toEqual({
            etiqueta: "OTRO_ESTADO",
            tono: "por_revisar",
        });
    });

    test("usa el día de Bogotá para la fecha de envío y no desplaza las fechas calendario", () => {
        // 02:00 UTC del 31 de octubre son las 21:00 del 30 en Bogotá.
        expect(formatearFechaSolicitud("2026-10-31T02:00:00.000Z")).toBe(
            "30/10/2026",
        );
        expect(formatearFechaSolicitud("2026-10-01")).toBe("01/10/2026");
        expect(formatearFechaSolicitud(null)).toBe("Sin enviar");
        expect(formatearFechaPeriodo("2026-10-01")).toBe("01/10/2026");
        expect(formatearFechaPeriodo(null)).toBe("Sin fecha");
        expect(
            formatearPeriodo({
                id: "periodo-1",
                nombre: "Grado octubre 2026",
                fechaInicio: "2026-10-01",
                fechaFin: "2026-10-31",
            }),
        ).toBe("01/10/2026 – 31/10/2026");
        expect(formatearPeriodo(null)).toBe("Sin periodo asignado");
    });

    test("normaliza el contrato y conserva las solicitudes del historial", () => {
        const solicitud = normalizarSolicitud(
            LISTADO_ESTUDIANTE.solicitudes[4],
        );
        expect(solicitud).toMatchObject({
            id: "5",
            nivel: "PREGRADO",
            estado: "CANCELADA",
            activa: false,
            periodo: { nombre: "Grado octubre 2026" },
        });
        expect(solicitud.canceladaEn).toBe("2026-08-20T14:00:00.000Z");
    });

    test("rechaza una fila sin los campos obligatorios del contrato", () => {
        expect(() =>
            normalizarSolicitud({
                id: "1",
                nivel: "PREGRADO",
                estado: "VALIDA",
                activa: true,
                fechaSolicitud: null,
                // falta fechaCreacion
                canceladaEn: null,
                periodo: null,
            }),
        ).toThrow("Solicitud inválida.");
        expect(() =>
            normalizarSolicitud({
                id: "2",
                nivel: "DOCTORADO",
                estado: "VALIDA",
                activa: true,
                fechaSolicitud: null,
                fechaCreacion: "2026-10-01T00:00:00.000Z",
                canceladaEn: null,
                periodo: null,
            }),
        ).toThrow("Solicitud inválida.");
    });
});

test.describe("vista de solicitudes de grado", () => {
    for (const tema of TEMAS) {
        for (const ancho of ANCHOS) {
            test(`accesible y sin desborde (${tema}, ${ancho}px)`, async ({
                page,
            }) => {
                await conListado(page);
                await revisarPagina(page, RUTA, tema, ancho);
            });
        }
    }

    test("muestra todas las solicitudes con su ID, nivel, estado, fecha, periodo y acción", async ({
        page,
    }) => {
        await conListado(page);
        await page.goto(RUTA);

        await expect(
            page.getByRole("heading", {
                level: 1,
                name: "Mis solicitudes de grado",
            }),
        ).toBeVisible();
        await expect(
            page.getByRole("heading", {
                level: 2,
                name: "Historial de preinscripciones",
            }),
        ).toBeVisible();

        const filaValida = fila(page, "9");
        await expect(filaValida).toContainText("PREGRADO");
        await expect(filaValida).toContainText("Válida");
        await expect(filaValida).toContainText("30/10/2026");
        await expect(filaValida).toContainText("Grado octubre 2026");
        await expect(filaValida).toContainText("01/10/2026 – 31/10/2026");
        await expect(
            filaValida.getByRole("link", {
                name: "Ver detalle de la solicitud 9",
            }),
        ).toHaveAttribute("href", "/estudiante/preinscripcion?solicitud=9");

        const filaPosgrado = fila(page, "8");
        await expect(filaPosgrado).toContainText("POSGRADO");
        await expect(filaPosgrado).toContainText("Inválida");

        await expect(fila(page, "7")).toContainText("Inconsistente");
        await expect(fila(page, "6")).toContainText("Por revisar");

        // Las solicitudes canceladas y anuladas siguen visibles y marcadas.
        const filaCancelada = fila(page, "5");
        await expect(filaCancelada).toContainText("Cancelada");
        await expect(filaCancelada).toContainText("Historial");
        await expect(filaCancelada).toHaveAttribute("data-activa", "false");

        const filaAnulada = fila(page, "4");
        await expect(filaAnulada).toContainText("Anulada");
        await expect(filaAnulada).toContainText("Historial");
        await expect(filaAnulada).toHaveAttribute("data-activa", "false");

        await expect(
            page.getByRole("link", {
                name: "Ver detalle de la solicitud 5",
            }),
        ).toHaveAttribute("href", "/estudiante/preinscripcion?solicitud=5");
    });

    test("en el celular usa tarjetas equivalentes a la tabla", async ({
        page,
    }) => {
        await conListado(page);
        await page.setViewportSize({ width: 320, height: 900 });
        await page.goto(RUTA);

        const tarjetas = page.getByRole("list", {
            name: "Listado de solicitudes de grado",
        });
        await expect(tarjetas.getByRole("listitem")).toHaveCount(6);
        await expect(
            tarjetas.getByRole("listitem").filter({ hasText: "Cancelada" }),
        ).toContainText("Historial");
        await expect(
            tarjetas.getByRole("link", {
                name: "Ver detalle de la solicitud 9",
            }),
        ).toHaveAttribute("href", "/estudiante/preinscripcion?solicitud=9");
    });

    test("permite abrir el detalle histórico de una solicitud cancelada", async ({
        page,
    }) => {
        await conListado(page);
        await page.route(`${API}/estudiante/solicitudes/5/analisis`, (ruta) =>
            ruta.fulfill({
                status: 200,
                json: {
                    ...DETALLE_ESTUDIANTE,
                    id: "5",
                    estadoSolicitud: "CANCELADA",
                    cancelacion: {
                        permitida: false,
                        canceladaEn: "2026-08-20T14:00:00.000Z",
                        fechaActual: "2026-10-31",
                        nombrePeriodo: "Grado octubre 2026",
                        fechaCorte: "2026-10-24",
                        diasRestantes: 0,
                    },
                },
            }),
        );
        await page.goto(RUTA);
        await page
            .getByRole("link", { name: "Ver detalle de la solicitud 5" })
            .click();

        await expect(page).toHaveURL(/\/estudiante\/preinscripcion\?solicitud=5$/);
        await expect(
            page.getByRole("heading", { name: "Detalle de mi preinscripción" }),
        ).toBeVisible();
        await expect(page.getByText("Consulta histórica")).toBeVisible();
    });

    test("muestra un estado vacío sin inventar solicitudes", async ({ page }) => {
        await conListado(page, { solicitudes: [] });
        await page.goto(RUTA);

        await expect(
            page.getByRole("heading", {
                name: "No tienes solicitudes registradas",
            }),
        ).toBeVisible();
        await expect(
            page.getByRole("link", { name: "Iniciar una preinscripción" }),
        ).toHaveAttribute("href", "/estudiante/bienvenida");
        await expect(page.getByText("0 solicitudes")).toBeVisible();
    });

    test("informa el error y permite reintentar la consulta", async ({ page }) => {
        await sesionComo(page, "estudiante");
        let intentos = 0;
        await page.route(`${API}/estudiante/solicitudes`, (ruta) => {
            intentos += 1;
            return intentos === 1
                ? ruta.fulfill({
                      status: 500,
                      json: { message: "Fallo simulado." },
                  })
                : ruta.fulfill({ status: 200, json: LISTADO_ESTUDIANTE });
        });

        await page.goto(RUTA);
        await expect(
            page.getByRole("alert").filter({ hasText: /No fue posible/ }),
        ).toContainText("No fue posible consultar tus solicitudes.");

        await page.getByRole("button", { name: "Reintentar" }).click();
        await expect(fila(page, "9")).toContainText("Válida");
        expect(intentos).toBe(2);
    });

    test("actualiza el estado de los registros al pulsar Actualizar", async ({
        page,
    }) => {
        await sesionComo(page, "estudiante");
        let consultas = 0;
        await page.route(`${API}/estudiante/solicitudes`, (ruta) => {
            consultas += 1;
            const estado = consultas === 1 ? "VALIDA" : "NO_VALIDA";
            return ruta.fulfill({
                status: 200,
                json: {
                    solicitudes: [
                        {
                            ...LISTADO_ESTUDIANTE.solicitudes[0],
                            estado,
                        },
                    ],
                },
            });
        });

        await page.goto(RUTA);
        await expect(fila(page, "9")).toContainText("Válida");

        await page.getByRole("button", { name: "Actualizar" }).click();
        await expect(fila(page, "9")).toContainText("Inválida");
        expect(consultas).toBe(2);
    });

    test("un funcionario es redirigido a su dashboard", async ({ page }) => {
        await sesionComo(page, "funcionario");
        await page.goto(RUTA);
        await expect(page).toHaveURL(/\/funcionario\/dashboard$/);
    });
});
