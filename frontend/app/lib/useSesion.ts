"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export type Rol = "estudiante" | "funcionario";

/** Usuario de GET /auth/me. nivel es opcional: el backend aún no lo devuelve. */
export interface UsuarioSesion {
    id: number;
    username: string;
    name: string;
    role: Rol;
    nivel?: "PREGRADO" | "POSGRADO";
}

export const INICIO_POR_ROL: Record<Rol, string> = {
    estudiante: "/estudiante/home",
    funcionario: "/funcionario/dashboard",
};

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface EstadoSesion {
    usuario: UsuarioSesion | null;
    cargando: boolean;
    /** true si no se pudo verificar la sesión por un fallo recuperable (red, 5xx, 429…). */
    errorSesion: boolean;
    /** Reintenta la verificación sin recargar la página. */
    reintentar: () => void;
}

/**
 * Exige una sesión con el rol de la página. Solo sin sesión (401/403) lleva al login; con el otro
 * rol, a su propio inicio. Un fallo transitorio de la consulta no cierra la sesión: se expone
 * `errorSesion` para que la página ofrezca reintentar. Mientras tanto, cargando es true y usuario null.
 */
export function useSesion(rolRequerido: Rol): EstadoSesion {
    const router = useRouter();
    const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
    const [cargando, setCargando] = useState(true);
    const [errorSesion, setErrorSesion] = useState(false);
    const [intento, setIntento] = useState(0);

    const reintentar = useCallback(() => {
        setErrorSesion(false);
        setCargando(true);
        setIntento((valor) => valor + 1);
    }, []);

    useEffect(() => {
        let vigente = true;
        const controlador = new AbortController();

        async function verificar() {
            try {
                if (!API_URL) {
                    // Sin URL de API no hay forma de validar: es configuración, no sesión perdida.
                    console.error("Falta NEXT_PUBLIC_API_URL en el build del frontend.");
                    if (vigente) {
                        setCargando(false);
                        setErrorSesion(true);
                    }
                    return;
                }
                const respuesta = await fetch(`${API_URL}/auth/me`, {
                    credentials: "include",
                    cache: "no-store",
                    signal: controlador.signal,
                });

                // Sin sesión de verdad: solo aquí se vuelve al login.
                if (respuesta.status === 401 || respuesta.status === 403) {
                    if (vigente) router.replace("/");
                    return;
                }
                // 429, 5xx, proxies caídos: no es una sesión inválida, es un fallo temporal.
                if (!respuesta.ok) {
                    if (vigente) {
                        setCargando(false);
                        setErrorSesion(true);
                    }
                    return;
                }

                const { user } = (await respuesta.json()) as { user: UsuarioSesion };
                if (user.role !== rolRequerido) {
                    if (vigente) router.replace(INICIO_POR_ROL[user.role]);
                    return;
                }
                if (vigente) {
                    setUsuario(user);
                    setCargando(false);
                }
            } catch {
                if (!vigente || controlador.signal.aborted) return;
                setCargando(false);
                setErrorSesion(true);
            }
        }

        verificar();
        return () => {
            vigente = false;
            controlador.abort();
        };
    }, [rolRequerido, router, intento]);

    return { usuario, cargando, errorSesion, reintentar };
}
