import { expect, test } from "@playwright/test";
import {
    claveDocumento,
    construirRequisitos,
    estadoDocumento,
    formatearFechaCorta,
    periodoDeSolicitud,
    progresoRequisitos,
} from "@/app/estudiante/home/resumen";
import type {
    DocumentoSolicitud,
    EstadoDocumento,
} from "@/app/estudiante/preinscripcion/types";
import { API, DETALLE_ESTUDIANTE, PERIODO_DEMO, sesionComo } from "./soporte";

// Lógica pura y presentación de "Mi solicitud de grado" (issue #105).

function documento(
    tipo: DocumentoSolicitud["tipo"],
    orden: number,
    estados: EstadoDocumento[],
    extras: Partial<DocumentoSolicitud> = {},
): DocumentoSolicitud {
    return {
        id: `${tipo}-${orden}`,
        tipo,
        orden,
        nombre: `${tipo} ${orden}`,
        descripcion: "archivo.pdf",
        resultados: estados.map((estado) => ({
            estado,
            mensaje: `Mensaje ${estado}.`,
        })),
        resubmission_allowed: false,
        ...extras,
    };
}

test.describe("resumen documental de la solicitud", () => {
    test("pregrado exige 5 requisitos aunque aún no haya documentos", () => {
        const requisitos = construirRequisitos("PREGRADO", false, []);

        expect(requisitos.map((requisito) => requisito.clave)).toEqual([
            "identification",
            "academic_evaluation",
            "paz_y_salvo_bib",
            "estampilla_pro_cultura",
            "saber_pro",
        ]);
        expect(requisitos.every((requisito) => requisito.estado === "falta_cargar")).toBe(true);
        expect(progresoRequisitos(requisitos)).toEqual({ validos: 0, total: 5 });
    });

    test("doble programa agrega la segunda evaluación de Banner y la segunda estampilla al final", () => {
        const requisitos = construirRequisitos("PREGRADO", true, [
            documento("estampilla_pro_cultura", 2, ["valido"], {
                nombre: "Estampilla Pro-Cultura · segundo programa",
            }),
        ]);

        expect(requisitos.map((requisito) => requisito.clave)).toEqual([
            "identification",
            "academic_evaluation",
            "paz_y_salvo_bib",
            "estampilla_pro_cultura",
            "saber_pro",
            "academic_evaluation-2",
            "estampilla_pro_cultura-2",
        ]);
        expect(requisitos.at(-1)).toMatchObject({
            nombre: "Estampilla Pro-Cultura · segundo programa",
            estado: "valido",
        });
        expect(progresoRequisitos(requisitos)).toEqual({ validos: 1, total: 7 });
    });

    test("posgrado exige 3 requisitos y no duplica la estampilla", () => {
        const requisitos = construirRequisitos("POSGRADO", true, []);

        expect(requisitos.map((requisito) => requisito.clave)).toEqual([
            "identification",
            "paz_y_salvo_bib",
            "estampilla_pro_cultura",
        ]);
        expect(progresoRequisitos(requisitos)).toEqual({ validos: 0, total: 3 });
    });

    test("un documento solo es válido si todas sus comprobaciones lo son", () => {
        expect(estadoDocumento(documento("paz_y_salvo_bib", 1, ["valido", "valido"]))).toBe("valido");
        expect(estadoDocumento(documento("paz_y_salvo_bib", 1, ["valido", "por_revisar"]))).toBe("por_revisar");
        expect(estadoDocumento(documento("paz_y_salvo_bib", 1, ["inconsistente", "no_valido"]))).toBe("no_valido");
        expect(estadoDocumento(documento("paz_y_salvo_bib", 1, ["inconsistente", "por_revisar"]))).toBe("inconsistente");
        expect(estadoDocumento(documento("paz_y_salvo_bib", 1, []))).toBe("por_revisar");
    });

    test("conserva las observaciones reales del backend y las agrupa sin repetir", () => {
        const requisitos = construirRequisitos("PREGRADO", false, [
            documento("identification", 1, ["no_valido"], {
                resultados: [
                    { estado: "no_valido", mensaje: "El documento está vencido." },
                    { estado: "no_valido", mensaje: "El documento está vencido." },
                    { estado: "inconsistente", mensaje: "El nombre no coincide." },
                ],
            }),
        ]);

        expect(requisitos[0]).toMatchObject({
            estado: "no_valido",
            observaciones: ["El documento está vencido.", "El nombre no coincide."],
        });
    });

    test("sin observación usa el mensaje de referencia del estado", () => {
        const requisitos = construirRequisitos("PREGRADO", false, [
            documento("identification", 1, [], { resultados: [] }),
        ]);

        expect(requisitos[0].estado).toBe("por_revisar");
        expect(requisitos[0].observaciones).toEqual([
            "El requisito está pendiente de análisis o requiere revisión manual.",
        ]);
    });

    test("claveDocumento distingue el segundo programa", () => {
        expect(claveDocumento({ tipo: "estampilla_pro_cultura", orden: 1 })).toBe(
            "estampilla_pro_cultura",
        );
        expect(claveDocumento({ tipo: "estampilla_pro_cultura", orden: 2 })).toBe(
            "estampilla_pro_cultura-2",
        );
    });

    test("el periodo asignado tiene prioridad sobre el disponible", () => {
        const asignado = { ...PERIODO_DEMO, fechaCorte: "2026-10-24" };
        const disponible = {
            ...PERIODO_DEMO,
            id: "periodo-2026-2",
            nombre: "Grado diciembre 2026",
            fechaCorte: "2026-11-24",
        };

        expect(
            periodoDeSolicitud({
                periodos: {
                    fechaActual: "2026-10-15",
                    periodoAsignado: asignado,
                    periodoDisponible: disponible,
                    proximosPeriodos: [],
                },
            }),
        ).toBe(asignado);
        expect(
            periodoDeSolicitud({
                periodos: {
                    fechaActual: "2026-10-15",
                    periodoAsignado: null,
                    periodoDisponible: disponible,
                    proximosPeriodos: [],
                },
            }),
        ).toBe(disponible);
        expect(periodoDeSolicitud(null)).toBeNull();
    });

    test("las fechas calendario se muestran sin desfase de zona horaria", () => {
        expect(formatearFechaCorta("2026-10-01")).toBe("01/10/2026");
        expect(formatearFechaCorta(undefined)).toBe("Sin fecha");
    });
});

test.describe("Mi solicitud de grado en el inicio", () => {
    test("muestra el periodo, el progreso y las observaciones reales", async ({ page }) => {
        await sesionComo(page, "estudiante");
        await page.goto("/estudiante/home");

        const tarjeta = page.locator("#mi-solicitud");
        await expect(tarjeta).toContainText("PREGRADO");
        await expect(tarjeta).toContainText("Grado octubre 2026");
        await expect(tarjeta).toContainText("01/10/2026");
        await expect(tarjeta).toContainText("31/10/2026");
        await expect(tarjeta).toContainText("1 de 5 requisitos válidos");
        await expect(tarjeta).toContainText("Identidad verificada.");
        await expect(tarjeta).toContainText("Pendiente de revisión manual.");
        await expect(tarjeta).toContainText("El valor pagado no coincide");
        await expect(tarjeta).toContainText("Aún no has cargado este documento.");
    });

    test("el doble programa muestra la segunda estampilla y su propio progreso", async ({ page }) => {
        const detalleDoble = {
            ...DETALLE_ESTUDIANTE,
            informacion: {
                ...DETALLE_ESTUDIANTE.informacion,
                tieneSegundoPrograma: true,
            },
            documentos: [
                ...DETALLE_ESTUDIANTE.documentos,
                {
                    ...DETALLE_ESTUDIANTE.documentos[2],
                    id: "13",
                    orden: 2,
                    nombre: "Estampilla Pro-Cultura · segundo programa",
                },
            ],
        };

        await sesionComo(page, "estudiante");
        await page.route(`${API}/estudiante/solicitud/analisis`, (ruta) =>
            ruta.fulfill({ status: 200, json: detalleDoble }),
        );
        await page.goto("/estudiante/home");

        const tarjeta = page.locator("#mi-solicitud");
        await expect(tarjeta).toContainText("PREGRADO · doble programa");
        await expect(
            tarjeta.getByText("Estampilla Pro-Cultura · segundo programa"),
        ).toBeVisible();
        await expect(tarjeta).toContainText("1 de 7 requisitos válidos");
    });

    test("posgrado muestra solo sus 3 requisitos", async ({ page }) => {
        const detallePosgrado = {
            ...DETALLE_ESTUDIANTE,
            estudiante: { ...DETALLE_ESTUDIANTE.estudiante, nivel: "POSGRADO" },
            documentos: [DETALLE_ESTUDIANTE.documentos[0]],
        };

        await sesionComo(page, "estudiante");
        await page.route(`${API}/estudiante/solicitud/analisis`, (ruta) =>
            ruta.fulfill({ status: 200, json: detallePosgrado }),
        );
        await page.goto("/estudiante/home");

        const tarjeta = page.locator("#mi-solicitud");
        await expect(tarjeta).toContainText("POSGRADO");
        await expect(tarjeta.locator("li")).toHaveCount(3);
        await expect(tarjeta).toContainText("1 de 3 requisitos válidos");
        await expect(tarjeta).not.toContainText("Evaluación de Grado");
        await expect(tarjeta).not.toContainText("Saber Pro");
    });

    test("los requisitos faltantes y corregibles enlazan a la preinscripción", async ({ page }) => {
        await sesionComo(page, "estudiante");
        await page.goto("/estudiante/home");

        const subir = page.getByRole("link", {
            name: "Subir documento: Paz y Salvo de Biblioteca",
        });
        await expect(subir).toHaveAttribute("href", "/estudiante/preinscripcion");

        const corregir = page.getByRole("link", {
            name: "Subir nueva versión: Estampilla Pro-Cultura",
        });
        await expect(corregir).toHaveAttribute("href", "/estudiante/preinscripcion");
    });

    test("un fallo del análisis documental no inventa requisitos y permite reintentar", async ({ page }) => {
        await sesionComo(page, "estudiante");
        await page.route(`${API}/estudiante/solicitud/analisis`, (ruta) =>
            ruta.fulfill({ status: 503, json: { message: "Base de datos no disponible" } }),
        );
        await page.goto("/estudiante/home");

        const tarjeta = page.locator("#mi-solicitud");
        await expect(tarjeta.getByRole("alert")).toContainText(
            "No fue posible cargar el resumen de tu solicitud.",
        );
        await expect(tarjeta.getByRole("button", { name: "Reintentar" })).toBeVisible();
    });
});
