/**
 * comun.tsx — Lo que comparten las secciones del formulario: sus props, la tarjeta de cada
 * sección, el bloque que aparece al responder "sí" y los cambios inmutables del borrador.
 */

import type { ReactNode } from "react";
import Card from "@/app/components/ui/Card";
import type { OpcionCampo } from "@/app/components/ui/Field";
import type {
    BorradorPreinscripcion,
    ExperienciaLaboral,
    InformacionPosgrado,
    InformacionPregrado,
    PerfilEstudiante,
    ProgramaSolicitud,
} from "../tipos";
import { SECCIONES, type SeccionId } from "../validacion";
import type { OpcionesFormulario } from "../opciones";
import styles from "../iniciar_preinscripcion.module.css";

export type Cambio = (borrador: BorradorPreinscripcion) => BorradorPreinscripcion;

export interface PropsSeccion {
    borrador: BorradorPreinscripcion;
    cambiar: (cambio: Cambio) => void;
    /** Errores por id de campo (los de `ID_CAMPOS`, `idCampoPrograma`…). */
    errores: Record<string, string>;
    /** Opciones de los campos, cargadas desde el panel del funcionario. */
    opciones: OpcionesFormulario;
}

// ─────────────────────────────────────────────────────────────────────────────
// Preguntas sí/no: el borrador guarda boolean | null y los radios, "si" | "no" | ""
// ─────────────────────────────────────────────────────────────────────────────

export const OPCIONES_SI_NO: readonly OpcionCampo[] = [
    { valor: "si", etiqueta: "Sí" },
    { valor: "no", etiqueta: "No" },
];

export function aSiNo(respuesta: boolean | null): string {
    if (respuesta === null) return "";
    return respuesta ? "si" : "no";
}

export function deSiNo(valor: string): boolean | null {
    if (valor === "") return null;
    return valor === "si";
}

// ─────────────────────────────────────────────────────────────────────────────
// Cambios del borrador (siempre copias nuevas)
// ─────────────────────────────────────────────────────────────────────────────

export function cambioPerfil<K extends keyof PerfilEstudiante>(campo: K, valor: PerfilEstudiante[K]): Cambio {
    return (b) => ({ ...b, perfil: { ...b.perfil, [campo]: valor } });
}

export function cambioPrograma<K extends keyof ProgramaSolicitud>(
    orden: 1 | 2,
    campo: K,
    valor: ProgramaSolicitud[K],
): Cambio {
    return (b) => ({
        ...b,
        programas: b.programas.map((programa) =>
            programa.orden === orden ? { ...programa, [campo]: valor } : programa,
        ),
    });
}

export function cambioPregrado<K extends keyof InformacionPregrado>(campo: K, valor: InformacionPregrado[K]): Cambio {
    return (b) => ({ ...b, pregrado: { ...b.pregrado, [campo]: valor } });
}

export function cambioPosgrado<K extends keyof InformacionPosgrado>(campo: K, valor: InformacionPosgrado[K]): Cambio {
    return (b) => ({ ...b, posgrado: { ...b.posgrado, [campo]: valor } });
}

export function cambioExperiencia<K extends keyof ExperienciaLaboral>(
    orden: 1 | 2,
    campo: K,
    valor: ExperienciaLaboral[K],
): Cambio {
    return (b) => ({
        ...b,
        experiencia: b.experiencia.map((cargo) => (cargo.orden === orden ? { ...cargo, [campo]: valor } : cargo)),
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Piezas de la página
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Una sección del formulario: tarjeta con `id="seccion-<id>"` (el destino del índice) y un
 * <fieldset> cuya <legend> es el título de la sección.
 */
export function Seccion({ id, descripcion, children }: { id: SeccionId; descripcion?: string; children: ReactNode }) {
    return (
        <Card id={`seccion-${id}`} className={styles.seccion}>
            <fieldset className={styles.grupoSeccion}>
                <legend className={styles.leyendaSeccion}>
                    <h2 className={styles.tituloSeccion}>{SECCIONES[id]}</h2>
                </legend>
                {descripcion && <p className={styles.descripcionSeccion}>{descripcion}</p>}
                {children}
            </fieldset>
        </Card>
    );
}

/** Lo que aparece al responder "sí": entra con opacidad y 4 px (180 ms) y se va sin animación. */
export function Condicional({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={[styles.condicional, className].filter(Boolean).join(" ")}>{children}</div>;
}
