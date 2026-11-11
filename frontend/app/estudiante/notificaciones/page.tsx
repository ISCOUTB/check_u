"use client";

import Navbar from "@/app/components/navbar/Navbar";
import PageHeader from "@/app/components/ui/PageHeader";
import { useSesion } from "@/app/lib/useSesion";
import NotificacionesPanel from "../home/NotificacionesPanel";
import styles from "./notificaciones.module.css";

export default function NotificacionesPage() {
    const { usuario } = useSesion("estudiante");

    return (
        <>
            {usuario && (
                <Navbar
                    tipoUsuario="estudiante"
                    nombreUsuario={usuario.name}
                    nivel={usuario.nivel}
                />
            )}
            <main id="contenido" tabIndex={-1} className={styles.pagina}>
                <PageHeader
                    ruta={[
                        { texto: "Inicio", href: "/estudiante/home" },
                        { texto: "Notificaciones" },
                    ]}
                    titulo="Notificaciones"
                    descripcion="Consulta los avisos sobre tus solicitudes de grado, del más reciente al más antiguo."
                />
                {usuario ? (
                    <NotificacionesPanel completas />
                ) : (
                    <p role="status">Comprobando sesión…</p>
                )}
            </main>
        </>
    );
}
