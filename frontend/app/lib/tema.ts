"use client";

import { useSyncExternalStore } from "react";

// Tema claro u oscuro. Sin elección guardada se sigue al sistema (prefers-color-scheme); con el
// botón se fija data-tema en <html>, que manda sobre el sistema (ver globals.css), y se recuerda.

export type Tema = "claro" | "oscuro";

const CLAVE = "checku-tema";
const CONSULTA_OSCURO = "(prefers-color-scheme: dark)";

/**
 * Se ejecuta en <head> antes de pintar (layout.tsx): aplica la elección guardada para que la
 * página no aparezca un instante con el tema equivocado.
 */
export const SCRIPT_TEMA = `(function(){try{var t=localStorage.getItem("${CLAVE}");if(t==="claro"||t==="oscuro")document.documentElement.dataset.tema=t}catch(e){}})()`;

export function temaActual(): Tema {
    const elegido = document.documentElement.dataset.tema;
    if (elegido === "claro" || elegido === "oscuro") return elegido;
    return window.matchMedia(CONSULTA_OSCURO).matches ? "oscuro" : "claro";
}

export function aplicarTema(tema: Tema): void {
    document.documentElement.dataset.tema = tema;
    try {
        localStorage.setItem(CLAVE, tema);
    } catch {
        // Sin almacenamiento (modo privado estricto): el tema dura hasta recargar.
    }
}

function suscribir(avisar: () => void): () => void {
    const consulta = window.matchMedia(CONSULTA_OSCURO);
    consulta.addEventListener("change", avisar);
    const observador = new MutationObserver(avisar);
    observador.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema"] });
    return () => {
        consulta.removeEventListener("change", avisar);
        observador.disconnect();
    };
}

/** Tema activo; cambia con el sistema y con el botón. En el servidor se asume claro. */
export function useTema(): Tema {
    return useSyncExternalStore(suscribir, temaActual, () => "claro");
}
