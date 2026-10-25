"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Navbar from "@/app/components/navbar/Navbar";
import Button from "@/app/components/ui/Button";
import PageHeader from "@/app/components/ui/PageHeader";
import type { Nivel } from "@/app/estudiante/documentos-requeridos";
import { useSesion } from "@/app/lib/useSesion";
import { cargarPreinscripcion, enviarPreinscripcion, escenarioDesde, guardarBorrador } from "./api";
import BarraAcciones from "./BarraAcciones";
import DialogoConfirmarEnvio from "./DialogoConfirmarEnvio";
import DialogoSalida from "./DialogoSalida";
import IndiceProgreso from "./IndiceProgreso";
import ResumenErrores, { type ContenidoResumen } from "./ResumenErrores";
import Academico from "./secciones/Academico";
import type { Cambio } from "./secciones/comun";
import Contacto from "./secciones/Contacto";
import Documentos from "./secciones/Documentos";
import EstudiosExperiencia from "./secciones/EstudiosExperiencia";
import Identificacion from "./secciones/Identificacion";
import SaberProVinculacion from "./secciones/SaberProVinculacion";
import type { BorradorPreinscripcion } from "./tipos";
import { useCambiosSinGuardar } from "./useCambiosSinGuardar";
import { progreso as calcularProgreso, faltantes, seccionesDelNivel } from "./validacion";
import styles from "./iniciar_preinscripcion.module.css";

const NOMBRE_NIVEL: Record<Nivel, string> = { PREGRADO: "Pregrado", POSGRADO: "Posgrado" };

const SIN_ERRORES: Record<string, string> = {};

function nivelDesde(valor: string | undefined): Nivel | null {
    return valor === "PREGRADO" || valor === "POSGRADO" ? valor : null;
}

/**
 * Formulario de preinscripción (cliente). Recibe `nivel` y `escenario` tal como vienen en la URL.
 *   - Nivel inválido, o distinto del nivel del usuario: a /estudiante/bienvenida.
 *   - Solicitud ya enviada: a /estudiante/preinscripcion.
 * Orquesta guardar, enviar (con su diálogo de confirmación) y la salida con cambios sin guardar.
 * El borrador se conserva en PostgreSQL; los datos no van al almacenamiento del navegador.
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
    const [guardados, setGuardados] = useState(0);
    const [errorGuardado, setErrorGuardado] = useState(false);
    const cambios = useRef(0);
    const guardandoRef = useRef(false);

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
        if (!borrador || guardandoRef.current) return false;
        guardandoRef.current = true;
        const cambiosAlGuardar = cambios.current;
        setGuardando(true);
        setErrorGuardado(false);
        try {
            const { guardadoEn, id_solicitud } = await guardarBorrador(borrador);
            setBorrador((actual) => (actual ? { ...actual, guardadoEn, id_solicitud } : actual));
            setGuardados((veces) => veces + 1);
            if (cambios.current === cambiosAlGuardar) setSucio(false);
            return true;
        } catch {
            setErrorGuardado(true);
            return false;
        } finally {
            guardandoRef.current = false;
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
        try {
            // Una clave por envío. Si falla la conexión, "Reintentar" repite la misma: el backend no la
            // duplica. Va dentro del try: sin contexto seguro (http://IP) crypto.randomUUID no existe.
            claveRef.current ??= crypto.randomUUID();
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
                <DialogoConfirmarEnvio
                    abierto={confirmando}
                    borrador={borrador}
                    avance={avance}
                    enviando={enviando}
                    errorEnvio={errorEnvio}
                    alCerrar={cerrarConfirmacion}
                    alEnviar={confirmarEnvio}
                />
                <DialogoSalida
                    abierto={salidaPendiente !== null}
                    guardando={guardando}
                    errorGuardado={errorGuardado}
                    alGuardarYSalir={guardarYSalir}
                    alSalirSinGuardar={confirmarSalida}
                    alSeguirAqui={cancelarSalida}
                />

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
                                guardados={guardados}
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
