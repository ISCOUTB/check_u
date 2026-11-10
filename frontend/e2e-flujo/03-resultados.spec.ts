import { expect, test } from "@playwright/test";
import {
    abrirDetalle, abrirPreinscripcion, alma, captura, documentosEnBd, entrar, ESTUDIANTE, estadoSolicitud, FUNCIONARIA,
    motor, NOMBRES, preinscribir, reiniciar, sesion, sql,
} from "./soporte";

// Escenarios 4 a 7 de la #133: resultado de la solicitud. Como no hay documentos reales válidos, los que
// usan el motor controlado lo dicen en su título; los validadores reales se ejercitan en «No válida».

const TODO_VALIDO = { identification: "valid", academic_evaluation: "valid", estampilla_pro_cultura: "valid", saber_pro: "valid" } as const;

test.describe("Escenarios 4 a 7: resultado de la solicitud", () => {
    test.beforeEach(reiniciar);

    test("E4 Válida (motor controlado): todos los requisitos cumplen", async ({ page, browser }) => {
        await motor("controlado", TODO_VALIDO);
        await entrar(page, ESTUDIANTE);
        const id = await preinscribir(page);
        expect(estadoSolicitud(id)).toBe("VALIDA");
        expect(new Set(Object.values(documentosEnBd(id)))).toEqual(new Set(["VALIDO"]));
        await page.goto("/estudiante/home");
        await expect(page.locator("#mi-solicitud")).toContainText("5 de 5 requisitos válidos");
        await captura(page, "04-a-valida-estudiante-inicio");
        await abrirPreinscripcion(page, id);
        await expect(page.getByRole("button", { name: "Volver a cargar" })).toHaveCount(0);
        await captura(page, "04-b-valida-estudiante-detalle");
        const funcionaria = await sesion(browser, FUNCIONARIA);
        await abrirDetalle(funcionaria, id);
        await expect(funcionaria.getByText("Válida").first()).toBeVisible();
        await captura(funcionaria, "04-c-valida-funcionaria");
    });

    test("E5.1 No válida (motor real): PDF que no son los documentos pedidos", async ({ page, browser }) => {
        await entrar(page, ESTUDIANTE);
        const id = await preinscribir(page);
        expect(estadoSolicitud(id)).toBe("NO_VALIDA");
        await abrirPreinscripcion(page, id);
        await expect(page.getByText("El archivo no es una cédula", { exact: false }).first()).toBeVisible();
        await captura(page, "05-a-no-valida-motor-real");
        // Terminología: en toda la aplicación el estado es «No válida» (hallazgo del informe).
        await expect.soft(page.getByText(/Estado de la preinscripción:/).first()).toContainText("No válida");
        const funcionaria = await sesion(browser, FUNCIONARIA);
        await abrirDetalle(funcionaria, id);
        await expect(funcionaria.getByText("No válida").first()).toBeVisible();
        await captura(funcionaria, "05-b-no-valida-funcionaria");
    });

    test("E5.2 No válida por Biblioteca (motor controlado, ALMA simulado): obligaciones pendientes", async ({ page }) => {
        await motor("controlado", TODO_VALIDO);
        alma("combinado");
        await entrar(page, ESTUDIANTE);
        const id = await preinscribir(page);
        expect(documentosEnBd(id).paz_y_salvo_bib).toBe("NO_VALIDO");
        expect(estadoSolicitud(id)).toBe("NO_VALIDA");
        await page.goto("/estudiante/home");
        const tarjeta = page.locator("#mi-solicitud");
        await expect(tarjeta.getByRole("table", { name: "Consulta de Paz y Salvo en Biblioteca" })).toBeVisible();
        await expect(tarjeta).toContainText("Devolver los préstamos pendientes en Biblioteca.");
        await captura(page, "05-c-no-valida-biblioteca");
    });

    test("E6.1 Inconsistente (motor controlado): el documento no coincide con el formulario", async ({ page, browser }) => {
        await motor("controlado", { ...TODO_VALIDO, identification: "inconsistent" });
        await entrar(page, ESTUDIANTE);
        const id = await preinscribir(page);
        expect(documentosEnBd(id).identification).toBe("INCONSISTENTE");
        expect(estadoSolicitud(id)).toBe("INCONSISTENTE");
        await abrirPreinscripcion(page, id);
        await expect(page.getByText("no coinciden con los del formulario", { exact: false }).first()).toBeVisible();
        await captura(page, "06-a-inconsistente-estudiante");
        const funcionaria = await sesion(browser, FUNCIONARIA);
        await abrirDetalle(funcionaria, id);
        await expect(funcionaria.getByText("Inconsistente").first()).toBeVisible();
        await captura(funcionaria, "06-b-inconsistente-funcionaria");
    });

    test("E6.2 Inconsistente por Biblioteca (ALMA simulado): el documento de ALMA es otro", async ({ page }) => {
        await motor("controlado", TODO_VALIDO);
        alma("inconsistente");
        await entrar(page, ESTUDIANTE);
        const id = await preinscribir(page);
        expect(documentosEnBd(id).paz_y_salvo_bib).toBe("INCONSISTENTE");
        expect(estadoSolicitud(id)).toBe("INCONSISTENTE");
        await page.goto("/estudiante/home");
        await expect(page.locator("#mi-solicitud")).toContainText("no coinciden con los registrados en CheckU");
        await captura(page, "06-c-inconsistente-biblioteca");
    });

    test("E7.1 Por revisar (motor controlado): un documento requiere intervención", async ({ page, browser }) => {
        await motor("controlado", { ...TODO_VALIDO, saber_pro: "to_check" });
        await entrar(page, ESTUDIANTE);
        const id = await preinscribir(page);
        expect(documentosEnBd(id).saber_pro).toBe("POR_REVISAR");
        expect(estadoSolicitud(id)).toBe("POR_REVISAR");
        await abrirPreinscripcion(page, id);
        await captura(page, "07-a-por-revisar-estudiante");
        const funcionaria = await sesion(browser, FUNCIONARIA);
        await abrirDetalle(funcionaria, id, "Documentos");
        await expect(funcionaria.getByRole("button", { name: "Marcar válido: Resultados Saber Pro" })).toBeVisible();
        await captura(funcionaria, "07-b-por-revisar-funcionaria");
        await funcionaria.getByRole("button", { name: "Marcar válido: Resultados Saber Pro" }).click();
        await funcionaria.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
        await expect(funcionaria.getByRole("status").filter({ hasText: "Documento resuelto" })).toBeVisible();
        expect(estadoSolicitud(id)).toBe("VALIDA");
    });

    test("E7.2 Por revisar por Biblioteca (ALMA simulado): el código no está en ALMA", async ({ page }) => {
        await motor("controlado", TODO_VALIDO);
        alma("no_encontrado");
        await entrar(page, ESTUDIANTE);
        const id = await preinscribir(page);
        expect(documentosEnBd(id).paz_y_salvo_bib).toBe("POR_REVISAR");
        expect(estadoSolicitud(id)).toBe("POR_REVISAR");
        await page.goto("/estudiante/home");
        await expect(page.locator("#mi-solicitud")).toContainText("no tiene registrado este código");
        await captura(page, "07-c-por-revisar-biblioteca");
    });

    test("E7.3 Motor de validación caído: documenta qué ve el estudiante y qué queda guardado", async ({ page }) => {
        await motor("real", {}, true);
        await entrar(page, ESTUDIANTE);
        let error = "";
        try {
            await preinscribir(page);
        } catch (e) {
            error = e instanceof Error ? e.message : String(e);
        }
        test.info().annotations.push({ type: "motor-caido", description: error || "El envío terminó sin error." });
        await captura(page, "07-d-motor-caido", false);
        test.info().annotations.push({
            type: "motor-caido-bd",
            description: sql("SELECT id_solicitud, estado FROM solicitud_grado").join(", ") || "sin solicitudes",
        });
        await motor("real");

        expect(error).toContain("No fue posible completar el análisis en este momento");
        expect(error).toContain("Tu borrador y lo escrito se conservan");
        expect(error).not.toContain("resultados anteriores");
        expect(error.toLowerCase()).not.toContain("corrige");
        expect(sql("SELECT estado FROM solicitud_grado ORDER BY id_solicitud DESC LIMIT 1")[0]).toBe("BORRADOR");
        await expect(page.locator("#campo-nombres")).toHaveValue(NOMBRES);
    });
});
