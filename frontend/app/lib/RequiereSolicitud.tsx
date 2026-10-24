"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Button from "@/app/components/ui/Button";
import { type SolicitudResumen, useSolicitudActiva } from "./useSolicitudActiva";
import styles from "./RequiereSolicitud.module.css";

interface RequiereSolicitudProps {
    children: React.ReactNode | ((solicitud: SolicitudResumen | null) => React.ReactNode);
    fallbackCargando?: React.ReactNode;
    fallbackError?: (reintentar: () => void) => React.ReactNode;
}

export function RequiereSolicitud({
    children,
    fallbackCargando,
    fallbackError,
}: RequiereSolicitudProps) {
    const router = useRouter();
    const { cargando, error, tiene_solicitud, solicitud, reintentar } = useSolicitudActiva();

    useEffect(() => {
        if (!cargando && !error && tiene_solicitud === false) {
            router.replace("/estudiante/bienvenida");
        }
    }, [cargando, error, tiene_solicitud, router]);

    if (cargando || (!error && tiene_solicitud === false)) {
        return (
            fallbackCargando ?? (
                <main id="contenido" tabIndex={-1} className={styles.cargando} aria-busy="true">
                    <span className={styles.spinner} aria-hidden="true" />
                    <p>Verificando solicitud...</p>
                </main>
            )
        );
    }

    if (error) {
        if (fallbackError) {
            return fallbackError(reintentar);
        }
        return (
            <main id="contenido" tabIndex={-1} className={styles.errorContenedor} role="alert">
                <div className={styles.cajaError}>
                    <h2>Error al verificar tu solicitud</h2>
                    <p>No fue posible consultar el estado de tu preinscripción. Por favor intenta nuevamente.</p>
                    <Button onClick={() => void reintentar()} variante="primario">
                        Reintentar
                    </Button>
                </div>
            </main>
        );
    }

    return <>{typeof children === "function" ? children(solicitud) : children}</>;
}
