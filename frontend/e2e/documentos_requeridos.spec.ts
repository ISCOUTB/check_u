import { expect, test } from "@playwright/test";
import { DOCUMENTOS_REQUERIDOS, documentosRequeridos } from "@/app/estudiante/documentos-requeridos";
import { DOCUMENTOS_POR_NIVEL } from "@/app/estudiante/home/api";

// Lógica pura de la lista de documentos: no necesita navegador ni servidor.

test("pregrado pide 5 documentos en orden", () => {
    const documentos = documentosRequeridos("PREGRADO", false);
    expect(documentos.map((d) => d.tipo)).toEqual([
        "identification",
        "academic_evaluation",
        "paz_y_salvo_bib",
        "estampilla_pro_cultura",
        "saber_pro",
    ]);
    expect(documentos.map((d) => d.id)).toEqual(documentos.map((d) => d.tipo));
});

test("posgrado pide 3", () => {
    const documentos = documentosRequeridos("POSGRADO", false);
    expect(documentos.map((d) => d.tipo)).toEqual([
        "identification",
        "paz_y_salvo_bib",
        "estampilla_pro_cultura",
    ]);
    expect(documentos[0].etiqueta).toBe("Documento de identidad");
});

test("segundo programa en pregrado agrega la segunda estampilla al final, con id estampilla_pro_cultura-2", () => {
    const documentos = documentosRequeridos("PREGRADO", true);
    expect(documentos).toHaveLength(6);
    expect(documentos[5]).toEqual({
        id: "estampilla_pro_cultura-2",
        tipo: "estampilla_pro_cultura",
        etiqueta: "Estampilla Pro-Cultura (segundo programa)",
    });
    // Los ids no se repiten: cada zona de carga necesita el suyo.
    expect(new Set(documentos.map((d) => d.id)).size).toBe(6);
});

test("segundo programa en posgrado no agrega comprobante", () => {
    expect(documentosRequeridos("POSGRADO", true)).toEqual(documentosRequeridos("POSGRADO", false));
});

test("el paz y salvo lleva la marca retirando", () => {
    for (const nivel of ["PREGRADO", "POSGRADO"] as const) {
        const marcados = DOCUMENTOS_REQUERIDOS[nivel].filter((d) => d.retirando);
        expect(marcados.map((d) => d.tipo)).toEqual(["paz_y_salvo_bib"]);
    }
});

test("DOCUMENTOS_POR_NIVEL de home conserva sus etiquetas", () => {
    expect(DOCUMENTOS_POR_NIVEL).toEqual({
        PREGRADO: [
            "Cédula de ciudadanía",
            "Evaluación de Grado (Banner)",
            "Paz y Salvo de Biblioteca",
            "Estampilla Pro-Cultura",
            "Resultados Saber Pro",
        ],
        POSGRADO: ["Documento de identidad", "Paz y Salvo de Biblioteca", "Estampilla Pro-Cultura"],
    });
});
