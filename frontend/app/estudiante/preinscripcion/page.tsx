"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import Navbar from "@/app/components/navbar/Navbar";
import styles from "./preinscripcion.module.css";

import { obtenerSolicitudDetalle } from "./api";
import type {
  SolicitudDetalle,
  EstadoDocumento,
  EstadoGeneral,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de sesión (mismo patrón que estudiante/home)
// ─────────────────────────────────────────────────────────────────────────────

interface Usuario {
  id: number;
  username: string;
  name: string;
  role: "estudiante" | "funcionario";
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de presentación
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

function derivarEstadoGeneral(documentos: SolicitudDetalle["documentos"]): {
  tipo: EstadoGeneral;
  titulo: string;
  frase: string;
  cantidadProblemas: number;
} {
  const todosResultados = documentos.flatMap((d) => d.resultados);

  const tieneNoValidoOInconsistente = todosResultados.some(
    (r) => r.estado === "no_valido" || r.estado === "inconsistente"
  );
  const tienePorRevisar = todosResultados.some((r) => r.estado === "por_revisar");

  const cantidadProblemas = documentos.filter((d) =>
    d.resultados.some((r) => r.estado !== "valido")
  ).length;

  if (tieneNoValidoOInconsistente) {
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

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

type Pestana = "resumen" | "informacion" | "documentos";

export default function PreinscripcionPage() {
  const router = useRouter();

  // ── Sesión real ──────────────────────────────────────────────────────────
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);

  // ── Datos de la solicitud (simulados) ────────────────────────────────────
  const [solicitud, setSolicitud] = useState<SolicitudDetalle | null>(null);
  const [errorDatos, setErrorDatos] = useState(false);

  // ── Pestaña activa ───────────────────────────────────────────────────────
  const [pestana, setPestana] = useState<Pestana>("documentos");

  // ── Verificar sesión ─────────────────────────────────────────────────────
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
        const usuarioActual: Usuario = data.user;

        if (usuarioActual.role !== "estudiante") {
          router.replace("/funcionario/dashboard");
          return;
        }

        setUsuario(usuarioActual);
      } catch {
        router.replace("/");
      } finally {
        setCargandoSesion(false);
      }
    }

    verificarSesion();
  }, [router]);

  // ── Cargar solicitud cuando hay sesión ────────────────────────────────────
  useEffect(() => {
    if (!usuario) return;

    obtenerSolicitudDetalle()
      .then(setSolicitud)
      .catch(() => {
        setSolicitud(null);
        setErrorDatos(true);
      });
  }, [usuario]);

  // ── Estados de carga ─────────────────────────────────────────────────────
  if (cargandoSesion || !usuario) {
    return (
      <div className={styles.cargando} aria-live="polite">
        <span className={styles.spinner} aria-hidden="true" />
        <p>Verificando sesión...</p>
      </div>
    );
  }

  if (errorDatos || !solicitud) {
    return (
      <>
        <Navbar tipoUsuario={usuario.role} nombreUsuario={usuario.name} />
        <main className={styles.page}>
          <p className={styles.textoError}>
            No fue posible cargar la preinscripción. Intenta recargar la página.
          </p>
        </main>
      </>
    );
  }

  const { estudiante, documentos, politicaReenvios } = solicitud;
  const estadoGeneral = derivarEstadoGeneral(documentos);

  return (
    <>
      <Navbar
        tipoUsuario={usuario.role}
        nombreUsuario={usuario.name}
        nivel={estudiante.nivel}
      />

      <main className={styles.page}>
        {/* ── Breadcrumb + Título ─────────────────────────────────────────── */}
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

        {/* ── Tarjeta del estudiante ──────────────────────────────────────── */}
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

        {/* ── Banner de estado general ────────────────────────────────────── */}
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

        {/* ── Pestañas ────────────────────────────────────────────────────── */}
        <div className={styles.tabs} role="tablist" aria-label="Secciones de la preinscripción">
          <button
            type="button"
            role="tab"
            aria-selected={pestana === "resumen"}
            aria-controls="panel-resumen"
            id="tab-resumen"
            className={pestana === "resumen" ? styles.tabActiva : styles.tab}
            onClick={() => setPestana("resumen")}
          >
            Resumen documental
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={pestana === "informacion"}
            aria-controls="panel-informacion"
            id="tab-informacion"
            className={pestana === "informacion" ? styles.tabActiva : styles.tab}
            onClick={() => setPestana("informacion")}
          >
            Tu información
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={pestana === "documentos"}
            aria-controls="panel-documentos"
            id="tab-documentos"
            className={pestana === "documentos" ? styles.tabActiva : styles.tab}
            onClick={() => setPestana("documentos")}
          >
            Tus documentos
          </button>
        </div>

        {/* ── Contenido de pestañas (placeholder por ahora) ───────────────── */}
        <div className={styles.panel}>
          {pestana === "resumen" && (
            <div
              role="tabpanel"
              id="panel-resumen"
              aria-labelledby="tab-resumen"
            >
              <h2 className={styles.panelTitle}>Resumen documental</h2>
              <p className={styles.panelSubtitle}>
                Resultado general del análisis automático de los documentos
                suministrados.
              </p>
              <p className={styles.placeholder}>
                (Contenido de Resumen documental — se implementa en Fase 3)
              </p>
            </div>
          )}

          {pestana === "informacion" && (
            <div
              role="tabpanel"
              id="panel-informacion"
              aria-labelledby="tab-informacion"
            >
              <h2 className={styles.panelTitle}>Tu información</h2>
              <p className={styles.panelSubtitle}>
                Información suministrada durante la inscripción. Es solo de
                consulta.
              </p>
              <p className={styles.placeholder}>
                (Contenido de Tu información — se implementa en Fase 3)
              </p>
            </div>
          )}

          {pestana === "documentos" && (
            <div
              role="tabpanel"
              id="panel-documentos"
              aria-labelledby="tab-documentos"
            >
              <h2 className={styles.panelTitle}>Tus documentos</h2>
              <p className={styles.panelSubtitle}>
                Resultado del análisis automático de cada documento requerido
                para pregrado.
              </p>
              <p className={styles.placeholder}>
                (Contenido de Tus documentos — se implementa en Fase 3)
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}