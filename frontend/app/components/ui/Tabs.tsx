"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import styles from "./Tabs.module.css";

export interface Pestana {
    id: string;
    titulo: string;
    contenido: ReactNode;
}

export interface TabsProps {
    /** Nombre del grupo de pestañas para el lector de pantalla. */
    etiqueta: string;
    pestanas: Pestana[];
    inicial?: string;
    /** Con activa y alCambiar, la página controla la pestaña (p. ej. para saltar desde el contenido). */
    activa?: string;
    alCambiar?: (id: string) => void;
}

/**
 * Pestañas con el patrón ARIA: flechas, Inicio y Fin mueven el foco y seleccionan; solo la pestaña
 * activa entra en el orden de Tab.
 */
export default function Tabs({ etiqueta, pestanas, inicial, activa, alCambiar }: TabsProps) {
    const base = useId();
    const [interna, setInterna] = useState(inicial ?? pestanas[0]?.id);
    const seleccionada = activa ?? interna;
    const botones = useRef<(HTMLButtonElement | null)[]>([]);

    const seleccionar = (id: string) => {
        setInterna(id);
        alCambiar?.(id);
    };

    const alTeclear = (evento: KeyboardEvent<HTMLButtonElement>, indice: number) => {
        const ultimo = pestanas.length - 1;
        const destino =
            evento.key === "ArrowRight" ? (indice === ultimo ? 0 : indice + 1)
            : evento.key === "ArrowLeft" ? (indice === 0 ? ultimo : indice - 1)
            : evento.key === "Home" ? 0
            : evento.key === "End" ? ultimo
            : null;
        if (destino === null) return;
        evento.preventDefault();
        seleccionar(pestanas[destino].id);
        botones.current[destino]?.focus();
    };

    return (
        <div className={styles.pestanas}>
            <div role="tablist" aria-label={etiqueta} className={styles.lista}>
                {pestanas.map((pestana, indice) => {
                    const activaAhora = pestana.id === seleccionada;
                    return (
                        <button
                            key={pestana.id}
                            ref={(boton) => {
                                botones.current[indice] = boton;
                            }}
                            type="button"
                            role="tab"
                            id={`${base}-pestana-${pestana.id}`}
                            aria-selected={activaAhora}
                            aria-controls={`${base}-panel-${pestana.id}`}
                            tabIndex={activaAhora ? 0 : -1}
                            className={styles.pestana}
                            onClick={() => seleccionar(pestana.id)}
                            onKeyDown={(evento) => alTeclear(evento, indice)}
                        >
                            {pestana.titulo}
                        </button>
                    );
                })}
            </div>
            {pestanas.map((pestana) => (
                <div
                    key={pestana.id}
                    role="tabpanel"
                    id={`${base}-panel-${pestana.id}`}
                    aria-labelledby={`${base}-pestana-${pestana.id}`}
                    tabIndex={0}
                    hidden={pestana.id !== seleccionada}
                    className={styles.panel}
                >
                    {pestana.contenido}
                </div>
            ))}
        </div>
    );
}
