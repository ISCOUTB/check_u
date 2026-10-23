"use client";

import { useState } from "react";
import { documentosRequeridos, type DocumentoDelFormulario } from "@/app/estudiante/documentos-requeridos";
import { tamanoMaximoPdfBytes } from "../api";
import type { DocumentoCargado } from "../tipos";
import { idDocumento, validarPdf, type Progreso } from "../validacion";
import ZonaDocumento from "../ZonaDocumento";
import styles from "../iniciar_preinscripcion.module.css";
import { Seccion, type PropsSeccion } from "./comun";

/** Tamaño máximo de un PDF (NEXT_PUBLIC_TAMANO_MAXIMO_PDF_MB), o null: sin límite en el cliente. */
const MAXIMO_PDF = tamanoMaximoPdfBytes();

/**
 * Los documentos que pide el nivel, una zona de carga por cada uno, con el contador arriba.
 * En pregrado, el segundo programa agrega el segundo comprobante de la estampilla.
 *
 * Un archivo rechazado (no es PDF, está vacío o pesa de más) no se carga: su zona muestra el
 * error. Del archivo aceptado se guarda solo `{ id, nombre, tamano }`, nunca el contenido.
 */
export default function Documentos({ borrador, cambiar, errores, progreso }: PropsSeccion & { progreso: Progreso }) {
    // El último archivo rechazado de cada zona; se borra al cargar uno que sirva.
    const [rechazos, setRechazos] = useState<Record<string, string>>({});
    // Lo que pasó con la última carga, para el lector de pantalla (WCAG 4.1.3): el foco sigue en el input.
    const [aviso, setAviso] = useState("");

    const documentos = documentosRequeridos(borrador.nivel, borrador.segundoPrograma === true);
    const { cargados, requeridos } = progreso.documentos;

    const cargar = (documento: DocumentoDelFormulario, archivo: File) => {
        const rechazo = validarPdf(archivo, MAXIMO_PDF);
        setRechazos((actual) => ({ ...actual, [documento.id]: rechazo ?? "" }));
        if (rechazo) {
            setAviso(`${documento.etiqueta}: ${rechazo}`);
            return;
        }
        const cargado: DocumentoCargado = { id: documento.id, nombre: archivo.name, tamano: archivo.size };
        cambiar((b) => ({ ...b, documentos: { ...b.documentos, [documento.id]: cargado } }));
        setAviso(`${documento.etiqueta}: ${archivo.name} cargado.`);
    };

    const quitar = (documento: DocumentoDelFormulario) => {
        cambiar((b) => {
            const restantes = { ...b.documentos };
            delete restantes[documento.id];
            return { ...b, documentos: restantes };
        });
        setAviso(`${documento.etiqueta}: archivo quitado.`);
    };

    return (
        <Seccion id="documentos" descripcion="Cada documento va en su propio archivo PDF.">
            <p className={styles.contador}>
                {cargados} de {requeridos} documentos cargados
            </p>
            <ul className={styles.zonas}>
                {documentos.map((documento) => (
                    <ZonaDocumento
                        key={documento.id}
                        documento={documento}
                        cargado={borrador.documentos[documento.id]}
                        error={rechazos[documento.id] || errores[idDocumento(documento.id)]}
                        alCargar={(archivo) => cargar(documento, archivo)}
                        alQuitar={() => quitar(documento)}
                    />
                ))}
            </ul>
            {/* Siempre montada, para que el lector anuncie el cambio. Sin role: no choca con role="status". */}
            <p className="solo-lector" aria-live="polite">
                {aviso}
            </p>
        </Seccion>
    );
}
