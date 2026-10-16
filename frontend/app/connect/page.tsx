"use client";

import { useEffect, useState } from "react";
import Card from "@/app/components/ui/Card";
import Icono from "@/app/components/ui/Icono";
import PageHeader from "@/app/components/ui/PageHeader";
import styles from "./connect.module.css";

interface HealthResponse {
    status: string;
    service: string;
    message: string;
}

export default function ConexionPage() {
    const [data, setData] = useState<HealthResponse | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        async function comprobarConexion() {
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`);
                if (!response.ok) {
                    throw new Error(`Error HTTP: ${response.status}`);
                }
                setData((await response.json()) as HealthResponse);
            } catch (causa) {
                setError(
                    causa instanceof Error && causa.message.startsWith("Error HTTP")
                        ? causa.message
                        : "No fue posible conectar con el backend de CheckU.",
                );
            }
        }

        comprobarConexion();
    }, []);

    const pendiente = !data && !error;

    return (
        <main id="contenido" tabIndex={-1} className={styles.pagina} aria-busy={pendiente}>
            <PageHeader titulo="CheckU · Prueba de conexión" descripcion="Comprueba que el frontend llega al backend." />

            <Card className={styles.tarjeta}>
                {pendiente && <p className={styles.estado}>Conectando con el backend...</p>}

                {data && (
                    <div role="status" className={styles.resultado} data-tono="exito">
                        <span className={styles.icono}>
                            <Icono nombre="valido" tamano={22} />
                        </span>
                        <div>
                            <h2 className={styles.titulo}>Conexión exitosa</h2>
                            <dl className={styles.datos}>
                                <div>
                                    <dt>Estado</dt>
                                    <dd>{data.status}</dd>
                                </div>
                                <div>
                                    <dt>Servicio</dt>
                                    <dd>{data.service}</dd>
                                </div>
                            </dl>
                            <p className={styles.mensaje}>{data.message}</p>
                        </div>
                    </div>
                )}

                {error && (
                    <div role="alert" className={styles.resultado} data-tono="error">
                        <span className={styles.icono}>
                            <Icono nombre="no_valido" tamano={22} />
                        </span>
                        <div>
                            <h2 className={styles.titulo}>Sin conexión</h2>
                            <p className={styles.mensaje}>{error}</p>
                        </div>
                    </div>
                )}
            </Card>
        </main>
    );
}
