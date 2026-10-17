"use client";

import { useState } from "react";
import Navbar from "@/app/components/navbar/Navbar";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import PageHeader from "@/app/components/ui/PageHeader";
import StatusBadge from "@/app/components/ui/StatusBadge";
import { useSesion } from "@/app/lib/useSesion";
import {
    DESCRIPCION_CONTADOR,
    ESTADOS_SOLICITUD,
    ETIQUETA_PLURAL,
    ETIQUETA_SOLICITUD,
    type EstadoSolicitud,
    SOLICITUDES,
} from "./datos";
import GraficoEstados from "./GraficoEstados";
import styles from "./dashboard.module.css";

type Filtro = "todos" | EstadoSolicitud;

const TOTAL = SOLICITUDES.length;
const CONTEO = ESTADOS_SOLICITUD.map((estado) => ({
    estado,
    cantidad: SOLICITUDES.filter((s) => s.estado === estado).length,
}));

const porcentaje = (cantidad: number) => (TOTAL ? Math.round((cantidad / TOTAL) * 100) : 0);

export default function Dashboard() {
    const { usuario, cargando } = useSesion("funcionario");
    const [filtro, setFiltro] = useState<Filtro>("todos");

    if (cargando || !usuario) {
        return (
            <main id="contenido" tabIndex={-1} className={styles.cargando} aria-busy="true">
                <p>Verificando sesión...</p>
            </main>
        );
    }

    const filtradas = filtro === "todos" ? SOLICITUDES : SOLICITUDES.filter((s) => s.estado === filtro);

    /** Desde un contador: filtra la lista y lleva el foco a su título, debajo de la barra fija. */
    const verEstado = (estado: EstadoSolicitud) => {
        setFiltro(estado);
        requestAnimationFrame(() => {
            const titulo = document.getElementById("titulo-solicitudes");
            titulo?.focus({ preventScroll: true });
            titulo?.scrollIntoView({ block: "start" });
        });
    };

    return (
        <>
            <Navbar tipoUsuario={usuario.role} nombreUsuario={usuario.name} />
            <main id="contenido" tabIndex={-1} className={styles.pagina}>
                <PageHeader
                    titulo="Dashboard de preinscripciones"
                    descripcion="Resumen y seguimiento de las solicitudes de grado."
                />

                <section aria-labelledby="titulo-resumen" className={styles.seccion}>
                    <h2 id="titulo-resumen" className="solo-lector">
                        Resumen por estado
                    </h2>
                    <p id="ayuda-contadores" className="solo-lector">
                        Al pulsar un contador se filtra la lista de preinscripciones.
                    </p>
                    <ul className={styles.contadores}>
                        {CONTEO.map(({ estado, cantidad }) => (
                            <li key={estado}>
                                <button
                                    type="button"
                                    className={styles.contador}
                                    data-estado={estado}
                                    aria-describedby="ayuda-contadores"
                                    onClick={() => verEstado(estado)}
                                >
                                    <span className={styles.contadorCabecera}>
                                        <span className={styles.contadorTitulo}>{ETIQUETA_PLURAL[estado]}</span>
                                        <span className={styles.marca} aria-hidden="true" />
                                    </span>
                                    <span className={styles.contadorValor}>
                                        <span className={styles.cifra}>{cantidad}</span>
                                        <span className={styles.porcentaje}>{porcentaje(cantidad)} %</span>
                                    </span>
                                    <span className={styles.contadorDescripcion}>{DESCRIPCION_CONTADOR[estado]}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>

                <div className={styles.graficos}>
                    <GraficoEstados
                        tipo="barras"
                        titulo="Distribución de solicitudes"
                        descripcion="Cantidad de preinscripciones por estado."
                        datos={CONTEO}
                    />
                    <GraficoEstados
                        tipo="dona"
                        titulo="Distribución porcentual"
                        descripcion="Porcentaje de solicitudes según su estado."
                        datos={CONTEO}
                    />
                </div>

                <Card
                    id="solicitudes"
                    tituloId="titulo-solicitudes"
                    titulo="Preinscripciones"
                    className={styles.listado}
                    acciones={
                        <p aria-live="polite" className={styles.conteo}>
                            {filtradas.length} solicitudes
                        </p>
                    }
                >
                    <p className={styles.textoSecundario}>Consulte las solicitudes registradas en el sistema.</p>

                    <div role="group" aria-label="Filtrar por estado" className={styles.filtros}>
                        {(["todos", ...ESTADOS_SOLICITUD] as Filtro[]).map((valor) => (
                            <button
                                key={valor}
                                type="button"
                                className={styles.filtro}
                                aria-pressed={filtro === valor}
                                onClick={() => setFiltro(valor)}
                            >
                                {valor === "todos" ? "Todas" : ETIQUETA_PLURAL[valor]}
                            </button>
                        ))}
                    </div>

                    {filtradas.length === 0 ? (
                        <div className={styles.vacio}>
                            <h3>No hay solicitudes</h3>
                            <p>No existen preinscripciones para el filtro seleccionado.</p>
                        </div>
                    ) : (
                        <>
                            <table className={styles.tabla}>
                                <caption className="solo-lector">
                                    Preinscripciones
                                    {filtro !== "todos" && ` (filtro: ${ETIQUETA_PLURAL[filtro]})`}
                                </caption>
                                <thead>
                                    <tr>
                                        <th scope="col">No. solicitud</th>
                                        <th scope="col">Fecha y hora</th>
                                        <th scope="col">Estudiante</th>
                                        <th scope="col">Estado</th>
                                        <th scope="col">
                                            <span className="solo-lector">Acción</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtradas.map((s) => (
                                        <tr key={s.numero}>
                                            <td className={styles.numero}>{s.numero}</td>
                                            <td className={styles.fecha}>{s.fecha}</td>
                                            <td>{s.estudiante}</td>
                                            <td>
                                                <StatusBadge estado={s.estado} etiqueta={ETIQUETA_SOLICITUD[s.estado]} />
                                            </td>
                                            <td className={styles.accion}>
                                                <Button
                                                    href={`/funcionario/detalle_preinscripcion/${s.numero}`}
                                                    variante="secundario"
                                                    aria-label={`Ver solicitud ${s.numero}`}
                                                >
                                                    Ver solicitud
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <ul aria-label="Preinscripciones" className={styles.tarjetas}>
                                {filtradas.map((s) => (
                                    <li key={s.numero} className={styles.tarjeta}>
                                        <div className={styles.tarjetaCabecera}>
                                            <span className={styles.numero}>{s.numero}</span>
                                            <StatusBadge estado={s.estado} etiqueta={ETIQUETA_SOLICITUD[s.estado]} />
                                        </div>
                                        <p className={styles.tarjetaEstudiante}>{s.estudiante}</p>
                                        <p className={styles.fecha}>{s.fecha}</p>
                                        <Button
                                            href={`/funcionario/detalle_preinscripcion/${s.numero}`}
                                            variante="secundario"
                                            aria-label={`Ver solicitud ${s.numero}`}
                                            className={styles.tarjetaAccion}
                                        >
                                            Ver solicitud
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </Card>
            </main>
        </>
    );
}
