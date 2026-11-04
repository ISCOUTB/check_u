import { expect, test } from "@playwright/test";
import { DOCUMENTOS_REQUERIDOS, documentosRequeridos, requisitosSolicitud } from "@/app/estudiante/documentos-requeridos";
import { DOCUMENTOS_POR_NIVEL } from "@/app/estudiante/home/api";

// Lógica pura de la lista de documentos: no necesita navegador ni servidor.

test("pregrado pide 4 documentos en orden: Paz y Salvo ya no se sube (Tarea 50)", () => {
    const documentos = documentosRequeridos("PREGRADO", false);
    expect(documentos.map((d) => d.tipo)).toEqual([
        "identification",
        "academic_evaluation",
        "estampilla_pro_cultura",
        "saber_pro",
    ]);
    expect(documentos.map((d) => d.id)).toEqual(documentos.map((d) => d.tipo));
});

test("posgrado pide 2", () => {
    const documentos = documentosRequeridos("POSGRADO", false);
    expect(documentos.map((d) => d.tipo)).toEqual([
        "identification",
        "estampilla_pro_cultura",
    ]);
    expect(documentos[0].etiqueta).toBe("Documento de identidad");
});

test("segundo programa en pregrado agrega al final la segunda evaluación de Banner y la segunda estampilla (6 en total)", () => {
    const documentos = documentosRequeridos("PREGRADO", true);
    expect(documentos).toHaveLength(6);
    expect(documentos.slice(4)).toEqual([
        {
            id: "academic_evaluation-2",
            tipo: "academic_evaluation",
            etiqueta: "Evaluación de Grado (Banner) (segundo programa)",
        },
        {
            id: "estampilla_pro_cultura-2",
            tipo: "estampilla_pro_cultura",
            etiqueta: "Estampilla Pro-Cultura (segundo programa)",
        },
    ]);
    // Los ids no se repiten: cada zona de carga necesita el suyo.
    expect(new Set(documentos.map((d) => d.id)).size).toBe(6);
});

test("segundo programa en posgrado no agrega comprobante", () => {
    expect(documentosRequeridos("POSGRADO", true)).toEqual(documentosRequeridos("POSGRADO", false));
});

test("el paz y salvo se consulta con Biblioteca, no se sube (Tarea 50)", () => {
    for (const nivel of ["PREGRADO", "POSGRADO"] as const) {
        const consultados = DOCUMENTOS_REQUERIDOS[nivel].filter((d) => d.consulta);
        expect(consultados.map((d) => d.tipo)).toEqual(["paz_y_salvo_bib"]);
    }
});

test("los requisitos de la solicitud siguen siendo 5, 7 y 3, con Paz y Salvo", () => {
    expect(requisitosSolicitud("PREGRADO", false).map((d) => d.id)).toEqual([
        "identification",
        "academic_evaluation",
        "paz_y_salvo_bib",
        "estampilla_pro_cultura",
        "saber_pro",
    ]);
    expect(requisitosSolicitud("PREGRADO", true)).toHaveLength(7);
    expect(requisitosSolicitud("POSGRADO", false).map((d) => d.id)).toEqual([
        "identification",
        "paz_y_salvo_bib",
        "estampilla_pro_cultura",
    ]);
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
