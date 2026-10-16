import type { DocumentAnalysisData } from "@/app/components/document_analysis/DocumentAnalysis";
import type { EstadoVisible } from "@/app/components/ui/StatusBadge";

/**
 * ⚠️ SIMULADO: datos de ejemplo de una preinscripción y del análisis automático de cada documento.
 * Se reemplazan por la API cuando exista (tareas 05 y 12). La página muestra estos mismos datos
 * para cualquier número de solicitud.
 */

export type EstadoDocumento = Extract<EstadoVisible, "valido" | "no_valido" | "inconsistente" | "por_revisar">;

export type TipoPrograma = "PREGRADO" | "POSGRADO";

export interface Documento {
    id: string;
    nombre: string;
    descripcion: string;
    estado: EstadoDocumento;
    mensaje: string;
    obligatorio: boolean;
}

export const estudiante = {
    codigo: "T00012345",
    tipoDocumento: "Cédula de ciudadanía",
    numeroDocumento: "1.234.567.890",
    nombre: "Juan David Pérez Rodríguez",
    programa: "Ingeniería de Sistemas y Computación",
    nivel: "PREGRADO" as TipoPrograma,
    facultad: "Facultad de Ingeniería",
    direccion: "Carrera 10 # 25-40",
    telefono: "300 123 4567",
    correo: "juan.perez@utb.edu.co",
    ciudad: "Cartagena de Indias",
    fechaSolicitud: "7 de octubre de 2026",
};

export const documentos: Documento[] = [
    {
        id: "cedula",
        nombre: "Cédula de ciudadanía",
        descripcion: "Documento de identificación del estudiante",
        estado: "valido",
        mensaje:
            "El documento suministrado parece auténtico con un nivel de confianza del 98%.",
        obligatorio: true,
    },
    {
        id: "banner",
        nombre: "Evaluación de Grado expedida por Banner",
        descripcion: "Evaluación de grado generada por el sistema académico",
        estado: "valido",
        mensaje: "Cumples con los requisitos académicos establecidos.",
        obligatorio: true,
    },
    {
        id: "estampilla",
        nombre: "Comprobante de pago de estampilla Pro-Cultura",
        descripcion: "Comprobante de pago correspondiente a la estampilla",
        estado: "inconsistente",
        mensaje:
            "La información del comprobante no coincide con la información suministrada.",
        obligatorio: true,
    },
    {
        id: "biblioteca",
        nombre: "Paz y Salvo de Biblioteca",
        descripcion:
            "Certificado de paz y salvo expedido por la Biblioteca",
        estado: "valido",
        mensaje:
            "Se verificó correctamente la firma electrónica del documento.",
        obligatorio: true,
    },
    {
        id: "saber-pro",
        nombre: "Resultados de las Pruebas Saber Pro",
        descripcion: "Resultados de las pruebas de Estado",
        estado: "valido",
        mensaje:
            "Cumples con el requisito mínimo de 100 puntos establecido.",
        obligatorio: true,
    },
];

export const informacionAdicional = [
    {
        label: "Facultad",
        value: estudiante.facultad,
    },
    {
        label: "Nivel académico",
        value: estudiante.nivel,
    },
    {
        label: "Ciudad",
        value: estudiante.ciudad,
    },
    {
        label: "Fecha de solicitud",
        value: estudiante.fechaSolicitud,
    },
];

/* ========================================================= */
/* DATASET FICTICIO DEL ANÁLISIS AUTOMÁTICO                  */
/* ========================================================= */

/*
 * IMPORTANTE:
 *
 * Este objeto solamente simula la respuesta que posteriormente
 * entregará el backend.
 *
 * Cuando exista la API, esta información NO debe permanecer aquí.
 *
 * El flujo será:
 *
 * Backend
 *    ↓
 * servicio / fetch
 *    ↓
 * DocumentAnalysisData
 *    ↓
 * DocumentAnalysis
 */

export const documentAnalysisMock: Record<
    string,
    DocumentAnalysisData
> = {
    cedula: {
        documentType: "Cédula de ciudadanía",
        fileName: "cedula_1000123456.pdf",
        status: "VALIDO",

        extractedFields: [
            {
                label: "Nombre completo",
                value: "Juan David Pérez Rodríguez",
                source: "Página 1 · OCR",
            },
            {
                label: "Número de documento",
                value: "1.234.567.890",
                source: "Página 1 · OCR",
            },
            {
                label: "Tipo de documento",
                value: "Cédula de ciudadanía",
                source: "Página 1 · OCR",
            },
            {
                label: "Fecha de nacimiento",
                value: "12/03/2004",
                source: "Página 1 · OCR",
            },
        ],

        validations: [
            {
                description:
                    "El documento corresponde a una cédula de ciudadanía",
                result: true,
                detail:
                    "La estructura y los elementos identificados corresponden al tipo de documento esperado.",
            },
            {
                description:
                    "La identificación coincide con la solicitud",
                result: true,
                detail:
                    "Documento extraído: 1.234.567.890.",
            },
            {
                description:
                    "El nombre coincide con la información registrada",
                result: true,
                detail:
                    "Juan David Pérez Rodríguez.",
            },
        ],
    },

    banner: {
        documentType:
            "Evaluación de Grado expedida por Banner",
        fileName: "evaluacion_grado_banner.pdf",
        status: "VALIDO",

        extractedFields: [
            {
                label: "Código estudiantil",
                value: "T00012345",
                source: "Página 1 · OCR",
            },
            {
                label: "Nombre del estudiante",
                value: "Juan David Pérez Rodríguez",
                source: "Página 1 · OCR",
            },
            {
                label: "Programa académico",
                value:
                    "Ingeniería de Sistemas y Computación",
                source: "Página 1 · OCR",
            },
            {
                label: "Estado académico",
                value: "Cumple",
                source: "Página 1 · OCR",
            },
        ],

        validations: [
            {
                description:
                    "El documento corresponde a una evaluación de grado",
                result: true,
                detail:
                    "Se identificaron los campos esperados para el documento.",
            },
            {
                description:
                    "El código estudiantil coincide",
                result: true,
                detail:
                    "Código encontrado: T00012345.",
            },
            {
                description:
                    "El estado académico permite continuar",
                result: true,
                detail:
                    "El documento indica que el estudiante cumple.",
            },
        ],
    },

    estampilla: {
        documentType:
            "Comprobante de pago de estampilla Pro-Cultura",
        fileName: "estampilla_pro_cultura.pdf",
        status: "INCONSISTENTE",

        extractedFields: [
            {
                label: "Nombre",
                value: "Juan David Pérez Rodríguez",
                source: "Página 1 · OCR",
            },
            {
                label: "Número de identificación",
                value: "1.234.567.890",
                source: "Página 1 · OCR",
            },
            {
                label: "Valor pagado",
                value: "$85.000",
                source: "Página 1 · OCR",
            },
            {
                label: "Referencia de pago",
                value: "PC-2026-009845",
                source: "Página 1 · OCR",
            },
        ],

        validations: [
            {
                description:
                    "El documento corresponde a un comprobante de pago",
                result: true,
                detail:
                    "Se identificó la estructura de un comprobante.",
            },
            {
                description:
                    "La identificación coincide con la solicitud",
                result: true,
                detail:
                    "Documento extraído: 1.234.567.890.",
            },
            {
                description:
                    "La referencia del pago presenta inconsistencias",
                result: false,
                detail:
                    "La referencia encontrada requiere revisión.",
            },
        ],
    },

    biblioteca: {
        documentType: "Paz y Salvo de Biblioteca",
        fileName: "paz_salvo_biblioteca.pdf",
        status: "VALIDO",

        extractedFields: [
            {
                label: "Nombre del estudiante",
                value: "Juan David Pérez Rodríguez",
                source: "Página 1 · OCR",
            },
            {
                label: "Código estudiantil",
                value: "T00012345",
                source: "Página 1 · OCR",
            },
            {
                label: "Estado",
                value: "Paz y salvo",
                source: "Página 1 · OCR",
            },
            {
                label: "Firma electrónica",
                value: "Verificada",
                source: "Metadatos del documento",
            },
        ],

        validations: [
            {
                description:
                    "El documento corresponde a un paz y salvo",
                result: true,
                detail:
                    "Se identificaron los elementos requeridos.",
            },
            {
                description:
                    "El código estudiantil coincide",
                result: true,
                detail:
                    "Código encontrado: T00012345.",
            },
            {
                description:
                    "La firma electrónica fue verificada",
                result: true,
                detail:
                    "La firma del documento fue validada correctamente.",
            },
        ],
    },

    "saber-pro": {
        documentType: "Resultados de las Pruebas Saber Pro",
        fileName: "resultado_saber_pro_1000123456.pdf",
        status: "VALIDO",

        extractedFields: [
            {
                label: "Nombre del estudiante",
                value: "Juan David Pérez Rodríguez",
                source: "Página 1 · OCR",
            },
            {
                label: "Identificación",
                value: "1.234.567.890",
                source: "Página 1 · OCR",
            },
            {
                label: "Puntaje global",
                value: "287",
                source: "Página 1 · OCR",
            },
            {
                label: "Número de registro",
                value: "123456789",
                source: "Página 1 · OCR",
            },
            {
                label: "Fecha de aplicación",
                value: "15/09/2025",
                source: "Página 1 · OCR",
            },
        ],

        validations: [
            {
                description:
                    "El documento corresponde a una prueba Saber Pro",
                result: true,
                detail:
                    "Se identificó correctamente el tipo de resultado.",
            },
            {
                description:
                    "La identificación coincide con la solicitud",
                result: true,
                detail:
                    "Identificación encontrada: 1.234.567.890.",
            },
            {
                description:
                    "El puntaje cumple el mínimo requerido",
                result: true,
                detail:
                    "Puntaje obtenido: 287. Mínimo requerido: 100.",
            },
            {
                description:
                    "Los datos obligatorios fueron encontrados",
                result: true,
                detail:
                    "Todos los campos requeridos fueron identificados.",
            },
        ],
    },
};
