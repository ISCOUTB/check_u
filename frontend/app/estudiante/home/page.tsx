"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Navbar from "@/app/components/navbar/Navbar";
import styles from "./home.module.css";

interface Usuario {
    id: number;
    username: string;
    name: string;
    role: "estudiante" | "funcionario";
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function Home() {
    const router = useRouter();

    const [usuario, setUsuario] = useState<Usuario | null>(null);
    const [cargandoSesion, setCargandoSesion] = useState(true);

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

    if (cargandoSesion || !usuario) {
        return <p>Verificando sesión...</p>;
    }

    return (
        <>
            <Navbar
                tipoUsuario={usuario.role}
                nombreUsuario={usuario.name}
            />

            <main className={styles.home}>
                <header className={styles.header}>
                    <div>
                        <span className={styles.eyebrow}>
                            PORTAL DE GRADOS
                        </span>

                        <h1>
                            ¡Hola, {usuario.name}!
                        </h1>

                        <p>
                            Bienvenido a CheckU. Consulta información sobre
                            tu proceso de solicitud de grado.
                        </p>
                    </div>
                </header>

                <section className={styles.welcomeCard}>
                    <div className={styles.welcomeIcon}>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="28"
                            height="28"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" />
                            <path d="m9 12 2 2 4-4" />
                        </svg>
                    </div>

                    <div>
                        <h2>Tu proceso de grado, más sencillo</h2>

                        <p>
                            CheckU permite prevalidar los documentos
                            requeridos para tu solicitud de grado,
                            identificar inconsistencias y facilitar
                            su corrección antes de enviar la inscripción
                            formal.
                        </p>
                    </div>
                </section>

                <section className={styles.development}>
                    <div className={styles.developmentIcon}>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="30"
                            height="30"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <rect
                                x="3"
                                y="3"
                                width="18"
                                height="18"
                                rx="3"
                            />
                            <path d="M8 10h8" />
                            <path d="M8 14h5" />
                        </svg>
                    </div>

                    <span className={styles.badge}>
                        En desarrollo
                    </span>

                    <h2>Estamos construyendo CheckU</h2>

                    <p>
                        Próximamente podrás consultar el estado de tu
                        solicitud, cargar documentos, conocer los resultados
                        de la prevalidación y revisar las observaciones
                        realizadas durante el proceso.
                    </p>

                    <div className={styles.features}>
                        <div className={styles.feature}>
                            <span>01</span>
                            <p>Seguimiento de solicitudes</p>
                        </div>

                        <div className={styles.feature}>
                            <span>02</span>
                            <p>Validación automática de documentos</p>
                        </div>

                        <div className={styles.feature}>
                            <span>03</span>
                            <p>Notificaciones y observaciones</p>
                        </div>
                    </div>
                </section>
            </main>
        </>
    );
}