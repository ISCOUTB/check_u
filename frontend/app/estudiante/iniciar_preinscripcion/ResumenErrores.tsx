"use client";

import { useEffect, useId, useRef, type MouseEvent } from "react";
import Icono from "@/app/components/ui/Icono";
import type { CampoFaltante } from "./validacion";
import styles from "./ResumenErrores.module.css";

/** Lo que muestra el resumen: lo que falta para enviar, o los motivos con que se rechazó el envío. */
export type ContenidoResumen = { faltantes: CampoFaltante[] } | { motivos: string[] };

/**
 * Lleva al campo del enlace: muestra su etiqueta (o la pregunta, en un grupo de opciones) bajo la
 * barra superior y le pasa el foco. El salto del navegador solo desplazaría, sin enfocar.
 */
function irAlCampo(evento: MouseEvent<HTMLAnchorElement>, id: string) {
    const campo = document.getElementById(id);
    if (!campo) return;
    evento.preventDefault();
    const etiqueta =
        campo.closest('[role="radiogroup"]')?.querySelector("legend") ??
        document.querySelector(`label[for="${CSS.escape(id)}"]`) ??
        campo;
    etiqueta.scrollIntoView({ block: "start" });
    campo.focus({ preventScroll: true });
}

/**
 * Resumen de errores arriba del formulario (role="alert"). Recibe el foco cada vez que llega un
 * contenido nuevo (cada envío), para que el lector lo lea y el teclado siga desde ahí.
 *   - Faltantes: "Revisa estos campos antes de enviar", con un enlace a cada campo.
 *   - Rechazo: los motivos del backend, sin enlaces (no dicen qué campo es).
 */
export default function ResumenErrores({ contenido }: { contenido: ContenidoResumen }) {
    const ref = useRef<HTMLDivElement>(null);
    const idTitulo = useId();

    useEffect(() => {
        // Desde su comienzo: si no cabe en la pantalla, el navegador lo alinearía por abajo y el
        // título quedaría debajo de la barra superior.
        ref.current?.scrollIntoView({ block: "start" });
        ref.current?.focus({ preventScroll: true });
    }, [contenido]);

    const titulo =
        "faltantes" in contenido ? "Revisa estos campos antes de enviar" : "No se pudo enviar tu preinscripción";

    return (
        <div ref={ref} role="alert" aria-labelledby={idTitulo} tabIndex={-1} className={styles.resumen}>
            <h2 id={idTitulo} className={styles.titulo}>
                <Icono nombre="no_valido" tamano={20} />
                {titulo}
            </h2>
            {"faltantes" in contenido ? (
                <ul className={styles.lista}>
                    {contenido.faltantes.map((faltante) => (
                        <li key={faltante.id}>
                            <a href={`#${faltante.id}`} onClick={(evento) => irAlCampo(evento, faltante.id)}>
                                {faltante.etiqueta}: {faltante.mensaje}
                            </a>
                        </li>
                    ))}
                </ul>
            ) : (
                <>
                    <ul className={styles.lista}>
                        {contenido.motivos.map((motivo) => (
                            <li key={motivo}>{motivo}</li>
                        ))}
                    </ul>
                    <p className={styles.siguiente}>Corrige lo que se indica y vuelve a enviarla.</p>
                </>
            )}
        </div>
    );
}
