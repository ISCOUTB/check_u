import { useId } from "react";
import type { OpcionCampo } from "./Field";
import styles from "./Opciones.module.css";

export interface OpcionesProps {
    /** La pregunta: nombra el grupo para el lector de pantalla. */
    leyenda: string;
    /** El `name` de los radios: único en la página. */
    nombre: string;
    opciones: readonly OpcionCampo[];
    /** El valor marcado; "" si no hay ninguno. */
    valor: string;
    alCambiar: (valor: string) => void;
    /** Agrega " (obligatorio)" a la pregunta, required en los radios y aria-required en el grupo. */
    obligatorio?: boolean;
    /** Error del grupo: marca aria-invalid en el grupo y describe cada opción (aria-describedby). */
    error?: string;
    /** Va en la primera opción: es la que recibe el foco al saltar desde un enlace. */
    id?: string;
    className?: string;
}

/**
 * Pregunta de una sola respuesta (sí/no, modalidad…): <fieldset> con <legend> y radios reales,
 * así que las flechas cambian la respuesta y el lector anuncia la pregunta. Cada opción mide 44 px.
 */
export default function Opciones({
    leyenda,
    nombre,
    opciones,
    valor,
    alCambiar,
    obligatorio,
    error,
    id,
    className,
}: OpcionesProps) {
    const generado = useId();
    const idLeyenda = `${generado}-leyenda`;
    const idError = error ? `${id ?? generado}-error` : undefined;

    return (
        <fieldset
            role="radiogroup"
            aria-labelledby={idLeyenda}
            aria-required={obligatorio || undefined}
            aria-invalid={error ? true : undefined}
            className={[styles.grupo, className].filter(Boolean).join(" ")}
        >
            <legend id={idLeyenda} className={styles.leyenda}>
                {leyenda}
                {obligatorio && <span className={styles.obligatorio}> (obligatorio)</span>}
            </legend>
            <div className={styles.opciones}>
                {opciones.map((opcion, posicion) => (
                    <label key={opcion.valor} className={styles.opcion}>
                        <input
                            type="radio"
                            id={posicion === 0 ? id : undefined}
                            name={nombre}
                            value={opcion.valor}
                            checked={valor === opcion.valor}
                            onChange={() => alCambiar(opcion.valor)}
                            required={obligatorio}
                            aria-describedby={idError}
                        />
                        {opcion.etiqueta}
                    </label>
                ))}
            </div>
            {error && (
                <p id={idError} className={styles.error}>
                    {error}
                </p>
            )}
        </fieldset>
    );
}
