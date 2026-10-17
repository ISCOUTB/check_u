"use client";

import { aplicarTema, useTema } from "@/app/lib/tema";
import Icono from "./Icono";
import styles from "./BotonTema.module.css";

/** Alterna entre claro y oscuro. Botón de alternancia: el nombre no cambia, cambia aria-pressed. */
export default function BotonTema({ className }: { className?: string }) {
    const tema = useTema();
    const oscuro = tema === "oscuro";

    return (
        <button
            type="button"
            className={[styles.boton, className].filter(Boolean).join(" ")}
            aria-pressed={oscuro}
            title={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            onClick={() => aplicarTema(oscuro ? "claro" : "oscuro")}
        >
            <span className="solo-lector">Modo oscuro</span>
            <Icono nombre={oscuro ? "luna" : "sol"} tamano={20} />
        </button>
    );
}
