"use client";

import { useState } from "react";
import Button from "@/app/components/ui/Button";
import Dialog from "@/app/components/ui/Dialog";
import Icono from "@/app/components/ui/Icono";
import StatusBadge, { type EstadoVisible } from "@/app/components/ui/StatusBadge";
import styles from "./DocumentAnalysis.module.css";

export interface ExtractedField {
    label: string;
    value: string;
    source?: string;
}

export interface ValidationResult {
    description: string;
    result: boolean;
    detail?: string;
}

export interface DocumentAnalysisData {
    documentType: string;
    fileName: string;
    status: "VALIDO" | "NO_VALIDO" | "INCONSISTENTE" | "POR_REVISAR";
    extractedFields: ExtractedField[];
    validations: ValidationResult[];
    documentUrl?: string;
}

interface DocumentAnalysisProps {
    open: boolean;
    onClose: () => void;
    data?: DocumentAnalysisData | null;
}

const ESTADO: Record<DocumentAnalysisData["status"], EstadoVisible> = {
    VALIDO: "valido",
    NO_VALIDO: "no_valido",
    INCONSISTENTE: "inconsistente",
    POR_REVISAR: "por_revisar",
};

/**
 * Análisis automático de un documento, en un diálogo modal. Conserva el último documento mientras
 * se cierra, para que el diálogo pueda devolver el foco al botón que lo abrió.
 */
export default function DocumentAnalysis({ open, onClose, data }: DocumentAnalysisProps) {
    const [ultimo, setUltimo] = useState<DocumentAnalysisData | null>(data ?? null);
    if (data && data !== ultimo) setUltimo(data);
    const actual = data ?? ultimo;

    if (!actual) return null;

    return (
        <Dialog
            abierto={open && !!data}
            alCerrar={onClose}
            etiqueta="Análisis automático"
            titulo={actual.documentType}
            descripcion={actual.fileName}
        >
            <div className={styles.contenido}>
                <section className={styles.panelDocumento} aria-labelledby="analisis-vista">
                    <h3 id="analisis-vista" className={styles.tituloSeccion}>
                        Vista del documento
                    </h3>
                    <div className={styles.vistaPrevia} aria-hidden="true">
                        <div className={styles.pagina}>
                            <p className={styles.membrete}>
                                UNIVERSIDAD TECNOLÓGICA <strong>DE BOLÍVAR</strong>
                            </p>
                            <span className={styles.linea} />
                            <p className={styles.tituloPagina}>RESULTADOS DE LA PRUEBA</p>
                            <dl className={styles.filasPagina}>
                                <dt>Nombre</dt>
                                <dd>Juan Pérez Gómez</dd>
                                <dt>Identificación</dt>
                                <dd>1000123456</dd>
                                <dt>Puntaje global</dt>
                                <dd>287</dd>
                                <dt>Número de registro</dt>
                                <dd>123456789</dd>
                                <dt>Fecha de aplicación</dt>
                                <dd>15/09/2025</dd>
                            </dl>
                        </div>
                    </div>
                    {actual.documentUrl && (
                        <Button
                            variante="secundario"
                            onClick={() => window.open(actual.documentUrl, "_blank", "noopener")}
                        >
                            Ver documento original
                        </Button>
                    )}
                </section>

                <div className={styles.panelAnalisis}>
                    <section aria-labelledby="analisis-extraccion">
                        <h3 id="analisis-extraccion" className={styles.tituloSeccion}>
                            Información identificada
                        </h3>
                        <dl className={styles.campos}>
                            {actual.extractedFields.map((campo, indice) => (
                                <div key={`${campo.label}-${indice}`} className={styles.campo}>
                                    <dt>{campo.label}</dt>
                                    <dd className={styles.valor}>{campo.value}</dd>
                                    {campo.source && <dd className={styles.fuente}>Fuente: {campo.source}</dd>}
                                </div>
                            ))}
                        </dl>
                    </section>

                    <section aria-labelledby="analisis-reglas">
                        <h3 id="analisis-reglas" className={styles.tituloSeccion}>
                            Reglas aplicadas
                        </h3>
                        <ul className={styles.reglas}>
                            {actual.validations.map((regla, indice) => (
                                <li
                                    key={`${regla.description}-${indice}`}
                                    className={styles.regla}
                                    data-cumple={regla.result}
                                >
                                    <span className={styles.reglaIcono}>
                                        <Icono nombre={regla.result ? "valido" : "no_valido"} />
                                    </span>
                                    <div>
                                        <p className={styles.reglaTitulo}>
                                            {regla.description}
                                            <span className={styles.reglaResultado}>
                                                {regla.result ? "Cumple" : "No cumple"}
                                            </span>
                                        </p>
                                        {regla.detail && <p className={styles.reglaDetalle}>{regla.detail}</p>}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <div className={styles.resultado}>
                        <p>Resultado del análisis</p>
                        <StatusBadge estado={ESTADO[actual.status]} />
                    </div>
                </div>
            </div>

            <p className={styles.nota}>
                <strong>Análisis generado automáticamente por CheckU.</strong> La decisión final puede requerir
                revisión del funcionario.
            </p>
        </Dialog>
    );
}
