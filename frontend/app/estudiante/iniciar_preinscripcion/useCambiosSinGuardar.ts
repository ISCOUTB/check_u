"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Avisa antes de perder cambios sin guardar (decisión 6 del spec).
 *   - Al recargar o cerrar la pestaña: el aviso del navegador (`beforeunload`).
 *   - Al tocar un enlace interno fuera del formulario (la barra, la ruta…): Next 16 no trae bloqueo de
 *     navegación, así que el clic se intercepta en fase de captura, antes que el de next/link, y la
 *     ruta queda en `salidaPendiente` para que la página pregunte con su propio diálogo.
 * Sin cambios (`sucio` en false) no intercepta nada.
 */
export function useCambiosSinGuardar(sucio: boolean): {
    salidaPendiente: string | null;
    confirmarSalida: () => void;
    cancelarSalida: () => void;
} {
    const router = useRouter();
    const [salidaPendiente, setSalidaPendiente] = useState<string | null>(null);

    useEffect(() => {
        if (!sucio) return;

        const antesDeSalir = (evento: BeforeUnloadEvent) => {
            evento.preventDefault();
            // Navegadores viejos piden además un returnValue.
            evento.returnValue = "";
        };

        const alHacerClic = (evento: MouseEvent) => {
            // Un clic con modificadores (nueva pestaña) o con otro botón no saca de la página.
            if (evento.defaultPrevented || evento.button !== 0) return;
            if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
            const enlace = (evento.target as Element | null)?.closest?.<HTMLAnchorElement>('a[href^="/"]');
            if (!enlace || enlace.closest("form") || enlace.hasAttribute("download")) return;
            if (enlace.target && enlace.target !== "_self") return;
            // Solo rutas de este mismo sitio ("//otro.sitio" también empieza por "/").
            const destino = new URL(enlace.href);
            if (destino.origin !== window.location.origin) return;

            evento.preventDefault();
            setSalidaPendiente(destino.pathname + destino.search + destino.hash);
        };

        window.addEventListener("beforeunload", antesDeSalir);
        document.addEventListener("click", alHacerClic, true);
        return () => {
            window.removeEventListener("beforeunload", antesDeSalir);
            document.removeEventListener("click", alHacerClic, true);
        };
    }, [sucio]);

    const confirmarSalida = () => {
        const destino = salidaPendiente;
        setSalidaPendiente(null);
        if (destino) router.push(destino);
    };

    const cancelarSalida = () => setSalidaPendiente(null);

    return { salidaPendiente, confirmarSalida, cancelarSalida };
}
