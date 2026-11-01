"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FocusEvent } from "react";
import BotonTema from "@/app/components/ui/BotonTema";
import Icono, { type NombreIcono } from "@/app/components/ui/Icono";
import styles from "./Navbar.module.css";

interface NavbarProps {
    tipoUsuario: "estudiante" | "funcionario";
    nombreUsuario: string;
    nivel?: "PREGRADO" | "POSGRADO";
}

const ENLACES: Record<NavbarProps["tipoUsuario"], { texto: string; href: string; icono: NombreIcono }[]> = {
    estudiante: [
        { texto: "Mis solicitudes", href: "/estudiante/solicitudes", icono: "lista" },
        { texto: "Notificaciones", href: "/estudiante/home#notificaciones", icono: "campana" },
    ],
    funcionario: [
        { texto: "Solicitudes de preinscripción", href: "/funcionario/dashboard", icono: "lista" },
        { texto: "Opciones del formulario", href: "/funcionario/opciones", icono: "ajustes" },
    ],
};

/** Barra superior: marca y menú de usuario (patrón de divulgación: botón + lista de enlaces). */
export default function Navbar({ tipoUsuario, nombreUsuario, nivel }: NavbarProps) {
    const router = useRouter();
    const idMenu = useId();
    const [abierto, setAbierto] = useState(false);
    const contenedorRef = useRef<HTMLDivElement>(null);
    const botonRef = useRef<HTMLButtonElement>(null);

    const esEstudiante = tipoUsuario === "estudiante";
    const inicio = esEstudiante ? "/estudiante/home" : "/funcionario/dashboard";

    useEffect(() => {
        if (!abierto) return;

        const alPresionar = (evento: MouseEvent) => {
            if (contenedorRef.current && !contenedorRef.current.contains(evento.target as Node)) {
                setAbierto(false);
            }
        };
        const alTeclear = (evento: KeyboardEvent) => {
            if (evento.key === "Escape") {
                setAbierto(false);
                botonRef.current?.focus();
            }
        };

        document.addEventListener("mousedown", alPresionar);
        document.addEventListener("keydown", alTeclear);
        return () => {
            document.removeEventListener("mousedown", alPresionar);
            document.removeEventListener("keydown", alTeclear);
        };
    }, [abierto]);

    /** Si el foco sale del menú con Tab, se cierra. */
    const alPerderFoco = (evento: FocusEvent<HTMLDivElement>) => {
        if (!contenedorRef.current?.contains(evento.relatedTarget as Node | null)) {
            setAbierto(false);
        }
    };

    const cerrarSesion = async () => {
        setAbierto(false);
        try {
            const respuesta = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
                method: "POST",
                credentials: "include",
                cache: "no-store",
            });
            if (!respuesta.ok) throw new Error("No se pudo cerrar la sesión");
            router.replace("/");
            router.refresh();
        } catch {
            alert("No fue posible cerrar la sesión. Intenta nuevamente.");
        }
    };

    return (
        <header className={styles.barra}>
            <div className={styles.interior}>
                <Link href={inicio} className={styles.marca}>
                    <Image src="/icons/checku_logo.png" alt="" width={40} height={40} className={styles.logo} />
                    <span className={styles.marcaTexto}>
                        <span className={styles.nombreMarca}>CheckU</span>
                        <span className={styles.subtitulo}>
                            {esEstudiante ? "Seguimiento de preinscripción" : "Preinscripciones"}
                        </span>
                    </span>
                </Link>

                <div className={styles.derecha}>
                    <BotonTema />
                    <nav aria-label="Principal" className={styles.navegacion}>
                        <div className={styles.usuario} ref={contenedorRef} onBlur={alPerderFoco}>
                            <button
                                ref={botonRef}
                                type="button"
                                className={styles.botonUsuario}
                                aria-expanded={abierto}
                                aria-controls={idMenu}
                                onClick={() => setAbierto((valor) => !valor)}
                            >
                                <span className={styles.datosUsuario}>
                                    <span className={styles.nombreUsuario}>{nombreUsuario}</span>
                                    <span className={styles.rolUsuario}>
                                        {esEstudiante ? "Candidato a grado" : "Funcionaria de grados"}
                                    </span>
                                </span>
                                {esEstudiante && nivel && <span className={styles.nivel}>{nivel}</span>}
                                <span className={styles.flecha} data-abierto={abierto}>
                                    <Icono nombre="flecha_abajo" tamano={16} />
                                </span>
                            </button>

                            {abierto && (
                                <ul id={idMenu} className={styles.menu}>
                                    {ENLACES[tipoUsuario].map((enlace) => (
                                        <li key={enlace.href}>
                                            <Link
                                                href={enlace.href}
                                                className={styles.opcion}
                                                onClick={() => setAbierto(false)}
                                            >
                                                <Icono nombre={enlace.icono} />
                                                {enlace.texto}
                                            </Link>
                                        </li>
                                    ))}
                                    <li className={styles.separado}>
                                        <button type="button" className={styles.opcion} onClick={cerrarSesion}>
                                            <Icono nombre="salir" />
                                            Cerrar sesión
                                        </button>
                                    </li>
                                </ul>
                            )}
                        </div>
                    </nav>
                </div>
            </div>
        </header>
    );
}
