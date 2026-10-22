/**
 * constantes.ts — Listas de valores de los campos con opciones del formulario.
 *
 * ⚠️  Los valores y las etiquetas de estas listas son provisionales: faltan las listas
 * oficiales del formulario real. Cada lista lleva su TODO. Cuando se confirmen, se cambian
 * aquí y el formulario las toma sin tocar nada más.
 */

import type { Modalidad } from "./tipos";

export interface Opcion<V extends string = string> {
    /** Lo que se guarda */
    valor: V;
    /** Lo que ve el estudiante */
    etiqueta: string;
}

// TODO: sin confirmar con el formulario real
export const TIPOS_DOCUMENTO: readonly Opcion[] = [
    { valor: "CC", etiqueta: "Cédula de ciudadanía" },
    { valor: "TI", etiqueta: "Tarjeta de identidad" },
    { valor: "CE", etiqueta: "Cédula de extranjería" },
    { valor: "PASAPORTE", etiqueta: "Pasaporte" },
];

// TODO: sin confirmar con el formulario real
export const GENEROS: readonly Opcion[] = [
    { valor: "FEMENINO", etiqueta: "Femenino" },
    { valor: "MASCULINO", etiqueta: "Masculino" },
    { valor: "OTRO", etiqueta: "Otro" },
    { valor: "NO_INFORMA", etiqueta: "Prefiero no decirlo" },
];

// TODO: sin confirmar con el formulario real
export const OPCIONES_GRADO: readonly Opcion[] = [
    { valor: "TRABAJO_DE_GRADO", etiqueta: "Trabajo de grado" },
    { valor: "PRACTICA_PROFESIONAL", etiqueta: "Práctica profesional" },
    { valor: "CURSO_POSGRADO", etiqueta: "Curso de posgrado" },
    { valor: "EMPRENDIMIENTO", etiqueta: "Proyecto de emprendimiento" },
];

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
