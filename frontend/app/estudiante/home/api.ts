/**
 * api.ts — Contratos de tipos y datos simulados para la Home del estudiante.
 *
 * SIMULADO: Todas las funciones que no sean obtenerSesion() devuelven datos
 * de ejemplo. Cuando el backend exponga los endpoints reales, reemplaza el
 * cuerpo de cada función con la llamada real y elimina el comentario "SIMULADO".
 *
 * REAL:   GET ${API_URL}/auth/me           → Usuario
 * TODO:   GET ${API_URL}/solicitudes/activa → Solicitud | null
 * TODO:   GET ${API_URL}/notificaciones     → Notificacion[]
 * TODO:   GET ${API_URL}/politica-reenvios  → PoliticaReenvios
 */

import { DOCUMENTOS_REQUERIDOS, type Nivel } from "../documentos-requeridos";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de dominio
// ─────────────────────────────────────────────────────────────────────────────

/** Alias de `Nivel`, que vive junto a la lista única de documentos requeridos. */
export type NivelAcademico = Nivel;

/** Estado de validación de un documento ya procesado */
export type EstadoDocumento =
    | "valido"
    | "no_valido"
    | "inconsistente"
    | "por_revisar"
    | "procesando";

/** Estado cuando aún no se ha cargado ningún archivo */
export type EstadoCargaDocumento = "falta_cargar";

export type EstadoDocumentoCompleto = EstadoDocumento | EstadoCargaDocumento;

export interface DocumentoSolicitud {
    /** Clave de negocio (ej. "identification", "paz_y_salvo_bib") */
    tipo: string;
    /** Nombre legible para mostrar en la UI */
    nombre: string;
    estado: EstadoDocumentoCompleto;
    /**
     * Mensaje breve del motivo cuando el estado es "no_valido".
     * El backend es quien lo establece; la UI solo lo muestra.
     */
    motivoRechazo?: string;
    /**
     * Cuando true, el backend autoriza subir una nueva versión aunque el
     * documento ya fue procesado (corrección explícita). Solo el backend
     * lo decide; la UI nunca lo deduce por el estado.
     */
    correccionAutorizada?: boolean;
}

export interface Solicitud {
    id: string;
    nivel: NivelAcademico;
    documentos: DocumentoSolicitud[];
}

export interface Notificacion {
    id: string;
    titulo: string;
    descripcion: string;
    /** ISO 8601 en zona America/Bogota */
    fecha: string;
}

export interface PoliticaReenvios {
    usados: number;
    limite: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Control de escenario de demostración
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cambia este valor para probar los tres casos requeridos:
 *   - "con_solicitud":      Solicitud activa con progreso + notificaciones recientes
 *   - "sin_solicitud":      Sin solicitud activa (botón iniciar) + sin notificaciones
 *   - "sin_notificaciones": Con solicitud activa + estado vacío de notificaciones
 */
export const ESCENARIO_DEMO: "con_solicitud" | "sin_solicitud" | "sin_notificaciones" =
    "con_solicitud";

// ─────────────────────────────────────────────────────────────────────────────
// Datos de ejemplo
// ─────────────────────────────────────────────────────────────────────────────

const DOCUMENTOS_CON_SOLICITUD_PREGRADO: DocumentoSolicitud[] = [
    {
        tipo: "identification",
        nombre: "Cédula de ciudadanía",
        estado: "no_valido",
        motivoRechazo: "La imagen no permite leer el número.",
        correccionAutorizada: true,
    },
    {
        tipo: "academic_evaluation",
        nombre: "Evaluación de Grado (Banner)",
        estado: "valido",
    },
    {
        tipo: "paz_y_salvo_bib",
        nombre: "Paz y Salvo de Biblioteca",
        estado: "por_revisar",
    },
    {
        tipo: "estampilla_pro_cultura",
        nombre: "Estampilla Pro-Cultura",
        estado: "falta_cargar",
    },
    {
        tipo: "saber_pro",
        nombre: "Resultados Saber Pro",
        estado: "falta_cargar",
    },
];

const SOLICITUD_DEMO_PREGRADO: Solicitud = {
    id: "sol-001",
    nivel: "PREGRADO",
    documentos: DOCUMENTOS_CON_SOLICITUD_PREGRADO,
};

const NOTIFICACIONES_DEMO: Notificacion[] = [
    {
        id: "n1",
        titulo: "Cédula: se necesita una nueva versión",
        descripcion: "La imagen no permite leer el número con claridad.",
        fecha: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    {
        id: "n2",
        titulo: "Paz y Salvo en revisión",
        descripcion: "No necesitas hacer nada por ahora.",
        fecha: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: "n3",
        titulo: "Evaluación de Grado válida",
        descripcion: "Ya cumple los requisitos revisados.",
        fecha: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    },
];

const POLITICA_DEMO: PoliticaReenvios = { usados: 1, limite: 3 };

// ─────────────────────────────────────────────────────────────────────────────
// Funciones públicas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Nivel académico del estudiante.
 *
 * SIMULADO — TODO: este dato debe venir de /auth/me cuando el backend lo incluya.
 * El campo `nivel` en el tipo Usuario ya es opcional para recibirlo sin romper
 * la sesión si el backend todavía no lo envía.
 */
export async function obtenerNivelSimulado(): Promise<NivelAcademico> {
    await new Promise((r) => setTimeout(r, 0));
    return "PREGRADO";
}

/**
 * Solicitud activa del estudiante autenticado, o null si no tiene.
 *
 * SIMULADO — TODO: GET ${API_URL}/solicitudes/activa
 */
export async function obtenerSolicitudActiva(): Promise<Solicitud | null> {
    await new Promise((r) => setTimeout(r, 100));

    const escenario =
        (typeof window !== "undefined" &&
            (window as unknown as { __CHECKU_ESCENARIO__?: string }).__CHECKU_ESCENARIO__) ||
        ESCENARIO_DEMO;

    if (escenario === "con_solicitud" || escenario === "sin_notificaciones") {
        return SOLICITUD_DEMO_PREGRADO;
    }
    return null;
}

/**
 * Notificaciones recientes del estudiante autenticado.
 *
 * SIMULADO — TODO: GET ${API_URL}/notificaciones
 */
export async function obtenerNotificaciones(): Promise<Notificacion[]> {
    await new Promise((r) => setTimeout(r, 100));

    if (ESCENARIO_DEMO === "con_solicitud") {
        return NOTIFICACIONES_DEMO;
    }
    return [];
}

/**
 * Política de reenvíos de corrección del día.
 *
 * SIMULADO — TODO: GET ${API_URL}/politica-reenvios  (campo resubmission_policy)
 */
export async function obtenerPoliticaReenvios(): Promise<PoliticaReenvios> {
    await new Promise((r) => setTimeout(r, 100));
    return POLITICA_DEMO;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilitarios de presentación (sin lógica de negocio)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Etiquetas de los documentos requeridos según el nivel. Solo la UI las necesita.
 * Salen de la lista única de `../documentos-requeridos`, la misma del formulario.
 */
export const DOCUMENTOS_POR_NIVEL: Record<NivelAcademico, string[]> = {
    PREGRADO: DOCUMENTOS_REQUERIDOS.PREGRADO.map((d) => d.etiqueta),
    POSGRADO: DOCUMENTOS_REQUERIDOS.POSGRADO.map((d) => d.etiqueta),
};

/** Formatea una fecha ISO para mostrarla de forma legible. */
export function formatearFecha(iso: string): string {
    const fecha = new Date(iso);
    const ahora = new Date();
    const diffMs = ahora.getTime() - fecha.getTime();
    const diffH = diffMs / (1000 * 60 * 60);

    if (diffH < 1) return "Hace un momento";
    if (diffH < 24) {
        return `Hoy, ${fecha.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`;
    }
    if (diffH < 48) return "Ayer";
    return fecha.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}
