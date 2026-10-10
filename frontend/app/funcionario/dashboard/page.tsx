"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Usuario {
    id: number;
    username: string;
    name: string;
    role: "estudiante" | "funcionario";
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

import {
    Chart,
    BarController,
    BarElement,
    CategoryScale,
    LinearScale,
    DoughnutController,
    ArcElement,
    Tooltip,
    Legend
} from "chart.js";

import Navbar from "../../components/navbar/Navbar";
import styles from "./dashboard.module.css";

Chart.register(
    BarController,
    BarElement,
    CategoryScale,
    LinearScale,
    DoughnutController,
    ArcElement,
    Tooltip,
    Legend
);

interface Solicitud {
    numero: string;
    fecha: string;
    estudiante: string;
    estado:
    | "valida"
    | "no-valida"
    | "inconsistente"
    | "por-revisar";
}

const solicitudes: Solicitud[] = [
    {
        numero: "GR-2026-001",
        fecha: "04/10/2026 08:30",
        estudiante: "Juan David Pérez",
        estado: "valida"
    },
    {
        numero: "GR-2026-002",
        fecha: "04/10/2026 09:10",
        estudiante: "María Fernanda López",
        estado: "no-valida"
    },
    {
        numero: "GR-2026-003",
        fecha: "04/10/2026 09:45",
        estudiante: "Carlos Andrés Martínez",
        estado: "inconsistente"
    },
    {
        numero: "GR-2026-004",
        fecha: "04/10/2026 10:05",
        estudiante: "Laura Sofía Rodríguez",
        estado: "por-revisar"
    },
    {
        numero: "GR-2026-005",
        fecha: "04/10/2026 10:20",
        estudiante: "Daniel José Gómez",
        estado: "valida"
    }
];

const nombresEstado: Record<Solicitud["estado"], string> = {
    valida: "Válida",
    "no-valida": "No válida",
    inconsistente: "Inconsistente",
    "por-revisar": "Por revisar"
};

const nombresFiltro: Record<string, string> = {
    valida: "Válidas",
    "no-valida": "No válidas",
    inconsistente: "Inconsistentes",
    "por-revisar": "Por revisar"
};

export default function Dashboard() {
    const router = useRouter();

    const [usuario, setUsuario] = useState<Usuario | null>(null);
    const [cargandoSesion, setCargandoSesion] = useState(true);

    useEffect(() => {
        async function verificarSesion() {
            try {
                const response = await fetch(`${API_URL}/auth/me`, {
                    method: "GET",
                    credentials: "include",
                });

                if (!response.ok) {
                    router.replace("/");
                    return;
                }

                const data = await response.json();
                const usuarioActual: Usuario = data.user;

                // Este dashboard es exclusivo para funcionarios.
                if (usuarioActual.role !== "funcionario") {
                    router.replace("/estudiante");
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
    const [filtro, setFiltro] = useState("todos");

    const barChartRef = useRef<HTMLCanvasElement | null>(null);
    const pieChartRef = useRef<HTMLCanvasElement | null>(null);

    /*
     * =========================
     * GRÁFICOS
     * =========================
     */

    useEffect(() => {

        if (!barChartRef.current || !pieChartRef.current) {
            return;
        }

        const cantidades = {
            valida: solicitudes.filter(
                solicitud => solicitud.estado === "valida"
            ).length,

            noValida: solicitudes.filter(
                solicitud => solicitud.estado === "no-valida"
            ).length,

            inconsistente: solicitudes.filter(
                solicitud => solicitud.estado === "inconsistente"
            ).length,

            porRevisar: solicitudes.filter(
                solicitud => solicitud.estado === "por-revisar"
            ).length
        };

        const barChart = new Chart(
            barChartRef.current,
            {
                type: "bar",

                data: {
                    labels: [
                        "Válidas",
                        "No válidas",
                        "Inconsistentes",
                        "Por revisar"
                    ],

                    datasets: [
                        {
                            label: "Solicitudes",
                            data: [
                                cantidades.valida,
                                cantidades.noValida,
                                cantidades.inconsistente,
                                cantidades.porRevisar
                            ],
                            backgroundColor: [
                                "#35A875",
                                "#E06464",
                                "#D6A62C",
                                "#5F8FCB"
                            ],
                            borderColor: [
                                "#35A875",
                                "#E06464",
                                "#D6A62C",
                                "#5F8FCB"
                            ],
                            borderWidth: 1
                        }
                    ]
                },

                options: {
                    responsive: true,
                    maintainAspectRatio: false,

                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            }
        );

        const pieChart = new Chart(
            pieChartRef.current,
            {
                type: "doughnut",

                data: {
                    labels: [
                        "Válidas",
                        "No válidas",
                        "Inconsistentes",
                        "Por revisar"
                    ],

                    datasets: [
                        {
                            data: [
                                cantidades.valida,
                                cantidades.noValida,
                                cantidades.inconsistente,
                                cantidades.porRevisar
                            ],
                            backgroundColor: [
                                "#35A875",
                                "#E06464",
                                "#D6A62C",
                                "#5F8FCB"
                            ],
                            borderColor: "#ffffff",
                            borderWidth: 2
                        }
                    ]
                },

                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            }
        );

        return () => {
            barChart.destroy();
            pieChart.destroy();
        };

    }, [usuario]);


    /*
     * =========================
     * ESTADÍSTICAS
     * =========================
     */

    const total = solicitudes.length;

    const obtenerCantidad = (
        estado: Solicitud["estado"]
    ) => {

        return solicitudes.filter(
            solicitud => solicitud.estado === estado
        ).length;

    };

    const obtenerPorcentaje = (
        estado: Solicitud["estado"]
    ) => {

        if (total === 0) {
            return 0;
        }

        return Math.round(
            (obtenerCantidad(estado) / total) * 100
        );

    };


    /*
     * =========================
     * FILTRO
     * =========================
     */

    const solicitudesFiltradas =
        filtro === "todos"
            ? solicitudes
            : solicitudes.filter(
                solicitud => solicitud.estado === filtro
            );

    const aplicarFiltro = (nuevoFiltro: string) => {

        setFiltro(nuevoFiltro);

        setTimeout(() => {

            document
                .getElementById("solicitudes")
                ?.scrollIntoView({
                    behavior: "smooth"
                });

        }, 50);

    };


    /*
     * =========================
     * CLASES DE ESTADO
     * =========================
     */

    const clasesEstado: Record<
        Solicitud["estado"],
        string
    > = {
        valida: styles.valida,
        "no-valida": styles.noValida,
        inconsistente: styles.inconsistente,
        "por-revisar": styles.porRevisar
    };


    if (cargandoSesion || !usuario) {
        return <p>Verificando sesión...</p>;
    }

    return (
        <>
            <Navbar
                tipoUsuario={usuario.role}
                nombreUsuario={usuario.name}
            />

            <main className={styles.dashboard}>

                {/* =========================
                    HEADER
                ========================= */}

                <header className={styles.dashboardHeader}>

                    <div>

                        <h1>
                            Dashboard de preinscripciones
                        </h1>

                        <p>
                            Resumen y seguimiento de las solicitudes de grado.
                        </p>

                    </div>

                </header>


                {/* =========================
                    ESTADÍSTICAS
                ========================= */}

                <section className={styles.statisticsGrid}>

                    {/* VÁLIDAS */}

                    <article
                        className={`${styles.statCard} ${styles.valid} ${styles.clickableStat}`}
                        onClick={() => aplicarFiltro("valida")}
                    >

                        <div className={styles.statCardHeader}>

                            <span className={styles.statTitle}>
                                Válidas
                            </span>

                            <span className={styles.statusDot} />

                        </div>

                        <div className={styles.statValue}>

                            <span>
                                {obtenerCantidad("valida")}
                            </span>

                            <small>
                                {obtenerPorcentaje("valida")}%
                            </small>

                        </div>

                        <p>
                            Preinscripciones válidas
                        </p>

                    </article>


                    {/* NO VÁLIDAS */}

                    <article
                        className={`${styles.statCard} ${styles.invalid} ${styles.clickableStat}`}
                        onClick={() => aplicarFiltro("no-valida")}
                    >

                        <div className={styles.statCardHeader}>

                            <span className={styles.statTitle}>
                                No válidas
                            </span>

                            <span className={styles.statusDot} />

                        </div>

                        <div className={styles.statValue}>

                            <span>
                                {obtenerCantidad("no-valida")}
                            </span>

                            <small>
                                {obtenerPorcentaje("no-valida")}%
                            </small>

                        </div>

                        <p>
                            Preinscripciones no válidas
                        </p>

                    </article>


                    {/* INCONSISTENTES */}

                    <article
                        className={`${styles.statCard} ${styles.inconsistent} ${styles.clickableStat}`}
                        onClick={() => aplicarFiltro("inconsistente")}
                    >

                        <div className={styles.statCardHeader}>

                            <span className={styles.statTitle}>
                                Inconsistentes
                            </span>

                            <span className={styles.statusDot} />

                        </div>

                        <div className={styles.statValue}>

                            <span>
                                {obtenerCantidad("inconsistente")}
                            </span>

                            <small>
                                {obtenerPorcentaje("inconsistente")}%
                            </small>

                        </div>

                        <p>
                            Preinscripciones inconsistentes
                        </p>

                    </article>


                    {/* POR REVISAR */}

                    <article
                        className={`${styles.statCard} ${styles.review} ${styles.clickableStat}`}
                        onClick={() => aplicarFiltro("por-revisar")}
                    >

                        <div className={styles.statCardHeader}>

                            <span className={styles.statTitle}>
                                Por revisar
                            </span>

                            <span className={styles.statusDot} />

                        </div>

                        <div className={styles.statValue}>

                            <span>
                                {obtenerCantidad("por-revisar")}
                            </span>

                            <small>
                                {obtenerPorcentaje("por-revisar")}%
                            </small>

                        </div>

                        <p>
                            Preinscripciones pendientes
                        </p>

                    </article>

                </section>


                {/* =========================
                    GRÁFICOS
                ========================= */}

                <section className={styles.chartsGrid}>

                    {/* GRÁFICO DE BARRAS */}

                    <article
                        className={`${styles.panel} ${styles.chartPanel}`}
                    >

                        <div className={styles.panelHeader}>

                            <h2>
                                Distribución de solicitudes
                            </h2>

                            <p>
                                Cantidad de preinscripciones por estado.
                            </p>

                        </div>

                        <div className={styles.barChartContainer}>

                            <canvas ref={barChartRef} />

                        </div>

                    </article>


                    {/* GRÁFICO DOUGHNUT */}

                    <article
                        className={`${styles.panel} ${styles.chartPanel}`}
                    >

                        <div className={styles.panelHeader}>

                            <h2>
                                Distribución porcentual
                            </h2>

                            <p>
                                Porcentaje de solicitudes según su estado.
                            </p>

                        </div>

                        <div className={styles.pieChartContainer}>

                            <canvas ref={pieChartRef} />

                        </div>

                    </article>

                </section>


                {/* =========================
                    LISTADO
                ========================= */}

                <section
                    id="solicitudes"
                    className={styles.panel}
                >

                    {/* CABECERA */}

                    <div className={styles.panelHeader}>

                        <div>

                            <h2>
                                Preinscripciones
                            </h2>

                            <p>
                                Consulte las solicitudes registradas
                                en el sistema.
                            </p>

                        </div>

                        <span className={styles.resultsCount}>
                            {solicitudesFiltradas.length} solicitudes
                        </span>

                    </div>


                    {/* AVISO DEL FILTRO */}

                    {filtro !== "todos" && (

                        <div className={styles.filterNotice}>

                            Filtro aplicado:{" "}

                            {nombresFiltro[filtro]}

                        </div>

                    )}


                    {/* FILTROS */}

                    <div className={styles.filters}>

                        {[
                            ["todos", "Todas"],
                            ["valida", "Válidas"],
                            ["no-valida", "No válidas"],
                            ["inconsistente", "Inconsistentes"],
                            ["por-revisar", "Por revisar"]
                        ].map(([valor, nombre]) => (

                            <button
                                key={valor}

                                className={`${styles.filterButton} ${filtro === valor
                                    ? styles.filterButtonActive
                                    : ""
                                    }`}

                                onClick={() =>
                                    aplicarFiltro(valor)
                                }
                            >

                                {nombre}

                            </button>

                        ))}

                    </div>


                    {/* TABLA */}

                    <div className={styles.tableContainer}>

                        {solicitudesFiltradas.length > 0 ? (

                            <table className={styles.table}>

                                <thead>

                                    <tr>

                                        <th>
                                            No. solicitud
                                        </th>

                                        <th>
                                            Fecha y hora
                                        </th>

                                        <th>
                                            Estudiante
                                        </th>

                                        <th>
                                            Estado
                                        </th>

                                        <th>
                                            Acción
                                        </th>

                                    </tr>

                                </thead>

                                <tbody>

                                    {solicitudesFiltradas.map(
                                        solicitud => (

                                            <tr
                                                key={solicitud.numero}
                                            >

                                                <td>
                                                    {solicitud.numero}
                                                </td>

                                                <td>
                                                    {solicitud.fecha}
                                                </td>

                                                <td>
                                                    {solicitud.estudiante}
                                                </td>

                                                <td>

                                                    <span
                                                        className={`${styles.status} ${clasesEstado[solicitud.estado]}`}
                                                    >
                                                        {
                                                            nombresEstado[
                                                            solicitud.estado
                                                            ]
                                                        }
                                                    </span>

                                                </td>

                                                <td>

                                                    <a
                                                        href={`/funcionario/detalle-preinscripcion?id=${encodeURIComponent(
                                                            solicitud.numero
                                                        )}`}
                                                        className={
                                                            styles.viewButton
                                                        }
                                                    >
                                                        Visualizar
                                                    </a>

                                                </td>

                                            </tr>

                                        )
                                    )}

                                </tbody>

                            </table>

                        ) : (

                            <div className={styles.emptyState}>

                                <h3>
                                    No hay solicitudes
                                </h3>

                                <p>
                                    No existen preinscripciones para
                                    el filtro seleccionado.
                                </p>

                            </div>

                        )}

                    </div>

                </section>

            </main>
        </>
    );
}