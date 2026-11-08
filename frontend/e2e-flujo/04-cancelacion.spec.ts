import { expect, test } from "@playwright/test";
import {
    abrirDetalle, abrirFormulario, dashboardConPeriodo, abrirPreinscripcion, captura, entrar, ESTUDIANTE, estadoSolicitud, FUNCIONARIA, motor,
    preinscribir, reiniciar, sesion, sql,
} from "./soporte";

// Escenario 8 de la #133: el estudiante cancela su solicitud.

test.describe("Escenario 8: cancelación por el estudiante", () => {
    test.beforeEach(reiniciar);

    test("E8 sale del dashboard, bloquea el periodo y queda en el historial", async ({ page, browser }) => {
        await motor("controlado", { identification: "invalid" });
        await entrar(page, ESTUDIANTE);
        const id = await preinscribir(page);
        const funcionaria = await sesion(browser, FUNCIONARIA);
        await dashboardConPeriodo(funcionaria);
        await expect(funcionaria.getByRole("region", { name: "Tabla de solicitudes de grado" })).toContainText(String(id));

        await abrirPreinscripcion(page, id);
        await page.getByRole("button", { name: "Cancelar preinscripción", exact: true }).click();
        const dialogo = page.getByRole("dialog");
        await captura(page, "08-a-confirmar-cancelacion", false);
        await dialogo.getByRole("button", { name: "Confirmar cancelación", exact: true }).click();
        await expect.poll(() => estadoSolicitud(id)).toBe("CANCELADA");
        await page.waitForLoadState("networkidle");
        await captura(page, "08-b-solicitud-cancelada");

        // Ya no aparece en el dashboard.
        await dashboardConPeriodo(funcionaria);
        await expect(funcionaria.getByRole("heading", { name: "No hay solicitudes" })).toBeVisible();
        await captura(funcionaria, "08-c-dashboard-sin-la-solicitud");

        // El periodo queda deshabilitado para ese estudiante.
        await abrirFormulario(page, "pregrado");
        await expect(page.getByText("Sin periodo disponible")).toBeVisible();
        await captura(page, "08-d-periodo-deshabilitado", false);

        // Estado e historial del estudiante.
        await page.goto("/estudiante/solicitudes");
        await expect(page.getByRole("main")).toContainText(/Cancelada/);
        await captura(page, "08-e-historial-estudiante");
        expect(sql(`SELECT count(*) FROM documentos WHERE id_solicitud=${id}`)[0]).not.toBe("0");

        // La funcionaria también debe poder consultar el historial de una solicitud cancelada (escenario 13).
        await abrirDetalle(funcionaria, id, "Historial");
        await captura(funcionaria, "08-f-historial-funcionaria");
        const panel = funcionaria.getByRole("tabpanel");
        await expect(panel).toContainText("Solicitud cancelada por el estudiante");
        await expect(panel).toContainText("Estudiante Prueba");
        await expect(panel).toContainText("Estado anterior: No válida");
        await expect(panel).toContainText("Estado final: Cancelada");
        const [fecha] = sql(`SELECT to_char(fecha_cancelacion AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
            FROM cancelaciones_preinscripcion WHERE id_solicitud=${id}`);
        const horaBogota = new Date(fecha).toLocaleString("es-CO", { timeZone: "America/Bogota" });
        await expect(panel.locator("time")).toHaveAttribute("datetime", fecha);
        await expect(panel.locator("time")).toHaveText(horaBogota.replace(/\s+/g, " "));
        await expect(panel.getByText("No hay revisiones registradas.")).toHaveCount(0);
    });
});
