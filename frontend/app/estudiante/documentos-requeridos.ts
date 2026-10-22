/**
 * documentos-requeridos.ts — Lista única de documentos que pide la preinscripción.
 *
 * La usan el formulario de preinscripción y la home del estudiante, para que las
 * dos pantallas pidan los mismos documentos con las mismas etiquetas.
 *
 * Los tipos documentales usan las claves del contrato (TypeDocument).
 */

export type Nivel = "PREGRADO" | "POSGRADO";

export type TipoDocumento =
    | "identification"
    | "academic_evaluation"
    | "paz_y_salvo_bib"
    | "estampilla_pro_cultura"
    | "saber_pro";

export interface DocumentoRequerido {
    tipo: TipoDocumento;
    /** Lo que ve el estudiante */
    etiqueta: string;
    /** El Paz y Salvo: retirarlo es quitar esta entrada; el formulario no lo muestra. */
    retirando?: true;
    /** La estampilla en pregrado: pide un segundo comprobante si hay segundo programa. */
    unoPorPrograma?: true;
}

/** Un documento tal como lo pide el formulario: con un id propio por zona de carga. */
export interface DocumentoDelFormulario {
    /** El tipo, o `estampilla_pro_cultura-2` para el segundo comprobante */
    id: string;
    tipo: TipoDocumento;
    etiqueta: string;
}

export const DOCUMENTOS_REQUERIDOS: Record<Nivel, readonly DocumentoRequerido[]> = {
    PREGRADO: [
        { tipo: "identification", etiqueta: "Cédula de ciudadanía" },
        { tipo: "academic_evaluation", etiqueta: "Evaluación de Grado (Banner)" },
        { tipo: "paz_y_salvo_bib", etiqueta: "Paz y Salvo de Biblioteca", retirando: true },
        { tipo: "estampilla_pro_cultura", etiqueta: "Estampilla Pro-Cultura", unoPorPrograma: true },
        { tipo: "saber_pro", etiqueta: "Resultados Saber Pro" },
    ],
    POSGRADO: [
        { tipo: "identification", etiqueta: "Documento de identidad" },
        { tipo: "paz_y_salvo_bib", etiqueta: "Paz y Salvo de Biblioteca", retirando: true },
        { tipo: "estampilla_pro_cultura", etiqueta: "Estampilla Pro-Cultura" },
    ],
};

/**
 * Documentos que el formulario pide para un nivel, en orden. Con segundo programa
 * en pregrado agrega al final el segundo comprobante de la estampilla.
 * No quita los marcados `retirando`: decidir si se muestran es cosa del formulario.
 */
export function documentosRequeridos(nivel: Nivel, segundoPrograma: boolean): DocumentoDelFormulario[] {
    const base = DOCUMENTOS_REQUERIDOS[nivel];
    const documentos: DocumentoDelFormulario[] = base.map(({ tipo, etiqueta }) => ({
        id: tipo,
        tipo,
        etiqueta,
    }));

    if (segundoPrograma) {
        for (const { tipo, etiqueta, unoPorPrograma } of base) {
            if (unoPorPrograma) {
                documentos.push({ id: `${tipo}-2`, tipo, etiqueta: `${etiqueta} (segundo programa)` });
            }
        }
    }

    return documentos;
}
