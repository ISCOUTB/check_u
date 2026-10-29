'use client';

import { useEffect, useState, useRef, useId } from 'react';
import { useRouter } from 'next/navigation';
import ProgresoDocumental from '@/app/components/ui/ProgresoDocumental';
import type { ProgresoEnvio } from '../envio-documental';
import { etiquetaPropiedad, valorVisible } from './etiquetas';
import {
  validarPdf,
  tieneFirmaPdf,
} from '../iniciar_preinscripcion/validacion';
import { tamanoMaximoPdfBytes } from '../iniciar_preinscripcion/api';
import Link from 'next/link';

import Navbar from '@/app/components/navbar/Navbar';
import DocumentAnalysis, {
  type DocumentAnalysisData,
} from '@/app/components/document_analysis/DocumentAnalysis';
import PeriodoInscripcion from '../iniciar_preinscripcion/PeriodoInscripcion';
import styles from './preinscripcion.module.css';

import {
  obtenerSolicitudDetalle,
  enviarDocumentosReenvio,
  ErrorConsultaSolicitud,
} from './api';
import type {
  SolicitudDetalle,
  EstadoDocumento,
  EstadoGeneral,
  DocumentoSolicitud,
} from './types';

import { InformacionEstudiante } from '@/app/components/informacion_estudiante';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de sesión
// ─────────────────────────────────────────────────────────────────────────────

interface Usuario {
  id: number;
  username: string;
  name: string;
  role: 'estudiante' | 'funcionario';
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function etiquetaEstado(estado: EstadoDocumento): string {
  const mapa: Record<EstadoDocumento, string> = {
    valido: 'Válido',
    no_valido: 'No válido',
    inconsistente: 'Inconsistente',
    por_revisar: 'Por revisar',
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
  return mapa[estado] ?? '';
}

function derivarEstadoGeneral(documentos: DocumentoSolicitud[]): {
  tipo: EstadoGeneral;
  titulo: string;
  frase: string;
  cantidadProblemas: number;
} {
  const todos = documentos.flatMap((d) => d.resultados);
  const tieneProblemaGrave = todos.some(
    (r) => r.estado === 'no_valido' || r.estado === 'inconsistente',
  );
  const tienePorRevisar = todos.some((r) => r.estado === 'por_revisar');
  const cantidadProblemas = documentos.filter((d) =>
    d.resultados.some((r) => r.estado !== 'valido'),
  ).length;

  if (tieneProblemaGrave) {
    return {
      tipo: 'requiere_correccion',
      titulo: 'Se requiere corregir documentos',
      frase: `${cantidadProblemas} documento${cantidadProblemas !== 1 ? 's' : ''} requieren atención antes de continuar con el proceso.`,
      cantidadProblemas,
    };
  }
  if (tienePorRevisar) {
    return {
      tipo: 'por_revisar',
      titulo: 'Preinscripción por revisar',
      frase: `${cantidadProblemas} documento${cantidadProblemas !== 1 ? 's' : ''} requieren atención antes de continuar con el proceso.`,
      cantidadProblemas,
    };
  }
  return {
    tipo: 'lista_para_continuar',
    titulo: 'Preinscripción lista para continuar',
    frase: 'Todos los documentos fueron validados correctamente.',
    cantidadProblemas: 0,
  };
}

function iniciales(nombre: string): string {
  return nombre
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase();
}

/** El modal utiliza exclusivamente la evidencia persistida del motor. */
function analisisPersistido(doc: DocumentoSolicitud): DocumentAnalysisData {
  const estados: Record<EstadoDocumento, DocumentAnalysisData['status']> = {
    valido: 'VALIDO',
    no_valido: 'NO_VALIDO',
    inconsistente: 'INCONSISTENTE',
    por_revisar: 'POR_REVISAR',
  };
  return {
    documentType: doc.nombre,
    fileName: doc.fileName ?? doc.nombre,
    status:
      estados[
        doc.resultados.find(
          (r) => r.estado === 'no_valido' || r.estado === 'inconsistente',
        )?.estado ??
          doc.resultados[0]?.estado ??
          'por_revisar'
      ],
    privateDocumentUrl:
      doc.archivoDisponible && doc.id
        ? `${API_URL}/estudiante/documentos/${encodeURIComponent(doc.id)}/original`
        : undefined,
    extractedFields: Object.entries(doc.analisis?.extracted_data ?? {}).map(
      ([campo, dato], indice) => ({
        label: etiquetaPropiedad(campo, indice),
        value: valorVisible(dato.value),
        source: 'Análisis documental registrado',
      }),
    ),
    validations: [
      ...(doc.analisis?.rules ?? []).map((r) => ({
        description: r.message || 'Comprobación documental',
        result: r.result === 'no_evaluable' ? null : r.result === 'cumple',
        detail: undefined,
      })),
      ...(doc.analisis?.errors ?? []).map((error) => ({
        description: 'Observación del análisis',
        result: false,
        detail: error,
      })),
    ],
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

// ─────────────────────────────────────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────────────────────────────────────

type Pestana = 'resumen' | 'informacion' | 'documentos';

export default function PreinscripcionPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tabsId = useId();

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [intento, setIntento] = useState(0);
  const [solicitud, setSolicitud] = useState<SolicitudDetalle | null>(null);
  const [errorDatos, setErrorDatos] = useState<string | null>(null);
  const [pestana, setPestana] = useState<Pestana>('documentos');

  // Análisis automático
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisData, setAnalysisData] = useState<DocumentAnalysisData | null>(
    null,
  );

  // Reenvío
  const [seleccionados, setSeleccionados] = useState<Record<string, File>>({});
  const envioRef = useRef(false);
  const claveCorreccion = useRef<string | null>(null);
  const [progresoEnvio, setProgresoEnvio] = useState<ProgresoEnvio | null>(
    null,
  );
  const [enviando, setEnviando] = useState(false);
  const [mensajeEnvio, setMensajeEnvio] = useState<string | null>(null);
  const [docParaCargar, setDocParaCargar] = useState<string | null>(null);

  // La consulta de detalle ya comprueba propiedad y devuelve 404 si no hay solicitud.
  // No esperar una consulta adicional de resumen antes de solicitar el detalle.
  useEffect(() => {
    const controlador = new AbortController();
    let vigente = true;
    let agotado = false;
    let redirigiendo = false;
    const limite = setTimeout(() => {
      agotado = true;
      controlador.abort();
    }, 15_000);

    async function cargar() {
      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          credentials: 'include',
          cache: 'no-store',
          signal: controlador.signal,
        });
        if (!vigente) return;
        if (response.status === 401) {
          redirigiendo = true;
          router.replace('/');
          return;
        }
        if (!response.ok)
          throw new Error('No fue posible verificar la sesión.');
        const data = await response.json();
        const u: Usuario = data.user;
        if (!vigente) return;
        if (!u || !['estudiante', 'funcionario'].includes(u.role))
          throw new Error('Respuesta de sesión inválida.');
        if (u.role !== 'estudiante') {
          redirigiendo = true;
          router.replace('/funcionario/dashboard');
          return;
        }
        setUsuario(u);
        const estadoRes = await fetch(`${API_URL}/solicitudes/estado`, {
          credentials: 'include',
          cache: 'no-store',
          signal: controlador.signal,
        });
        if (!vigente) return;
        if (estadoRes.ok) {
          const estadoNav = (await estadoRes.json()) as {
            estado: string;
            destino: string;
          };
          if (estadoNav.estado !== 'ENVIADA') {
            redirigiendo = true;
            router.replace(estadoNav.destino);
            return;
          }
        }

        const detalle = await obtenerSolicitudDetalle(controlador.signal);
        if (vigente) setSolicitud(detalle);
      } catch (error) {
        if (!vigente) return;
        if (
          error instanceof ErrorConsultaSolicitud &&
          [401, 404].includes(error.status)
        ) {
          redirigiendo = true;
          router.replace(error.status === 401 ? '/' : '/estudiante/bienvenida');
          return;
        }
        setErrorDatos(
          agotado
            ? 'La consulta tardó demasiado. Comprueba la conexión e intenta nuevamente.'
            : 'No fue posible cargar la preinscripción. Intenta recargar la página.',
        );
      } finally {
        clearTimeout(limite);
        if (vigente && !redirigiendo) setCargando(false);
      }
    }
    void cargar();
    return () => {
      vigente = false;
      clearTimeout(limite);
      controlador.abort();
    };
  }, [router, intento]);

  if (cargando) {
    return (
      <>
        {usuario && (
          <Navbar tipoUsuario={usuario.role} nombreUsuario={usuario.name} />
        )}
        <main
          id="contenido"
          tabIndex={-1}
          className={styles.page}
          aria-busy="true"
        >
          <header className={styles.header}>
            <h1>Detalle de mi preinscripción</h1>
            <p>Revisión documental de tu solicitud de grado.</p>
          </header>
          <div className={styles.cargando} role="status">
            <span className={styles.spinner} aria-hidden="true" />
            <p>Cargando tu preinscripción…</p>
          </div>
        </main>
      </>
    );
  }

  if (errorDatos || !solicitud || !usuario) {
    return (
      <>
        {usuario && (
          <Navbar tipoUsuario={usuario.role} nombreUsuario={usuario.name} />
        )}
        <main
          id="contenido"
          tabIndex={-1}
          className={styles.page}
          aria-busy="false"
        >
          <h1>Detalle de mi preinscripción</h1>
          <p role="alert" className={styles.textoError}>
            {errorDatos ??
              'No fue posible cargar la preinscripción. Intenta recargar la página.'}
          </p>
          <div style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className={styles.btnSecundario}
              onClick={() => {
                setErrorDatos(null);
                setCargando(true);
                setIntento((v) => v + 1);
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
  const estadoGeneral =
    solicitud.estadoAnalisis === 'pendiente' || documentos.length === 0
      ? {
          tipo: 'por_revisar' as const,
          titulo: 'Análisis documental pendiente',
          frase:
            'Todavía no hay resultados completos registrados para esta preinscripción.',
          cantidadProblemas: 0,
        }
      : derivarEstadoGeneral(documentos);
  const reenviosRestantes = politicaReenvios.limite - politicaReenvios.usados;
  const docsConProblema = documentos.filter((d) =>
    d.resultados.some((r) => r.estado !== 'valido'),
  );
  const docsValidos = documentos.filter((d) =>
    d.resultados.every((r) => r.estado === 'valido'),
  );
  const seleccionadosList = Object.keys(seleccionados);
  const puedeEnviar =
    seleccionadosList.length > 0 && reenviosRestantes > 0 && !enviando;

  function abrirAnalisis(doc: DocumentoSolicitud) {
    setAnalysisData(analisisPersistido(doc));
    setAnalysisOpen(true);
  }

  function cerrarAnalisis() {
    setAnalysisOpen(false);
    setAnalysisData(null);
  }

  function iniciarCarga(tipo: string) {
    setDocParaCargar(tipo);
    fileInputRef.current?.click();
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && docParaCargar) {
      const error = validarPdf(file, tamanoMaximoPdfBytes());
      if (error) {
        setMensajeEnvio(error);
        e.target.value = '';
        return;
      }
      try {
        if (!(await tieneFirmaPdf(file))) {
          setMensajeEnvio('El archivo debe ser un PDF válido.');
          e.target.value = '';
          return;
        }
      } catch {
        setMensajeEnvio('No fue posible leer el PDF seleccionado.');
        return;
      }
      claveCorreccion.current = null;
      setSeleccionados((prev) => ({ ...prev, [docParaCargar]: file }));
      setMensajeEnvio(null);
    }
    e.target.value = '';
    setDocParaCargar(null);
  }

  function quitarArchivo(tipo: string) {
    claveCorreccion.current = null;
    setSeleccionados((prev) => {
      const next = { ...prev };
      delete next[tipo];
      return next;
    });
  }

  async function handleEnviar() {
    if (!puedeEnviar || !solicitud || envioRef.current) return;
    envioRef.current = true;
    setEnviando(true);
    setMensajeEnvio(null);
    try {
      claveCorreccion.current ??= `correccion-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
      const key = claveCorreccion.current;
      const res = await enviarDocumentosReenvio(
        solicitud.id,
        seleccionadosList.map((id) => ({ id, archivo: seleccionados[id] })),
        key,
        setProgresoEnvio,
      );
      setMensajeEnvio(res.mensaje);
      if (res.ok) {
        setSeleccionados({});
        claveCorreccion.current = null;
        try {
          setSolicitud(await obtenerSolicitudDetalle());
        } catch {
          setMensajeEnvio(
            'La corrección quedó registrada, pero no fue posible actualizar la vista. Recarga la página para consultar los resultados.',
          );
        }
      }
    } catch {
      setMensajeEnvio(
        'No fue posible enviar los documentos. Intenta de nuevo.',
      );
    } finally {
      envioRef.current = false;
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

      <main
        id="contenido"
        tabIndex={-1}
        className={styles.page}
        aria-busy="false"
      >
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

        <PeriodoInscripcion datos={solicitud.periodos ?? null} />

        {/* Tarjeta estudiante */}
        <section
          className={styles.studentCard}
          aria-label="Datos del estudiante"
        >
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
              {estudiante.tipoDocumento}: {estudiante.numeroDocumento} ·{' '}
              {estudiante.correo} · {estudiante.telefono}
            </p>
          </div>
        </section>

        {/* Banner estado */}
        <section
          className={`${styles.bannerEstado} ${
            estadoGeneral.tipo === 'lista_para_continuar'
              ? styles.bannerOk
              : styles.bannerAtencion
          }`}
          aria-live="polite"
        >
          <div className={styles.bannerIcono} aria-hidden="true">
            {estadoGeneral.tipo === 'lista_para_continuar' ? '✓' : '!'}
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
              ['resumen', 'Resumen documental'],
              ['informacion', 'Tu información'],
              ['documentos', 'Tus documentos'],
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
        {pestana === 'resumen' && (
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
                <span className={styles.metricLabel}>
                  Documentos analizados
                </span>
                <span className={styles.metricHint}>Documentos requeridos</span>
              </div>
              <div className={`${styles.metricCard} ${styles.metricOk}`}>
                <span className={styles.metricValue}>{docsValidos.length}</span>
                <span className={styles.metricLabel}>Válidos</span>
                <span className={styles.metricHint}>Sin novedades</span>
              </div>
              <div className={`${styles.metricCard} ${styles.metricWarn}`}>
                <span className={styles.metricValue}>
                  {docsConProblema.length}
                </span>
                <span className={styles.metricLabel}>Requieren atención</span>
                <span className={styles.metricHint}>Con alertas</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricValue}>
                  {reenviosRestantes} de {politicaReenvios.limite}
                </span>
                <span className={styles.metricLabel}>
                  Reenvíos disponibles hoy
                </span>
                <span className={styles.metricHint}>
                  Se reinician a medianoche (Bogotá)
                </span>
              </div>
            </div>

            {/* Alertas */}
            {docsConProblema.length > 0 ? (
              <section
                className={styles.alertasBox}
                aria-labelledby="hdr-alertas"
              >
                <div className={styles.alertasHeader}>
                  <h3 id="hdr-alertas">Alertas</h3>
                  <span className={styles.alertasCount}>
                    {docsConProblema.length}
                  </span>
                </div>
                <p className={styles.alertasSub}>
                  Documentos que requieren revisión o corrección.
                </p>
                <ul className={styles.alertasList}>
                  {docsConProblema.map((doc) => (
                    <li
                      key={doc.id ?? `${doc.tipo}-${doc.orden ?? 1}`}
                      className={styles.alertaItem}
                    >
                      <div className={styles.alertaMain}>
                        <strong>{doc.nombre}</strong>
                        <div className={styles.alertaChips}>
                          {doc.resultados.map((r, i) => (
                            <StatusBadge key={i} estado={r.estado} />
                          ))}
                        </div>
                        <p className={styles.alertaMsg}>
                          {doc.resultados.map((r) => r.mensaje).join(' ')}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={styles.btnSecundario}
                        onClick={() => setPestana('documentos')}
                      >
                        Ver detalle
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <p className={styles.textoOk}>
                {solicitud.estadoAnalisis === 'pendiente'
                  ? 'Todavía no hay resultados del análisis registrados.'
                  : 'Todos los documentos fueron validados correctamente.'}
              </p>
            )}

            {/* Estado de los documentos */}
            <section
              className={styles.estadoDocs}
              aria-labelledby="hdr-estado-docs"
            >
              <h3 id="hdr-estado-docs">Estado de los documentos</h3>
              <p className={styles.panelSubtitle}>
                Vista rápida del resultado de cada documento.
              </p>
              <ul className={styles.estadoList}>
                {documentos.map((doc) => (
                  <li
                    key={doc.id ?? `${doc.tipo}-${doc.orden ?? 1}`}
                    className={styles.estadoRow}
                  >
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
        {pestana === 'informacion' && (
          <div
            role="tabpanel"
            id={`${tabsId}-panel-informacion`}
            aria-labelledby={`${tabsId}-informacion`}
            className={styles.panel}
          >
            <h2 className={styles.panelTitle}>Tu información</h2>

            <p className={styles.panelSubtitle}>
              Información suministrada durante el proceso de preinscripción.
            </p>

            <InformacionEstudiante
              nivel={estudiante.nivel === 'POSGRADO' ? 'POSGRADO' : 'PREGRADO'}
              datos={solicitud.informacion}
              variante="estudiante"
            />
          </div>
        )}

        {/* ═══════════════ TUS DOCUMENTOS ═══════════════ */}
        {pestana === 'documentos' && (
          <div
            role="tabpanel"
            id={`${tabsId}-panel-documentos`}
            aria-labelledby={`${tabsId}-documentos`}
            className={styles.panel}
          >
            <h2 className={styles.panelTitle}>Tus documentos</h2>
            <p className={styles.panelSubtitle}>
              Resultado del análisis automático de cada documento requerido para{' '}
              {estudiante.nivel.toLowerCase()}.
            </p>

            <ProgresoDocumental progreso={progresoEnvio} />
            <div className={styles.docCards}>
              {documentos.map((doc) => {
                const archivo = seleccionados[doc.id ?? ''];
                return (
                  <article
                    key={doc.id ?? `${doc.tipo}-${doc.orden ?? 1}`}
                    className={styles.docCard}
                  >
                    <div className={styles.docCardHeader}>
                      <h3>{doc.nombre}</h3>
                      {doc.version && <span>Versión {doc.version}</span>}
                      <div className={styles.alertaChips}>
                        {doc.resultados.map((r, i) => (
                          <StatusBadge key={i} estado={r.estado} />
                        ))}
                      </div>
                    </div>

                    <div className={styles.docResultados}>
                      <span className={styles.resultLabel}>
                        RESULTADO DEL ANÁLISIS
                      </span>
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
                          disabled={enviando || !doc.id}
                          onClick={() => iniciarCarga(doc.id!)}
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
                            disabled={enviando}
                            onClick={() => quitarArchivo(doc.id!)}
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

            {/* El backend habilitará las correcciones cuando exista el flujo real. */}
            {politicaReenvios.limite > 0 && (
              <section
                className={styles.proximoEnvio}
                aria-labelledby="hdr-envio"
              >
                <div>
                  <h3 id="hdr-envio">Tu próximo envío</h3>
                  <p>
                    {seleccionadosList.length === 0
                      ? 'Ningún documento seleccionado.'
                      : `${seleccionadosList.length} documento${seleccionadosList.length !== 1 ? 's' : ''} seleccionado${seleccionadosList.length !== 1 ? 's' : ''}.`}{' '}
                    Puedes volver a enviar documentos que estén{' '}
                    <strong>No válido, Inconsistente o Por revisar</strong>; el
                    sistema seguirá validándolos. Un envío con varios documentos
                    cuenta como un solo reenvío.
                  </p>
                </div>
                <div className={styles.envioActions}>
                  <span className={styles.reenviosCount}>
                    <strong>
                      {reenviosRestantes} de {politicaReenvios.limite}
                    </strong>
                    <small>
                      reenvíos hoy · reinician a medianoche (Bogotá)
                    </small>
                  </span>
                  <button
                    type="button"
                    className={styles.btnPrimario}
                    disabled={!puedeEnviar}
                    onClick={handleEnviar}
                  >
                    {enviando ? 'Enviando...' : 'Enviar documentos'}
                  </button>
                </div>
                {mensajeEnvio && (
                  <p className={styles.mensajeEnvio} role="status">
                    {mensajeEnvio}
                  </p>
                )}
              </section>
            )}
          </div>
        )}

        {/* Input oculto para carga de archivos */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
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
