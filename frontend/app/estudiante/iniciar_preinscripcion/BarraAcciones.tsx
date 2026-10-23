"use client";

import { useEffect, useRef } from "react";
import Button from "@/app/components/ui/Button";
import { formatearGuardado } from "./api";
import styles from "./BarraAcciones.module.css";

export interface BarraAccionesProps {
    /** ISO 8601 del último guardado, o null si nunca se ha guardado */
    guardadoEn: string | null;
    /** Cuántas veces se guardó en esta visita: cada guardado se anuncia, aunque diga la misma hora */
    guardados: number;
    guardando: boolean;
    enviando: boolean;
    /** El último guardado falló */
    errorGuardado: boolean;
    alGuardar: () => void;
    alEnviar: () => void;
}

/**
 * Barra fija abajo: Guardar para continuar después, Enviar preinscripción, el estado del borrador
 * (role="status") y la nota de que la simulación no conserva nada al recargar. Los dos botones siguen
 * enfocables mientras trabajan (`conservarFoco`): con el teclado no se pierde el sitio.
 *
 * Publica su alto en `--alto-barra-acciones` para el `scroll-padding-bottom` de la página: así el
 * foco nunca queda debajo de la barra (WCAG 2.4.11).
 */
export default function BarraAcciones({
    guardadoEn,
    guardados,
    guardando,
    enviando,
    errorGuardado,
    alGuardar,
    alEnviar,
}: BarraAccionesProps) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const barra = ref.current;
        if (!barra) return;
        const raiz = document.documentElement;
        const medir = () => raiz.style.setProperty("--alto-barra-acciones", `${barra.offsetHeight}px`);
        medir();
        const observador = new ResizeObserver(medir);
        observador.observe(barra);
        return () => {
            observador.disconnect();
            raiz.style.removeProperty("--alto-barra-acciones");
        };
    }, []);

    return (
        <div ref={ref} className={styles.barra}>
            <div className={styles.tarjeta}>
                <div className={styles.textos}>
                    <p role="status" className={styles.estado}>
                        {/*
                         * Un nodo nuevo por guardado: el lector no repite un texto que no cambió, y dos
                         * guardados en el mismo minuto dicen lo mismo.
                         */}
                        {guardadoEn && !errorGuardado && (
                            <span key={guardados}>
                                Borrador guardado el{" "}
                                <span className={styles.fecha}>{formatearGuardado(guardadoEn)}</span>
                            </span>
                        )}
                    </p>
                    {errorGuardado && (
                        <p role="alert" className={styles.error}>
                            No fue posible guardar tu borrador.{" "}
                            <Button variante="sutil" className={styles.reintentar} onClick={alGuardar}>
                                Reintentar
                            </Button>
                        </p>
                    )}
                    <p className={styles.nota}>Simulación: el borrador no se conserva si recargas la página.</p>
                </div>
                <div className={styles.botones}>
                    <Button
                        variante="secundario"
                        cargando={guardando}
                        textoCargando="Guardando…"
                        conservarFoco
                        disabled={enviando}
                        onClick={alGuardar}
                    >
                        Guardar para continuar después
                    </Button>
                    <Button
                        cargando={enviando}
                        textoCargando="Enviando…"
                        conservarFoco
                        disabled={guardando}
                        onClick={alEnviar}
                    >
                        Enviar preinscripción
                    </Button>
                </div>
            </div>
        </div>
    );
}
