/**
 * documentos-requeridos.ts — Lista única de documentos requeridos por nivel académico.
 *
 * Módulo compartido entre /estudiante/bienvenida, /estudiante/home y la página
 * /estudiante/iniciar_preinscripcion.
 */

export type NivelAcademico = "PREGRADO" | "POSGRADO";
export type Nivel = NivelAcademico; // alias usado por iniciar_preinscripcion

export type TipoDocumento =
    | "identification"
    | "academic_evaluation"
    | "paz_y_salvo_bib"
    | "estampilla_pro_cultura"
    | "saber_pro";

export interface RequisitoDocumento {
    /** Clave documental interna o de contrato (ej. "identification", "paz_y_salvo_bib") */
    tipo: string;
    /** Nombre legible completo para mostrar en bienvenida */
    nombre: string;
    /** Etiqueta corta para formularios y listas de verificación */
    etiqueta: string;
    /** Nota complementaria opcional (como aclaraciones de doble programa) */
    nota?: string;
    /**
     * Marca interna para documentos en proceso de retiro del flujo institucional.
     * REGLA: NO debe mostrarse en la interfaz del estudiante.
     * Retirarlo del flujo solo requerirá quitar esta entrada del arreglo.
     */
    retirando?: boolean;
    /** En pregrado con segundo programa se pide otro documento de este tipo (evaluación y estampilla). */
    unoPorPrograma?: boolean;
}

export type DocumentoRequerido = RequisitoDocumento;

/** Un documento tal como lo pide el formulario: con un id propio por zona de carga. */
export interface DocumentoDelFormulario {
    /** El tipo, o `{tipo}-2` para el documento del segundo programa */
    id: string;
    tipo: string;
    etiqueta: string;
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
            etiqueta: "Cédula de ciudadanía",
        },
        {
            tipo: "academic_evaluation",
            nombre: "Evaluación de grado expedida por Banner.",
            etiqueta: "Evaluación de Grado (Banner)",
            nota: "(En caso de doble programa, una por programa.)",
            unoPorPrograma: true,
        },
        {
            // TODO: Próximo a retirar del flujo de grado cuando se automatice la consulta con biblioteca.
            tipo: "paz_y_salvo_bib",
            nombre: "Paz y Salvo Biblioteca.",
            etiqueta: "Paz y Salvo de Biblioteca",
            retirando: true,
        },
        {
            tipo: "estampilla_pro_cultura",
            nombre: "Comprobante de pago estampilla Pro Cultura.",
            etiqueta: "Estampilla Pro-Cultura",
            nota: "(En caso de doble programa, 2 comprobantes.)",
            unoPorPrograma: true,
        },
        {
            tipo: "saber_pro",
            nombre: "Resultados Pruebas Saber Pro.",
            etiqueta: "Resultados Saber Pro",
        },
    ],
    POSGRADO: [
        {
            tipo: "identification",
            nombre: "Documento de identidad.",
            etiqueta: "Documento de identidad",
        },
        {
            // TODO: Próximo a retirar del flujo de grado cuando se automatice la consulta con biblioteca.
            tipo: "paz_y_salvo_bib",
            nombre: "Paz y Salvo Biblioteca.",
            etiqueta: "Paz y Salvo de Biblioteca",
            retirando: true,
        },
        {
            tipo: "estampilla_pro_cultura",
            nombre: "Comprobante de pago estampilla Pro Cultura.",
            etiqueta: "Estampilla Pro-Cultura",
        },
    ],
};

/**
 * Mapeo plano para componentes que requieren únicamente los nombres visibles.
 */
export const DOCUMENTOS_POR_NIVEL: Record<NivelAcademico, string[]> = {
    PREGRADO: DOCUMENTOS_REQUERIDOS.PREGRADO.map((doc) => doc.etiqueta),
    POSGRADO: DOCUMENTOS_REQUERIDOS.POSGRADO.map((doc) => doc.etiqueta),
};

/**
 * Documentos que el formulario pide para un nivel, en orden. Con segundo programa
 * en pregrado agrega al final el segundo comprobante de la estampilla.
 * No quita los marcados retirando: se incluyen los 5 de pregrado y 3 de posgrado.
 */
export function documentosRequeridos(
    nivel: NivelAcademico,
    segundoPrograma: boolean = false,
): DocumentoDelFormulario[] {
    const base = DOCUMENTOS_REQUERIDOS[nivel];
    const documentos: DocumentoDelFormulario[] = base.map(({ tipo, etiqueta }) => ({
        id: tipo,
        tipo,
        etiqueta,
    }));

    if (segundoPrograma && nivel === "PREGRADO") {
        for (const { tipo, etiqueta, unoPorPrograma } of base) {
            if (unoPorPrograma) {
                documentos.push({
                    id: `${tipo}-2`,
                    tipo,
                    etiqueta: `${etiqueta} (segundo programa)`,
                });
            }
        }
    }

    return documentos;
}
