"use client";

import { useEffect, useId, useState } from "react";
import { flushSync } from "react-dom";
import Icono from "@/app/components/ui/Icono";
import type { Progreso, ProgresoSeccion, SeccionId } from "./validacion";
import styles from "./IndiceProgreso.module.css";

/** "1 sección", "3 documentos"… */
function contar(cantidad: number, singular: string, plural: string): string {
    return `${cantidad} ${cantidad === 1 ? singular : plural}`;
}

/** "Te faltan 2 secciones y 5 documentos", o "Todo listo para enviar". */
export function textoResumen(progreso: Progreso): string {
    if (progreso.listo) return "Todo listo para enviar";
    const { seccionesPendientes, documentosPendientes } = progreso;
    const partes = [];
    if (seccionesPendientes > 0) partes.push(contar(seccionesPendientes, "sección", "secciones"));
    if (documentosPendientes > 0) partes.push(contar(documentosPendientes, "documento", "documentos"));
    const verbo = seccionesPendientes + documentosPendientes === 1 ? "falta" : "faltan";
    return `Te ${verbo} ${partes.join(" y ")}`;
}

type EstadoSeccion = "completa" | "pendiente" | "opcional";

/**
 * Una sección sin campos obligatorios es "opcional": no se marca como completa, porque no hay
 * nada que completar. Las demás están completas cuando no les falta nada.
 */
function estadoDe(seccion: ProgresoSeccion): EstadoSeccion {
    if (seccion.opcional) return "opcional";
    return seccion.faltan === 0 ? "completa" : "pendiente";
}

/** El estado de una sección, en texto: el color solo lo acompaña. */
function textoEstado(seccion: ProgresoSeccion, progreso: Progreso): string {
    if (seccion.id === "documentos") {
        const { cargados, requeridos } = progreso.documentos;
        return `${cargados} de ${requeridos} documentos cargados`;
    }
    if (seccion.opcional) return "Opcional";
    if (seccion.faltan === 0) return "Completa";
    return seccion.faltan === 1 ? "Falta 1 campo" : `Faltan ${seccion.faltan} campos`;
}

/** Alto de la barra superior (`--altura-barra`), para que lo tapado por ella no cuente como visible. */
function altoBarra(): number {
    const valor = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--altura-barra"));
    return Number.isFinite(valor) ? valor : 72;
}

/**
 * Índice de las secciones con su progreso.
 *   - Desde 768 px: columna fija bajo la barra, con el resumen arriba.
 *   - En celular: un botón de divulgación (aria-expanded) con el resumen, que despliega la lista.
 * La sección que se está viendo lleva aria-current="location".
 */
export default function IndiceProgreso({ progreso, secciones }: { progreso: Progreso; secciones: SeccionId[] }) {
    const idLista = useId();
    const [abierto, setAbierto] = useState(false);
    const [actual, setActual] = useState<SeccionId>(secciones[0]);
    const clave = secciones.join(",");

    // La sección actual es la primera que cruza la franja de arriba de la pantalla (bajo la barra).
    // La última no siempre alcanza a subir hasta ahí: cuenta como actual cuando se ve completa.
    useEffect(() => {
        const ids = clave.split(",") as SeccionId[];
        const elementos = ids
            .map((id) => document.getElementById(`seccion-${id}`))
            .filter((elemento): elemento is HTMLElement => elemento !== null);
        if (elementos.length === 0) return;

        const idDe = (elemento: Element) => elemento.id.replace("seccion-", "") as SeccionId;
        const enFranja = new Set<SeccionId>();
        let ultimaCompleta = false;

        const elegir = () => {
            if (ultimaCompleta) return setActual(ids[ids.length - 1]);
            const primera = ids.find((id) => enFranja.has(id));
            if (primera) return setActual(primera);
            // Arriba del todo ninguna sección entra en la franja (el encabezado la deja abajo):
            // la sección que se está viendo es la primera.
            if (window.scrollY <= 1) setActual(ids[0]);
        };

        const franja = new IntersectionObserver(
            (entradas) => {
                for (const entrada of entradas) {
                    if (entrada.isIntersecting) enFranja.add(idDe(entrada.target));
                    else enFranja.delete(idDe(entrada.target));
                }
                elegir();
            },
            { rootMargin: `-${altoBarra() + 16}px 0px -55% 0px` },
        );
        const final = new IntersectionObserver(
            ([entrada]) => {
                ultimaCompleta = entrada.intersectionRatio >= 0.99;
                elegir();
            },
            { threshold: [0, 1] },
        );

        elementos.forEach((elemento) => franja.observe(elemento));
        final.observe(elementos[elementos.length - 1]);
        return () => {
            franja.disconnect();
            final.disconnect();
        };
    }, [clave]);

    const resumen = textoResumen(progreso);
    const porId = new Map(progreso.secciones.map((seccion) => [seccion.id, seccion]));

    return (
        <nav aria-label="Secciones del formulario" className={styles.indice}>
            <button
                type="button"
                className={styles.indiceBoton}
                aria-expanded={abierto}
                aria-controls={idLista}
                onClick={() => setAbierto((valor) => !valor)}
            >
                <span className={styles.indiceBotonResumen} data-listo={progreso.listo}>
                    {progreso.listo && <Icono nombre="valido" tamano={16} />}
                    {resumen}
                </span>
                <span className={styles.indiceFlecha} data-abierto={abierto}>
                    <Icono nombre="flecha_abajo" tamano={18} />
                </span>
            </button>

            <p className={styles.indiceResumen} data-listo={progreso.listo}>
                {progreso.listo && <Icono nombre="valido" tamano={16} />}
                {resumen}
            </p>

            <ol id={idLista} className={styles.indiceLista} data-abierta={abierto}>
                {secciones.map((id) => {
                    const seccion = porId.get(id);
                    if (!seccion) return null;
                    const estado = estadoDe(seccion);
                    return (
                        <li key={id}>
                            <a
                                href={`#seccion-${id}`}
                                className={styles.indiceEnlace}
                                data-estado={estado}
                                aria-current={actual === id ? "location" : undefined}
                                onClick={() => {
                                    // Se cierra antes de saltar, para que el salto caiga en su sitio.
                                    flushSync(() => setAbierto(false));
                                    setActual(id);
                                }}
                            >
                                <span className={styles.indiceMarca}>
                                    {estado === "completa" && <Icono nombre="valido" tamano={14} />}
                                </span>
                                <span className={styles.indiceTexto}>
                                    <span className={styles.indiceTitulo}>{seccion.titulo}</span>
                                    <span className="solo-lector">, </span>
                                    <span className={styles.indiceEstado}>{textoEstado(seccion, progreso)}</span>
                                </span>
                            </a>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
