import { useId, type InputHTMLAttributes } from "react";
import styles from "./Field.module.css";

export type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
    etiqueta: string;
    /** Error de este campo; se enlaza con aria-describedby y marca aria-invalid. */
    error?: string;
    ayuda?: string;
};

/** Campo con etiqueta visible, ayuda y error enlazados. 16 px para que el celular no haga zoom. */
export default function Field({ etiqueta, error, ayuda, id, className, ...resto }: FieldProps) {
    const generado = useId();
    const idCampo = id ?? generado;
    const idAyuda = ayuda ? `${idCampo}-ayuda` : undefined;
    const idError = error ? `${idCampo}-error` : undefined;
    const descrito = [resto["aria-describedby"], idAyuda, idError].filter(Boolean).join(" ") || undefined;

    return (
        <div className={[styles.campo, className].filter(Boolean).join(" ")}>
            <label htmlFor={idCampo} className={styles.etiqueta}>
                {etiqueta}
            </label>
            {ayuda && (
                <p id={idAyuda} className={styles.ayuda}>
                    {ayuda}
                </p>
            )}
            <input
                id={idCampo}
                className={styles.entrada}
                aria-invalid={error ? true : undefined}
                {...resto}
                aria-describedby={descrito}
            />
            {error && (
                <p id={idError} className={styles.error}>
                    {error}
                </p>
            )}
        </div>
    );
}
