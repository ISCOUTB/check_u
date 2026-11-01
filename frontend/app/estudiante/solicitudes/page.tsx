"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import Navbar from "@/app/components/navbar/Navbar";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import PageHeader from "@/app/components/ui/PageHeader";
import StatusBadge from "@/app/components/ui/StatusBadge";
import { useSesion } from "@/app/lib/useSesion";

import { ErrorListadoSolicitudes, obtenerSolicitudes } from "./api";
import {
    formatearFechaSolicitud,
    formatearPeriodo,
    presentarEstado,
    type SolicitudListado,
} from "./listado";
import styles from "./solicitudes.module.css";

function esCancelacion(error: unknown): boolean {
    return (
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && error.name === "AbortError")
    );
}

function enlaceDetalle(id: string): string {
    return `/estudiante/preinscripcion?solicitud=${encodeURIComponent(id)}`;
}

export default function SolicitudesPage() {
    const { usuario, cargando: cargandoSesion } = useSesion("estudiante");
    const router = useRouter();

    const [solicitudes, setSolicitudes] = useState<SolicitudListado[] | null>(null);
    const [cargando, setCargando] = useState(true);
    const [actualizando, setActualizando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [intento, setIntento] = useState(0);
    const solicitudesRef = useRef<SolicitudListado[] | null>(null);

    useEffect(() => {
        solicitudesRef.current = solicitudes;
    }, [solicitudes]);

    // Al volver a la pestaña se refresca el estado real de cada solicitud.
    useEffect(() => {
        if (!usuario) return;
        const alVolver = () => {
            if (document.visibilityState === "visible") setIntento((valor) => valor + 1);
        };
        document.addEventListener("visibilitychange", alVolver);
        return () => document.removeEventListener("visibilitychange", alVolver);
    }, [usuario]);

    useEffect(() => {
        if (!usuario) return;
        const controlador = new AbortController();
        let vigente = true;
        const hayDatos = solicitudesRef.current !== null;

        if (hayDatos) setActualizando(true);
        else setCargando(true);

        void obtenerSolicitudes(controlador.signal)
            .then((datos) => {
                if (!vigente) return;
                setSolicitudes(datos);
                setError(null);
            })
            .catch((fallo: unknown) => {
                if (!vigente || esCancelacion(fallo)) return;
                if (fallo instanceof ErrorListadoSolicitudes && fallo.status === 401) {
                    router.replace("/");
                    return;
                }
                setError(
                    fallo instanceof Error
                        ? fallo.message
                        : "No fue posible consultar tus solicitudes.",
                );
            })
            .finally(() => {
                if (!vigente) return;
                setCargando(false);
                setActualizando(false);
            });

        return () => {
            vigente = false;
            controlador.abort();
        };
    }, [usuario, intento, router]);

    if (cargandoSesion || !usuario || (cargando && solicitudes === null)) {
        return (
            <>
                {usuario && (
                    <Navbar
                        tipoUsuario={usuario.role}
                        nombreUsuario={usuario.name}
                        nivel={usuario.nivel}
                    />
                )}
                <main
                    id="contenido"
                    tabIndex={-1}
                    className={styles.pagina}
                    aria-busy="true"
                >
                    <div className={styles.cargando} role="status">
                        <span className={styles.spinner} aria-hidden="true" />
                        <p>Cargando tus solicitudes…</p>
                    </div>
                </main>
            </>
        );
    }

    if (error && solicitudes === null) {
        return (
            <>
                <Navbar
                    tipoUsuario={usuario.role}
                    nombreUsuario={usuario.name}
                    nivel={usuario.nivel}
                />
                <main id="contenido" tabIndex={-1} className={styles.pagina}>
                    <PageHeader
                        etiqueta="PORTAL DE GRADOS"
                        titulo="Mis solicitudes de grado"
                        descripcion="Consulta el estado y el periodo de cada una de tus preinscripciones."
                    />
                    <Card titulo="Historial de preinscripciones">
                        <p role="alert" className={styles.textoError}>
                            {error}
                        </p>
                        <Button
                            variante="secundario"
                            onClick={() => {
                                setError(null);
                                setCargando(true);
                                setIntento((valor) => valor + 1);
                            }}
                        >
                            Reintentar
                        </Button>
                    </Card>
                </main>
            </>
        );
    }

    const lista = solicitudes ?? [];
    const total = lista.length;
    const historial = lista.filter((solicitud) => !solicitud.activa).length;

    function actualizar() {
        setIntento((valor) => valor + 1);
    }

    const badge = (solicitud: SolicitudListado) => {
        const estado = presentarEstado(solicitud.estado);
        return (
            <div className={styles.estadoCelda}>
                <StatusBadge estado={estado.tono} etiqueta={estado.etiqueta} />
                {!solicitud.activa && (
                    <span className={styles.etiquetaHistorial}>Historial</span>
                )}
            </div>
        );
    };

    return (
        <>
            <Navbar
                tipoUsuario={usuario.role}
                nombreUsuario={usuario.name}
                nivel={usuario.nivel}
            />

            <main id="contenido" tabIndex={-1} className={styles.pagina}>
                <PageHeader
                    etiqueta="PORTAL DE GRADOS"
                    titulo="Mis solicitudes de grado"
                    descripcion="Consulta todas tus preinscripciones, incluidas las que cancelaste o fueron anuladas. Desde cada registro puedes abrir su detalle documental."
                    ruta={[
                        { texto: "Inicio", href: "/estudiante/home" },
                        { texto: "Mis solicitudes" },
                    ]}
                />

                {error && (
                    <div className={styles.avisoError} role="alert">
                        <p>{error}</p>
                        <Button variante="secundario" onClick={actualizar}>
                            Reintentar
                        </Button>
                    </div>
                )}

                <Card
                    id="solicitudes"
                    tituloId="titulo-solicitudes"
                    titulo="Historial de preinscripciones"
                    acciones={
                        <div className={styles.accionesCabecera}>
                            <p aria-live="polite" className={styles.conteo}>
                                {total === 1 ? "1 solicitud" : `${total} solicitudes`}
                                {historial > 0 &&
                                    ` · ${historial} en historial`}
                            </p>
                            <Button
                                variante="secundario"
                                cargando={actualizando}
                                textoCargando="Actualizando…"
                                conservarFoco
                                onClick={actualizar}
                            >
                                Actualizar
                            </Button>
                        </div>
                    }
                >
                    <p className={styles.descripcion}>
                        Las solicitudes canceladas o anuladas se conservan como parte de
                        tu historial. El estado se actualiza al consultar esta página.
                    </p>

                    {total === 0 ? (
                        <div className={styles.vacio}>
                            <h3>No tienes solicitudes registradas</h3>
                            <p>
                                Cuando inicies una preinscripción de grado, aparecerá
                                aquí con su estado y su periodo asignado.
                            </p>
                            <Button href="/estudiante/bienvenida">
                                Iniciar una preinscripción
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div
                                className={styles.tablaContenedor}
                                role="region"
                                aria-label="Listado de solicitudes de grado"
                                tabIndex={0}
                            >
                                <table className={styles.tabla}>
                                    <caption className="solo-lector">
                                        Tus solicitudes de grado, de la más reciente a
                                        la más antigua.
                                    </caption>
                                    <thead>
                                        <tr>
                                            <th scope="col">No. solicitud</th>
                                            <th scope="col">Nivel</th>
                                            <th scope="col">Estado</th>
                                            <th scope="col">Fecha de solicitud</th>
                                            <th scope="col">Periodo de grado</th>
                                            <th scope="col">
                                                <span className="solo-lector">
                                                    Acción
                                                </span>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lista.map((solicitud) => (
                                            <tr
                                                key={solicitud.id}
                                                data-activa={solicitud.activa}
                                                className={
                                                    solicitud.activa
                                                        ? undefined
                                                        : styles.filaHistorial
                                                }
                                            >
                                                <td className={styles.id}>
                                                    {solicitud.id}
                                                </td>
                                                <td>{solicitud.nivel}</td>
                                                <td>{badge(solicitud)}</td>
                                                <td>
                                                    {formatearFechaSolicitud(
                                                        solicitud.fechaSolicitud,
                                                    )}
                                                </td>
                                                <td>
                                                    <div className={styles.periodo}>
                                                        <strong>
                                                            {solicitud.periodo?.nombre ??
                                                                "Sin periodo asignado"}
                                                        </strong>
                                                        <span>
                                                            {formatearPeriodo(
                                                                solicitud.periodo,
                                                            )}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className={styles.accion}>
                                                    <Button
                                                        href={enlaceDetalle(
                                                            solicitud.id,
                                                        )}
                                                        variante="secundario"
                                                        aria-label={`Ver detalle de la solicitud ${solicitud.id}`}
                                                    >
                                                        Ver detalle
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <ul
                                className={styles.tarjetas}
                                aria-label="Listado de solicitudes de grado"
                            >
                                {lista.map((solicitud) => (
                                    <li
                                        key={solicitud.id}
                                        data-activa={solicitud.activa}
                                        className={
                                            solicitud.activa
                                                ? styles.tarjeta
                                                : `${styles.tarjeta} ${styles.tarjetaHistorial}`
                                        }
                                    >
                                        <div className={styles.tarjetaCabecera}>
                                            <div>
                                                <span className={styles.etiquetaCampo}>
                                                    No. solicitud
                                                </span>
                                                <strong className={styles.id}>
                                                    {solicitud.id}
                                                </strong>
                                            </div>
                                            {badge(solicitud)}
                                        </div>

                                        <dl className={styles.detalle}>
                                            <div>
                                                <dt>Nivel</dt>
                                                <dd>{solicitud.nivel}</dd>
                                            </div>
                                            <div>
                                                <dt>Fecha de solicitud</dt>
                                                <dd>
                                                    {formatearFechaSolicitud(
                                                        solicitud.fechaSolicitud,
                                                    )}
                                                </dd>
                                            </div>
                                            <div className={styles.detalleAncho}>
                                                <dt>Periodo de grado</dt>
                                                <dd>
                                                    {solicitud.periodo?.nombre ??
                                                        "Sin periodo asignado"}
                                                    <span className={styles.fechas}>
                                                        {formatearPeriodo(
                                                            solicitud.periodo,
                                                        )}
                                                    </span>
                                                </dd>
                                            </div>
                                        </dl>

                                        <Button
                                            href={enlaceDetalle(solicitud.id)}
                                            variante="secundario"
                                            aria-label={`Ver detalle de la solicitud ${solicitud.id}`}
                                            className={styles.tarjetaAccion}
                                        >
                                            Ver detalle
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}

                    {actualizando && (
                        <p role="status" className="solo-lector">
                            Actualizando solicitudes…
                        </p>
                    )}
                </Card>
            </main>
        </>
    );
}
