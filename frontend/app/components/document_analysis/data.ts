import { DocumentAnalysisData } from "../document_analysis/DocumentAnalysis";

export const documentAnalysisMock: Record<
    string,
    DocumentAnalysisData
> = {
    saberPro: {
        documentType: "Prueba Saber Pro",
        fileName: "resultado_saber_pro_1000123456.pdf",

        status: "VALIDO",

        extractedFields: [
            {
                label: "Nombre del estudiante",
                value: "Juan Pérez Gómez",
                source: "Página 1 · OCR"
            },
            {
                label: "Identificación",
                value: "1000123456",
                source: "Página 1 · OCR"
            },
            {
                label: "Puntaje global",
                value: "287",
                source: "Página 1 · OCR"
            },
            {
                label: "Número de registro",
                value: "123456789",
                source: "Página 1 · OCR"
            },
            {
                label: "Fecha de aplicación",
                value: "15/09/2025",
                source: "Página 1 · OCR"
            }
        ],

        validations: [
            {
                description: "El documento corresponde a una prueba Saber Pro",
                result: true,
                detail: "Tipo de documento identificado correctamente."
            },
            {
                description: "La identificación coincide con la solicitud",
                result: true,
                detail: "Identificación extraída: 1000123456."
            },
            {
                description: "El puntaje cumple el mínimo requerido",
                result: true,
                detail: "287 ≥ 100."
            },
            {
                description: "Los datos obligatorios fueron encontrados",
                result: true,
                detail: "Todos los campos requeridos fueron identificados."
            }
        ],

        documentUrl: "/documents/demo/saber-pro.pdf"
    },

    cedula: {
        documentType: "Cédula de ciudadanía",
        fileName: "cedula_1000123456.pdf",

        status: "VALIDO",

        extractedFields: [
            {
                label: "Nombre",
                value: "Juan Pérez Gómez",
                source: "Página 1 · OCR"
            },
            {
                label: "Número de documento",
                value: "1000123456",
                source: "Página 1 · OCR"
            },
            {
                label: "Fecha de nacimiento",
                value: "12/03/2004",
                source: "Página 1 · OCR"
            }
        ],

        validations: [
            {
                description: "El documento corresponde a una cédula",
                result: true,
                detail: "Formato y estructura identificados."
            },
            {
                description: "La identificación coincide",
                result: true,
                detail: "1000123456."
            }
        ],

        documentUrl: "/documents/demo/cedula.pdf"
    }
};