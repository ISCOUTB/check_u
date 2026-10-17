"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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

/**
 * Exige una sesión con el rol de la página. Sin sesión (o si falla la consulta) lleva al login; con
 * el otro rol, a su propio inicio. Mientras tanto, cargando es true y usuario es null.
 */
export function useSesion(rolRequerido: Rol): { usuario: UsuarioSesion | null; cargando: boolean } {
    const router = useRouter();
    const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        let vigente = true;

        async function verificar() {
            try {
                const respuesta = await fetch(`${API_URL}/auth/me`, {
                    credentials: "include",
                    cache: "no-store",
                });
                if (!respuesta.ok) {
                    router.replace("/");
                    return;
                }
                const { user } = (await respuesta.json()) as { user: UsuarioSesion };
                if (user.role !== rolRequerido) {
                    router.replace(INICIO_POR_ROL[user.role]);
                    return;
                }
                if (vigente) {
                    setUsuario(user);
                    setCargando(false);
                }
            } catch {
                router.replace("/");
            }
        }

        verificar();
        return () => {
            vigente = false;
        };
    }, [rolRequerido, router]);

    return { usuario, cargando };
}
