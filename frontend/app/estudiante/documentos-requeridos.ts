/**
 * documentos-requeridos.ts — Lista única de documentos requeridos por nivel académico.
 *
 * Módulo compartido entre /estudiante/bienvenida, /estudiante/home y la futura
 * página /estudiante/iniciar_preinscripcion.
 */

export type NivelAcademico = "PREGRADO" | "POSGRADO";

export interface RequisitoDocumento {
    /** Clave documental interna o de contrato (ej. "identification", "paz_y_salvo_bib") */
    tipo: string;
    /** Nombre legible para mostrar en la interfaz */
    nombre: string;
    /** Nota complementaria opcional (como aclaraciones de doble programa) */
    nota?: string;
    /**
     * Marca interna para documentos en proceso de retiro del flujo institucional.
     * REGLA: NO debe mostrarse en la interfaz del estudiante.
     * Retirarlo del flujo solo requerirá quitar esta entrada del arreglo.
     */
    retirando?: boolean;
}

/**
 * Definición central de documentos requeridos para preinscripción según nivel académico.
 *
 * NOTA: "[próximo a retirar]" en Paz y Salvo es interno y se modela con el flag `retirando`.
 */
export const DOCUMENTOS_REQUERIDOS: Record<NivelAcademico, RequisitoDocumento[]> = {
    PREGRADO: [
        {
            tipo: "identification",
            nombre: "Cédula de ciudadanía.",
        },
        {
            tipo: "academic_evaluation",
            nombre: "Evaluación de grado expedida por Banner.",
        },
        {
            // TODO: Próximo a retirar del flujo de grado cuando se automatice la consulta con biblioteca.
            tipo: "paz_y_salvo_bib",
            nombre: "Paz y Salvo Biblioteca.",
            retirando: true,
        },
        {
            tipo: "estampilla_pro_cultura",
            nombre: "Comprobante de pago estampilla Pro Cultura.",
            nota: "(En caso de doble programa, 2 comprobantes.)",
        },
        {
            tipo: "saber_pro",
            nombre: "Resultados Pruebas Saber Pro.",
        },
    ],
    POSGRADO: [
        {
            tipo: "identification",
            nombre: "Documento de identidad.",
        },
        {
            // TODO: Próximo a retirar del flujo de grado cuando se automatice la consulta con biblioteca.
            tipo: "paz_y_salvo_bib",
            nombre: "Paz y Salvo Biblioteca.",
            retirando: true,
        },
        {
            tipo: "estampilla_pro_cultura",
            nombre: "Comprobante de pago estampilla Pro Cultura.",
        },
    ],
};

/**
 * Mapeo plano para componentes que requieran únicamente los nombres legibles (ej. home).
 */
export const DOCUMENTOS_POR_NIVEL: Record<NivelAcademico, string[]> = {
    PREGRADO: DOCUMENTOS_REQUERIDOS.PREGRADO.map((doc) =>
        doc.nota ? `${doc.nombre.replace(/\.$/, "")} ${doc.nota}` : doc.nombre.replace(/\.$/, ""),
    ),
    POSGRADO: DOCUMENTOS_REQUERIDOS.POSGRADO.map((doc) =>
        doc.nota ? `${doc.nombre.replace(/\.$/, "")} ${doc.nota}` : doc.nombre.replace(/\.$/, ""),
    ),
};
