"use client";

import { useRef, useState } from "react";
import { DOCUMENTOS_REQUERIDOS as documentosRequeridos, type DocumentoDelFormulario, type NivelAcademico } from "@/app/estudiante/documentos-requeridos";
import { tamanoMaximoPdfBytes } from "../api";
import type { DocumentoCargado } from "../tipos";
import {
    idDocumento,
    MENSAJE_NO_ES_PDF,
    tieneFirmaPdf,
    validarPdf,
    type Progreso,
} from "../validacion";
import ZonaDocumento from "../ZonaDocumento";
import styles from "../iniciar_preinscripcion.module.css";
import { Seccion, type PropsSeccion } from "./comun";

/** Tamaño máximo de un PDF o null si no hay límite configurado. */
const MAXIMO_PDF = tamanoMaximoPdfBytes();

export default function Documentos({
    borrador,
    cambiar,
    errores,
    progreso,
}: PropsSeccion & { progreso: Progreso }) {
    const [rechazos, setRechazos] = useState<Record<string, string>>({});
    const [aviso, setAviso] = useState({ texto: "", vez: 0 });

    const avisar = (texto: string) =>
        setAviso((anterior) => ({
            texto,
            vez: anterior.vez + 1,
        }));

    const nivel: NivelAcademico =
        borrador.nivel.toUpperCase() as NivelAcademico;

    const documentosBase: DocumentoDelFormulario[] =
        documentosRequeridos[nivel]
            .filter((documento) => !documento.retirando)
            .map((documento) => ({
                id: documento.tipo,
                etiqueta: documento.nombre,
                nota: documento.nota,
            }));
    // Un segundo programa requiere un segundo comprobante de estampilla.
    const documentos =
        borrador.nivel === "PREGRADO" &&
            borrador.segundoPrograma === true
            ? [
                ...documentosBase,
                {
                    id: "estampilla2",
                    etiqueta: "Segundo comprobante de la estampilla",
                },
            ]
            : documentosBase;

    const { cargados, requeridos } = progreso.documentos;

    // Evita aplicar el resultado de una selección anterior de archivo.
    const elecciones = useRef<Record<string, number>>({});

    const nuevaEleccion = (documento: DocumentoDelFormulario) => {
        elecciones.current[documento.id] =
            (elecciones.current[documento.id] ?? 0) + 1;

        return elecciones.current[documento.id];
    };

    const revisar = async (archivo: File): Promise<string | null> => {
        const rechazo = validarPdf(archivo, MAXIMO_PDF);

        if (rechazo) return rechazo;

        try {
            return (await tieneFirmaPdf(archivo))
                ? null
                : MENSAJE_NO_ES_PDF;
        } catch {
            return "No fue posible leer el archivo. Vuelve a seleccionarlo.";
        }
    };

    const cargar = async (
        documento: DocumentoDelFormulario,
        archivo: File,
    ) => {
        const eleccion = nuevaEleccion(documento);
        const rechazo = await revisar(archivo);

        if (elecciones.current[documento.id] !== eleccion) return;

        setRechazos((actual) => ({
            ...actual,
            [documento.id]: rechazo ?? "",
        }));

        if (rechazo) {
            avisar(`${documento.etiqueta}: ${rechazo}`);
            return;
        }

        const cargado: DocumentoCargado = {
            id: documento.id,
            nombre: archivo.name,
            tamano: archivo.size,
        };

        cambiar((b) => ({
            ...b,
            documentos: {
                ...b.documentos,
                [documento.id]: cargado,
            },
        }));

        avisar(`${documento.etiqueta}: ${archivo.name} cargado.`);
    };

    const quitar = (documento: DocumentoDelFormulario) => {
        nuevaEleccion(documento);

        cambiar((b) => {
            const restantes = { ...b.documentos };
            delete restantes[documento.id];

            return {
                ...b,
                documentos: restantes,
            };
        });

        setRechazos((actual) => ({
            ...actual,
            [documento.id]: "",
        }));

        avisar(`${documento.etiqueta}: archivo quitado.`);
    };

    return (
        <Seccion
            id="documentos"
            descripcion="Cada documento va en su propio archivo PDF."
        >
            <p className={styles.contador}>
                {cargados} de {requeridos} documentos cargados
            </p>

            <ul className={styles.zonas}>
                {documentos.map((documento) => (
                    <ZonaDocumento
                        key={documento.id}
                        documento={documento}
                        cargado={borrador.documentos[documento.id]}
                        error={
                            rechazos[documento.id] ||
                            errores[idDocumento(documento.id)]
                        }
                        alCargar={(archivo) =>
                            void cargar(documento, archivo)
                        }
                        alQuitar={() => quitar(documento)}
                    />
                ))}
            </ul>

            <p className="solo-lector" aria-live="polite">
                <span key={aviso.vez}>{aviso.texto}</span>
            </p>
        </Seccion>
    );
}