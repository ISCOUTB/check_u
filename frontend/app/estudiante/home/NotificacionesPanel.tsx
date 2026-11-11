"use client";

import { useEffect, useRef, useState } from "react";
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

const FORMATO_FECHA = new Intl.DateTimeFormat("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Bogota",
});

/** Ancla única de cada aviso en el historial completo. */
const anclaNotificacion = (id: string) => `notificacion-${id}`;
const PREFIJO_ANCLA = "notificacion-";

/** Un fallo de esta consulta no bloquea el resto del home. */
export default function NotificacionesPanel({
    completas = false,
}: { completas?: boolean }) {
    const [notificaciones, setNotificaciones] = useState<Notificacion[] | null>(
        null,
    );
    const [error, setError] = useState<string | null>(null);
    const [errorLectura, setErrorLectura] = useState<string | null>(null);
    const [intento, setIntento] = useState(0);
    const [leyendo, setLeyendo] = useState<string | null>(null);
    const bloqueo = useRef(false);
    useEffect(() => {
        const controlador = new AbortController();
        let vigente = true;
        obtenerNotificaciones(controlador.signal, completas)
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
    }, [intento, completas]);
    const cargadas = !!notificaciones?.length;
    // El historial carga después del primer render; cuando llegan los datos, lleva el foco
    // y la vista al aviso indicado por el hash (#notificacion-<id>). Solo se repite si
    // cambia el hash, no cada vez que se marca un aviso como leído.
    useEffect(() => {
        if (!completas || !cargadas) return;
        const irAlAncla = () => {
            const id = window.location.hash.slice(1);
            if (!id.startsWith(PREFIJO_ANCLA)) return;
            const destino = document.getElementById(id);
            if (!destino) return;
            destino.scrollIntoView({ block: "start" });
            destino.focus({ preventScroll: true });
        };
        irAlAncla();
        window.addEventListener("hashchange", irAlAncla);
        return () => window.removeEventListener("hashchange", irAlAncla);
    }, [completas, cargadas]);
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
    const visibles = completas ? notificaciones : notificaciones?.slice(0, 3);
    const noLeidas = notificaciones?.filter((n) => !n.leida).length ?? 0;
    return (
        <Card
            titulo={completas ? "Historial de notificaciones" : "Notificaciones"}
            id="notificaciones"
            acciones={!completas && (
                <Button variante="sutil" href="/estudiante/notificaciones">
                    Ver todas las notificaciones
                </Button>
            )}
        >
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
                <ul className={styles.notificaciones}>
                    {visibles.map((n) => (
                        <li
                            key={n.id}
                            id={anclaNotificacion(n.id)}
                            tabIndex={completas ? -1 : undefined}
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
                                    title={completas ? undefined : FORMATO_FECHA.format(new Date(n.fecha))}
                                >
                                    {completas ? FORMATO_FECHA.format(new Date(n.fecha)) : formatearFecha(n.fecha)}
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
                                {!completas && (
                                    <Button
                                        variante="sutil"
                                        href={`/estudiante/notificaciones#${anclaNotificacion(n.id)}`}
                                        aria-label={`Ver notificación completa: ${n.titulo}`}
                                    >
                                        Ver notificación completa
                                    </Button>
                                )}
                                {completas && n.solicitudId && (
                                    <Button variante="sutil" href={`/estudiante/preinscripcion?solicitud=${n.solicitudId}${n.documentoId ? `&documento=${n.documentoId}` : ""}`}>
                                        {n.documentoId ? "Ver documento" : "Ver solicitud"}
                                    </Button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}
