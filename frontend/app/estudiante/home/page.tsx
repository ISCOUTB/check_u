"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import Navbar from "@/app/components/navbar/Navbar";
import styles from "./home.module.css";

import {
    type NivelAcademico,
    type Solicitud,
    type Notificacion,
    type PoliticaReenvios,
    type EstadoDocumentoCompleto,
    DOCUMENTOS_POR_NIVEL,
    obtenerNivelSimulado,
    obtenerSolicitudActiva,
    obtenerNotificaciones,
    obtenerPoliticaReenvios,
    formatearFecha,
} from "./api";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de usuario (nivel es opcional: el backend aún no lo devuelve en /auth/me)
// ─────────────────────────────────────────────────────────────────────────────

interface Usuario {
    id: number;
    username: string;
    name: string;
    role: "estudiante" | "funcionario";
    nivel?: NivelAcademico;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de presentación
// ─────────────────────────────────────────────────────────────────────────────

function etiquetaEstado(estado: EstadoDocumentoCompleto): string {
    const etiquetas: Record<EstadoDocumentoCompleto, string> = {
        valido: "Válido",
        no_valido: "Corrección requerida",
        inconsistente: "Inconsistente",
        por_revisar: "Por revisar",
        procesando: "Procesando",
        falta_cargar: "Falta cargar",
    };
    return etiquetas[estado] ?? estado;
}

function claseChipEstado(estado: EstadoDocumentoCompleto): string {
    const mapa: Record<EstadoDocumentoCompleto, string> = {
        valido: styles.chipValido,
        no_valido: styles.chipNoValido,
        inconsistente: styles.chipInconsistente,
        por_revisar: styles.chipPorRevisar,
        procesando: styles.chipProcesando,
        falta_cargar: styles.chipFaltaCargar,
    };
    return mapa[estado] ?? styles.chipFaltaCargar;
}

function documentosCargados(sol: Solicitud): number {
    return sol.documentos.filter((d) => d.estado !== "falta_cargar").length;
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export default function Home() {
    const router = useRouter();

    // ── Sesión (REAL: /auth/me) ──────────────────────────────────────────────
    const [usuario, setUsuario] = useState<Usuario | null>(null);
    const [cargandoSesion, setCargandoSesion] = useState(true);

    // ── Nivel académico (SIMULADO: api.ts) ──────────────────────────────────
    const [nivel, setNivel] = useState<NivelAcademico | null>(null);

    // ── Solicitud activa (SIMULADO: api.ts) ──────────────────────────────────
    const [solicitud, setSolicitud] = useState<Solicitud | null | undefined>(undefined);
    const [errorSolicitud, setErrorSolicitud] = useState(false);

    // ── Notificaciones (SIMULADO: api.ts) ────────────────────────────────────
    const [notificaciones, setNotificaciones] = useState<Notificacion[] | null>(null);
    const [errorNotificaciones, setErrorNotificaciones] = useState(false);

    // ── Política de reenvíos (SIMULADO: api.ts) ──────────────────────────────
    const [politica, setPolitica] = useState<PoliticaReenvios | null>(null);

    // ── Verificación de sesión real con /auth/me ─────────────────────────────
    useEffect(() => {
        async function verificarSesion() {
            try {
                const response = await fetch(`${API_URL}/auth/me`, {
                    method: "GET",
                    credentials: "include",
                    cache: "no-store",
                });

                if (!response.ok) {
                    router.replace("/");
                    return;
                }

                const data = await response.json();
                const usuarioActual: Usuario = data.user;

                if (usuarioActual.role !== "estudiante") {
                    router.replace("/funcionario/dashboard");
                    return;
                }

                setUsuario(usuarioActual);
            } catch {
                router.replace("/");
            } finally {
                setCargandoSesion(false);
            }
        }

        verificarSesion();
    }, [router]);

    // ── Carga de datos de la interfaz (simulados) ────────────────────────────
    useEffect(() => {
        if (!usuario) return;

        obtenerNivelSimulado().then(setNivel);

        obtenerSolicitudActiva()
            .then(setSolicitud)
            .catch(() => {
                setSolicitud(null);
                setErrorSolicitud(true);
            });

        obtenerNotificaciones()
            .then(setNotificaciones)
            .catch(() => {
                setNotificaciones([]);
                setErrorNotificaciones(true);
            });

        obtenerPoliticaReenvios()
            .then(setPolitica)
            .catch(() => setPolitica(null));
    }, [usuario]);

    if (cargandoSesion || !usuario) {
        return (
            <div className={styles.cargandoSesion} aria-live="polite">
                <span className={styles.spinner} aria-hidden="true" />
                <p>Verificando sesión...</p>
            </div>
        );
    }

    const nivelEfectivo: NivelAcademico = nivel ?? usuario.nivel ?? "PREGRADO";
    const nombreNivel = nivelEfectivo === "PREGRADO" ? "pregrado" : "posgrado";
    const listaDocs = DOCUMENTOS_POR_NIVEL[nivelEfectivo] || [];
    const haySolicitud = solicitud !== null && solicitud !== undefined;
    const cargandoSolicitud = solicitud === undefined;

    // ─────────────────────────────────────────────────────────────────────────
    // Subcomponentes de tarjetas reutilizables
    // ─────────────────────────────────────────────────────────────────────────

    const renderCardDocumentos = () => (
        <section className={styles.card} aria-labelledby="hdr-docs">
            <h2 id="hdr-docs" className={styles.cardTitle}>
                Documentos de {nombreNivel} · {listaDocs.length}
            </h2>
            <ul className={styles.docList}>
                {listaDocs.map((nombre) => (
                    <li key={nombre}>{nombre}</li>
                ))}
            </ul>
        </section>
    );

    const renderCardAviso = () => (
        <section className={`${styles.card} ${styles.cardAviso}`} aria-labelledby="hdr-aviso">
            <h2 id="hdr-aviso" className={styles.cardTitle}>
                Antes de enviar
            </h2>
            <p className={styles.avisoTexto}>
                CheckU prevalida tus documentos; no reemplaza la decisión oficial de la Universidad.
            </p>
            {politica ? (
                <p className={styles.reenviosTexto}>
                    <span className={styles.reenviosLabel}>Reenvíos de corrección hoy:</span>{" "}
                    {politica.limite - politica.usados} de {politica.limite} disponibles
                </p>
            ) : (
                <p className={styles.textoSecundario}>Cargando política de reenvíos...</p>
            )}
        </section>
    );

    const renderCardNotificaciones = () => (
        <section className={styles.card} aria-labelledby="hdr-notif">
            <h2 id="hdr-notif" className={styles.cardTitle}>
                Notificaciones
            </h2>

            {notificaciones === null && !errorNotificaciones && (
                <p className={styles.textoSecundario}>Cargando notificaciones...</p>
            )}

            {errorNotificaciones && (
                <p className={styles.textoError}>No fue posible cargar las notificaciones.</p>
            )}

            {notificaciones !== null && notificaciones.length === 0 && (
                <p className={styles.textoVacio}>No tienes notificaciones.</p>
            )}

            {notificaciones !== null && notificaciones.length > 0 && (
                <>
                    <ul className={styles.notifList}>
                        {notificaciones.slice(0, 3).map((n) => (
                            <li key={n.id} className={styles.notifItem}>
                                <div className={styles.notifCabecera}>
                                    <span className={styles.notifTitulo}>{n.titulo}</span>
                                    <time dateTime={n.fecha} className={styles.notifFecha}>
                                        {formatearFecha(n.fecha)}
                                    </time>
                                </div>
                                <p className={styles.notifDesc}>{n.descripcion}</p>
                            </li>
                        ))}
                    </ul>

                    {/* TODO: Conectar con la vista o modal completo de notificaciones */}
                    <button
                        type="button"
                        className={styles.verTodas}
                        onClick={() => {
                            console.log("Navegar a notificaciones completas (TODO)");
                        }}
                    >
                        Ver todas las notificaciones
                    </button>
                </>
            )}
        </section>
    );

    const renderCardMiSolicitud = () => {
        if (cargandoSolicitud) {
            return (
                <section className={`${styles.card} ${styles.cardSkeleton}`} aria-busy="true">
                    <p className={styles.textoSecundario}>Cargando solicitud...</p>
                </section>
            );
        }

        if (errorSolicitud || !solicitud) {
            return (
                <section className={styles.card}>
                    <h2 className={styles.cardTitle}>Mi solicitud de grado</h2>
                    <p className={styles.textoError}>
                        No fue posible cargar la solicitud. Intenta recargar la página.
                    </p>
                </section>
            );
        }

        const cargados = documentosCargados(solicitud);
        const total = solicitud.documentos.length;
        const porcentaje = total > 0 ? (cargados / total) * 100 : 0;

        return (
            <section className={styles.card} aria-labelledby="hdr-sol">
                <h2 id="hdr-sol" className={styles.cardTitle}>
                    Mi solicitud de grado
                </h2>

                <p className={styles.progresoTexto}>
                    {cargados} de {total} documentos cargados
                </p>

                <div
                    className={styles.progressBar}
                    role="progressbar"
                    aria-valuenow={cargados}
                    aria-valuemin={0}
                    aria-valuemax={total}
                    aria-label="Progreso de documentos cargados"
                >
                    <div
                        className={styles.progressFill}
                        style={{ width: `${porcentaje}%` }}
                    />
                </div>

                <ul className={styles.solicitudDocList}>
                    {solicitud.documentos.map((doc) => (
                        <li key={doc.tipo} className={styles.docRow}>
                            <div className={styles.docInfo}>
                                <div className={styles.docNombreChip}>
                                    <span className={styles.docNombre}>{doc.nombre}</span>
                                    <span className={`${styles.chip} ${claseChipEstado(doc.estado)}`}>
                                        {etiquetaEstado(doc.estado)}
                                    </span>
                                </div>

                                {doc.estado === "no_valido" && doc.motivoRechazo && (
                                    <p className={styles.motivoRechazo}>{doc.motivoRechazo}</p>
                                )}

                                {doc.estado === "valido" && (
                                    <p className={styles.docSubtexto}>Cumple los requisitos revisados.</p>
                                )}

                                {doc.estado === "por_revisar" && (
                                    <p className={styles.docSubtexto}>En revisión; no necesitas hacer nada.</p>
                                )}

                                {doc.estado === "falta_cargar" && (
                                    <p className={styles.docSubtexto}>Aún no has cargado este documento.</p>
                                )}

                                {doc.estado === "inconsistente" && (
                                    <p className={styles.docSubtexto}>Inconsistencia detectada entre documentos.</p>
                                )}

                                {doc.estado === "procesando" && (
                                    <p className={styles.docSubtexto}>Procesando y validando documento...</p>
                                )}
                            </div>

                            {/* Acciones de subida decididas por el backend */}
                            <div className={styles.docAccion}>
                                {doc.estado === "falta_cargar" && (
                                    <Link
                                        href="/estudiante/preinscripcion"
                                        className={styles.btnAccionDocumento}
                                    >
                                        Subir documento
                                    </Link>
                                )}

                                {doc.correccionAutorizada && (
                                    <Link
                                        href="/estudiante/preinscripcion"
                                        className={styles.btnAccionDocumento}
                                    >
                                        Subir nueva versión
                                    </Link>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            </section>
        );
    };

    return (
        <>
            <Navbar
                tipoUsuario={usuario.role}
                nombreUsuario={usuario.name}
                nivel={nivelEfectivo}
            />

            <main className={styles.home}>
                {/* ============================================================ */}
                {/* ENCABEZADO                                                    */}
                {/* ============================================================ */}
                <header className={styles.header}>
                    <div>
                        <span className={styles.eyebrow}>PORTAL DE GRADOS</span>
                        <h1>¡Hola, {usuario.name}!</h1>
                        <p>
                            Bienvenido a CheckU. Consulta información sobre tu proceso de solicitud de grado.
                        </p>
                    </div>
                </header>

                {/* ============================================================ */}
                {/* TARJETA DE BIENVENIDA (ADAPTADA AL ESTADO)                   */}
                {/* ============================================================ */}
                <section
                    className={`${styles.welcomeCard} ${
                        haySolicitud ? styles.welcomeCardConSolicitud : styles.welcomeCardSinSolicitud
                    }`}
                >
                    <div className={styles.welcomeMain}>
                        <div className={styles.welcomeIcon} aria-hidden="true">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="26"
                                height="26"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" />
                                <path d="m9 12 2 2 4-4" />
                            </svg>
                        </div>

                        <div className={styles.welcomeTexto}>
                            {haySolicitud ? (
                                <>
                                    <h2>Tu solicitud de grado está en curso</h2>
                                    <p>
                                        Sube los documentos que faltan y revisa si cumplen los requisitos antes de la inscripción formal.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <h2>Tu proceso de grado, más sencillo</h2>
                                    <p>
                                        CheckU prevalida los documentos de tu solicitud de grado, identifica inconsistencias y facilita su corrección antes de la inscripción formal. Tu nivel académico lo toma CheckU de tu registro institucional.
                                    </p>
                                    <div className={styles.welcomeBotonContainer}>
                                        <Link
                                            href="/estudiante/preinscripcion"
                                            className={styles.btnPrincipal}
                                        >
                                            Iniciar preinscripción de {nombreNivel}
                                        </Link>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {haySolicitud && (
                        <div className={styles.welcomeAccionDerecha}>
                            <Link
                                href="/estudiante/preinscripcion"
                                className={styles.btnPrincipal}
                            >
                                Continuar mi preinscripción
                            </Link>
                        </div>
                    )}
                </section>

                {/* ============================================================ */}
                {/* CUADRÍCULA DE TARJETAS                                        */}
                {/* ============================================================ */}
                {haySolicitud ? (
                    <div className={styles.gridConSolicitud}>
                        <div className={styles.colLeft}>
                            {renderCardDocumentos()}
                            {renderCardMiSolicitud()}
                        </div>
                        <div className={styles.colRight}>
                            {renderCardAviso()}
                            {renderCardNotificaciones()}
                        </div>
                    </div>
                ) : (
                    <div className={styles.gridSinSolicitud}>
                        {renderCardDocumentos()}
                        {renderCardAviso()}
                        {renderCardNotificaciones()}
                    </div>
                )}
            </main>
        </>
    );
}