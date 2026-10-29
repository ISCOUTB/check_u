"use client";

import { useEffect, useId, useRef, useState } from "react";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import {
    formatearFecha,
    marcarNotificacionLeida,
    obtenerNotificaciones,
    type Notificacion,
} from "./api";
import styles from "./home.module.css";

const ORIGEN = {
    system: "Sistema",
    motor: "Análisis documental",
    funcionario: "Oficina de grados",
};
const TIPO = {
    success: "Éxito",
    warning: "Advertencia",
    error: "Error",
    info: "Información",
};

/** Un fallo de esta consulta no bloquea el resto del home. */
export default function NotificacionesPanel() {
    const idLista = useId();
    const [notificaciones, setNotificaciones] = useState<Notificacion[] | null>(
        null,
    );
    const [error, setError] = useState<string | null>(null);
    const [errorLectura, setErrorLectura] = useState<string | null>(null);
    const [intento, setIntento] = useState(0);
    const [verTodas, setVerTodas] = useState(false);
    const [leyendo, setLeyendo] = useState<string | null>(null);
    const bloqueo = useRef(false);
    useEffect(() => {
        const controlador = new AbortController();
        let vigente = true;
        obtenerNotificaciones(controlador.signal)
            .then((n) => {
                if (vigente) setNotificaciones(n);
            })
            .catch((e) => {
                if (vigente)
                    setError(
                        e instanceof Error && e.name !== "AbortError"
                            ? e.message
                            : "La consulta tardó demasiado. Intenta nuevamente.",
                    );
            });
        return () => {
            vigente = false;
            controlador.abort();
        };
    }, [intento]);
    async function marcar(n: Notificacion) {
        if (bloqueo.current) return;
        bloqueo.current = true;
        setLeyendo(n.id);
        setErrorLectura(null);
        try {
            await marcarNotificacionLeida(n.id);
            setNotificaciones(
                (anteriores) =>
                    anteriores?.map((a) =>
                        a.id === n.id ? { ...a, leida: true } : a,
                    ) ?? null,
            );
        } catch {
            setErrorLectura(
                "No fue posible marcar la notificación como leída. Puedes reintentar.",
            );
        } finally {
            bloqueo.current = false;
            setLeyendo(null);
        }
    }
    const visibles =
        notificaciones &&
        (verTodas ? notificaciones : notificaciones.slice(0, 3));
    const noLeidas = notificaciones?.filter((n) => !n.leida).length ?? 0;
    return (
        <Card titulo="Notificaciones" id="notificaciones">
            {notificaciones && (
                <p aria-live="polite" className={styles.textoSecundario}>
                    {noLeidas} sin leer
                </p>
            )}
            {!notificaciones && !error && (
                <p role="status" className={styles.textoSecundario}>
                    Cargando notificaciones...
                </p>
            )}
            {error && (
                <div>
                    <p role="alert" className={styles.textoError}>
                        {error}
                    </p>
                    <Button
                        variante="secundario"
                        onClick={() => {
                            setError(null);
                            setIntento((v) => v + 1);
                        }}
                    >
                        Reintentar notificaciones
                    </Button>
                </div>
            )}
            {errorLectura && (
                <p role="alert" className={styles.textoError}>
                    {errorLectura}
                </p>
            )}
            {notificaciones?.length === 0 && (
                <p className={styles.textoSecundario}>
                    No tienes notificaciones.
                </p>
            )}
            {!!visibles?.length && (
                <ul id={idLista} className={styles.notificaciones}>
                    {visibles.map((n) => (
                        <li
                            key={n.id}
                            className={styles.notificacion}
                            data-tipo={n.tipo}
                            data-leida={n.leida}
                        >
                            <div className={styles.notificacionCabecera}>
                                <h3 className={styles.notificacionTitulo}>
                                    {n.titulo}
                                </h3>
                                <span className={styles.notificacionTipo}>
                                    {TIPO[n.tipo]}
                                </span>
                            </div>
                            <p className={styles.notificacionTexto}>
                                {n.descripcion}
                            </p>
                            <div className={styles.notificacionMeta}>
                                <span>{ORIGEN[n.generadoPor]}</span>
                                <time
                                    dateTime={n.fecha}
                                    title={new Intl.DateTimeFormat("es-CO", {
                                        dateStyle: "long",
                                        timeStyle: "short",
                                        timeZone: "America/Bogota",
                                    }).format(new Date(n.fecha))}
                                >
                                    {formatearFecha(n.fecha)}
                                </time>
                                {n.leida ? (
                                    <span>Leída</span>
                                ) : (
                                    <Button
                                        variante="sutil"
                                        disabled={leyendo !== null}
                                        aria-label={`Marcar como leída: ${n.titulo}`}
                                        onClick={() => {
                                            void marcar(n);
                                        }}
                                    >
                                        Marcar como leída
                                    </Button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            {notificaciones && notificaciones.length > 3 && (
                <Button
                    variante="sutil"
                    aria-expanded={verTodas}
                    aria-controls={idLista}
                    onClick={() => setVerTodas((v) => !v)}
                >
                    {verTodas
                        ? "Ver menos notificaciones"
                        : "Ver todas las notificaciones"}
                </Button>
            )}
        </Card>
    );
}
