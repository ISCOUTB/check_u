import { useId, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";
import Icono from "./Icono";
import styles from "./Field.module.css";

/** Una opción de un campo con lista: lo que se guarda y lo que se ve. */
export interface OpcionCampo {
    valor: string;
    etiqueta: string;
}

interface PropsComunes {
    etiqueta: string;
    /** Error de este campo; se enlaza con aria-describedby y marca aria-invalid. */
    error?: string;
    ayuda?: string;
    /** Agrega " (obligatorio)" a la etiqueta, required y aria-required. */
    obligatorio?: boolean;
}

type PropsEntrada = PropsComunes & InputHTMLAttributes<HTMLInputElement> & { opciones?: undefined };

/** Con `opciones` el campo es un <select>, con una primera opción vacía ("Selecciona una opción"). */
type PropsLista = PropsComunes & SelectHTMLAttributes<HTMLSelectElement> & { opciones: readonly OpcionCampo[] };

export type FieldProps = PropsEntrada | PropsLista;

type Exigido = { required?: true; "aria-required"?: true };

/** Campo con etiqueta visible, ayuda y error enlazados. 16 px para que el celular no haga zoom. */
export default function Field({ etiqueta, error, ayuda, obligatorio, id, className, ...resto }: FieldProps) {
    const generado = useId();
    const idCampo = id ?? generado;
    const idAyuda = ayuda ? `${idCampo}-ayuda` : undefined;
    const idError = error ? `${idCampo}-error` : undefined;
    const descrito = [resto["aria-describedby"], idAyuda, idError].filter(Boolean).join(" ") || undefined;
    const exigido: Exigido = obligatorio ? { required: true, "aria-required": true } : {};

    return (
        <div className={[styles.campo, className].filter(Boolean).join(" ")}>
            <label htmlFor={idCampo} className={styles.etiqueta}>
                {etiqueta}
                {obligatorio && <span className={styles.obligatorio}> (obligatorio)</span>}
            </label>
            {ayuda && (
                <p id={idAyuda} className={styles.ayuda}>
                    {ayuda}
                </p>
            )}
            {resto.opciones ? (
                <ListaDeOpciones idCampo={idCampo} error={error} exigido={exigido} descrito={descrito} {...resto} />
            ) : (
                <input
                    id={idCampo}
                    className={styles.entrada}
                    aria-invalid={error ? true : undefined}
                    {...exigido}
                    {...resto}
                    aria-describedby={descrito}
                />
            )}
            {error && (
                <p id={idError} className={styles.error}>
                    {error}
                </p>
            )}
        </div>
    );
}

function ListaDeOpciones({
    idCampo,
    error,
    exigido,
    descrito,
    opciones,
    ...atributos
}: Omit<PropsLista, keyof PropsComunes | "id" | "className"> & {
    idCampo: string;
    error?: string;
    exigido: Exigido;
    descrito?: string;
}) {
    return (
        <div className={styles.envoltorioLista}>
            <select
                id={idCampo}
                className={`${styles.entrada} ${styles.lista}`}
                aria-invalid={error ? true : undefined}
                {...exigido}
                {...atributos}
                aria-describedby={descrito}
            >
                <option value="">Selecciona una opción</option>
                {opciones.map((opcion) => (
                    <option key={opcion.valor} value={opcion.valor}>
                        {opcion.etiqueta}
                    </option>
                ))}
            </select>
            <span className={styles.flecha}>
                <Icono nombre="flecha_abajo" tamano={16} />
            </span>
        </div>
    );
}
