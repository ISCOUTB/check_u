import type { TextareaHTMLAttributes } from "react";
import styles from "./Field.module.css";

export interface AreaTextoProps
    extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> {
    etiqueta: string;
    /** Error de este campo; se enlaza con aria-describedby y marca aria-invalid. */
    error?: string;
    ayuda?: string;
    /** Agrega " (obligatorio)" a la etiqueta, required y aria-required. */
    obligatorio?: boolean;
    className?: string;
}

/**
 * Campo de texto largo con etiqueta visible, ayuda y error enlazados.
 * Comparte la tipografía y los estados de foco de `Field`.
 */
export default function AreaTexto({
    etiqueta,
    error,
    ayuda,
    obligatorio,
    id,
    className,
    ...resto
}: AreaTextoProps) {
    const idAyuda = ayuda && id ? `${id}-ayuda` : undefined;
    const idError = error && id ? `${id}-error` : undefined;
    const descrito =
        [resto["aria-describedby"], idAyuda, idError].filter(Boolean).join(" ") ||
        undefined;

    return (
        <div className={[styles.campo, className].filter(Boolean).join(" ")}>
            <label htmlFor={id} className={styles.etiqueta}>
                {etiqueta}
                {obligatorio && (
                    <span className={styles.obligatorio}> (obligatorio)</span>
                )}
            </label>
            {ayuda && (
                <p id={idAyuda} className={styles.ayuda}>
                    {ayuda}
                </p>
            )}
            <textarea
                id={id}
                className={styles.entrada}
                aria-invalid={error ? true : undefined}
                required={obligatorio}
                aria-required={obligatorio || undefined}
                aria-describedby={descrito}
                {...resto}
            />
            {error && (
                <p id={idError} className={styles.error}>
                    {error}
                </p>
            )}
        </div>
    );
}
