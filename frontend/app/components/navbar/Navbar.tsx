"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./Navbar.module.css";

interface NavbarProps {
    tipoUsuario: "estudiante" | "funcionario";
    nombreUsuario: string;
    nivel?: "PREGRADO" | "POSGRADO";
}

export default function Navbar({
    tipoUsuario,
    nombreUsuario,
    nivel
}: NavbarProps) {
    const router = useRouter();

    const [menuAbierto, setMenuAbierto] = useState(false);

    const menuRef = useRef<HTMLDivElement>(null);

    const esEstudiante = tipoUsuario === "estudiante";

    /*
     * Cerrar el menú al hacer clic fuera.
     */
    useEffect(() => {

        const handleClickOutside = (event: MouseEvent) => {

            if (
                menuRef.current &&
                !menuRef.current.contains(event.target as Node)
            ) {
                setMenuAbierto(false);
            }

        };

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };

    }, []);

    /*
     * Acciones del menú
     */

    const handleMisSolicitudes = () => {

        setMenuAbierto(false);

        // TODO:
        // Conectar con la ruta real de solicitudes.
        console.log("Mis solicitudes");

    };

    const handleNotificaciones = () => {

        setMenuAbierto(false);

        // TODO:
        // Conectar con el sistema de notificaciones.
        console.log("Notificaciones");

    };

    const handleDashboard = () => {

        setMenuAbierto(false);

        // TODO:
        // Conectar con la ruta real del dashboard.
        console.log("Dashboard");

    };

    const handleCerrarSesion = async () => {

        setMenuAbierto(false);
        try {
                const response = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL}/auth/logout`,
                    {
                        method: "POST",
                        credentials: "include",
                        cache: "no-store",
                    }
                );

                if (!response.ok) {
                    throw new Error("No se pudo cerrar la sesión");
                }

                router.replace("/");
                router.refresh();
            } catch (error) {
                console.error("Error al cerrar sesión:", error);
                alert("No fue posible cerrar la sesión. Intenta nuevamente.");
            }
        console.log("Cerrar sesión pendiente de endpoint");

    };

    return (
        <nav className={styles.navbar}>

            {/* ================================================= */}
            {/* BRAND */}
            {/* ================================================= */}

            <div className={styles.navbarBrand}>

                <img
                    src="/icons/checku_logo.png"
                    alt="CheckU"
                    className={styles.navbarLogo}
                />

                <div className={styles.navbarTitle}>

                    <span className={styles.navbarName}>
                        CheckU
                    </span>

                    <span className={styles.navbarSubtitle}>
                        {esEstudiante
                            ? "Seguimiento de preinscripción"
                            : "Preinscripciones"
                        }
                    </span>

                </div>

            </div>

            {/* ================================================= */}
            {/* USUARIO */}
            {/* ================================================= */}

            <div
                className={styles.navbarUserContainer}
                ref={menuRef}
            >

                <button
                    type="button"
                    className={`${styles.navbarUser} ${
                        menuAbierto
                            ? styles.navbarUserActive
                            : ""
                    }`}
                    onClick={() => setMenuAbierto(!menuAbierto)}
                    aria-expanded={menuAbierto}
                    aria-haspopup="menu"
                >

                    <div className={styles.navbarUserInfo}>

                        <span className={styles.navbarUserName}>
                            {nombreUsuario}
                        </span>

                        <span className={styles.navbarUserRole}>
                            {esEstudiante
                                ? "Candidato a grado"
                                : "Funcionaria de grados"
                            }
                        </span>

                    </div>

                    {esEstudiante && nivel && (
                        <span className={styles.navbarLevel}>
                            {nivel}
                        </span>
                    )}

                    <span
                        className={`${styles.navbarChevron} ${
                            menuAbierto
                                ? styles.navbarChevronOpen
                                : ""
                        }`}
                    >
                        <img src="/icons/arrow_down.png" alt="" />
                    </span>

                </button>

                {/* ================================================= */}
                {/* MENU */}
                {/* ================================================= */}

                {menuAbierto && (

                    <div
                        className={styles.userMenu}
                        role="menu"
                    >

                        {/* =============================== */}
                        {/* ESTUDIANTE */}
                        {/* =============================== */}

                        {esEstudiante && (
                            <>
                                <button
                                    type="button"
                                    className={styles.userMenuItem}
                                    onClick={handleMisSolicitudes}
                                    role="menuitem"
                                >
                                    <span className={styles.menuIcon}>
                                        <img src="/icons/fact_check.png" alt="Fact Check" />
                                    </span>

                                    <span>
                                        Mis solicitudes
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    className={styles.userMenuItem}
                                    onClick={handleNotificaciones}
                                    role="menuitem"
                                >
                                    <span className={styles.menuIcon}>
                                        <img src="/icons/notification.png" alt="Notificaciones" />
                                    </span>

                                    <span>
                                        Notificaciones
                                    </span>
                                </button>
                            </>
                        )}

                        {/* =============================== */}
                        {/* FUNCIONARIO */}
                        {/* =============================== */}

                        {!esEstudiante && (
                            <button
                                type="button"
                                className={styles.userMenuItem}
                                onClick={handleDashboard}
                                role="menuitem"
                            >
                                <span className={styles.menuIcon}>
                                    <img src="/icons/fact_check.png" alt="Dashboard" />
                                </span>

                                <span>
                                    Solicitudes de preinscripción
                                </span>
                            </button>
                        )}

                        {/* =============================== */}
                        {/* SEPARADOR */}
                        {/* =============================== */}

                        <div className={styles.menuDivider} />

                        {/* =============================== */}
                        {/* CERRAR SESIÓN */}
                        {/* =============================== */}

                        <button
                            type="button"
                            className={`${styles.userMenuItem} ${styles.logoutItem}`}
                            onClick={handleCerrarSesion}
                            role="menuitem"
                        >
                            <span className={styles.menuIcon}>
                                ↪
                            </span>

                            <span>
                                Cerrar sesión
                            </span>
                        </button>

                    </div>

                )}

            </div>

        </nav>
    );
}
