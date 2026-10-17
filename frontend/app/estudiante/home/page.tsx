"use client";

import { useEffect, useId, useState } from "react";
import Navbar from "@/app/components/navbar/Navbar";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import Icono from "@/app/components/ui/Icono";
import PageHeader from "@/app/components/ui/PageHeader";
import StatusBadge from "@/app/components/ui/StatusBadge";
import { useSesion } from "@/app/lib/useSesion";
import styles from "./home.module.css";
import {
    type DocumentoSolicitud,
    type EstadoDocumentoCompleto,
    type NivelAcademico,
    type Notificacion,
    type PoliticaReenvios,
    type Solicitud,
    DOCUMENTOS_POR_NIVEL,
    formatearFecha,
    obtenerNivelSimulado,
    obtenerNotificaciones,
    obtenerPoliticaReenvios,
    obtenerSolicitudActiva,
} from "./api";

/** El estudiante ve "Corrección requerida" donde el sistema dice "No válido". */
const ETIQUETA_PARA_ESTUDIANTE: Partial<Record<EstadoDocumentoCompleto, string>> = {
    no_valido: "Corrección requerida",
};

const DETALLE_ESTADO: Partial<Record<EstadoDocumentoCompleto, string>> = {
    valido: "Cumple los requisitos revisados.",
    por_revisar: "En revisión; no necesitas hacer nada.",
    falta_cargar: "Aún no has cargado este documento.",
    inconsistente: "Inconsistencia detectada entre documentos.",
    procesando: "Procesando y validando documento...",
};

const NOTIFICACIONES_VISIBLES = 3;

function documentosCargados(solicitud: Solicitud): number {
    return solicitud.documentos.filter((d) => d.estado !== "falta_cargar").length;
}

export default function Home() {
    const { usuario, cargando } = useSesion("estudiante");
    const idListaNotificaciones = useId();

    const [nivel, setNivel] = useState<NivelAcademico | null>(null);
    const [solicitud, setSolicitud] = useState<Solicitud | null | undefined>(undefined);
    const [errorSolicitud, setErrorSolicitud] = useState(false);
    const [notificaciones, setNotificaciones] = useState<Notificacion[] | null>(null);
    const [errorNotificaciones, setErrorNotificaciones] = useState(false);
    const [politica, setPolitica] = useState<PoliticaReenvios | null>(null);
    const [verTodas, setVerTodas] = useState(false);

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

    const datosListos = solicitud !== undefined && notificaciones !== null;

    if (cargando || !usuario) {
        return (
            <main id="contenido" tabIndex={-1} className={styles.cargando} aria-busy="true">
                <span className={styles.spinner} aria-hidden="true" />
                <p>Verificando sesión...</p>
            </main>
        );
    }

    const nivelEfectivo: NivelAcademico = nivel ?? usuario.nivel ?? "PREGRADO";
    const nombreNivel = nivelEfectivo === "PREGRADO" ? "pregrado" : "posgrado";
    const listaDocs = DOCUMENTOS_POR_NIVEL[nivelEfectivo] || [];
    const haySolicitud = solicitud !== null && solicitud !== undefined;

    const tarjetaDocumentos = (
        <Card titulo={`Documentos de ${nombreNivel} · ${listaDocs.length}`}>
            <ul className={styles.listaRequisitos}>
                {listaDocs.map((nombre) => (
                    <li key={nombre}>{nombre}</li>
                ))}
            </ul>
        </Card>
    );

    const tarjetaAviso = (
        <Card titulo="Antes de enviar" className={styles.aviso}>
            <p className={styles.avisoTexto}>
                CheckU prevalida tus documentos; no reemplaza la decisión oficial de la Universidad.
            </p>
            {politica ? (
                <p className={styles.reenvios}>
                    <strong>Reenvíos de corrección hoy:</strong> {politica.limite - politica.usados} de{" "}
                    {politica.limite} disponibles
                </p>
            ) : (
                <p className={styles.textoSecundario}>Cargando política de reenvíos...</p>
            )}
        </Card>
    );

    const listaNotificaciones =
        notificaciones && (verTodas ? notificaciones : notificaciones.slice(0, NOTIFICACIONES_VISIBLES));

    const tarjetaNotificaciones = (
        <Card titulo="Notificaciones" id="notificaciones">
            {notificaciones === null && !errorNotificaciones && (
                <p className={styles.textoSecundario}>Cargando notificaciones...</p>
            )}
            {errorNotificaciones && <p className={styles.textoError}>No fue posible cargar las notificaciones.</p>}
            {notificaciones !== null && notificaciones.length === 0 && !errorNotificaciones && (
                <p className={styles.textoSecundario}>No tienes notificaciones.</p>
            )}
            {listaNotificaciones && listaNotificaciones.length > 0 && (
                <ul id={idListaNotificaciones} className={styles.notificaciones}>
                    {listaNotificaciones.map((n) => (
                        <li key={n.id} className={styles.notificacion}>
                            <div className={styles.notificacionCabecera}>
                                <span className={styles.notificacionTitulo}>{n.titulo}</span>
                                <time dateTime={n.fecha} className={styles.notificacionFecha}>
                                    {formatearFecha(n.fecha)}
                                </time>
                            </div>
                            <p className={styles.notificacionTexto}>{n.descripcion}</p>
                        </li>
                    ))}
                </ul>
            )}
            {notificaciones && notificaciones.length > NOTIFICACIONES_VISIBLES && (
                <Button
                    variante="sutil"
                    aria-expanded={verTodas}
                    aria-controls={idListaNotificaciones}
                    onClick={() => setVerTodas((valor) => !valor)}
                >
                    {verTodas ? "Ver menos notificaciones" : "Ver todas las notificaciones"}
                </Button>
            )}
        </Card>
    );

    const filaDocumento = (doc: DocumentoSolicitud) => (
        <li key={doc.tipo} className={styles.documento}>
            <div className={styles.documentoInfo}>
                <div className={styles.documentoNombre}>
                    <span>{doc.nombre}</span>
                    <StatusBadge estado={doc.estado} etiqueta={ETIQUETA_PARA_ESTUDIANTE[doc.estado]} />
                </div>
                {doc.estado === "no_valido" && doc.motivoRechazo ? (
                    <p className={styles.motivo}>{doc.motivoRechazo}</p>
                ) : (
                    DETALLE_ESTADO[doc.estado] && <p className={styles.documentoDetalle}>{DETALLE_ESTADO[doc.estado]}</p>
                )}
            </div>
            {(doc.estado === "falta_cargar" || doc.correccionAutorizada) && (
                <Button
                    href="/estudiante/preinscripcion"
                    variante="secundario"
                    className={styles.documentoAccion}
                    aria-label={`${doc.estado === "falta_cargar" ? "Subir documento" : "Subir nueva versión"}: ${doc.nombre}`}
                >
                    {doc.estado === "falta_cargar" ? "Subir documento" : "Subir nueva versión"}
                </Button>
            )}
        </li>
    );

    const tarjetaSolicitud = () => {
        if (solicitud === undefined) {
            return (
                <Card titulo="Mi solicitud de grado" id="mi-solicitud">
                    <p className={styles.textoSecundario}>Cargando solicitud...</p>
                </Card>
            );
        }
        if (errorSolicitud || !solicitud) {
            return (
                <Card titulo="Mi solicitud de grado" id="mi-solicitud">
                    <p className={styles.textoError}>No fue posible cargar la solicitud. Intenta recargar la página.</p>
                </Card>
            );
        }

        const cargados = documentosCargados(solicitud);
        const total = solicitud.documentos.length;

        return (
            <Card titulo="Mi solicitud de grado" id="mi-solicitud">
                <p className={styles.progresoTexto}>
                    {cargados} de {total} documentos cargados
                </p>
                <div
                    className={styles.progreso}
                    role="progressbar"
                    aria-label="Progreso de documentos cargados"
                    aria-valuemin={0}
                    aria-valuemax={total}
                    aria-valuenow={cargados}
                    aria-valuetext={`${cargados} de ${total} documentos cargados`}
                >
                    <div className={styles.progresoRelleno} style={{ transform: `scaleX(${total ? cargados / total : 0})` }} />
                </div>
                <ul className={styles.documentos}>{solicitud.documentos.map(filaDocumento)}</ul>
            </Card>
        );
    };

    return (
        <>
            <Navbar tipoUsuario={usuario.role} nombreUsuario={usuario.name} nivel={nivelEfectivo} />
            <main id="contenido" tabIndex={-1} className={styles.pagina} aria-busy={!datosListos}>
                <PageHeader
                    etiqueta="PORTAL DE GRADOS"
                    titulo={`¡Hola, ${usuario.name}!`}
                    descripcion="Bienvenido a CheckU. Consulta información sobre tu proceso de solicitud de grado."
                />

                <section className={styles.bienvenida} aria-labelledby="titulo-bienvenida">
                    <div className={styles.bienvenidaPrincipal}>
                        <span className={styles.bienvenidaIcono}>
                            <Icono nombre="escudo" tamano={26} />
                        </span>
                        <div>
                            <h2 id="titulo-bienvenida" className={styles.bienvenidaTitulo}>
                                {haySolicitud ? "Tu solicitud de grado está en curso" : "Tu proceso de grado, más sencillo"}
                            </h2>
                            <p className={styles.bienvenidaTexto}>
                                {haySolicitud
                                    ? "Sube los documentos que faltan y revisa si cumplen los requisitos antes de la inscripción formal."
                                    : "CheckU prevalida los documentos de tu solicitud de grado, identifica inconsistencias y facilita su corrección antes de la inscripción formal. Tu nivel académico lo toma CheckU de tu registro institucional."}
                            </p>
                        </div>
                    </div>
                    <Button href="/estudiante/preinscripcion" className={styles.bienvenidaAccion}>
                        {haySolicitud ? "Continuar mi preinscripción" : `Iniciar preinscripción de ${nombreNivel}`}
                    </Button>
                </section>

                {haySolicitud ? (
                    <div className={styles.rejillaConSolicitud}>
                        <div className={styles.columna}>
                            {tarjetaDocumentos}
                            {tarjetaSolicitud()}
                        </div>
                        <div className={styles.columna}>
                            {tarjetaAviso}
                            {tarjetaNotificaciones}
                        </div>
                    </div>
                ) : (
                    <div className={styles.rejillaSinSolicitud}>
                        {tarjetaDocumentos}
                        {tarjetaAviso}
                        {tarjetaNotificaciones}
                    </div>
                )}
            </main>
        </>
    );
}
