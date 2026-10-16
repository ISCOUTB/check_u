import Link from "next/link";
import styles from "./PageHeader.module.css";

export interface PageHeaderProps {
    /** Texto corto sobre el título; solo donde ya existía (inicio del estudiante). */
    etiqueta?: string;
    titulo: string;
    descripcion?: string;
    /** Ruta de navegación; el último elemento es la página actual. */
    ruta?: { texto: string; href?: string }[];
}

export default function PageHeader({ etiqueta, titulo, descripcion, ruta }: PageHeaderProps) {
    return (
        <div className={styles.encabezado}>
            {ruta && ruta.length > 0 && (
                <nav aria-label="Ruta" className={styles.ruta}>
                    <ol>
                        {ruta.map((paso, i) => {
                            const actual = i === ruta.length - 1;
                            return (
                                <li key={paso.texto}>
                                    {paso.href && !actual ? (
                                        <Link href={paso.href}>{paso.texto}</Link>
                                    ) : (
                                        <span aria-current={actual ? "page" : undefined}>{paso.texto}</span>
                                    )}
                                </li>
                            );
                        })}
                    </ol>
                </nav>
            )}
            {etiqueta && <p className={styles.etiqueta}>{etiqueta}</p>}
            <h1 className={styles.titulo}>{titulo}</h1>
            {descripcion && <p className={styles.descripcion}>{descripcion}</p>}
        </div>
    );
}
