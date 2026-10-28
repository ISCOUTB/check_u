
/**
 * validacion.ts — Qué falta en el borrador, cuánto se lleva y cómo se revisa un PDF.
 *
 * Son funciones puras, sin React: reciben el borrador y devuelven datos.
 * No modifican el borrador ni reescriben lo que escribió el estudiante.
 */

import {
    documentosRequeridos,
    type DocumentoDelFormulario,
    type NivelAcademico as Nivel,
} from "@/app/estudiante/documentos-requeridos";
import { borradorVacio, type BorradorPreinscripcion } from "./tipos";

// ─────────────────────────────────────────────────────────────────────────────
// Documentos requeridos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve los documentos que debe cargar el estudiante.
 * Incluye el Paz y Salvo y agrega una segunda estampilla cuando corresponde.
 */
function obtenerDocumentosRequeridos(nivel: Nivel, segundoPrograma: boolean): DocumentoDelFormulario[] {
    return documentosRequeridos(nivel, segundoPrograma);
}

// ─────────────────────────────────────────────────────────────────────────────
// IDs de la página
// ─────────────────────────────────────────────────────────────────────────────

/** Los campos que aparecen una sola vez en el formulario. */
export const ID_CAMPOS = {
    nombres: "campo-nombres",
    apellidos: "campo-apellidos",
    tipoDocumento: "campo-tipo-documento",
    numeroDocumento: "campo-numero-documento",
    fechaNacimiento: "campo-fecha-nacimiento",
    genero: "campo-genero",
    correo: "campo-correo",
    telefonoFijo: "campo-telefono-fijo",
    celular: "campo-celular",
    departamento: "campo-departamento",
    ciudad: "campo-ciudad",
    direccion: "campo-direccion",
    tieneDiscapacidad: "campo-tiene-discapacidad",
    tipoDiscapacidad: "campo-tipo-discapacidad",
    detallesAsistencia: "campo-detalles-asistencia",
    codigoEstudiantil: "campo-codigo-estudiantil",
    segundoPrograma: "campo-segundo-programa",
    conoceRegistroSaberPro: "campo-conoce-registro-saber-pro",
    numeroRegistroSaberPro: "campo-numero-registro-saber-pro",
    fechaExamenSaberPro: "campo-fecha-examen-saber-pro",
    esEmpleadoUtb: "campo-es-empleado-utb",
    tipoContrato: "campo-tipo-contrato",
    esHijoDeEmpleadoUtb: "campo-es-hijo-de-empleado-utb",
    nivelEstudios: "campo-nivel-estudios",
    tituloObtenido: "campo-titulo-obtenido",
    esEgresadoPregradoUtb: "campo-es-egresado-pregrado-utb",
} as const;

/** Orden de un programa o de un cargo: 1 es el primero y 2 es el segundo. */
export type Orden = 1 | 2;

const BASE_CAMPO_PROGRAMA = {
    programa: "campo-programa",
    modalidad: "campo-modalidad",
    tipoOpcionGrado: "campo-opcion-grado",
} as const;

export type CampoPrograma = keyof typeof BASE_CAMPO_PROGRAMA;

/** Genera el ID de un campo de programa. */
export function idCampoPrograma(campo: CampoPrograma, orden: Orden): string {
    return `${BASE_CAMPO_PROGRAMA[campo]}-${orden}`;
}

const BASE_CAMPO_EXPERIENCIA = {
    empresa: "campo-empresa",
    cargo: "campo-cargo",
    tiempo: "campo-tiempo",
} as const;

export type CampoExperiencia = keyof typeof BASE_CAMPO_EXPERIENCIA;

/** Genera el ID de un campo de experiencia. */
export function idCampoExperiencia(campo: CampoExperiencia, orden: Orden): string {
    return `${BASE_CAMPO_EXPERIENCIA[campo]}-${orden}`;
}

/** Genera el ID de la zona de carga de un documento. */
export function idDocumento(id: string): string {
    return `documento-${id}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Secciones
// ─────────────────────────────────────────────────────────────────────────────

export type SeccionId = "identificacion" | "contacto" | "academico" | "saber_pro" | "estudios" | "documentos";

export const SECCIONES: Record<SeccionId, string> = {
    identificacion: "Identificación",
    contacto: "Contacto y residencia",
    academico: "Información académica",
    saber_pro: "Saber Pro y vinculación con la UTB",
    estudios: "Estudios y experiencia",
    documentos: "Documentos",
};

/** Devuelve las secciones que corresponden al nivel académico. */
export function seccionesDelNivel(nivel: Nivel): SeccionId[] {
    return nivel === "PREGRADO"
        ? ["identificacion", "contacto", "academico", "saber_pro", "documentos"]
        : ["identificacion", "contacto", "academico", "estudios", "documentos"];
}

// ─────────────────────────────────────────────────────────────────────────────
// Faltantes
// ─────────────────────────────────────────────────────────────────────────────

export const MENSAJE_OBLIGATORIO = "Completa este campo.";
export const MENSAJE_DOCUMENTO = "Carga este documento en PDF.";

export interface CampoFaltante {
    /** ID del elemento en la página. */
    id: string;
    seccion: SeccionId;
    /** Nombre del campo o documento que ve el estudiante. */
    etiqueta: string;
    mensaje: string;
}

function estaVacio(texto: string | undefined): boolean {
    return (texto ?? "").trim() === "";
}

function documentoCargado(borrador: BorradorPreinscripcion, id: string): boolean {
    if (borrador.documentos[id]) return true;
    if (id === "estampilla_pro_cultura-2" && borrador.documentos["estampilla2"]) return true;
    if (id === "estampilla2" && borrador.documentos["estampilla_pro_cultura-2"]) return true;
    return false;
}

/**
 * Devuelve los campos y documentos obligatorios pendientes.
 * Si todo está completo, devuelve un arreglo vacío.
 */
export function faltantes(borrador: BorradorPreinscripcion): CampoFaltante[] {
    const resultado: CampoFaltante[] = [];

    const exigir = (texto: string | undefined, id: string, seccion: SeccionId, etiqueta: string) => {
        if (estaVacio(texto)) {
            resultado.push({ id, seccion, etiqueta, mensaje: MENSAJE_OBLIGATORIO });
        }
    };

    exigir(borrador.nombres, ID_CAMPOS.nombres, "identificacion", "Nombres");
    exigir(borrador.apellidos, ID_CAMPOS.apellidos, "identificacion", "Apellidos");
    exigir(borrador.perfil.tipoDocumento, ID_CAMPOS.tipoDocumento, "identificacion", "Tipo de documento");
    exigir(borrador.perfil.numeroDocumento, ID_CAMPOS.numeroDocumento, "identificacion", "Número de documento");
    exigir(borrador.codigoEstudiantil, ID_CAMPOS.codigoEstudiantil, "academico", "Código estudiantil");

    // El tipo solo se exige cuando la respuesta es afirmativa; los detalles son opcionales.
    if (borrador.perfil.tieneDiscapacidad === true) {
        exigir(borrador.perfil.tipoDiscapacidad, ID_CAMPOS.tipoDiscapacidad, "contacto", "Tipo de discapacidad");
    }

    // El segundo programa solo cuenta si el estudiante respondió que sí.
    const ordenes: Orden[] = borrador.segundoPrograma === true ? [1, 2] : [1];

    for (const orden of ordenes) {
        const solicitud = borrador.programas[orden - 1];
        const sufijo = orden === 2 ? " (segundo programa)" : "";

        exigir(solicitud?.modalidad, idCampoPrograma("modalidad", orden), "academico", `Modalidad${sufijo}`);
        exigir(solicitud?.programa, idCampoPrograma("programa", orden), "academico", `Programa${sufijo}`);
    }

    const documentos = obtenerDocumentosRequeridos(borrador.nivel, borrador.segundoPrograma === true);

    for (const documento of documentos) {
        if (!documentoCargado(borrador, documento.id)) {
            resultado.push({
                id: idDocumento(documento.id),
                seccion: "documentos",
                etiqueta: documento.etiqueta,
                mensaje: MENSAJE_DOCUMENTO,
            });
        }
    }

    return resultado;
}

/**
 * Determina qué secciones tienen campos obligatorios según el nivel académico.
 * La sección de documentos se calcula por separado.
 */
function seccionesConObligatorios(nivel: Nivel): Set<SeccionId> {
    return new Set(
        faltantes(borradorVacio(nivel, ""))
            .map((pendiente) => pendiente.seccion)
            .filter((seccion) => seccion !== "documentos"),
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Progreso
// ─────────────────────────────────────────────────────────────────────────────

export interface ProgresoSeccion {
    id: SeccionId;
    titulo: string;
    /** Campos obligatorios sin completar o documentos requeridos sin cargar. */
    faltan: number;
    /** Indica si la sección no tiene campos obligatorios para este nivel. */
    opcional: boolean;
}

export interface Progreso {
    /** Secciones del nivel, en orden, incluida la sección de documentos. */
    secciones: ProgresoSeccion[];
    documentos: { cargados: number; requeridos: number };
    /** Secciones con campos pendientes, sin contar documentos. */
    seccionesPendientes: number;
    documentosPendientes: number;
    /** Indica si el formulario está listo para enviarse. */
    listo: boolean;
}

/** Calcula el progreso del estudiante. */
export function progreso(borrador: BorradorPreinscripcion): Progreso {
    const pendientes = faltantes(borrador);
    const requeridos = obtenerDocumentosRequeridos(borrador.nivel, borrador.segundoPrograma === true);

    const cargados = requeridos.filter((documento) => documentoCargado(borrador, documento.id)).length;
    const conObligatorios = seccionesConObligatorios(borrador.nivel);
    // La respuesta afirmativa vuelve obligatorio el tipo de discapacidad en Contacto.
    if (borrador.perfil.tieneDiscapacidad === true) conObligatorios.add("contacto");

    const secciones = seccionesDelNivel(borrador.nivel).map((id) => ({
        id,
        titulo: SECCIONES[id],
        faltan: pendientes.filter((pendiente) => pendiente.seccion === id).length,
        opcional: id !== "documentos" && !conObligatorios.has(id),
    }));

    return {
        secciones,
        documentos: { cargados, requeridos: requeridos.length },
        seccionesPendientes: secciones.filter((seccion) => seccion.id !== "documentos" && seccion.faltan > 0).length,
        documentosPendientes: requeridos.length - cargados,
        listo: pendientes.length === 0,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Formato
// ─────────────────────────────────────────────────────────────────────────────

/** Deja solo letras y dígitos; quita puntos, comas, espacios y guiones. */
export function limpiarNumeroDocumento(texto: string): string {
    return texto.replace(/[^A-Za-z0-9]/g, "");
}

export const MENSAJE_NO_ES_PDF = "Solo se aceptan archivos PDF.";

const BYTES_POR_MB = 1024 * 1024;
const FORMATO_MEGAS = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

/**
 * Comprueba que el archivo tenga extensión y tipo PDF, que no esté vacío
 * y que no supere el tamaño máximo. Si no hay límite, maximo debe ser null.
 */
export function validarPdf(archivo: { name: string; type: string; size: number }, maximo: number | null): string | null {
    const esPdf = /\.pdf$/i.test(archivo.name) && archivo.type.toLowerCase() === "application/pdf";

    if (!esPdf) return MENSAJE_NO_ES_PDF;
    if (archivo.size === 0) return "El archivo está vacío.";

    if (maximo !== null && archivo.size > maximo) {
        return `El archivo pesa más de ${FORMATO_MEGAS.format(maximo / BYTES_POR_MB)} MB, el máximo permitido.`;
    }

    return null;
}

/** Firma inicial de un archivo PDF: "%PDF-". */
const FIRMA_PDF = [0x25, 0x50, 0x44, 0x46, 0x2d];

/** Número máximo de bytes en los que se busca la firma. */
const BYTES_CON_FIRMA = 1024;

/**
 * Comprueba que el archivo tenga la firma de un PDF en sus primeros bytes.
 * Lee como máximo el primer KB y no guarda ni envía el archivo.
 */
export async function tieneFirmaPdf(archivo: Blob): Promise<boolean> {
    const bytes = new Uint8Array(await archivo.slice(0, BYTES_CON_FIRMA).arrayBuffer());

    for (let inicio = 0; inicio + FIRMA_PDF.length <= bytes.length; inicio++) {
        if (FIRMA_PDF.every((byte, i) => bytes[inicio + i] === byte)) {
            return true;
        }
    }

    return false;
}
