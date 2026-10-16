import { useId, type ReactNode } from "react";
import styles from "./Card.module.css";

export interface CardProps {
    titulo?: string;
    nivelTitulo?: 2 | 3;
    /** Contenido a la derecha del título (un botón, un conteo…). */
    acciones?: ReactNode;
    className?: string;
    id?: string;
    children: ReactNode;
}

/** Sección con fondo de superficie; su título la nombra para el lector de pantalla. */
export default function Card({ titulo, nivelTitulo = 2, acciones, className, id, children }: CardProps) {
    const idTitulo = useId();
    const Titulo = nivelTitulo === 2 ? "h2" : "h3";

    return (
        <section
            id={id}
            className={[styles.tarjeta, className].filter(Boolean).join(" ")}
            aria-labelledby={titulo ? idTitulo : undefined}
        >
            {(titulo || acciones) && (
                <div className={styles.cabecera}>
                    {titulo && (
                        <Titulo id={idTitulo} className={styles.titulo}>
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
