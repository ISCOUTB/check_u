"use client";

import { useRef } from "react";
import Button from "@/app/components/ui/Button";
import Icono from "@/app/components/ui/Icono";
import type { DocumentoDelFormulario } from "@/app/estudiante/documentos-requeridos";
import type { DocumentoCargado } from "./tipos";
import { idDocumento } from "./validacion";
import styles from "./ZonaDocumento.module.css";

export interface ZonaDocumentoProps {
    documento: DocumentoDelFormulario;
    /** El PDF ya cargado (solo sus metadatos), si lo hay */
    cargado?: DocumentoCargado;
    /** El archivo rechazado o el documento que falta al enviar */
    error?: string;
    alCargar: (archivo: File) => void;
    alQuitar: () => void;
}

const FORMATO_TAMANO = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

/** "240 KB" o "1,2 MB". */
function formatearTamano(bytes: number): string {
    const kilos = bytes / 1024;
    if (kilos < 1024) return `${FORMATO_TAMANO.format(Math.max(1, Math.round(kilos)))} KB`;
    return `${FORMATO_TAMANO.format(kilos / 1024)} MB`;
}

/**
 * La carga de un PDF: un <input type="file"> real, con el id que usa el resumen de errores
 * (`idDocumento`). Se ve como un botón ("Seleccionar PDF"): el input va dentro de su <label>,
 * invisible pero enfocable, así que funciona con el teclado (Tab y Espacio). Su nombre es el del
 * documento más la acción.
 *
 * Del archivo solo se usan su nombre, su tipo y su tamaño: el contenido nunca se lee, y el input
 * se vacía en cuanto se elige, para no quedarse con él.
 */
export default function ZonaDocumento({ documento, cargado, error, alCargar, alQuitar }: ZonaDocumentoProps) {
    const entradaRef = useRef<HTMLInputElement>(null);
    const id = idDocumento(documento.id);
    const idEstado = `${id}-estado`;
    const idError = `${id}-error`;
    const estado = error ? "error" : cargado ? "cargado" : "vacio";

    return (
        <li className={styles.zona} data-estado={estado}>
            <span className={styles.icono}>
                <Icono nombre={error ? "no_valido" : cargado ? "valido" : "falta_cargar"} tamano={20} />
            </span>

            <div className={styles.texto}>
                <label htmlFor={id} className={styles.nombre}>
                    {documento.etiqueta}
                    <span className={styles.obligatorio}> (obligatorio)</span>
                </label>
                <p id={idEstado} className={styles.estado}>
                    {cargado ? (
                        <>
                            <span className={styles.archivo}>{cargado.nombre}</span>
                            <span className={styles.tamano}> · {formatearTamano(cargado.tamano)}</span>
                        </>
                    ) : (
                        "Sin cargar"
                    )}
                </p>
                {error && (
                    <p id={idError} className={styles.error}>
                        {error}
                    </p>
                )}
            </div>

            <div className={styles.acciones}>
                <label className={styles.seleccionar}>
                    <input
                        ref={entradaRef}
                        type="file"
                        id={id}
                        accept="application/pdf,.pdf"
                        className={styles.entrada}
                        required={!cargado}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? `${idEstado} ${idError}` : idEstado}
                        onChange={(evento) => {
                            const archivo = evento.target.files?.[0];
                            evento.target.value = "";
                            if (archivo) alCargar(archivo);
                        }}
                    />
                    {cargado ? "Cambiar PDF" : "Seleccionar PDF"}
                </label>
                {cargado && (
                    <Button
                        variante="sutil"
                        className={styles.quitar}
                        onClick={() => {
                            alQuitar();
                            // El botón desaparece: el foco vuelve a la carga del mismo documento.
                            entradaRef.current?.focus();
                        }}
                    >
                        Quitar<span className="solo-lector"> {documento.etiqueta}</span>
                    </Button>
                )}
            </div>
        </li>
    );
}
