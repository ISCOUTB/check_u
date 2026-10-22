/**
 * validacion.ts — Qué falta en el borrador, cuánto se lleva y cómo se revisa un PDF.
 *
 * Son funciones puras, sin React: reciben el borrador y devuelven datos. Nada aquí
 * modifica el borrador ni reescribe lo que escribió el estudiante (las fechas, por
 * ejemplo, se quedan como `aaaa-mm-dd`).
 *
 * IDS DE LA PÁGINA
 *   Un único lugar decide el `id` de cada elemento del formulario, para que el resumen de
 *   errores pueda enlazar y enfocar el campo exacto. La página usa estos mismos ayudantes
 *   para ponerle el `id` a cada campo; `CampoFaltante.id` sale de ellos.
 *     - `ID_CAMPOS`: los campos que aparecen una sola vez. `ID_CAMPOS.nombres` es "campo-nombres".
 *     - `idCampoPrograma(campo, orden)`: los campos de cada programa. `("programa", 2)` es
 *       "campo-programa-2". El orden 1 es el primer programa y el 2 es el segundo.
 *     - `idCampoExperiencia(campo, orden)`: los campos de cada cargo. `("empresa", 1)` es
 *       "campo-empresa-1".
 *     - `idDocumento(id)`: la zona de carga de un documento, con el id de
 *       `DocumentoDelFormulario`. `("saber_pro")` es "documento-saber_pro".
 *   En un grupo de opciones (sí/no, modalidad), el id va en el elemento que recibe el foco
 *   al saltar desde el resumen (la primera opción).
 *
 * QUÉ CUENTA COMO FALTANTE (sección 4 del spec)
 *   - Obligatorios: nombres, apellidos, tipo y número de documento, código estudiantil, y
 *     programa y modalidad del primer programa.
 *   - El segundo programa (programa y modalidad) solo cuenta si `segundoPrograma === true`.
 *     Lo que haya quedado escrito en él después de cambiar la respuesta a "no" se ignora.
 *   - Cada documento requerido sin cargar, según `documentosRequeridos` (incluido el
 *     Paz y Salvo; la segunda estampilla solo con segundo programa en pregrado).
 *   - El correo viene de la sesión y no se cuenta. Todo lo demás es opcional, incluidos los
 *     bloques de Saber Pro/vinculación (pregrado) y de estudios/experiencia (posgrado).
 *   - Un texto de solo espacios cuenta como vacío.
 */

import { documentosRequeridos, type Nivel } from "@/app/estudiante/documentos-requeridos";
import { borradorVacio, type BorradorPreinscripcion } from "./tipos";

// ─────────────────────────────────────────────────────────────────────────────
// Ids de la página
// ─────────────────────────────────────────────────────────────────────────────

/** Los campos que aparecen una sola vez en el formulario. */
export const ID_CAMPOS = {
    // Identificación
    nombres: "campo-nombres",
    apellidos: "campo-apellidos",
    tipoDocumento: "campo-tipo-documento",
    numeroDocumento: "campo-numero-documento",
    fechaNacimiento: "campo-fecha-nacimiento",
    genero: "campo-genero",
    // Contacto y residencia
    correo: "campo-correo",
    telefonoFijo: "campo-telefono-fijo",
    celular: "campo-celular",
    departamento: "campo-departamento",
    ciudad: "campo-ciudad",
    direccion: "campo-direccion",
    // Información académica (los de cada programa van en `idCampoPrograma`)
    codigoEstudiantil: "campo-codigo-estudiantil",
    segundoPrograma: "campo-segundo-programa",
    // Saber Pro y vinculación con la UTB (pregrado)
    conoceRegistroSaberPro: "campo-conoce-registro-saber-pro",
    numeroRegistroSaberPro: "campo-numero-registro-saber-pro",
    fechaExamenSaberPro: "campo-fecha-examen-saber-pro",
    esEmpleadoUtb: "campo-es-empleado-utb",
    tipoContrato: "campo-tipo-contrato",
    esHijoDeEmpleadoUtb: "campo-es-hijo-de-empleado-utb",
    // Estudios y experiencia (posgrado; los de cada cargo van en `idCampoExperiencia`)
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

/** El id de un campo de un programa: `idCampoPrograma("programa", 2)` es "campo-programa-2". */
export function idCampoPrograma(campo: CampoPrograma, orden: Orden): string {
    return `${BASE_CAMPO_PROGRAMA[campo]}-${orden}`;
}

const BASE_CAMPO_EXPERIENCIA = {
    empresa: "campo-empresa",
    cargo: "campo-cargo",
    tiempo: "campo-tiempo",
} as const;

export type CampoExperiencia = keyof typeof BASE_CAMPO_EXPERIENCIA;

/** El id de un campo de un cargo: `idCampoExperiencia("empresa", 1)` es "campo-empresa-1". */
export function idCampoExperiencia(campo: CampoExperiencia, orden: Orden): string {
    return `${BASE_CAMPO_EXPERIENCIA[campo]}-${orden}`;
}

/** El id de la zona de carga de un documento: `idDocumento("saber_pro")` es "documento-saber_pro". */
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

/** Las secciones que muestra el formulario para un nivel, en orden. */
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
    /** El id del elemento en la página (ver `ID_CAMPOS`, `idCampoPrograma` e `idDocumento`) */
    id: string;
    seccion: SeccionId;
    /** El nombre del campo o del documento, como lo ve el estudiante */
    etiqueta: string;
    mensaje: string;
}

function estaVacio(texto: string | undefined): boolean {
    return (texto ?? "").trim() === "";
}

function documentoCargado(borrador: BorradorPreinscripcion, id: string): boolean {
    return Boolean(borrador.documentos[id]);
}

/**
 * Lo obligatorio que falta, en el orden en que aparece en la página: primero los campos
 * por sección y al final los documentos. Con todo completo devuelve [].
 */
export function faltantes(borrador: BorradorPreinscripcion): CampoFaltante[] {
    const resultado: CampoFaltante[] = [];

    const exigir = (texto: string | undefined, id: string, seccion: SeccionId, etiqueta: string) => {
        if (estaVacio(texto)) resultado.push({ id, seccion, etiqueta, mensaje: MENSAJE_OBLIGATORIO });
    };

    exigir(borrador.nombres, ID_CAMPOS.nombres, "identificacion", "Nombres");
    exigir(borrador.apellidos, ID_CAMPOS.apellidos, "identificacion", "Apellidos");
    exigir(borrador.perfil.tipoDocumento, ID_CAMPOS.tipoDocumento, "identificacion", "Tipo de documento");
    exigir(borrador.perfil.numeroDocumento, ID_CAMPOS.numeroDocumento, "identificacion", "Número de documento");

    exigir(borrador.codigoEstudiantil, ID_CAMPOS.codigoEstudiantil, "academico", "Código estudiantil");

    // El segundo programa solo cuenta si el estudiante dijo que sí.
    const ordenes: Orden[] = borrador.segundoPrograma === true ? [1, 2] : [1];
    for (const orden of ordenes) {
        const solicitud = borrador.programas[orden - 1];
        const sufijo = orden === 2 ? " (segundo programa)" : "";
        exigir(solicitud?.modalidad, idCampoPrograma("modalidad", orden), "academico", `Modalidad${sufijo}`);
        exigir(solicitud?.programa, idCampoPrograma("programa", orden), "academico", `Programa${sufijo}`);
    }

    for (const documento of documentosRequeridos(borrador.nivel, borrador.segundoPrograma === true)) {
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
 * Las secciones que tienen algún campo obligatorio en un nivel. Sale de las mismas reglas de
 * `faltantes` (lo que le falta a un borrador vacío), para que no haya una segunda lista que
 * mantener. "documentos" no entra: sus requisitos son documentos, no campos.
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
    /** Campos obligatorios sin llenar; en "documentos", documentos requeridos sin cargar */
    faltan: number;
    /**
     * La sección no tiene ningún campo obligatorio en este nivel: todo en ella es opcional.
     * Depende del nivel, no de lo llenado. "documentos" nunca es opcional.
     */
    opcional: boolean;
}

export interface Progreso {
    /** Las secciones del nivel, en orden, incluida "documentos" */
    secciones: ProgresoSeccion[];
    documentos: { cargados: number; requeridos: number };
    /** Secciones de campos con algo pendiente. No cuenta "documentos", que va aparte. */
    seccionesPendientes: number;
    documentosPendientes: number;
    /** No falta nada: se puede enviar */
    listo: boolean;
}

/** Cuánto lleva el estudiante, para el índice lateral y su resumen. */
export function progreso(borrador: BorradorPreinscripcion): Progreso {
    const pendientes = faltantes(borrador);
    const requeridos = documentosRequeridos(borrador.nivel, borrador.segundoPrograma === true);
    const cargados = requeridos.filter((documento) => documentoCargado(borrador, documento.id)).length;

    const conObligatorios = seccionesConObligatorios(borrador.nivel);

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

/** Deja solo letras y dígitos (`[A-Za-z0-9]`): quita puntos, comas, espacios y guiones. */
export function limpiarNumeroDocumento(texto: string): string {
    return texto.replace(/[^A-Za-z0-9]/g, "");
}

const BYTES_POR_MB = 1024 * 1024;
const FORMATO_MEGAS = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

/**
 * Revisa un archivo antes de cargarlo: tiene que ser PDF (por extensión y por tipo), no estar
 * vacío y caber en `maximo` bytes (null: sin límite). Devuelve el mensaje de error, o null si
 * el archivo sirve.
 */
export function validarPdf(
    archivo: { name: string; type: string; size: number },
    maximo: number | null,
): string | null {
    const esPdf = /\.pdf$/i.test(archivo.name) && archivo.type.toLowerCase() === "application/pdf";
    if (!esPdf) return "Solo se aceptan archivos PDF.";
    if (archivo.size === 0) return "El archivo está vacío.";
    if (maximo !== null && archivo.size > maximo) {
        return `El archivo pesa más de ${FORMATO_MEGAS.format(maximo / BYTES_POR_MB)} MB, el máximo permitido.`;
    }
    return null;
}
