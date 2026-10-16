"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import Icono from "./Icono";
import styles from "./Dialog.module.css";

const ENFOCABLES =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface DialogProps {
    abierto: boolean;
    alCerrar: () => void;
    titulo: string;
    /** Línea bajo el título (p. ej. el nombre del archivo). */
    descripcion?: string;
    /** Texto corto sobre el título. */
    etiqueta?: string;
    children: ReactNode;
}

/**
 * Diálogo modal sobre <dialog> nativo (showModal): el navegador atrapa el foco y deja el fondo
 * inerte. Esc o un clic en el fondo llaman a alCerrar, y al cerrar el foco vuelve a donde estaba.
 */
export default function Dialog({ abierto, alCerrar, titulo, descripcion, etiqueta, children }: DialogProps) {
    const ref = useRef<HTMLDialogElement>(null);
    const anterior = useRef<HTMLElement | null>(null);
    const idTitulo = useId();
    const idDescripcion = useId();

    useEffect(() => {
        const dialogo = ref.current;
        if (!dialogo) return;

        if (abierto && !dialogo.open) {
            anterior.current = document.activeElement as HTMLElement | null;
            dialogo.showModal();
        } else if (!abierto && dialogo.open) {
            dialogo.close();
            anterior.current?.focus();
        }
    }, [abierto]);

    return (
        <dialog
            ref={ref}
            className={styles.dialogo}
            aria-labelledby={idTitulo}
            aria-describedby={descripcion ? idDescripcion : undefined}
            onCancel={(evento) => {
                evento.preventDefault();
                alCerrar();
            }}
            onClick={(evento) => {
                if (evento.target === ref.current) alCerrar();
            }}
            onKeyDown={(evento) => {
                // El fondo ya es inerte; además, Tab da la vuelta dentro del diálogo en vez de
                // salir a la barra del navegador.
                if (evento.key !== "Tab" || !ref.current) return;
                const enfocables = ref.current.querySelectorAll<HTMLElement>(ENFOCABLES);
                const primero = enfocables[0];
                const ultimo = enfocables[enfocables.length - 1];
                if (!primero || !ultimo) return;
                if (evento.shiftKey && document.activeElement === primero) {
                    evento.preventDefault();
                    ultimo.focus();
                } else if (!evento.shiftKey && document.activeElement === ultimo) {
                    evento.preventDefault();
                    primero.focus();
                }
            }}
        >
            <div className={styles.contenido}>
                <header className={styles.cabecera}>
                    <div className={styles.titulos}>
                        {etiqueta && <p className={styles.etiqueta}>{etiqueta}</p>}
                        <h2 id={idTitulo} className={styles.titulo}>
                            {titulo}
                        </h2>
                        {descripcion && (
                            <p id={idDescripcion} className={styles.descripcion}>
                                {descripcion}
                            </p>
                        )}
                    </div>
                    <button type="button" className={styles.cerrar} onClick={alCerrar} aria-label="Cerrar">
                        <Icono nombre="cerrar" tamano={20} />
                    </button>
                </header>
                <div className={styles.cuerpo}>{children}</div>
            </div>
        </dialog>
    );
}
