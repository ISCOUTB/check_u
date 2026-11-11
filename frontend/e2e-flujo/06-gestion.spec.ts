import { expect, test, type Page } from "@playwright/test";
import {
    abrirDetalle, API, abrirPreinscripcion, accionRevision, captura, dashboardConPeriodo, entrar, ESTUDIANTE, estadoSolicitud, FUNCIONARIA, motor,
    preinscribir, reenviarPorPantalla, reiniciar, sesion, sql,
} from "./soporte";

// Escenarios 12, 13 y 14 de la #133: gestión de la funcionaria, historial y anulación.

const TODO_VALIDO = { identification: "valid", academic_evaluation: "valid", estampilla_pro_cultura: "valid", saber_pro: "valid" } as const;

async function verInicioEstudiante(page: Page, nombre: string): Promise<void> {
    await page.goto("/estudiante/home");
    await page.locator("#mi-solicitud").waitFor();
    await captura(page, nombre);
}

test.describe("Escenario 12: revisión y gestión", () => {
    test.beforeEach(reiniciar);

    test("E12 la funcionaria ve el análisis, comenta, pide corrección y acepta", async ({ page, browser }) => {
        await motor("controlado", { ...TODO_VALIDO, estampilla_pro_cultura: "invalid" });
        await entrar(page, ESTUDIANTE);
        const id = await preinscribir(page);
        const funcionaria = await sesion(browser, FUNCIONARIA);

        // Selecciona la solicitud en el dashboard.
        await dashboardConPeriodo(funcionaria);
        await funcionaria.getByRole("region", { name: "Tabla de solicitudes de grado" }).getByRole("link", { name: /Ver/ }).first().click();
        await funcionaria.waitForURL(`**/funcionario/detalle_preinscripcion/${id}`);
        await captura(funcionaria, "12-a-detalle-resumen");
        await funcionaria.getByRole("tab", { name: /Información/ }).click();
        await captura(funcionaria, "12-b-detalle-informacion");
        await expect(funcionaria.getByRole("heading", { name: "Estudiante Prueba" })).toBeVisible();
        await expect(funcionaria.getByRole("tabpanel").locator("input").first()).toHaveValue("Estudiante");
        await funcionaria.getByRole("tab", { name: "Documentos" }).click();
        await funcionaria.getByRole("button", { name: "Ver análisis automático: Estampilla Pro-Cultura" }).click();
        await captura(funcionaria, "12-c-analisis-documento", false);
        await funcionaria.keyboard.press("Escape");

        // Comentario: el inicio conserva el resumen y el historial muestra el original.
        const comentario = "Comentario de prueba de la funcionaria sobre la estampilla.\nRevisa también la segunda línea.";
        await accionRevision(funcionaria, id, "comentario", comentario);
        await captura(funcionaria, "12-d-comentario-registrado");
        await verInicioEstudiante(page, "12-e-estudiante-tras-comentario");
        const panel = page.getByRole("region", { name: "Notificaciones", exact: true });
        await expect(panel).toContainText("Comentario de p…");
        await panel.getByRole("link", { name: "Ver todas las notificaciones" }).click();
        const historial = page.getByRole("region", { name: "Historial de notificaciones" });
        const aviso = historial.getByRole("listitem").filter({ hasText: "Nuevo comentario" });
        await expect(aviso.getByText("La funcionaria te dejó un comentario:", { exact: false }))
            .toHaveJSProperty("textContent", `La funcionaria te dejó un comentario: ${comentario}`);
        await expect(aviso.getByRole("link", { name: "Ver solicitud" }))
            .toHaveAttribute("href", `/estudiante/preinscripcion?solicitud=${id}`);
        await captura(page, "12-e2-estudiante-historial-tras-comentario");
        await aviso.getByRole("button", { name: "Marcar como leída: Nuevo comentario" }).click();
        await expect(aviso.getByText("Leída", { exact: true })).toBeVisible();
        const sinLeer = await historial.getByText(/^[0-9]+ sin leer$/).textContent();
        await page.getByRole("link", { name: "Inicio", exact: true }).click();
        await expect(panel.getByText(sinLeer!, { exact: true })).toBeVisible();

        // Solicitar corrección.
        await accionRevision(funcionaria, id, "recarga", "Sube de nuevo la estampilla.", ["Estampilla Pro-Cultura"]);
        await verInicioEstudiante(page, "12-f-estudiante-tras-correccion");

        // Aceptar no se permite mientras no sea válida.
        await abrirDetalle(funcionaria, id, "Acciones");
        await expect(funcionaria.locator('option[value="aceptada"]')).toHaveJSProperty("disabled", true);
        const aceptar = await funcionaria.request.post(`${API}/funcionario/solicitudes/${id}/revisiones`, { data: { accion: "aceptada" } });
        expect(aceptar.status(), "La API tampoco debe aceptar una solicitud que no es válida.").toBe(409);
        // Con un documento No válido, el estado calculado es No válida; «Solicitar corrección» no debería pisarlo.
        expect.soft(estadoSolicitud(id), "El estado no debe contradecir a los documentos tras pedir corrección.").toBe("NO_VALIDA");

        // El estudiante corrige; ya válida, la funcionaria acepta.
        await motor("controlado", TODO_VALIDO);
        await reenviarPorPantalla(page, id, "Estampilla Pro-Cultura");
        expect(estadoSolicitud(id)).toBe("VALIDA");
        await accionRevision(funcionaria, id, "aceptada", "Documentación completa.");
        expect(estadoSolicitud(id)).toBe("ACEPTADA");
        await captura(funcionaria, "12-g-solicitud-aceptada");
        await verInicioEstudiante(page, "12-h-estudiante-tras-aceptar");
        await expect(page.getByRole("region", { name: "Notificaciones", exact: true })).toContainText("Solicitud aceptada");
        await expect.soft(page.getByRole("heading", { name: "Tu solicitud de grado está en curso" }), "Una solicitud aceptada no debe mostrarse «en curso».").toHaveCount(0);
        await expect.soft(page.getByRole("link", { name: "Continuar mi preinscripción" }), "Una solicitud aceptada no tiene nada que continuar.").toHaveCount(0);
        await expect.soft(page.locator("#mi-solicitud"), "La tarjeta debe mostrar el estado, como ya lo hace con «Anulada».").toContainText("Aceptada", { timeout: 3000 });
        await abrirPreinscripcion(page, id);
        await expect(page.getByRole("button", { name: "Cancelar preinscripción", exact: true })).toHaveCount(0);
    });
});

test.describe("Escenario 13: historial", () => {
    test.beforeEach(reiniciar);

    test("E13 H-02 muestra la cancelación junto con las revisiones en orden", async ({ page, browser }) => {
        await motor("controlado", { ...TODO_VALIDO, saber_pro: "invalid" });
        await entrar(page, ESTUDIANTE);
        const id = await preinscribir(page);
        const funcionaria = await sesion(browser, FUNCIONARIA);
        const panel = funcionaria.getByRole("tabpanel");

        await abrirDetalle(funcionaria, id, "Historial");
        await expect(panel).toContainText("No hay revisiones registradas.");
        await accionRevision(funcionaria, id, "comentario", "Comentario anterior a la cancelación.");

        await abrirPreinscripcion(page, id);
        await page.getByRole("button", { name: "Cancelar preinscripción", exact: true }).click();
        await page.getByRole("dialog").getByRole("button", { name: "Confirmar cancelación", exact: true }).click();
        await expect.poll(() => estadoSolicitud(id)).toBe("CANCELADA");

        await abrirDetalle(funcionaria, id, "Historial");
        const eventos = panel.getByRole("listitem");
        await expect(eventos).toHaveCount(2);
        await expect(eventos.nth(0)).toContainText("Solicitud cancelada por el estudiante");
        await expect(eventos.nth(0)).toContainText("Estado anterior: No válida");
        await expect(eventos.nth(0)).toContainText("Estado final: Cancelada");
        await expect(eventos.nth(1)).toContainText("Comentario anterior a la cancelación.");
        await captura(funcionaria, "13-b-historial-con-cancelacion");
    });

    test("E13 el historial registra los eventos relevantes", async ({ page, browser }) => {
        await motor("controlado", { ...TODO_VALIDO, saber_pro: "invalid" });
        await entrar(page, ESTUDIANTE);
        const id = await preinscribir(page);
        await reenviarPorPantalla(page, id, "Resultados Saber Pro");
        const funcionaria = await sesion(browser, FUNCIONARIA);
        await accionRevision(funcionaria, id, "comentario", "Comentario para el historial.");
        await accionRevision(funcionaria, id, "anulada", "Anulación para el historial.");
        await abrirDetalle(funcionaria, id, "Historial");
        const panel = funcionaria.getByRole("tabpanel");
        await captura(funcionaria, "13-a-historial-funcionaria");
        await expect(funcionaria.locator("section[aria-labelledby='nombre-estudiante']")).toContainText("Ingeniería de Sistemas y Computación");
        await expect(funcionaria.locator("section[aria-labelledby='nombre-estudiante']")).not.toContainText("INGENIERIA_DE_SISTEMAS_Y_COMPUTACION");

        // Lo que la #133 pide ver en el historial.
        await expect.soft(panel, "Acciones de la funcionaria").toContainText("Solicitud anulada");
        await expect.soft(panel, "Comentarios").toContainText("Comentario para el historial.");
        await expect.soft(panel, "Creación de la solicitud").toContainText(/creaci[oó]n|creada|enviada/i, { timeout: 2000 });
        await expect.soft(panel, "Envíos y reenvíos").toContainText(/reenv[ií]o/i, { timeout: 2000 });
        await expect.soft(panel, "Resultados del análisis").toContainText(/an[aá]lisis/i, { timeout: 2000 });
        await expect.soft(panel, "Cambios de estado").toContainText(/→|cambi[oó] a/i, { timeout: 2000 });

        // Lo que sí queda guardado en la base aunque la pantalla no lo muestre.
        test.info().annotations.push({
            type: "historial-en-bd",
            description: JSON.stringify({
                entregas: sql(`SELECT numero_entrega, tipo_entrega FROM entregas WHERE id_solicitud=${id} ORDER BY 1`),
                revisiones: sql(`SELECT resultado FROM revisiones WHERE id_solicitud=${id} ORDER BY id_revision`),
                validaciones: sql(`SELECT count(*) FROM validaciones v JOIN documentos d USING (id_documento) WHERE d.id_solicitud=${id}`)[0],
            }),
        });
    });
});

test.describe("Escenario 14: anulación por la funcionaria", () => {
    test.beforeEach(reiniciar);

    test("E14 la anulación se ve en el inicio del estudiante y en el historial", async ({ page, browser }) => {
        await motor("controlado", TODO_VALIDO);
        await entrar(page, ESTUDIANTE);
        const id = await preinscribir(page);
        const funcionaria = await sesion(browser, FUNCIONARIA);
        await abrirDetalle(funcionaria, id, "Acciones");
        await captura(funcionaria, "14-a-acciones-antes-de-anular");
        await accionRevision(funcionaria, id, "anulada", "Motivo de anulación de prueba.");
        await captura(funcionaria, "14-b-solicitud-anulada");
        expect(estadoSolicitud(id)).toBe("CERRADA");

        // El estudiante vuelve a entrar.
        await page.context().clearCookies();
        await entrar(page, ESTUDIANTE);
        await verInicioEstudiante(page, "14-c-estudiante-tras-anular");
        await expect(page.getByRole("main")).toContainText(/Anulada/);
        await expect.soft(page.getByRole("main"), "El estudiante debe ver la información asociada a la anulación.").toContainText("Motivo de anulación de prueba", { timeout: 3000 });

        await abrirDetalle(funcionaria, id, "Historial");
        await expect(funcionaria.getByRole("tabpanel")).toContainText("Solicitud anulada");
        await expect(funcionaria.getByRole("tabpanel")).toContainText("Motivo de anulación de prueba.");
        await captura(funcionaria, "14-d-historial-anulacion");
        expect(sql(`SELECT resultado FROM revisiones WHERE id_solicitud=${id}`)).toContain("RECHAZADA");
    });
});
