"use client";

import { useState } from "react";

import Navbar from "../../../components/navbar/Navbar";

import DocumentAnalysis, {
    DocumentAnalysisData,
} from "@/app/components/document_analysis/DocumentAnalysis";

import "./detalle.css";

type EstadoDocumento =
    | "Válido"
    | "No válido"
    | "Inconsistente"
    | "Por revisar";

type TipoPrograma = "PREGRADO" | "POSGRADO";

interface Documento {
    id: string;
    nombre: string;
    descripcion: string;
    estado: EstadoDocumento;
    mensaje: string;
    obligatorio: boolean;
}

const estudiante = {
    codigo: "T00012345",
    tipoDocumento: "Cédula de ciudadanía",
    numeroDocumento: "1.234.567.890",
    nombre: "Juan David Pérez Rodríguez",
    programa: "Ingeniería de Sistemas y Computación",
    nivel: "PREGRADO" as TipoPrograma,
    facultad: "Facultad de Ingeniería",
    direccion: "Carrera 10 # 25-40",
    telefono: "300 123 4567",
    correo: "juan.perez@utb.edu.co",
    ciudad: "Cartagena de Indias",
    fechaSolicitud: "7 de octubre de 2026",
};

const documentos: Documento[] = [
    {
        id: "cedula",
        nombre: "Cédula de ciudadanía",
        descripcion: "Documento de identificación del estudiante",
        estado: "Válido",
        mensaje:
            "El documento suministrado parece auténtico con un nivel de confianza del 98%.",
        obligatorio: true,
    },
    {
        id: "banner",
        nombre: "Evaluación de Grado expedida por Banner",
        descripcion: "Evaluación de grado generada por el sistema académico",
        estado: "Válido",
        mensaje: "Cumples con los requisitos académicos establecidos.",
        obligatorio: true,
    },
    {
        id: "estampilla",
        nombre: "Comprobante de pago de estampilla Pro-Cultura",
        descripcion: "Comprobante de pago correspondiente a la estampilla",
        estado: "Inconsistente",
        mensaje:
            "La información del comprobante no coincide con la información suministrada.",
        obligatorio: true,
    },
    {
        id: "biblioteca",
        nombre: "Paz y Salvo de Biblioteca",
        descripcion:
            "Certificado de paz y salvo expedido por la Biblioteca",
        estado: "Válido",
        mensaje:
            "Se verificó correctamente la firma electrónica del documento.",
        obligatorio: true,
    },
    {
        id: "saber-pro",
        nombre: "Resultados de las Pruebas Saber Pro",
        descripcion: "Resultados de las pruebas de Estado",
        estado: "Válido",
        mensaje:
            "Cumples con el requisito mínimo de 100 puntos establecido.",
        obligatorio: true,
    },
];

const informacionAdicional = [
    {
        label: "Facultad",
        value: estudiante.facultad,
    },
    {
        label: "Nivel académico",
        value: estudiante.nivel,
    },
    {
        label: "Ciudad",
        value: estudiante.ciudad,
    },
    {
        label: "Fecha de solicitud",
        value: estudiante.fechaSolicitud,
    },
];

/* ========================================================= */
/* DATASET FICTICIO DEL ANÁLISIS AUTOMÁTICO                  */
/* ========================================================= */

/*
 * IMPORTANTE:
 *
 * Este objeto solamente simula la respuesta que posteriormente
 * entregará el backend.
 *
 * Cuando exista la API, esta información NO debe permanecer aquí.
 *
 * El flujo será:
 *
 * Backend
 *    ↓
 * servicio / fetch
 *    ↓
 * DocumentAnalysisData
 *    ↓
 * DocumentAnalysis
 */

const documentAnalysisMock: Record<
    string,
    DocumentAnalysisData
> = {
    cedula: {
        documentType: "Cédula de ciudadanía",
        fileName: "cedula_1000123456.pdf",
        status: "VALIDO",

        extractedFields: [
            {
                label: "Nombre completo",
                value: "Juan David Pérez Rodríguez",
                source: "Página 1 · OCR",
            },
            {
                label: "Número de documento",
                value: "1.234.567.890",
                source: "Página 1 · OCR",
            },
            {
                label: "Tipo de documento",
                value: "Cédula de ciudadanía",
                source: "Página 1 · OCR",
            },
            {
                label: "Fecha de nacimiento",
                value: "12/03/2004",
                source: "Página 1 · OCR",
            },
        ],

        validations: [
            {
                description:
                    "El documento corresponde a una cédula de ciudadanía",
                result: true,
                detail:
                    "La estructura y los elementos identificados corresponden al tipo de documento esperado.",
            },
            {
                description:
                    "La identificación coincide con la solicitud",
                result: true,
                detail:
                    "Documento extraído: 1.234.567.890.",
            },
            {
                description:
                    "El nombre coincide con la información registrada",
                result: true,
                detail:
                    "Juan David Pérez Rodríguez.",
            },
        ],
    },

    banner: {
        documentType:
            "Evaluación de Grado expedida por Banner",
        fileName: "evaluacion_grado_banner.pdf",
        status: "VALIDO",

        extractedFields: [
            {
                label: "Código estudiantil",
                value: "T00012345",
                source: "Página 1 · OCR",
            },
            {
                label: "Nombre del estudiante",
                value: "Juan David Pérez Rodríguez",
                source: "Página 1 · OCR",
            },
            {
                label: "Programa académico",
                value:
                    "Ingeniería de Sistemas y Computación",
                source: "Página 1 · OCR",
            },
            {
                label: "Estado académico",
                value: "Cumple",
                source: "Página 1 · OCR",
            },
        ],

        validations: [
            {
                description:
                    "El documento corresponde a una evaluación de grado",
                result: true,
                detail:
                    "Se identificaron los campos esperados para el documento.",
            },
            {
                description:
                    "El código estudiantil coincide",
                result: true,
                detail:
                    "Código encontrado: T00012345.",
            },
            {
                description:
                    "El estado académico permite continuar",
                result: true,
                detail:
                    "El documento indica que el estudiante cumple.",
            },
        ],
    },

    estampilla: {
        documentType:
            "Comprobante de pago de estampilla Pro-Cultura",
        fileName: "estampilla_pro_cultura.pdf",
        status: "INCONSISTENTE",

        extractedFields: [
            {
                label: "Nombre",
                value: "Juan David Pérez Rodríguez",
                source: "Página 1 · OCR",
            },
            {
                label: "Número de identificación",
                value: "1.234.567.890",
                source: "Página 1 · OCR",
            },
            {
                label: "Valor pagado",
                value: "$85.000",
                source: "Página 1 · OCR",
            },
            {
                label: "Referencia de pago",
                value: "PC-2026-009845",
                source: "Página 1 · OCR",
            },
        ],

        validations: [
            {
                description:
                    "El documento corresponde a un comprobante de pago",
                result: true,
                detail:
                    "Se identificó la estructura de un comprobante.",
            },
            {
                description:
                    "La identificación coincide con la solicitud",
                result: true,
                detail:
                    "Documento extraído: 1.234.567.890.",
            },
            {
                description:
                    "La referencia del pago presenta inconsistencias",
                result: false,
                detail:
                    "La referencia encontrada requiere revisión.",
            },
        ],
    },

    biblioteca: {
        documentType: "Paz y Salvo de Biblioteca",
        fileName: "paz_salvo_biblioteca.pdf",
        status: "VALIDO",

        extractedFields: [
            {
                label: "Nombre del estudiante",
                value: "Juan David Pérez Rodríguez",
                source: "Página 1 · OCR",
            },
            {
                label: "Código estudiantil",
                value: "T00012345",
                source: "Página 1 · OCR",
            },
            {
                label: "Estado",
                value: "Paz y salvo",
                source: "Página 1 · OCR",
            },
            {
                label: "Firma electrónica",
                value: "Verificada",
                source: "Metadatos del documento",
            },
        ],

        validations: [
            {
                description:
                    "El documento corresponde a un paz y salvo",
                result: true,
                detail:
                    "Se identificaron los elementos requeridos.",
            },
            {
                description:
                    "El código estudiantil coincide",
                result: true,
                detail:
                    "Código encontrado: T00012345.",
            },
            {
                description:
                    "La firma electrónica fue verificada",
                result: true,
                detail:
                    "La firma del documento fue validada correctamente.",
            },
        ],
    },

    "saber-pro": {
        documentType: "Resultados de las Pruebas Saber Pro",
        fileName: "resultado_saber_pro_1000123456.pdf",
        status: "VALIDO",

        extractedFields: [
            {
                label: "Nombre del estudiante",
                value: "Juan David Pérez Rodríguez",
                source: "Página 1 · OCR",
            },
            {
                label: "Identificación",
                value: "1.234.567.890",
                source: "Página 1 · OCR",
            },
            {
                label: "Puntaje global",
                value: "287",
                source: "Página 1 · OCR",
            },
            {
                label: "Número de registro",
                value: "123456789",
                source: "Página 1 · OCR",
            },
            {
                label: "Fecha de aplicación",
                value: "15/09/2025",
                source: "Página 1 · OCR",
            },
        ],

        validations: [
            {
                description:
                    "El documento corresponde a una prueba Saber Pro",
                result: true,
                detail:
                    "Se identificó correctamente el tipo de resultado.",
            },
            {
                description:
                    "La identificación coincide con la solicitud",
                result: true,
                detail:
                    "Identificación encontrada: 1.234.567.890.",
            },
            {
                description:
                    "El puntaje cumple el mínimo requerido",
                result: true,
                detail:
                    "Puntaje obtenido: 287. Mínimo requerido: 100.",
            },
            {
                description:
                    "Los datos obligatorios fueron encontrados",
                result: true,
                detail:
                    "Todos los campos requeridos fueron identificados.",
            },
        ],
    },
};

export default function DetallePreinscripcionPage() {

    const [pestana, setPestana] = useState("resumen");

    /* ========================================================= */
    /* ESTADO DEL MÓDULO DE ANÁLISIS                             */
    /* ========================================================= */

    const [analysisOpen, setAnalysisOpen] = useState(false);

    const [selectedDocument, setSelectedDocument] =
        useState<DocumentAnalysisData | null>(null);

    const documentosConProblemas = documentos.filter(
        (documento) => documento.estado !== "Válido"
    );

    const documentosValidos = documentos.filter(
        (documento) => documento.estado === "Válido"
    );

    const estadoGeneral =
        documentos.some(
            (documento) => documento.estado === "Por revisar"
        )
            ? "Por revisar"
            : documentos.some(
                (documento) =>
                    documento.estado === "No válido" ||
                    documento.estado === "Inconsistente"
            )
                ? "Se requiere corregir documentos"
                : "Preinscripción lista para continuar";

    /* ========================================================= */
    /* ABRIR ANÁLISIS AUTOMÁTICO                                 */
    /* ========================================================= */

    const handleOpenAnalysis = (
        documento: Documento
    ) => {

        /*
         * ACTUALMENTE:
         * Utilizamos el dataset ficticio.
         *
         * FUTURO:
         * Aquí se realizará la solicitud al backend.
         *
         * Ejemplo futuro:
         *
         * const response = await fetch(
         *     `${API_URL}/documentos/${documento.id}/analisis`
         * );
         *
         * const data = await response.json();
         *
         * setSelectedDocument(data);
         */

        const analysis =
            documentAnalysisMock[documento.id];

        if (!analysis) {
            console.warn(
                `No existe análisis ficticio para ${documento.id}`
            );

            return;
        }

        setSelectedDocument(analysis);
        setAnalysisOpen(true);
    };

    /* ========================================================= */
    /* CERRAR ANÁLISIS                                           */
    /* ========================================================= */

    const handleCloseAnalysis = () => {
        setAnalysisOpen(false);
        setSelectedDocument(null);
    };

    return (
        <div className="detalle-page">

            <Navbar
                tipoUsuario="funcionario"
                nombreUsuario="Rosana Marriaga Gonzalez"
            />

            <main className="detalle-container">

                {/* ===================================================== */}
                {/* ENCABEZADO                                             */}
                {/* ===================================================== */}

                <section className="page-header">

                    <div>

                        <div className="breadcrumb">
                            Funcionarios / Preinscripciones / Detalle
                        </div>

                        <div className="title-row">

                            <div>

                                <h1>
                                    Detalle de preinscripción
                                </h1>

                                <p>
                                    Revisión documental de la solicitud
                                    de grado del estudiante.
                                </p>

                            </div>

                            <span className="codigo-badge">
                                {estudiante.codigo}
                            </span>

                        </div>

                    </div>

                </section>

                {/* ===================================================== */}
                {/* IDENTIFICACIÓN DEL ESTUDIANTE                          */}
                {/* ===================================================== */}

                <section className="student-header">

                    <div className="student-avatar">

                        {estudiante.nombre
                            .split(" ")
                            .slice(0, 2)
                            .map((nombre) => nombre[0])
                            .join("")}

                    </div>

                    <div className="student-main-info">

                        <div className="student-name-row">

                            <h2>
                                {estudiante.nombre}
                            </h2>

                            <span
                                className={`program-badge ${
                                    estudiante.nivel === "POSGRADO"
                                        ? "program-postgrado"
                                        : "program-pregrado"
                                }`}
                            >
                                {estudiante.nivel}
                            </span>

                        </div>

                        <p>
                            {estudiante.programa}
                        </p>

                        <div className="student-meta">

                            <span>
                                <strong>
                                    {estudiante.tipoDocumento}:
                                </strong>{" "}
                                {estudiante.numeroDocumento}
                            </span>

                            <span>
                                {estudiante.correo}
                            </span>

                            <span>
                                {estudiante.telefono}
                            </span>

                        </div>

                    </div>

                </section>

                {/* ===================================================== */}
                {/* ESTADO GENERAL                                          */}
                {/* ===================================================== */}

                <section
                    className={`general-status ${
                        estadoGeneral ===
                        "Preinscripción lista para continuar"
                            ? "status-success"
                            : estadoGeneral === "Por revisar"
                                ? "status-review"
                                : "status-warning"
                    }`}
                >

                    <div className="status-icon">

                        {estadoGeneral ===
                        "Preinscripción lista para continuar"
                            ? "✓"
                            : estadoGeneral === "Por revisar"
                                ? "?"
                                : "!"}

                    </div>

                    <div className="status-content">

                        <span className="status-label">
                            Estado general
                        </span>

                        <h2>
                            {estadoGeneral}
                        </h2>

                        {documentosConProblemas.length > 0 ? (
                            <p>
                                {documentosConProblemas.length} documento
                                {documentosConProblemas.length !== 1
                                    ? "s requieren"
                                    : " requiere"}{" "}
                                atención antes de continuar con el proceso.
                            </p>
                        ) : (
                            <p>
                                Todos los documentos requeridos fueron
                                validados correctamente.
                            </p>
                        )}

                    </div>

                </section>

                {/* ===================================================== */}
                {/* PESTAÑAS                                                */}
                {/* ===================================================== */}

                <nav className="detail-tabs">

                    <button
                        className={
                            pestana === "resumen"
                                ? "active"
                                : ""
                        }
                        onClick={() =>
                            setPestana("resumen")
                        }
                    >
                        Resumen documental
                    </button>

                    <button
                        className={
                            pestana === "estudiante"
                                ? "active"
                                : ""
                        }
                        onClick={() =>
                            setPestana("estudiante")
                        }
                    >
                        Información del estudiante
                    </button>

                    <button
                        className={
                            pestana === "documentos"
                                ? "active"
                                : ""
                        }
                        onClick={() =>
                            setPestana("documentos")
                        }
                    >
                        Documentos
                    </button>

                </nav>

                {/* ===================================================== */}
                {/* RESUMEN DOCUMENTAL                                      */}
                {/* ===================================================== */}

                {pestana === "resumen" && (

                    <section className="tab-content">

                        <div className="section-heading">

                            <div>

                                <h2>
                                    Resumen documental
                                </h2>

                                <p>
                                    Resultado general del análisis
                                    automático de los documentos
                                    suministrados.
                                </p>

                            </div>

                        </div>

                        <div className="metrics-grid">

                            <div className="metric-card">

                                <span className="metric-title">
                                    Documentos analizados
                                </span>

                                <strong>
                                    {documentos.length}
                                </strong>

                                <span className="metric-description">
                                    Documentos requeridos
                                </span>

                            </div>

                            <div className="metric-card metric-success">

                                <span className="metric-title">
                                    Válidos
                                </span>

                                <strong>
                                    {documentosValidos.length}
                                </strong>

                                <span className="metric-description">
                                    Sin novedades
                                </span>

                            </div>

                            <div className="metric-card metric-danger">

                                <span className="metric-title">
                                    Requieren atención
                                </span>

                                <strong>
                                    {documentosConProblemas.length}
                                </strong>

                                <span className="metric-description">
                                    Con alertas
                                </span>

                            </div>

                            <div className="metric-card">

                                <span className="metric-title">
                                    Nivel académico
                                </span>

                                <strong>
                                    {estudiante.nivel}
                                </strong>

                                <span className="metric-description">
                                    Tipo de solicitud
                                </span>

                            </div>

                        </div>

                        {documentosConProblemas.length > 0 && (

                            <div className="content-block">

                                <div className="block-header">

                                    <div>

                                        <h3>
                                            Alertas
                                        </h3>

                                        <p>
                                            Documentos que requieren
                                            revisión o corrección.
                                        </p>

                                    </div>

                                    <span className="alert-count">
                                        {documentosConProblemas.length}
                                    </span>

                                </div>

                                <div className="alerts-list">

                                    {documentosConProblemas.map(
                                        (documento) => (

                                            <div
                                                className="alert-item"
                                                key={documento.id}
                                            >

                                                <div
                                                    className={`alert-status-icon ${getStatusClass(
                                                        documento.estado
                                                    )}`}
                                                >
                                                    !
                                                </div>

                                                <div className="alert-information">

                                                    <div className="alert-title-row">

                                                        <strong>
                                                            {documento.nombre}
                                                        </strong>

                                                        <StatusBadge
                                                            estado={
                                                                documento.estado
                                                            }
                                                        />

                                                    </div>

                                                    <p>
                                                        {documento.mensaje}
                                                    </p>

                                                </div>

                                                <button
                                                    className="secondary-button"
                                                    onClick={() =>
                                                        setPestana(
                                                            "documentos"
                                                        )
                                                    }
                                                >
                                                    Revisar
                                                </button>

                                            </div>

                                        )
                                    )}

                                </div>

                            </div>

                        )}

                        <div className="content-block">

                            <div className="block-header">

                                <div>

                                    <h3>
                                        Estado de los documentos
                                    </h3>

                                    <p>
                                        Vista rápida del resultado
                                        de cada documento.
                                    </p>

                                </div>

                            </div>

                            <div className="document-summary-list">

                                {documentos.map(
                                    (documento) => (

                                        <div
                                            className="document-summary-item"
                                            key={documento.id}
                                        >

                                            <div className="document-summary-main">

                                                <div className="document-icon">
                                                    PDF
                                                </div>

                                                <div>

                                                    <strong>
                                                        {documento.nombre}
                                                    </strong>

                                                    <p>
                                                        {documento.descripcion}
                                                    </p>

                                                </div>

                                            </div>

                                            <StatusBadge
                                                estado={
                                                    documento.estado
                                                }
                                            />

                                        </div>

                                    )
                                )}

                            </div>

                        </div>

                    </section>
                )}

                {/* ===================================================== */}
                {/* INFORMACIÓN DEL ESTUDIANTE                              */}
                {/* ===================================================== */}

                {pestana === "estudiante" && (

                    <section className="tab-content">

                        <div className="section-heading">

                            <div>

                                <h2>
                                    Información del estudiante
                                </h2>

                                <p>
                                    Información suministrada durante
                                    el proceso de preinscripción.
                                </p>

                            </div>

                        </div>

                        <div className="content-block">

                            <div className="block-header">

                                <div>

                                    <h3>
                                        Datos personales
                                    </h3>

                                    <p>
                                        Información básica de identificación.
                                    </p>

                                </div>

                            </div>

                            <div className="form-grid">

                                <ReadOnlyField
                                    label="Código estudiantil"
                                    value={estudiante.codigo}
                                />

                                <ReadOnlyField
                                    label="Tipo de documento"
                                    value={estudiante.tipoDocumento}
                                />

                                <ReadOnlyField
                                    label="Número de documento"
                                    value={estudiante.numeroDocumento}
                                />

                                <ReadOnlyField
                                    label="Nombre completo"
                                    value={estudiante.nombre}
                                    wide
                                />

                            </div>

                        </div>

                        <div className="content-block">

                            <div className="block-header">

                                <div>

                                    <h3>
                                        Información académica
                                    </h3>

                                    <p>
                                        Datos relacionados con la
                                        solicitud de grado.
                                    </p>

                                </div>

                            </div>

                            <div className="form-grid">

                                <ReadOnlyField
                                    label="Carrera / programa"
                                    value={estudiante.programa}
                                    wide
                                />

                                {informacionAdicional.map(
                                    (item) => (

                                        <ReadOnlyField
                                            key={item.label}
                                            label={item.label}
                                            value={item.value}
                                        />

                                    )
                                )}

                            </div>

                        </div>

                        <div className="content-block">

                            <div className="block-header">

                                <div>

                                    <h3>
                                        Información de contacto
                                    </h3>

                                    <p>
                                        Datos de contacto registrados
                                        en la solicitud.
                                    </p>

                                </div>

                            </div>

                            <div className="form-grid">

                                <ReadOnlyField
                                    label="Dirección"
                                    value={estudiante.direccion}
                                    wide
                                />

                                <ReadOnlyField
                                    label="Número de teléfono"
                                    value={estudiante.telefono}
                                />

                                <ReadOnlyField
                                    label="Correo electrónico"
                                    value={estudiante.correo}
                                />

                            </div>

                        </div>

                    </section>
                )}

                {/* ===================================================== */}
                {/* DOCUMENTOS                                              */}
                {/* ===================================================== */}

                {pestana === "documentos" && (

                    <section className="tab-content">

                        <div className="section-heading">

                            <div>

                                <h2>
                                    Documentos analizados
                                </h2>

                                <p>
                                    Detalle de los resultados obtenidos
                                    durante la validación documental.
                                </p>

                            </div>

                        </div>

                        <div className="documents-detail-list">

                            {documentos.map(
                                (documento, index) => (

                                    <article
                                        className="document-detail-card"
                                        key={documento.id}
                                    >

                                        <div className="document-detail-header">

                                            <div className="document-number">
                                                {String(index + 1).padStart(
                                                    2,
                                                    "0"
                                                )}
                                            </div>

                                            <div className="document-detail-title">

                                                <h3>
                                                    {documento.nombre}
                                                </h3>

                                                <p>
                                                    {documento.descripcion}
                                                </p>

                                            </div>

                                            <StatusBadge
                                                estado={
                                                    documento.estado
                                                }
                                            />

                                        </div>

                                        <div className="document-message">

                                            <span className="message-label">
                                                Resultado del análisis
                                            </span>

                                            <p>
                                                {documento.mensaje}
                                            </p>

                                        </div>

                                        <div className="document-actions">

                                            <button
                                                className="secondary-button"
                                                onClick={() =>
                                                    handleOpenAnalysis(
                                                        documento
                                                    )
                                                }
                                            >
                                                Ver análisis automático
                                            </button>

                                            {(documento.estado ===
                                                "Por revisar" ||
                                                documento.estado ===
                                                    "Inconsistente" ||
                                                documento.estado ===
                                                    "No válido") && (

                                                <button className="outline-button">
                                                    Marcar como revisado
                                                </button>

                                            )}

                                        </div>

                                    </article>

                                )
                            )}

                        </div>

                    </section>
                )}

            </main>

            {/* ========================================================= */}
            {/* MÓDULO REUTILIZABLE DE ANÁLISIS                            */}
            {/* ========================================================= */}

            <DocumentAnalysis
                open={analysisOpen}
                onClose={handleCloseAnalysis}
                data={selectedDocument}
            />

        </div>
    );
}

/* ========================================================= */
/* COMPONENTES                                                */
/* ========================================================= */

function ReadOnlyField({
    label,
    value,
    wide = false,
}: {
    label: string;
    value: string;
    wide?: boolean;
}) {
    return (
        <div
            className={`readonly-field ${
                wide ? "field-wide" : ""
            }`}
        >
            <label>
                {label}
            </label>

            <div className="readonly-value">
                {value}
            </div>
        </div>
    );
}

function StatusBadge({
    estado,
}: {
    estado: EstadoDocumento;
}) {
    return (
        <span
            className={`status-badge ${getStatusClass(
                estado
            )}`}
        >
            <span className="status-dot" />
            {estado}
        </span>
    );
}

function getStatusClass(
    estado: EstadoDocumento
) {
    switch (estado) {

        case "Válido":
            return "valid";

        case "No válido":
            return "invalid";

        case "Inconsistente":
            return "inconsistent";

        case "Por revisar":
            return "review";

        default:
            return "";
    }
}