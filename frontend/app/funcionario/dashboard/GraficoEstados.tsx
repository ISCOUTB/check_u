"use client";

import {
    ArcElement,
    BarController,
    BarElement,
    CategoryScale,
    Chart,
    DoughnutController,
    Legend,
    LinearScale,
    Tooltip,
} from "chart.js";
import { useEffect, useRef } from "react";
import Card from "@/app/components/ui/Card";
import { useTema } from "@/app/lib/tema";
import { ETIQUETA_PLURAL, type EstadoSolicitud } from "./datos";
import styles from "./GraficoEstados.module.css";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, DoughnutController, ArcElement, Tooltip, Legend);

/** Token de marca de cada estado: los gráficos usan los mismos colores que los chips. */
const TOKEN_MARCA: Record<EstadoSolicitud, string> = {
    valido: "--status-valid-mark",
    no_valido: "--status-invalid-mark",
    inconsistente: "--status-inconsistent-mark",
    por_revisar: "--status-review-mark",
    aceptada: "--status-accepted-mark",
    anulada: "--status-neutral-mark",
};

export interface GraficoEstadosProps {
    tipo: "barras" | "dona";
    titulo: string;
    descripcion: string;
    datos: { estado: EstadoSolicitud; cantidad: number }[];
}

/**
 * Gráfico de Chart.js con alternativa en texto: el canvas lleva un resumen (role="img") y la figura
 * una tabla para lectores de pantalla. Como el canvas no lee variables CSS, los colores se toman de
 * los tokens al dibujar y el gráfico se redibuja cuando cambia el tema (sistema o botón).
 */
export default function GraficoEstados({ tipo, titulo, descripcion, datos }: GraficoEstadosProps) {
    const lienzoRef = useRef<HTMLCanvasElement>(null);
    const tema = useTema() === "oscuro" ? "dark" : "light";

    const total = datos.reduce((suma, d) => suma + d.cantidad, 0);
    const porcentaje = (cantidad: number) => (total ? Math.round((cantidad / total) * 100) : 0);
    const resumen = datos
        .map((d) =>
            tipo === "dona"
                ? `${ETIQUETA_PLURAL[d.estado]}: ${d.cantidad} (${porcentaje(d.cantidad)} %)`
                : `${ETIQUETA_PLURAL[d.estado]}: ${d.cantidad}`,
        )
        .join(", ");

    useEffect(() => {
        if (!lienzoRef.current) return;

        const estilos = getComputedStyle(document.documentElement);
        const token = (nombre: string) => estilos.getPropertyValue(nombre).trim();
        const colores = datos.map((d) => token(TOKEN_MARCA[d.estado]));
        const texto = token("--color-text-secondary");
        const borde = token("--color-border");
        const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
        Chart.defaults.color = texto;

        const grafico = new Chart(lienzoRef.current, {
            type: tipo === "barras" ? "bar" : "doughnut",
            data: {
                labels: datos.map((d) => ETIQUETA_PLURAL[d.estado]),
                datasets: [
                    {
                        label: "Solicitudes",
                        data: datos.map((d) => d.cantidad),
                        backgroundColor: colores,
                        borderColor: tipo === "barras" ? colores : token("--color-surface"),
                        borderWidth: tipo === "barras" ? 0 : 2,
                        borderRadius: tipo === "barras" ? 6 : 0,
                        maxBarThickness: 56,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: sinMovimiento ? false : { duration: 400 },
                plugins: {
                    legend: { display: tipo === "dona", position: "bottom", labels: { boxWidth: 12, padding: 16 } },
                },
                ...(tipo === "barras"
                    ? {
                          scales: {
                              x: { grid: { display: false }, ticks: { color: texto } },
                              y: {
                                  beginAtZero: true,
                                  ticks: { precision: 0, color: texto },
                                  grid: { color: borde },
                              },
                          },
                      }
                    : { cutout: "62%" }),
            },
        });

        return () => grafico.destroy();
    }, [tipo, datos, tema]);

    return (
        <Card titulo={titulo}>
            <figure className={styles.figura} data-tema={tema}>
                <figcaption className={styles.descripcion}>{descripcion}</figcaption>
                <div className={styles.lienzo}>
                    <canvas ref={lienzoRef} role="img" aria-label={`${titulo}. ${resumen}.`} />
                </div>
                <div className="solo-lector">
                <table>
                    <caption>{titulo}</caption>
                    <thead>
                        <tr>
                            <th scope="col">Estado</th>
                            <th scope="col">Solicitudes</th>
                            <th scope="col">Porcentaje</th>
                        </tr>
                    </thead>
                    <tbody>
                        {datos.map((d) => (
                            <tr key={d.estado}>
                                <th scope="row">{ETIQUETA_PLURAL[d.estado]}</th>
                                <td>{d.cantidad}</td>
                                <td>{porcentaje(d.cantidad)} %</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
            </figure>
        </Card>
    );
}
