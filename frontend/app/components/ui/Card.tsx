import { useId, type ReactNode } from "react";
import styles from "./Card.module.css";

export interface CardProps {
    titulo?: string;
    nivelTitulo?: 2 | 3;
    /** Contenido a la derecha del título (un botón, un conteo…). */
    acciones?: ReactNode;
    className?: string;
    id?: string;
    /** Id fijo para el título; lo hace enfocable (tabIndex -1) para llevar el foco a la sección. */
    tituloId?: string;
    /** Quita el margen inferior de la cabecera cuando su contenido está oculto. */
    cabeceraSinMargen?: boolean;
    children: ReactNode;
}

/** Sección con fondo de superficie; su título la nombra para el lector de pantalla. */
export default function Card({ titulo, nivelTitulo = 2, acciones, className, id, tituloId, cabeceraSinMargen = false, children }: CardProps) {
    const generado = useId();
    const idTitulo = tituloId ?? generado;
    const Titulo = nivelTitulo === 2 ? "h2" : "h3";

    return (
        <section
            id={id}
            className={[styles.tarjeta, cabeceraSinMargen && styles.cabeceraSinMargen, className].filter(Boolean).join(" ")}
            aria-labelledby={titulo ? idTitulo : undefined}
        >
            {(titulo || acciones) && (
                <div className={styles.cabecera}>
                    {titulo && (
                        <Titulo id={idTitulo} className={styles.titulo} tabIndex={tituloId ? -1 : undefined}>
                            {titulo}
                        </Titulo>
                    )}
                    {acciones}
                </div>
            )}
            {children}
        </section>
    );
}
