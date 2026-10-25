"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export interface SolicitudResumen {
    id_solicitud: number;
    tipo_solicitud: string;
    estado: string;
}

export interface RespuestaSolicitud {
    tiene_solicitud: boolean;
    solicitud: SolicitudResumen | null;
}

export interface EstadoSolicitudActiva {
    cargando: boolean;
    error: boolean;
    tiene_solicitud: boolean | null;
    solicitud: SolicitudResumen | null;
    reintentar: () => Promise<void>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

/**
 * Gancho reutilizable para consultar el estado de la solicitud activa del estudiante autenticado.
 *
 * Devuelve:
 * - cargando: true mientras se verifica la solicitud
 * - error: true si la base de datos o el backend fallan (no redirige en error)
 * - tiene_solicitud: boolean | null (false si no tiene ninguna solicitud en BD)
 * - solicitud: datos básicos de la solicitud ({ id_solicitud, tipo_solicitud, estado })
 * - reintentar: función para reintentar la consulta en caso de error
 */
export function useSolicitudActiva(habilitado: boolean = true): EstadoSolicitudActiva {
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(false);
    const [tieneSolicitud, setTieneSolicitud] = useState<boolean | null>(null);
    const [solicitud, setSolicitud] = useState<SolicitudResumen | null>(null);
    const [intento, setIntento] = useState(0);

    const reintentar = useCallback(async () => {
        setCargando(true);
        setError(false);
        setIntento((prev) => prev + 1);
    }, []);

    useEffect(() => {
        if (!habilitado) return;
        let vigente = true;

        async function consultar() {
            // Soporte retrocompatible para pruebas E2E que inyectan escenario sin_solicitud
            if (
                typeof window !== "undefined" &&
                (window as unknown as { __CHECKU_ESCENARIO__?: string }).__CHECKU_ESCENARIO__ === "sin_solicitud"
            ) {
                if (vigente) {
                    setCargando(false);
                    setTieneSolicitud(false);
                    setSolicitud(null);
                }
                return;
            }

            try {
                const respuesta = await fetch(`${API_URL}/estudiante/solicitud`, {
                    method: "GET",
                    credentials: "include",
                    cache: "no-store",
                });

                if (!respuesta.ok) {
                    if (vigente) {
                        setError(true);
                        setCargando(false);
                    }
                    return;
                }

                const data = (await respuesta.json()) as RespuestaSolicitud;
                if (vigente) {
                    setTieneSolicitud(data.tiene_solicitud);
                    setSolicitud(data.solicitud);
                    setError(false);
                    setCargando(false);
                }
            } catch {
                if (vigente) {
                    setError(true);
                    setCargando(false);
                }
            }
        }

        void consultar();
        return () => {
            vigente = false;
        };
    }, [habilitado, intento]);

    return {
        cargando,
        error,
        tiene_solicitud: tieneSolicitud,
        solicitud,
        reintentar,
    };
}

/**
 * Guardia en forma de gancho: si el estudiante autenticado no tiene ninguna solicitud (tiene_solicitud === false)
 * y la consulta no arrojó error, lo redirige automáticamente a /estudiante/bienvenida.
 * Si la consulta falla, NO redirige y permite reintentar.
 */
export function useRequiereSolicitud(habilitado: boolean = true): EstadoSolicitudActiva {
    const router = useRouter();
    const estado = useSolicitudActiva(habilitado);

    useEffect(() => {
        if (habilitado && !estado.cargando && !estado.error && estado.tiene_solicitud === false) {
            router.replace("/estudiante/bienvenida");
        }
    }, [habilitado, estado.cargando, estado.error, estado.tiene_solicitud, router]);

    return estado;
}
