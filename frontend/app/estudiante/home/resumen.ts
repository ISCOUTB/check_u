/**
 * resumen.ts — Construye el resumen documental de "Mi solicitud de grado".
 *
 * Los estados, observaciones y permisos de reenvío vienen del backend. La lista
 * de requisitos exigidos se toma del catálogo compartido de documentos para
 * conservar el orden y detectar los que aún no tengan registro.
 */

import {
    documentosRequeridos,
    type NivelAcademico,
} from "../documentos-requeridos";
import type {
    DocumentoSolicitud,
    EstadoDocumento,
    SolicitudDetalle,
} from "../preinscripcion/types";
import type { ContextoPeriodo } from "../iniciar_preinscripcion/PeriodoInscripcion";

export type EstadoRequisito = EstadoDocumento | "falta_cargar";

export interface RequisitoResumen {
    /** Identificador estable: `tipo` o `tipo-2` para el segundo programa. */
    clave: string;
    nombre: string;
    estado: EstadoRequisito;
    observaciones: string[];
    /** Solo lo decide el backend. La UI nunca lo deduce del estado. */
    resubmissionAllowed: boolean;
    documentoId?: string;
}

const MENSAJE_POR_ESTADO: Record<EstadoDocumento, string> = {
    valido: "Cumple los requisitos revisados.",
    no_valido: "El documento no cumple los criterios establecidos.",
    inconsistente: "Se identificaron diferencias o información contradictoria.",
    por_revisar: "El requisito está pendiente de análisis o requiere revisión manual.",
};

/** Clave de negocio del documento: el segundo comprobante lleva el sufijo `-2`. */
export function claveDocumento(
    documento: Pick<DocumentoSolicitud, "tipo" | "orden">,
): string {
    return documento.orden === 2 ? `${documento.tipo}-2` : documento.tipo;
}

/** Un documento es válido solo si todas sus comprobaciones lo son. */
export function estadoDocumento(
    documento: Pick<DocumentoSolicitud, "resultados">,
): EstadoDocumento {
    const estados = documento.resultados.map((resultado) => resultado.estado);
    if (estados.includes("no_valido")) return "no_valido";
    if (estados.includes("inconsistente")) return "inconsistente";
    if (estados.length === 0 || estados.includes("por_revisar")) return "por_revisar";
    return "valido";
}

function observacionesDocumento(
    documento: DocumentoSolicitud,
    estado: EstadoDocumento,
): string[] {
    const mensajes = documento.resultados
        .map((resultado) => resultado.mensaje?.trim())
        .filter((mensaje): mensaje is string => Boolean(mensaje));
    return mensajes.length ? [...new Set(mensajes)] : [MENSAJE_POR_ESTADO[estado]];
}

/**
 * Combina los requisitos exigidos para la modalidad con los documentos reales.
 * Los requisitos sin registro se muestran como "falta cargar"; los documentos
 * reales que no estén en el catálogo se conservan al final.
 */
export function construirRequisitos(
    nivel: NivelAcademico,
    segundoPrograma: boolean,
    documentos: readonly DocumentoSolicitud[],
): RequisitoResumen[] {
    const porClave = new Map(
        documentos.map((documento) => [claveDocumento(documento), documento]),
    );
    const requisitos = documentosRequeridos(nivel, segundoPrograma).map(
        ({ id, etiqueta }) => {
            const documento = porClave.get(id);
            if (!documento) {
                return {
                    clave: id,
                    nombre: etiqueta,
                    estado: "falta_cargar" as const,
                    observaciones: ["Aún no has cargado este documento."],
                    resubmissionAllowed: false,
                };
            }
            porClave.delete(id);
            const estado = estadoDocumento(documento);
            return {
                clave: id,
                nombre: documento.nombre || etiqueta,
                estado,
                observaciones: observacionesDocumento(documento, estado),
                resubmissionAllowed: documento.resubmission_allowed,
                documentoId: documento.id,
            };
        },
    );

    for (const documento of porClave.values()) {
        const estado = estadoDocumento(documento);
        requisitos.push({
            clave: claveDocumento(documento),
            nombre: documento.nombre,
            estado,
            observaciones: observacionesDocumento(documento, estado),
            resubmissionAllowed: documento.resubmission_allowed,
            documentoId: documento.id,
        });
    }

    // Se conserva el orden del catálogo (y el de la preinscripción): el segundo
    // comprobante queda al final, después de Saber Pro.
    return requisitos;
}

/** Progreso documental: requisitos válidos sobre el total exigido. */
export function progresoRequisitos(requisitos: readonly RequisitoResumen[]) {
    return {
        validos: requisitos.filter((requisito) => requisito.estado === "valido")
            .length,
        total: requisitos.length,
    };
}

/** Periodo asignado a la solicitud; si aún no tiene, el disponible informativo. */
export function periodoDeSolicitud(
    detalle: Pick<SolicitudDetalle, "periodos"> | null | undefined,
) {
    const periodos: ContextoPeriodo | null | undefined = detalle?.periodos;
    return periodos?.periodoAsignado ?? periodos?.periodoDisponible ?? null;
}

/** DATE es una fecha calendario: se formatea sin convertirla a UTC. */
export function formatearFechaCorta(fecha: string | null | undefined): string {
    if (!fecha) return "Sin fecha";
    const [anio, mes, dia] = fecha.slice(0, 10).split("-");
    return dia && mes && anio ? `${dia}/${mes}/${anio}` : "Sin fecha";
}
