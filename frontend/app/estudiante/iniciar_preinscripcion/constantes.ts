/**
 * constantes.ts — Listas de valores de los campos que todavía no administra el panel.
 *
 * Los campos de la Tarea 40 (tipo de documento, género, programa, opción de grado y
 * tipo de discapacidad) ya no se definen aquí: se cargan desde `opciones_campo` en
 * `opciones.ts`. Estas listas siguen su curso hasta que esos campos también se
 * confirmen con el formulario real.
 */

import type { Modalidad } from "./tipos";

export interface Opcion<V extends string = string> {
    /** Lo que se guarda */
    valor: V;
    /** Lo que ve el estudiante */
    etiqueta: string;
}

// TODO: sin confirmar con el formulario real
export const TIPOS_CONTRATO: readonly Opcion[] = [
    { valor: "INDEFINIDO", etiqueta: "Término indefinido" },
    { valor: "FIJO", etiqueta: "Término fijo" },
    { valor: "PRESTACION_SERVICIOS", etiqueta: "Prestación de servicios" },
    { valor: "CATEDRA", etiqueta: "Docente de cátedra" },
];

// TODO: sin confirmar con el formulario real
export const NIVELES_ESTUDIO: readonly Opcion[] = [
    { valor: "PROFESIONAL", etiqueta: "Profesional" },
    { valor: "ESPECIALIZACION", etiqueta: "Especialización" },
    { valor: "MAESTRIA", etiqueta: "Maestría" },
    { valor: "DOCTORADO", etiqueta: "Doctorado" },
];

/** Los valores son los del modelo de datos (#40): VIRTUAL y PRESENCIAL. */
export const MODALIDADES: readonly Opcion<Modalidad>[] = [
    { valor: "VIRTUAL", etiqueta: "Virtual" },
    { valor: "PRESENCIAL", etiqueta: "Presencial" },
];
