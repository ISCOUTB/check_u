import { expect, test } from "@playwright/test";
import {
    abrirPreinscripcion, captura, documentosEnBd, entrar, ESTUDIANTE, idDocumentoVigente, motor, preinscribir,
    reenviarPorApi, reenviarPorPantalla, reiniciar, sql,
} from "./soporte";

// Escenario 3 de la #133: máximo tres reenvíos diarios de los documentos observados.

function versiones(id: number, tipo: string): string[] {
    return sql(`SELECT version FROM documentos WHERE id_solicitud=${id} AND tipo_documento='${tipo}' ORDER BY version`);
}
function analisis(id: number, tipo: string): number {
    return Number(sql(`SELECT count(*) FROM validaciones v JOIN documentos d USING (id_documento) WHERE d.id_solicitud=${id} AND d.tipo_documento='${tipo}'`)[0]);
}

for (const nivel of ["pregrado", "posgrado"] as const) {
    test.describe(`Escenario 3: reenvíos en ${nivel}`, () => {
        test.beforeEach(reiniciar);

        test(`E3 ${nivel}: tres reenvíos con análisis nuevo, y el cuarto no se permite`, async ({ page }) => {
            await entrar(page, ESTUDIANTE);
            const id = await preinscribir(page, { nivel });
            const tipo = "estampilla_pro_cultura";
            const nombre = "Estampilla Pro-Cultura";
            const antes = analisis(id, tipo);

            await abrirPreinscripcion(page, id);
            await expect(page.getByText("3 de 3")).toBeVisible();
            await captura(page, `03-a-${nivel}-antes-de-reenviar`);

            for (let i = 1; i <= 3; i++) {
                await reenviarPorPantalla(page, id, nombre);
                expect(versiones(id, tipo)).toHaveLength(i + 1);
                await abrirPreinscripcion(page, id);
                await expect(page.getByText(`${3 - i} de 3`)).toBeVisible();
            }
            expect(analisis(id, tipo), "Cada reenvío debe generar un análisis nuevo.").toBeGreaterThan(antes);
            expect(sql(`SELECT count(*) FROM entregas WHERE id_solicitud=${id} AND tipo_entrega='CORRECCION'`)[0]).toBe("3");

            // Cuarto reenvío: la pantalla no lo ofrece y la API lo rechaza.
            await captura(page, `03-b-${nivel}-tras-tres-reenvios`);
            await expect(page.getByRole("button", { name: "Volver a cargar" })).toHaveCount(0);
            const cuarto = await reenviarPorApi(page, id, idDocumentoVigente(id, tipo), `cuarto-intento-${nivel}-1234`);
            expect(cuarto.status()).toBe(409);
            expect((await cuarto.json()).message).toContain("tres reenvíos");
            expect(versiones(id, tipo)).toHaveLength(4);
        });
    });
}

test.describe("Escenario 3: un reenvío actualiza el resultado", () => {
    test.beforeEach(reiniciar);

    test("E3.3 el documento corregido pasa a Válido y la solicitud se recalcula (motor controlado)", async ({ page }) => {
        await motor("controlado", { identification: "valid", academic_evaluation: "valid", estampilla_pro_cultura: "invalid", saber_pro: "valid" });
        await entrar(page, ESTUDIANTE);
        const id = await preinscribir(page);
        expect(documentosEnBd(id).estampilla_pro_cultura).toBe("NO_VALIDO");
        expect(sql(`SELECT estado FROM solicitud_grado WHERE id_solicitud=${id}`)[0]).toBe("NO_VALIDA");
        await motor("controlado", { estampilla_pro_cultura: "valid" });
        await reenviarPorPantalla(page, id, "Estampilla Pro-Cultura");
        expect(documentosEnBd(id).estampilla_pro_cultura).toBe("VALIDO");
        expect(sql(`SELECT estado FROM solicitud_grado WHERE id_solicitud=${id}`)[0]).toBe("VALIDA");
        await abrirPreinscripcion(page, id);
        await captura(page, "03-c-reenvio-actualiza-resultado");
    });
});
