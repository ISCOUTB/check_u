"use client";

import { useEffect, useState, useRef, useId } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import Navbar from "@/app/components/navbar/Navbar";
import { useRequiereSolicitud } from "@/app/lib/useSolicitudActiva";
import DocumentAnalysis, {
  type DocumentAnalysisData,
} from "@/app/components/document_analysis/DocumentAnalysis";
import styles from "./preinscripcion.module.css";

import { obtenerSolicitudDetalle, enviarDocumentosReenvio } from "./api";
import type {
  SolicitudDetalle,
  EstadoDocumento,
  EstadoGeneral,
  TipoDocumento,
  DocumentoSolicitud,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de sesión
// ─────────────────────────────────────────────────────────────────────────────

interface Usuario {
  id: number;
  username: string;
  name: string;
  role: "estudiante" | "funcionario";
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function etiquetaEstado(estado: EstadoDocumento): string {
  const mapa: Record<EstadoDocumento, string> = {
    valido: "Válido",
    no_valido: "No válido",
    inconsistente: "Inconsistente",
    por_revisar: "Por revisar",
  };
  return mapa[estado] ?? estado;
}

function claseChip(estado: EstadoDocumento): string {
  const mapa: Record<EstadoDocumento, string> = {
    valido: styles.chipValido,
    no_valido: styles.chipNoValido,
    inconsistente: styles.chipInconsistente,
    por_revisar: styles.chipPorRevisar,
  };
  return mapa[estado] ?? "";
}

function derivarEstadoGeneral(documentos: DocumentoSolicitud[]): {
  tipo: EstadoGeneral;
  titulo: string;
  frase: string;
  cantidadProblemas: number;
} {
  const todos = documentos.flatMap((d) => d.resultados);
  const tieneProblemaGrave = todos.some(
    (r) => r.estado === "no_valido" || r.estado === "inconsistente"
  );
  const tienePorRevisar = todos.some((r) => r.estado === "por_revisar");
  const cantidadProblemas = documentos.filter((d) =>
    d.resultados.some((r) => r.estado !== "valido")
  ).length;

  if (tieneProblemaGrave) {
    return {
      tipo: "requiere_correccion",
      titulo: "Se requiere corregir documentos",
      frase: `${cantidadProblemas} documento${cantidadProblemas !== 1 ? "s" : ""} requieren atención antes de continuar con el proceso.`,
      cantidadProblemas,
    };
  }
  if (tienePorRevisar) {
    return {
      tipo: "por_revisar",
      titulo: "Preinscripción por revisar",
      frase: `${cantidadProblemas} documento${cantidadProblemas !== 1 ? "s" : ""} requieren atención antes de continuar con el proceso.`,
      cantidadProblemas,
    };
  }
  return {
    tipo: "lista_para_continuar",
    titulo: "Preinscripción lista para continuar",
    frase: "Todos los documentos fueron validados correctamente.",
    cantidadProblemas: 0,
  };
}

function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();
}

/** Mock de análisis para el modal (SIMULADO — TODO: endpoint real) */
function mockAnalisis(
  doc: DocumentoSolicitud,
  estudiante: { nombre: string; numeroDocumento: string; codigo: string }
): DocumentAnalysisData {
  const primerEstado = doc.resultados[0]?.estado ?? "por_revisar";
  const statusMap: Record<EstadoDocumento, DocumentAnalysisData["status"]> = {
    valido: "VALIDO",
    no_valido: "NO_VALIDO",
    inconsistente: "INCONSISTENTE",
    por_revisar: "POR_REVISAR",
  };

  const camposPorTipo: Record<
    TipoDocumento,
    DocumentAnalysisData["extractedFields"]
  > = {
    identification: [
      { label: "Nombre completo", value: estudiante.nombre, source: "Página 1 · OCR" },
      { label: "Número de documento", value: estudiante.numeroDocumento, source: "Página 1 · OCR" },
      { label: "Tipo de documento", value: "Cédula de ciudadanía", source: "Página 1 · OCR" },
    ],
    academic_evaluation: [
      { label: "Código estudiantil", value: estudiante.codigo, source: "Página 1 · OCR" },
      { label: "Nombre del estudiante", value: estudiante.nombre, source: "Página 1 · OCR" },
      { label: "Programa académico", value: "Ingeniería de Sistemas y Computación", source: "Página 1 · OCR" },
      { label: "Estado académico", value: primerEstado === "valido" ? "Cumple" : "Revisar", source: "Página 1 · OCR" },
    ],
    estampilla_pro_cultura: [
      { label: "Nombre", value: estudiante.nombre, source: "Página 1 · OCR" },
      { label: "Número de identificación", value: estudiante.numeroDocumento, source: "Página 1 · OCR" },
      { label: "Referencia de pago", value: "PC-2026-009845", source: "Página 1 · OCR" },
    ],
    saber_pro: [
      { label: "Nombre del estudiante", value: estudiante.nombre, source: "Página 1 · OCR" },
      { label: "Identificación", value: estudiante.numeroDocumento, source: "Página 1 · OCR" },
      { label: "Puntaje global", value: primerEstado === "valido" ? "287" : "85", source: "Página 1 · OCR" },
      { label: "Número de registro", value: "123456789", source: "Página 1 · OCR" },
      { label: "Fecha de aplicación", value: "15/09/2025", source: "Página 1 · OCR" },
    ],
    paz_y_salvo_bib: [
      { label: "Nombre del estudiante", value: estudiante.nombre, source: "Página 1 · OCR" },
      { label: "Código estudiantil", value: estudiante.codigo, source: "Página 1 · OCR" },
      { label: "Estado", value: "Paz y salvo", source: "Página 1 · OCR" },
      { label: "Firma electrónica", value: primerEstado === "valido" ? "Verificada" : "No encontrada", source: "Metadatos del documento" },
    ],
  };

  return {
    documentType: doc.nombre,
    fileName: doc.fileName ?? `${doc.tipo}.pdf`,
    status: statusMap[primerEstado],
    extractedFields: camposPorTipo[doc.tipo] ?? [
      { label: "Tipo de documento", value: doc.nombre, source: "Metadatos" },
    ],
    validations: doc.resultados.map((r) => ({
      description: r.mensaje,
      result: r.estado === "valido",
      detail: `Estado: ${etiquetaEstado(r.estado)}`,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponentes
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ estado }: { estado: EstadoDocumento }) {
  return (
    <span className={`${styles.chip} ${claseChip(estado)}`}>
      <span className={styles.chipDot} aria-hidden="true" />
      {etiquetaEstado(estado)}
    </span>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.fieldValue}>{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────────────────────────────────────

type Pestana = "resumen" | "informacion" | "documentos";

export default function PreinscripcionPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tabsId = useId();

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [solicitud, setSolicitud] = useState<SolicitudDetalle | null>(null);
  const [errorDatos, setErrorDatos] = useState(false);
  const [pestana, setPestana] = useState<Pestana>("documentos");

  const {
    cargando: cargandoSolicitud,
    error: errorSolicitud,
    tiene_solicitud,
    reintentar: reintentarSolicitud,
  } = useRequiereSolicitud(Boolean(usuario));

  // Análisis automático
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisData, setAnalysisData] = useState<DocumentAnalysisData | null>(null);

  // Reenvío
  const [seleccionados, setSeleccionados] = useState<Partial<Record<TipoDocumento, File>>>({});
  const [enviando, setEnviando] = useState(false);
  const [mensajeEnvio, setMensajeEnvio] = useState<string | null>(null);
  const [docParaCargar, setDocParaCargar] = useState<TipoDocumento | null>(null);

  // Sesión
  useEffect(() => {
    async function verificarSesion() {
      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) {
          router.replace("/");
          return;
        }
        const data = await response.json();
        const u: Usuario = data.user;
        if (u.role !== "estudiante") {
          router.replace("/funcionario/dashboard");
          return;
        }
        setUsuario(u);
      } catch {
        router.replace("/");
      } finally {
        setCargandoSesion(false);
      }
    }
    verificarSesion();
  }, [router]);

  // Datos
  useEffect(() => {
    if (!usuario || tiene_solicitud !== true) return;
    obtenerSolicitudDetalle()
      .then(setSolicitud)
      .catch(() => {
        setSolicitud(null);
        setErrorDatos(true);
      });
  }, [usuario, tiene_solicitud]);

  const cargando = cargandoSesion || cargandoSolicitud;

  if (cargando || !usuario || (!errorSolicitud && tiene_solicitud === false)) {
    return (
      <div className={styles.cargando} aria-live="polite">
        <span className={styles.spinner} aria-hidden="true" />
        <p>Verificando sesión y preinscripción...</p>
      </div>
    );
  }

  if (errorSolicitud || errorDatos || !solicitud) {
    return (
      <>
        <Navbar tipoUsuario={usuario.role} nombreUsuario={usuario.name} />
        <main className={styles.page}>
          <p className={styles.textoError}>
            No fue posible cargar la preinscripción. Intenta recargar la página.
          </p>
          <div style={{ marginTop: "1rem" }}>
            <button
              type="button"
              className={styles.btnSecundario}
              onClick={() => {
                setErrorDatos(false);
                void reintentarSolicitud();
                obtenerSolicitudDetalle()
                  .then(setSolicitud)
                  .catch(() => {
                    setSolicitud(null);
                    setErrorDatos(true);
                  });
              }}
            >
              Reintentar
            </button>
          </div>
        </main>
      </>
    );
  }

  const { estudiante, documentos, politicaReenvios } = solicitud;
  const estadoGeneral = derivarEstadoGeneral(documentos);
  const reenviosRestantes = politicaReenvios.limite - politicaReenvios.usados;
  const docsConProblema = documentos.filter((d) =>
    d.resultados.some((r) => r.estado !== "valido")
  );
  const docsValidos = documentos.filter((d) =>
    d.resultados.every((r) => r.estado === "valido")
  );
  const seleccionadosList = Object.keys(seleccionados) as TipoDocumento[];
  const puedeEnviar =
    seleccionadosList.length > 0 && reenviosRestantes > 0 && !enviando;

  function abrirAnalisis(doc: DocumentoSolicitud) {
    setAnalysisData(mockAnalisis(doc, estudiante));
    setAnalysisOpen(true);
  }

  function cerrarAnalisis() {
    setAnalysisOpen(false);
    setAnalysisData(null);
  }

  function iniciarCarga(tipo: TipoDocumento) {
    setDocParaCargar(tipo);
    fileInputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && docParaCargar) {
      setSeleccionados((prev) => ({ ...prev, [docParaCargar]: file }));
      setMensajeEnvio(null);
    }
    e.target.value = "";
    setDocParaCargar(null);
  }

  function quitarArchivo(tipo: TipoDocumento) {
    setSeleccionados((prev) => {
      const next = { ...prev };
      delete next[tipo];
      return next;
    });
  }

  async function handleEnviar() {
    if (!puedeEnviar || !solicitud) return;
    setEnviando(true);
    setMensajeEnvio(null);
    const key = `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const res = await enviarDocumentosReenvio(
        solicitud.id,
        seleccionadosList,
        key
      );
      setMensajeEnvio(res.mensaje);
      if (res.ok) {
        setSeleccionados({});
      }
    } catch {
      setMensajeEnvio("No fue posible enviar los documentos. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Navbar
        tipoUsuario={usuario.role}
        nombreUsuario={usuario.name}
        nivel={estudiante.nivel}
      />

      <main className={styles.page}>
        {/* Header */}
        <header className={styles.header}>
          <nav className={styles.breadcrumb} aria-label="Miga de pan">
            <Link href="/estudiante/home">Inicio</Link>
            <span aria-hidden="true"> / </span>
            <span>Mi preinscripción</span>
            <span aria-hidden="true"> / </span>
            <span>Detalle</span>
          </nav>
          <div className={styles.titleRow}>
            <div>
              <h1>Detalle de mi preinscripción</h1>
              <p className={styles.subtitle}>
                Revisión documental de tu solicitud de grado.
              </p>
            </div>
            <span className={styles.codigoBadge}>{estudiante.codigo}</span>
          </div>
        </header>

        {/* Tarjeta estudiante */}
        <section className={styles.studentCard} aria-label="Datos del estudiante">
          <div className={styles.avatar} aria-hidden="true">
            {iniciales(estudiante.nombre)}
          </div>
          <div className={styles.studentInfo}>
            <div className={styles.studentNameRow}>
              <h2>{estudiante.nombre}</h2>
              <span className={styles.nivelBadge}>{estudiante.nivel}</span>
            </div>
            <p className={styles.programa}>{estudiante.programa}</p>
            <p className={styles.meta}>
              {estudiante.tipoDocumento}: {estudiante.numeroDocumento} ·{" "}
              {estudiante.correo} · {estudiante.telefono}
            </p>
          </div>
        </section>

        {/* Banner estado */}
        <section
          className={`${styles.bannerEstado} ${
            estadoGeneral.tipo === "lista_para_continuar"
              ? styles.bannerOk
              : styles.bannerAtencion
          }`}
          aria-live="polite"
        >
          <div className={styles.bannerIcono} aria-hidden="true">
            {estadoGeneral.tipo === "lista_para_continuar" ? "✓" : "!"}
          </div>
          <div>
            <span className={styles.bannerLabel}>ESTADO GENERAL</span>
            <h3 className={styles.bannerTitulo}>{estadoGeneral.titulo}</h3>
            <p className={styles.bannerFrase}>{estadoGeneral.frase}</p>
          </div>
        </section>

        {/* Tabs */}
        <div
          className={styles.tabs}
          role="tablist"
          aria-label="Secciones de la preinscripción"
        >
          {(
            [
              ["resumen", "Resumen documental"],
              ["informacion", "Tu información"],
              ["documentos", "Tus documentos"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`${tabsId}-${id}`}
              aria-selected={pestana === id}
              aria-controls={`${tabsId}-panel-${id}`}
              className={pestana === id ? styles.tabActiva : styles.tab}
              onClick={() => setPestana(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ═══════════════ RESUMEN DOCUMENTAL ═══════════════ */}
        {pestana === "resumen" && (
          <div
            role="tabpanel"
            id={`${tabsId}-panel-resumen`}
            aria-labelledby={`${tabsId}-resumen`}
            className={styles.panel}
          >
            <h2 className={styles.panelTitle}>Resumen documental</h2>
            <p className={styles.panelSubtitle}>
              Resultado general del análisis automático de los documentos
              suministrados.
            </p>

            {/* Métricas */}
            <div className={styles.metrics}>
              <div className={styles.metricCard}>
                <span className={styles.metricValue}>{documentos.length}</span>
                <span className={styles.metricLabel}>Documentos analizados</span>
                <span className={styles.metricHint}>Documentos requeridos</span>
              </div>
              <div className={`${styles.metricCard} ${styles.metricOk}`}>
                <span className={styles.metricValue}>{docsValidos.length}</span>
                <span className={styles.metricLabel}>Válidos</span>
                <span className={styles.metricHint}>Sin novedades</span>
              </div>
              <div className={`${styles.metricCard} ${styles.metricWarn}`}>
                <span className={styles.metricValue}>{docsConProblema.length}</span>
                <span className={styles.metricLabel}>Requieren atención</span>
                <span className={styles.metricHint}>Con alertas</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricValue}>
                  {reenviosRestantes} de {politicaReenvios.limite}
                </span>
                <span className={styles.metricLabel}>Reenvíos disponibles hoy</span>
                <span className={styles.metricHint}>
                  Se reinician a medianoche (Bogotá)
                </span>
              </div>
            </div>

            {/* Alertas */}
            {docsConProblema.length > 0 ? (
              <section className={styles.alertasBox} aria-labelledby="hdr-alertas">
                <div className={styles.alertasHeader}>
                  <h3 id="hdr-alertas">Alertas</h3>
                  <span className={styles.alertasCount}>{docsConProblema.length}</span>
                </div>
                <p className={styles.alertasSub}>
                  Documentos que requieren revisión o corrección.
                </p>
                <ul className={styles.alertasList}>
                  {docsConProblema.map((doc) => (
                    <li key={doc.tipo} className={styles.alertaItem}>
                      <div className={styles.alertaMain}>
                        <strong>{doc.nombre}</strong>
                        <div className={styles.alertaChips}>
                          {doc.resultados.map((r, i) => (
                            <StatusBadge key={i} estado={r.estado} />
                          ))}
                        </div>
                        <p className={styles.alertaMsg}>
                          {doc.resultados.map((r) => r.mensaje).join(" ")}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={styles.btnSecundario}
                        onClick={() => setPestana("documentos")}
                      >
                        Ver detalle
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <p className={styles.textoOk}>
                Todos los documentos fueron validados correctamente.
              </p>
            )}

            {/* Estado de los documentos */}
            <section className={styles.estadoDocs} aria-labelledby="hdr-estado-docs">
              <h3 id="hdr-estado-docs">Estado de los documentos</h3>
              <p className={styles.panelSubtitle}>Vista rápida del resultado de cada documento.</p>
              <ul className={styles.estadoList}>
                {documentos.map((doc) => (
                  <li key={doc.tipo} className={styles.estadoRow}>
                    <div className={styles.estadoLeft}>
                      <span className={styles.pdfBadge}>PDF</span>
                      <div>
                        <strong>{doc.nombre}</strong>
                        <p>{doc.descripcion}</p>
                      </div>
                    </div>
                    <div className={styles.alertaChips}>
                      {doc.resultados.map((r, i) => (
                        <StatusBadge key={i} estado={r.estado} />
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}

        {/* ═══════════════ TU INFORMACIÓN ═══════════════ */}
        {pestana === "informacion" && (
          <div
            role="tabpanel"
            id={`${tabsId}-panel-informacion`}
            aria-labelledby={`${tabsId}-informacion`}
            className={styles.panel}
          >
            <h2 className={styles.panelTitle}>Tu información</h2>
            <p className={styles.panelSubtitle}>
              Información suministrada durante la inscripción. Es solo de consulta.
            </p>

            <section className={styles.infoBlock}>
              <h3>Información básica de identificación</h3>
              <p className={styles.infoHint}>Datos de identificación registrados.</p>
              <div className={styles.fieldsGrid}>
                <ReadOnlyField label="Nombre completo" value={estudiante.nombre} />
                <ReadOnlyField label="Tipo de documento" value={estudiante.tipoDocumento} />
                <ReadOnlyField label="Número de documento" value={estudiante.numeroDocumento} />
                <ReadOnlyField label="Fecha de nacimiento" value={estudiante.fechaNacimiento} />
              </div>
            </section>

            <section className={styles.infoBlock}>
              <h3>Información académica</h3>
              <p className={styles.infoHint}>Datos académicos registrados.</p>
              <div className={styles.fieldsGrid}>
                <ReadOnlyField label="Código estudiantil" value={estudiante.codigo} />
                <ReadOnlyField label="Programa académico" value={estudiante.programa} />
                <ReadOnlyField label="Facultad" value={estudiante.facultad} />
                <ReadOnlyField label="Nivel académico" value={estudiante.nivel} />
              </div>
            </section>

            <section className={styles.infoBlock}>
              <h3>Contacto y solicitud</h3>
              <p className={styles.infoHint}>Datos de contacto y de la solicitud.</p>
              <div className={styles.fieldsGrid}>
                <ReadOnlyField label="Correo" value={estudiante.correo} />
                <ReadOnlyField label="Teléfono" value={estudiante.telefono} />
                <ReadOnlyField label="Ciudad" value={estudiante.ciudad} />
                <ReadOnlyField label="Fecha de solicitud" value={estudiante.fechaSolicitud} />
              </div>
            </section>
          </div>
        )}

        {/* ═══════════════ TUS DOCUMENTOS ═══════════════ */}
        {pestana === "documentos" && (
          <div
            role="tabpanel"
            id={`${tabsId}-panel-documentos`}
            aria-labelledby={`${tabsId}-documentos`}
            className={styles.panel}
          >
            <h2 className={styles.panelTitle}>Tus documentos</h2>
            <p className={styles.panelSubtitle}>
              Resultado del análisis automático de cada documento requerido para
              pregrado.
            </p>

            <div className={styles.docCards}>
              {documentos.map((doc) => {
                const archivo = seleccionados[doc.tipo];
                return (
                  <article key={doc.tipo} className={styles.docCard}>
                    <div className={styles.docCardHeader}>
                      <h3>{doc.nombre}</h3>
                      <div className={styles.alertaChips}>
                        {doc.resultados.map((r, i) => (
                          <StatusBadge key={i} estado={r.estado} />
                        ))}
                      </div>
                    </div>

                    <div className={styles.docResultados}>
                      <span className={styles.resultLabel}>RESULTADO DEL ANÁLISIS</span>
                      {doc.resultados.map((r, i) => (
                        <div
                          key={i}
                          className={`${styles.resultadoBox} ${claseChip(r.estado)}`}
                        >
                          <StatusBadge estado={r.estado} />
                          <p>{r.mensaje}</p>
                        </div>
                      ))}
                    </div>

                    <div className={styles.docActions}>
                      <button
                        type="button"
                        className={styles.btnSecundario}
                        onClick={() => abrirAnalisis(doc)}
                      >
                        Ver análisis automático
                      </button>

                      {doc.resubmission_allowed && !archivo && (
                        <button
                          type="button"
                          className={styles.btnSecundario}
                          onClick={() => iniciarCarga(doc.tipo)}
                        >
                          Volver a cargar
                        </button>
                      )}

                      {archivo && (
                        <div className={styles.archivoSeleccionado}>
                          <span>{archivo.name} · listo para enviar</span>
                          <button
                            type="button"
                            className={styles.btnSecundario}
                            onClick={() => quitarArchivo(doc.tipo)}
                          >
                            Quitar
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Franja próximo envío */}
            <section className={styles.proximoEnvio} aria-labelledby="hdr-envio">
              <div>
                <h3 id="hdr-envio">Tu próximo envío</h3>
                <p>
                  {seleccionadosList.length === 0
                    ? "Ningún documento seleccionado."
                    : `${seleccionadosList.length} documento${seleccionadosList.length !== 1 ? "s" : ""} seleccionado${seleccionadosList.length !== 1 ? "s" : ""}.`}{" "}
                  Puedes volver a enviar documentos que estén{" "}
                  <strong>Por revisar</strong>; el sistema seguirá validándolos.
                  Un envío con varios documentos cuenta como un solo reenvío.
                </p>
              </div>
              <div className={styles.envioActions}>
                <span className={styles.reenviosCount}>
                  <strong>
                    {reenviosRestantes} de {politicaReenvios.limite}
                  </strong>
                  <small>reenvíos hoy · reinician a medianoche (Bogotá)</small>
                </span>
                <button
                  type="button"
                  className={styles.btnPrimario}
                  disabled={!puedeEnviar}
                  onClick={handleEnviar}
                >
                  {enviando ? "Enviando..." : "Enviar documentos"}
                </button>
              </div>
              {mensajeEnvio && (
                <p className={styles.mensajeEnvio} role="status">
                  {mensajeEnvio}
                </p>
              )}
            </section>
          </div>
        )}

        {/* Input oculto para carga de archivos */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf,image/*"
          className={styles.hiddenInput}
          onChange={onFileChange}
          aria-hidden="true"
          tabIndex={-1}
        />
      </main>

      <DocumentAnalysis
        open={analysisOpen}
        onClose={cerrarAnalisis}
        data={analysisData}
      />
    </>
  );
}