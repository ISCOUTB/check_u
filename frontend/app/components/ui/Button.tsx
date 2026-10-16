import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variante?: "primario" | "secundario" | "sutil";
    /** Mientras espera: muestra textoCargando, queda deshabilitado y con aria-busy. */
    cargando?: boolean;
    textoCargando?: string;
    /** Con href navega (next/link) en vez de ser un botón. */
    href?: string;
};

/** Botón de CheckU: 44 px de alto como mínimo, foco visible y respuesta al presionar. */
export default function Button({
    variante = "primario",
    cargando = false,
    textoCargando,
    href,
    className,
    children,
    disabled,
    type = "button",
    ...resto
}: ButtonProps) {
    const clases = [styles.boton, styles[variante], className].filter(Boolean).join(" ");

    if (href) {
        return (
            <Link href={href} className={clases} aria-label={resto["aria-label"]} title={resto.title}>
                {children}
            </Link>
        );
    }

    return (
        <button
            type={type}
            className={clases}
            disabled={disabled || cargando}
            aria-busy={cargando || undefined}
            {...resto}
        >
            {cargando && textoCargando ? textoCargando : children}
        </button>
    );
}
