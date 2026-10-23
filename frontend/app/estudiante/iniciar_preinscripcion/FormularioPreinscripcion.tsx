"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Navbar from "@/app/components/navbar/Navbar";
import Button from "@/app/components/ui/Button";
import Dialog from "@/app/components/ui/Dialog";
import PageHeader from "@/app/components/ui/PageHeader";
import type { Nivel } from "@/app/estudiante/documentos-requeridos";
import { useSesion } from "@/app/lib/useSesion";
import { cargarPreinscripcion, enviarPreinscripcion, escenarioDesde, guardarBorrador } from "./api";
import BarraAcciones from "./BarraAcciones";
import { MODALIDADES, TIPOS_DOCUMENTO, type Opcion } from "./constantes";
import IndiceProgreso from "./IndiceProgreso";
import ResumenErrores, { type ContenidoResumen } from "./ResumenErrores";
import Academico from "./secciones/Academico";
import type { Cambio } from "./secciones/comun";
import Contacto from "./secciones/Contacto";
import Documentos from "./secciones/Documentos";
import EstudiosExperiencia from "./secciones/EstudiosExperiencia";
import Identificacion from "./secciones/Identificacion";
import SaberProVinculacion from "./secciones/SaberProVinculacion";
import type { BorradorPreinscripcion, ProgramaSolicitud } from "./tipos";
import { useCambiosSinGuardar } from "./useCambiosSinGuardar";
import { progreso as calcularProgreso, faltantes, seccionesDelNivel, type Progreso } from "./validacion";
import styles from "./iniciar_preinscripcion.module.css";

const NOMBRE_NIVEL: Record<Nivel, string> = { PREGRADO: "Pregrado", POSGRADO: "Posgrado" };

const SIN_ERRORES: Record<string, string> = {};

function nivelDesde(valor: string | undefined): Nivel | null {
    return valor === "PREGRADO" || valor === "POSGRADO" ? valor : null;
}

/** Lo que se va a enviar, en pocas líneas, para el diálogo de confirmación. */
function datosDelEnvio(borrador: BorradorPreinscripcion, avance: Progreso): [string, string][] {
    const etiqueta = (lista: readonly Opcion[], valor: string) =>
        lista.find((opcion) => opcion.valor === valor)?.etiqueta ?? valor;
    const programa = (solicitud: ProgramaSolicitud) =>
        `${solicitud.programa.trim()} · ${etiqueta(MODALIDADES, solicitud.modalidad)}`;
    const { perfil, programas } = borrador;

    const datos: [string, string][] = [
        ["Nombre", `${borrador.nombres.trim()} ${borrador.apellidos.trim()}`],
        ["Documento", `${etiqueta(TIPOS_DOCUMENTO, perfil.tipoDocumento)} ${perfil.numeroDocumento}`],
        ["Código estudiantil", borrador.codigoEstudiantil.trim()],
        ["Programa", programa(programas[0])],
    ];
    if (borrador.segundoPrograma === true) datos.push(["Segundo programa", programa(programas[1])]);
    const { cargados, requeridos } = avance.documentos;
    datos.push(["Documentos", `${cargados} de ${requeridos} documentos cargados`]);
    return datos;
}

/**
 * Formulario de preinscripción (cliente). Recibe `nivel` y `escenario` tal como vienen en la URL.
 *   - Nivel inválido, o distinto del nivel del usuario: a /estudiante/bienvenida.
 *   - Solicitud ya enviada: a /estudiante/preinscripcion.
 * Orquesta guardar, enviar (con su diálogo de confirmación) y la salida con cambios sin guardar.
 * El borrador vive solo en memoria: nada va a localStorage, sessionStorage, la URL ni la consola.
 */
export default function FormularioPreinscripcion({ nivel, escenario }: { nivel?: string; escenario?: string }) {
    const router = useRouter();
    const { usuario, cargando } = useSesion("estudiante");
    const nivelPedido = nivelDesde(nivel);

    const [borrador, setBorrador] = useState<BorradorPreinscripcion | null>(null);
    const [errorCarga, setErrorCarga] = useState(false);
    const [intento, setIntento] = useState(0);
    const formularioRef = useRef<HTMLFormElement>(null);

    // Guardar. `cambios` cuenta las ediciones: lo escrito mientras se guardaba sigue sin guardar.
    const [sucio, setSucio] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [errorGuardado, setErrorGuardado] = useState(false);
    const cambios = useRef(0);

    // Enviar. Tras el primer intento, cada campo marca su error mientras falte.
    const [validar, setValidar] = useState(false);
    const [resumen, setResumen] = useState<ContenidoResumen | null>(null);
    const [confirmando, setConfirmando] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [errorEnvio, setErrorEnvio] = useState(false);
    const enviandoRef = useRef(false);
    const claveRef = useRef<string | null>(null);

    const { salidaPendiente, confirmarSalida, cancelarSalida } = useCambiosSinGuardar(sucio);

    useEffect(() => {
        if (!usuario) return;
        if (!nivelPedido || (usuario.nivel && usuario.nivel !== nivelPedido)) {
            router.replace("/estudiante/bienvenida");
            return;
        }

        let vigente = true;
        cargarPreinscripcion(nivelPedido, usuario.username, escenarioDesde(escenario))
            .then((resultado) => {
                if (!vigente) return;
                if (resultado.estado === "enviada") {
                    router.replace("/estudiante/preinscripcion");
                    return;
                }
                setBorrador(resultado.borrador);
            })
            .catch(() => {
                if (vigente) setErrorCarga(true);
            });
        return () => {
            vigente = false;
        };
    }, [usuario, nivelPedido, escenario, router, intento]);

    const cambiar = useCallback((cambio: Cambio) => {
        cambios.current += 1;
        setSucio(true);
        setBorrador((actual) => (actual ? cambio(actual) : actual));
    }, []);

    const avance = useMemo(() => (borrador ? calcularProgreso(borrador) : null), [borrador]);
    const secciones = useMemo(() => (nivelPedido ? seccionesDelNivel(nivelPedido) : []), [nivelPedido]);
    const errores = useMemo(
        () =>
            validar && borrador
                ? Object.fromEntries(faltantes(borrador).map((faltante) => [faltante.id, faltante.mensaje]))
                : SIN_ERRORES,
        [validar, borrador],
    );

    /** Guarda el borrador tal como está, sin exigir nada. Devuelve si se pudo. */
    const guardar = async (): Promise<boolean> => {
        if (!borrador || guardando) return false;
        const cambiosAlGuardar = cambios.current;
        setGuardando(true);
        setErrorGuardado(false);
        try {
            const { guardadoEn } = await guardarBorrador(borrador);
            setBorrador((actual) => (actual ? { ...actual, guardadoEn } : actual));
            if (cambios.current === cambiosAlGuardar) setSucio(false);
            return true;
        } catch {
            setErrorGuardado(true);
            return false;
        } finally {
            setGuardando(false);
        }
    };

    const guardarYSalir = async () => {
        if (await guardar()) confirmarSalida();
    };

    /** Con faltantes, el resumen de errores (que toma el foco); sin ellos, el diálogo de confirmación. */
    const pedirEnvio = () => {
        if (!borrador) return;
        const pendientes = faltantes(borrador);
        setValidar(true);
        setResumen(pendientes.length > 0 ? { faltantes: pendientes } : null);
        if (pendientes.length > 0) return;
        setErrorEnvio(false);
        setConfirmando(true);
    };

    const cerrarConfirmacion = () => {
        if (enviandoRef.current) return;
        claveRef.current = null;
        setConfirmando(false);
    };

    const confirmarEnvio = async () => {
        // El ref corta un segundo clic antes de que el botón alcance a deshabilitarse.
        if (!borrador || enviandoRef.current) return;
        enviandoRef.current = true;
        setEnviando(true);
        setErrorEnvio(false);
        // Una clave por envío. Si falla la conexión, "Reintentar" repite la misma: el backend no la duplica.
        claveRef.current ??= crypto.randomUUID();
        try {
            const resultado = await enviarPreinscripcion(borrador, claveRef.current, escenarioDesde(escenario));
            claveRef.current = null;
            if (resultado.ok) {
                setSucio(false);
                router.replace("/estudiante/preinscripcion");
                return; // Sigue "Enviando…" hasta que la página se va.
            }
            setConfirmando(false);
            setResumen({ motivos: resultado.motivos });
        } catch {
            setErrorEnvio(true);
        }
        enviandoRef.current = false;
        setEnviando(false);
    };

    /**
     * Lo que aparece al responder "sí" entra animado con el puntero, pero no con el teclado
     * (las flechas o la barra espaciadora en un radio): se marca cómo se está respondiendo.
     */
    const marcarEntrada = (entrada: "puntero" | "teclado") => {
        if (formularioRef.current) formularioRef.current.dataset.entrada = entrada;
    };

    if (cargando || !usuario) {
        return (
            <main id="contenido" tabIndex={-1} className={styles.cargando} aria-busy="true">
                <span className={styles.spinner} aria-hidden="true" />
                <p>Verificando sesión...</p>
            </main>
        );
    }

    const titulo = nivelPedido
        ? `Preinscripción de grado · ${NOMBRE_NIVEL[nivelPedido]}`
        : "Preinscripción de grado";

    return (
        <>
            <Navbar tipoUsuario={usuario.role} nombreUsuario={usuario.name} nivel={nivelPedido ?? usuario.nivel} />
            <main id="contenido" tabIndex={-1} className={styles.pagina} aria-busy={!borrador && !errorCarga}>
                <PageHeader
                    ruta={[{ texto: "Inicio", href: "/estudiante/home" }, { texto: "Iniciar preinscripción" }]}
                    titulo={titulo}
                    descripcion="Completa tus datos y carga tus documentos en PDF. Puedes guardar un borrador y seguir después."
                />

                {/*
                 * Los diálogos van antes del formulario: al rechazarse el envío, el diálogo se cierra y
                 * devuelve el foco al botón, y después el resumen de errores (más abajo) lo toma.
                 */}
                <Dialog
                    abierto={confirmando}
                    alCerrar={cerrarConfirmacion}
                    titulo="Revisa tu información antes de enviar"
                    descripcion="Después de enviarla, tu preinscripción queda de solo consulta."
                    compacto
                >
                    <dl className={styles.datosEnvio}>
                        {borrador &&
                            avance &&
                            datosDelEnvio(borrador, avance).map(([dato, valor]) => (
                                <div key={dato}>
                                    <dt>{dato}</dt>
                                    <dd>{valor}</dd>
                                </div>
                            ))}
                    </dl>
                    <p className={styles.notaDialogo}>
                        CheckU prevalida tus documentos antes de la solicitud formal: enviarla no aprueba tu grado.
                    </p>
                    {errorEnvio && (
                        <p role="alert" className={styles.errorDialogo}>
                            No fue posible enviar tu preinscripción. Revisa tu conexión e inténtalo de nuevo.
                        </p>
                    )}
                    <div className={styles.accionesDialogo}>
                        <Button variante="secundario" disabled={enviando} onClick={cerrarConfirmacion}>
                            Volver a editar
                        </Button>
                        <Button cargando={enviando} textoCargando="Enviando…" conservarFoco onClick={confirmarEnvio}>
                            {errorEnvio ? "Reintentar" : "Enviar"}
                        </Button>
                    </div>
                </Dialog>

                <Dialog
                    abierto={salidaPendiente !== null}
                    alCerrar={() => {
                        // Mientras guarda no se cierra: al terminar, "Guardar y salir" sigue el enlace.
                        if (!guardando) cancelarSalida();
                    }}
                    titulo="Tienes cambios sin guardar"
                    descripcion="Si sales ahora, pierdes lo que cambiaste desde la última vez que guardaste."
                    compacto
                >
                    {errorGuardado && (
                        <p role="alert" className={styles.errorDialogo}>
                            No fue posible guardar tu borrador. Inténtalo de nuevo.
                        </p>
                    )}
                    <div className={styles.accionesDialogo}>
                        <Button cargando={guardando} textoCargando="Guardando…" conservarFoco onClick={guardarYSalir}>
                            Guardar y salir
                        </Button>
                        <Button variante="secundario" disabled={guardando} onClick={confirmarSalida}>
                            Salir sin guardar
                        </Button>
                        <Button variante="secundario" disabled={guardando} onClick={cancelarSalida}>
                            Seguir aquí
                        </Button>
                    </div>
                </Dialog>

                {errorCarga && (
                    <div className={styles.errorCarga}>
                        <p role="alert">No fue posible cargar tu preinscripción.</p>
                        <Button
                            variante="secundario"
                            onClick={() => {
                                setErrorCarga(false);
                                setIntento((valor) => valor + 1);
                            }}
                        >
                            Reintentar
                        </Button>
                    </div>
                )}

                {!errorCarga && (!borrador || !avance) && (
                    <div className={styles.cargandoBorrador}>
                        <span className={styles.spinner} aria-hidden="true" />
                        <p>Cargando tu preinscripción...</p>
                    </div>
                )}

                {borrador && avance && (
                    <div className={styles.rejilla}>
                        <IndiceProgreso progreso={avance} secciones={secciones} />
                        <form
                            ref={formularioRef}
                            aria-label="Preinscripción de grado"
                            className={styles.formulario}
                            noValidate
                            onSubmit={(evento) => evento.preventDefault()}
                            onPointerDownCapture={() => marcarEntrada("puntero")}
                            onKeyDownCapture={() => marcarEntrada("teclado")}
                        >
                            {resumen && <ResumenErrores contenido={resumen} />}
                            <Identificacion borrador={borrador} cambiar={cambiar} errores={errores} />
                            <Contacto borrador={borrador} cambiar={cambiar} errores={errores} />
                            <Academico borrador={borrador} cambiar={cambiar} errores={errores} />
                            {borrador.nivel === "PREGRADO" ? (
                                <SaberProVinculacion borrador={borrador} cambiar={cambiar} errores={errores} />
                            ) : (
                                <EstudiosExperiencia borrador={borrador} cambiar={cambiar} errores={errores} />
                            )}
                            <Documentos borrador={borrador} cambiar={cambiar} errores={errores} progreso={avance} />
                            <BarraAcciones
                                guardadoEn={borrador.guardadoEn}
                                guardando={guardando}
                                enviando={enviando}
                                errorGuardado={errorGuardado}
                                alGuardar={() => void guardar()}
                                alEnviar={pedirEnvio}
                            />
                        </form>
                    </div>
                )}
            </main>
        </>
    );
}
