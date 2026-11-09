import { expect, test } from "@playwright/test";
import {
    abrirFormulario, adjuntarTodos, alma, captura, documentosEnBd, documentosPedidos, enviar, entrar, ESTUDIANTE,
    estadoSolicitud, llenarDatos, llenarEstudios, motor, reiniciar, sql,
} from "./soporte";

// Escenarios 1 y 2 de la #133: preinscripción de pregrado y de posgrado, con uno y dos programas.
// Motor real con PDF inventados: los validadores reales los rechazan; Paz y Salvo sale de ALMA simulado.

const PREGRADO_UNO = ["identification", "academic_evaluation", "estampilla_pro_cultura", "saber_pro"];
const PREGRADO_DOS = ["identification", "academic_evaluation", "academic_evaluation-2", "estampilla_pro_cultura", "estampilla_pro_cultura-2", "saber_pro"];

test.describe("Escenario 1: preinscripción de pregrado", () => {
    test.beforeEach(reiniciar);

    test("E1.1 un programa: pide 4 documentos, muestra el progreso y los resultados", async ({ page }) => {
        await entrar(page, ESTUDIANTE);
        await expect(page).toHaveURL(/\/estudiante\/home/);
        await expect(page.getByRole("link", { name: "Nueva preinscripción" }).first()).toBeVisible();
        await captura(page, "01-a-estudiante-nuevo-inicio");

        await abrirFormulario(page, "pregrado");
        await expect(page.getByRole("heading", { level: 1 })).toHaveText("Preinscripción de grado · Pregrado");
        await llenarDatos(page);
        expect(await documentosPedidos(page)).toEqual(PREGRADO_UNO);
        await adjuntarTodos(page);
        await captura(page, "01-b-formulario-pregrado-un-programa");

        await enviar(page, async (p) => {
            await expect(p.getByRole("progressbar").or(p.getByText(/Analizando|Consultando|Generando|Guardando/).first()).first()).toBeVisible();
            await captura(p, "01-c-progreso-analisis", false);
        });
        await captura(page, "01-d-resultado-tras-enviar");
        await expect(page.locator("section[aria-label='Datos del estudiante']")).toContainText("Ingeniería de Sistemas y Computación");
        await expect(page.locator("section[aria-label='Datos del estudiante']")).not.toContainText("INGENIERIA_DE_SISTEMAS_Y_COMPUTACION");

        // Tarea 67 (H-13): una sola etiqueta por documento y tildes del motor
        for (const item of await page.locator("li[class*='alertaItem']").all()) {
            await expect(item.locator("div[class*='alertaChips'] [class*='badge']")).toHaveCount(1);
        }
        await expect(page.locator("body")).not.toContainText("resolucion");
        await expect(page.locator("body")).not.toContainText("numero ni el nombre");

        const id = Number(sql("SELECT max(id_solicitud) FROM solicitud_grado")[0]);
        const docs = documentosEnBd(id);
        expect(Object.keys(docs).sort()).toEqual([...PREGRADO_UNO, "paz_y_salvo_bib"].sort());
        expect(docs.paz_y_salvo_bib).toBe("VALIDO");
        expect(docs.identification).not.toBe("VALIDO");
        await page.goto("/estudiante/home");
        // Tarea 67 (H-13): sin panel «Antes de enviar» ni texto de iniciar nueva con solicitud activa
        await expect(page.getByText("Antes de enviar")).toHaveCount(0);
        await expect(page.locator("section[aria-labelledby='titulo-bienvenida']")).not.toContainText("iniciar una nueva preinscripción");
        const tarjeta = page.locator("#mi-solicitud");
        await expect(tarjeta).toContainText("Paz y Salvo de Biblioteca");
        await expect(tarjeta.getByRole("button", { name: /Subir nueva versión/ }).first().or(tarjeta.getByRole("link", { name: /Subir nueva versión/ }).first()).first()).toBeVisible();
        await captura(page, "01-e-inicio-con-resultados");
    });

    test("E1.2 dos programas: pide 6 documentos y conserva los dos programas", async ({ page }) => {
        await entrar(page, ESTUDIANTE);
        await abrirFormulario(page, "pregrado");
        await llenarDatos(page, { doble: true });
        expect((await documentosPedidos(page)).sort()).toEqual([...PREGRADO_DOS].sort());
        await adjuntarTodos(page);
        await captura(page, "01-f-formulario-pregrado-dos-programas");
        await enviar(page);
        await captura(page, "01-g-resultado-dos-programas");
        await expect(page.locator("section[aria-label='Datos del estudiante']")).toContainText("Ingeniería de Sistemas y Computación");
        await expect(page.locator("section[aria-label='Datos del estudiante']")).toContainText("Ingeniería Industrial");
        await expect(page.locator("section[aria-label='Datos del estudiante']")).not.toContainText("INGENIERIA_DE_SISTEMAS_Y_COMPUTACION");
        await expect(page.locator("section[aria-label='Datos del estudiante']")).not.toContainText("INGENIERIA_INDUSTRIAL");
        const id = Number(sql("SELECT max(id_solicitud) FROM solicitud_grado")[0]);
        expect(Object.keys(documentosEnBd(id)).sort()).toEqual([...PREGRADO_DOS, "paz_y_salvo_bib"].sort());
        expect(sql(`SELECT count(*) FROM solicitud_programa WHERE id_solicitud=${id}`)[0]).toBe("2");
        expect(estadoSolicitud(id)).toBe("NO_VALIDA");
    });

    test("E1.3 resultado mixto: separa lo que requiere corrección de lo que superó los filtros", async ({ page }) => {
        await motor("controlado", { identification: "valid", academic_evaluation: "valid", estampilla_pro_cultura: "invalid", saber_pro: "valid" });
        alma("paz_y_salvo");
        await entrar(page, ESTUDIANTE);
        await abrirFormulario(page, "pregrado");
        await llenarDatos(page);
        await adjuntarTodos(page);
        await enviar(page);
        await page.goto("/estudiante/home");
        const tarjeta = page.locator("#mi-solicitud");
        await expect(tarjeta).toContainText("4 de 5 requisitos válidos");
        await captura(page, "01-h-inicio-resultado-mixto");
    });
});

test.describe("Escenario 2: preinscripción de posgrado", () => {
    test.beforeEach(reiniciar);

    test("E2.0 sin los datos de estudios no queda listo ni deja enviar; con ellos, sí", async ({ page }) => {
        // H-01, corregido por #162: antes decía «Todo listo para enviar» y el backend rechazaba el envío.
        await entrar(page, ESTUDIANTE);
        await abrirFormulario(page, "posgrado");
        await llenarDatos(page, { nivel: "posgrado", estudios: false });
        await adjuntarTodos(page);
        const listo = page.getByText("Todo listo para enviar").filter({ visible: true });
        await expect(listo).toHaveCount(0);

        await page.getByRole("button", { name: "Enviar preinscripción" }).click();
        const pendientes = page.getByRole("alert").filter({ hasText: "Revisa estos campos antes de enviar" });
        await expect(pendientes).toContainText("Nivel de estudios alcanzado");
        await expect(pendientes).toContainText("Título obtenido");
        await expect(pendientes).toContainText("egresado o egresada");
        await expect(page.getByRole("dialog", { name: "Revisa tu información antes de enviar" })).toHaveCount(0);

        await llenarEstudios(page);
        await expect(listo.first()).toBeVisible();
        await enviar(page);
        expect(sql("SELECT titulo_obtenido FROM informacion_posgrado")).toEqual(["Ingeniero de prueba"]);
    });

    test("E2.1 un programa: la #133 pide Cédula, Evaluación de Banner y Estampilla", async ({ page }) => {
        await entrar(page, ESTUDIANTE);
        await abrirFormulario(page, "posgrado");
        await expect(page.getByRole("heading", { level: 1 })).toHaveText("Preinscripción de grado · Posgrado");
        await llenarDatos(page, { nivel: "posgrado" });
        await captura(page, "02-a-formulario-posgrado-un-programa");
        // Hallazgo H-08 del informe: el formulario no pide la Evaluación de Banner en posgrado.
        expect.soft(await documentosPedidos(page)).toEqual(["identification", "academic_evaluation", "estampilla_pro_cultura"]);
        await adjuntarTodos(page);
        await enviar(page, async (p) => {
            await p.getByRole("progressbar").first().waitFor({ timeout: 15_000 }).catch(() => {});
            await captura(p, "02-b-progreso-analisis", false);
        });
        await captura(page, "02-c-resultado-posgrado");
        const id = Number(sql("SELECT max(id_solicitud) FROM solicitud_grado")[0]);
        expect(sql(`SELECT tipo_solicitud FROM solicitud_grado WHERE id_solicitud=${id}`)[0]).toBe("POSGRADO");
        expect(documentosEnBd(id).paz_y_salvo_bib).toBe("VALIDO");
    });

    test("E2.2 dos programas: documenta qué pide el formulario", async ({ page }) => {
        await entrar(page, ESTUDIANTE);
        await abrirFormulario(page, "posgrado");
        await llenarDatos(page, { doble: true, nivel: "posgrado" });
        const pedidos = await documentosPedidos(page);
        test.info().annotations.push({ type: "documentos-posgrado-dos-programas", description: pedidos.join(", ") });
        await captura(page, "02-d-formulario-posgrado-dos-programas");
        await adjuntarTodos(page);
        await enviar(page);
        await captura(page, "02-e-resultado-posgrado-dos-programas");
        const id = Number(sql("SELECT max(id_solicitud) FROM solicitud_grado")[0]);
        expect(sql(`SELECT count(*) FROM solicitud_programa WHERE id_solicitud=${id}`)[0]).toBe("2");
        expect(Object.keys(documentosEnBd(id)).sort()).toEqual([...pedidos, "paz_y_salvo_bib"].sort());
    });
});
