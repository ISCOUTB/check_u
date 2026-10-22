"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Navbar from "@/app/components/navbar/Navbar";
import Button from "@/app/components/ui/Button";
import PageHeader from "@/app/components/ui/PageHeader";
import type { Nivel } from "@/app/estudiante/documentos-requeridos";
import { useSesion } from "@/app/lib/useSesion";
import { cargarPreinscripcion, escenarioDesde } from "./api";
import IndiceProgreso from "./IndiceProgreso";
import Academico from "./secciones/Academico";
import type { Cambio } from "./secciones/comun";
import Contacto from "./secciones/Contacto";
import Documentos from "./secciones/Documentos";
import EstudiosExperiencia from "./secciones/EstudiosExperiencia";
import Identificacion from "./secciones/Identificacion";
import SaberProVinculacion from "./secciones/SaberProVinculacion";
import type { BorradorPreinscripcion } from "./tipos";
import { progreso as calcularProgreso, seccionesDelNivel } from "./validacion";
import styles from "./iniciar_preinscripcion.module.css";

const NOMBRE_NIVEL: Record<Nivel, string> = { PREGRADO: "Pregrado", POSGRADO: "Posgrado" };

/** Sin errores todavía: los marca el envío (llega con la parte de guardar y enviar). */
const SIN_ERRORES: Record<string, string> = {};

function nivelDesde(valor: string | undefined): Nivel | null {
    return valor === "PREGRADO" || valor === "POSGRADO" ? valor : null;
}

/**
 * Formulario de preinscripción (cliente). Recibe `nivel` y `escenario` tal como vienen en la URL.
 *   - Nivel inválido, o distinto del nivel del usuario: a /estudiante/bienvenida.
 *   - Solicitud ya enviada: a /estudiante/preinscripcion.
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
        setBorrador((actual) => (actual ? cambio(actual) : actual));
    }, []);

    const avance = useMemo(() => (borrador ? calcularProgreso(borrador) : null), [borrador]);
    const secciones = useMemo(() => (nivelPedido ? seccionesDelNivel(nivelPedido) : []), [nivelPedido]);

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
                            <Identificacion borrador={borrador} cambiar={cambiar} errores={SIN_ERRORES} />
                            <Contacto borrador={borrador} cambiar={cambiar} errores={SIN_ERRORES} />
                            <Academico borrador={borrador} cambiar={cambiar} errores={SIN_ERRORES} />
                            {borrador.nivel === "PREGRADO" ? (
                                <SaberProVinculacion borrador={borrador} cambiar={cambiar} errores={SIN_ERRORES} />
                            ) : (
                                <EstudiosExperiencia borrador={borrador} cambiar={cambiar} errores={SIN_ERRORES} />
                            )}
                            <Documentos progreso={avance} />
                        </form>
                    </div>
                )}
            </main>
        </>
    );
}
