"use client";

import { useEffect } from "react";
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

export default function DocumentAnalysis({
    open,
    onClose,
    data,
}: DocumentAnalysisProps) {

    useEffect(() => {
        if (!open) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        // Ahora `document` es el global del navegador
        document.addEventListener("keydown", handleEscape);

        return () => {
            document.removeEventListener("keydown", handleEscape);
        };
    }, [open, onClose]);

    if (!open || !data) {
        return null;
    }

    const statusClass = {
        VALIDO: styles.statusValid,
        NO_VALIDO: styles.statusInvalid,
        INCONSISTENTE: styles.statusInconsistent,
        POR_REVISAR: styles.statusReview,
    }[data.status];

    const statusLabel = {
        VALIDO: "Válido",
        NO_VALIDO: "No válido",
        INCONSISTENTE: "Inconsistente",
        POR_REVISAR: "Por revisar",
    }[data.status];

    return (
        <div
            className={styles.overlay}
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <section
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby="document-analysis-title"
            >
                <header className={styles.header}>
                    <div className={styles.headerInfo}>
                        <span className={styles.eyebrow}>
                            Análisis automático
                        </span>

                        <h2 id="document-analysis-title">
                            {data.documentType}
                        </h2>

                        <p>{data.fileName}</p>
                    </div>

                    <button
                        type="button"
                        className={styles.closeButton}
                        onClick={onClose}
                        aria-label="Cerrar análisis"
                    >
                        ×
                    </button>
                </header>

                <div className={styles.content}>
                    {/* DOCUMENTO */}
                    <div className={styles.documentPanel}>
                        <div className={styles.panelHeader}>
                            <div>
                                <span className={styles.panelEyebrow}>
                                    Documento
                                </span>

                                <h3>Vista del documento</h3>
                            </div>
                        </div>

                        <div className={styles.documentPreview}>
                            <div className={styles.documentPage}>
                                <div className={styles.fakeDocumentHeader}>
                                    <span>UNIVERSIDAD TECNOLÓGICA</span>
                                    <strong>DE BOLÍVAR</strong>
                                </div>

                                <div className={styles.fakeDocumentLine} />

                                <div className={styles.fakeDocumentTitle}>
                                    RESULTADOS DE LA PRUEBA
                                </div>

                                <div className={styles.fakeDocumentRows}>
                                    <div>
                                        <span>Nombre</span>
                                        <strong>Juan Pérez Gómez</strong>
                                    </div>

                                    <div>
                                        <span>Identificación</span>
                                        <strong>1000123456</strong>
                                    </div>

                                    <div>
                                        <span>Puntaje global</span>
                                        <strong>287</strong>
                                    </div>

                                    <div>
                                        <span>Número de registro</span>
                                        <strong>123456789</strong>
                                    </div>

                                    <div>
                                        <span>Fecha de aplicación</span>
                                        <strong>15/09/2025</strong>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {data.documentUrl && (
                            <button
                                type="button"
                                className={styles.originalButton}
                                onClick={() => {
                                    window.open(data.documentUrl, "_blank");
                                }}
                            >
                                Ver documento original
                            </button>
                        )}
                    </div>

                    {/* INFORMACIÓN EXTRAÍDA */}
                    <div className={styles.analysisPanel}>
                        <div className={styles.section}>
                            <div className={styles.sectionTitle}>
                                <span className={styles.sectionIcon}>01</span>

                                <div>
                                    <span>Extracción</span>
                                    <h3>Información identificada</h3>
                                </div>
                            </div>

                            <div className={styles.fields}>
                                {data.extractedFields.map((field, index) => (
                                    <div
                                        className={styles.field}
                                        key={`${field.label}-${index}`}
                                    >
                                        <span className={styles.fieldLabel}>
                                            {field.label}
                                        </span>

                                        <strong className={styles.fieldValue}>
                                            {field.value}
                                        </strong>

                                        {field.source && (
                                            <span className={styles.fieldSource}>
                                                Fuente: {field.source}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* VALIDACIONES */}
                        <div className={styles.section}>
                            <div className={styles.sectionTitle}>
                                <span className={styles.sectionIcon}>02</span>

                                <div>
                                    <span>Validación</span>
                                    <h3>Reglas aplicadas</h3>
                                </div>
                            </div>

                            <div className={styles.validations}>
                                {data.validations.map((validation, index) => (
                                    <div
                                        className={`${styles.validation} ${
                                            validation.result
                                                ? styles.validationSuccess
                                                : styles.validationError
                                        }`}
                                        key={`${validation.description}-${index}`}
                                    >
                                        <div className={styles.validationIcon}>
                                            {validation.result ? "✓" : "!"}
                                        </div>

                                        <div>
                                            <strong>
                                                {validation.description}
                                            </strong>

                                            {validation.detail && (
                                                <p>{validation.detail}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* RESULTADO */}
                        <div className={styles.resultSection}>
                            <div>
                                <span className={styles.resultLabel}>
                                    Resultado del análisis
                                </span>

                                <strong>{statusLabel}</strong>
                            </div>

                            <span className={`${styles.status} ${statusClass}`}>
                                {statusLabel}
                            </span>
                        </div>
                    </div>
                </div>

                <footer className={styles.footer}>
                    <span>Análisis generado automáticamente por CheckU</span>

                    <span>
                        La decisión final puede requerir revisión del funcionario.
                    </span>
                </footer>
            </section>
        </div>
    );
}