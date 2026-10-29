"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Navbar from "@/app/components/navbar/Navbar";
import Button from "@/app/components/ui/Button";
import Dialog from "@/app/components/ui/Dialog";
import Icono from "@/app/components/ui/Icono";
import PageHeader from "@/app/components/ui/PageHeader";
import { useSesion } from "@/app/lib/useSesion";
import BloqueOpciones from "./BloqueOpciones";
import {
    CAMPOS_ADMIN,
    crearOpcion,
    eliminarOpcion,
    importarOpciones,
    obtenerOpciones,
    reordenarOpciones,
    type CampoAdmin,
    type OpcionAdmin,
    type ResultadoImportacion,
} from "./api";
import styles from "./opciones.module.css";

type Agrupadas = Record<CampoAdmin, OpcionAdmin[]>;

function agrupar(opciones: OpcionAdmin[]): Agrupadas {
    const mapa = Object.fromEntries(
        CAMPOS_ADMIN.map((campo) => [campo.id, [] as OpcionAdmin[]]),
    ) as Agrupadas;
    for (const opcion of opciones) {
        mapa[opcion.campo]?.push(opcion);
    }
    for (const campo of CAMPOS_ADMIN) {
        mapa[campo.id].sort((a, b) => a.orden - b.orden || a.id - b.id);
    }
    return mapa;
}

export default function OpcionesFormularioPage() {
    const { usuario, cargando } = useSesion("funcionario");
    const [opciones, setOpciones] = useState<OpcionAdmin[]>([]);
    const [cargandoOpciones, setCargandoOpciones] = useState(true);
    const [errorCarga, setErrorCarga] = useState("");
    const [intento, setIntento] = useState(0);
    const [ocupado, setOcupado] = useState(false);
    const [aviso, setAviso] = useState<string | null>(null);
    const [porEliminar, setPorEliminar] = useState<OpcionAdmin | null>(null);
    const [eliminando, setEliminando] = useState(false);
    const [errorEliminar, setErrorEliminar] = useState("");

    useEffect(() => {
        if (!usuario) return;
        let vigente = true;
        obtenerOpciones()
            .then((datos) => {
                if (vigente) setOpciones(datos);
            })
            .catch((error) => {
                if (vigente) {
                    setErrorCarga(
                        error instanceof Error ? error.message : "No fue posible cargar las opciones.",
                    );
                }
            })
            .finally(() => {
                if (vigente) setCargandoOpciones(false);
            });
        return () => {
            vigente = false;
        };
    }, [usuario, intento]);

    const agrupadas = useMemo(() => agrupar(opciones), [opciones]);

    const ejecutar = useCallback(async <T,>(accion: () => Promise<T>): Promise<T> => {
        setOcupado(true);
        setAviso(null);
        try {
            const resultado = await accion();
            setOpciones(await obtenerOpciones());
            return resultado;
        } finally {
            setOcupado(false);
        }
    }, []);

    const crear = (campo: CampoAdmin, etiqueta: string) =>
        ejecutar(async () => {
            await crearOpcion(campo, etiqueta);
        });

    const mover = (campo: CampoAdmin, opcion: OpcionAdmin, direccion: -1 | 1) =>
        ejecutar(async () => {
            const lista = agrupadas[campo];
            const indice = lista.findIndex((item) => item.id === opcion.id);
            const destino = indice + direccion;
            if (indice < 0 || destino < 0 || destino >= lista.length) return;
            const ids = lista.map((item) => item.id);
            [ids[indice], ids[destino]] = [ids[destino], ids[indice]];
            await reordenarOpciones(campo, ids);
        });

    const importar = (campo: CampoAdmin, texto: string): Promise<ResultadoImportacion> =>
        ejecutar(() => importarOpciones(campo, texto));

    const pedirEliminar = (opcion: OpcionAdmin) => {
        setErrorEliminar("");
        setPorEliminar(opcion);
    };

    const cerrarEliminar = () => {
        if (eliminando) return;
        setPorEliminar(null);
        setErrorEliminar("");
    };

    const confirmarEliminar = async () => {
        if (!porEliminar) return;
        setEliminando(true);
        setErrorEliminar("");
        try {
            await ejecutar(() => eliminarOpcion(porEliminar.id));
            setAviso(`Se eliminó «${porEliminar.etiqueta}».`);
            setPorEliminar(null);
        } catch (error) {
            setErrorEliminar(
                error instanceof Error ? error.message : "No fue posible eliminar la opción.",
            );
        } finally {
            setEliminando(false);
        }
    };

    if (cargando || !usuario) {
        return (
            <main id="contenido" tabIndex={-1} className={styles.cargando} aria-busy="true">
                <span className={styles.spinner} aria-hidden="true" />
                <p>Verificando sesión...</p>
            </main>
        );
    }

    return (
        <>
            <Navbar tipoUsuario={usuario.role} nombreUsuario={usuario.name} />
            <main id="contenido" tabIndex={-1} className={styles.pagina} aria-busy={cargandoOpciones}>
                <PageHeader
                    ruta={[
                        { texto: "Solicitudes de preinscripción", href: "/funcionario/dashboard" },
                        { texto: "Opciones del formulario" },
                    ]}
                    titulo="Opciones del formulario de preinscripción"
                    descripcion="Administra los valores que los estudiantes ven al diligenciar su preinscripción. Cada campo es independiente: crea, ordena, elimina o importa sus opciones."
                />

                {aviso && (
                    <p className={styles.avisoOk} role="status">
                        {aviso}
                    </p>
                )}

                {errorCarga && (
                    <div className={styles.errorCarga} role="alert">
                        <p>{errorCarga}</p>
                        <Button
                            variante="secundario"
                            onClick={() => {
                                setErrorCarga("");
                                setCargandoOpciones(true);
                                setIntento((valor) => valor + 1);
                            }}
                        >
                            Reintentar
                        </Button>
                    </div>
                )}

                {cargandoOpciones && !errorCarga && (
                    <div className={styles.cargandoOpciones} role="status">
                        <span className={styles.spinner} aria-hidden="true" />
                        <p>Cargando opciones...</p>
                    </div>
                )}

                {!cargandoOpciones && !errorCarga && (
                    <div className={styles.rejilla}>
                        {CAMPOS_ADMIN.map((campo) => (
                            <BloqueOpciones
                                key={campo.id}
                                campo={campo.id}
                                titulo={campo.titulo}
                                descripcion={campo.descripcion}
                                icono={campo.icono}
                                opciones={agrupadas[campo.id]}
                                ocupado={ocupado}
                                alCrear={(etiqueta) => crear(campo.id, etiqueta)}
                                alEliminar={pedirEliminar}
                                alMover={(opcion, direccion) => mover(campo.id, opcion, direccion)}
                                alImportar={(texto) => importar(campo.id, texto)}
                            />
                        ))}
                    </div>
                )}

                <p className={styles.nota}>
                    <Icono nombre="ajustes" tamano={18} />
                    Los cambios se aplican de inmediato en el formulario de nuevas preinscripciones. El orden que
                    definas aquí es el que verá el estudiante.
                </p>
            </main>

            <Dialog
                abierto={porEliminar !== null}
                alCerrar={cerrarEliminar}
                titulo="Eliminar opción"
                descripcion="La opción dejará de aparecer en el formulario."
                compacto
            >
                <p className={styles.textoDialogo}>
                    ¿Eliminar «{porEliminar?.etiqueta}»? Las preinscripciones que ya usan este valor conservan su
                    información.
                </p>
                {errorEliminar && (
                    <p className={styles.mensajeError} role="alert">
                        {errorEliminar}
                    </p>
                )}
                <div className={styles.accionesDialogo}>
                    <Button variante="secundario" onClick={cerrarEliminar} disabled={eliminando}>
                        Cancelar
                    </Button>
                    <Button cargando={eliminando} textoCargando="Eliminando…" conservarFoco onClick={confirmarEliminar}>
                        Eliminar
                    </Button>
                </div>
            </Dialog>
        </>
    );
}
