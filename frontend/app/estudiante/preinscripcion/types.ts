import type { DatosInformacionEstudiante } from "@/app/components/informacion_estudiante/types";
import type { ContextoPeriodo } from "../iniciar_preinscripcion/PeriodoInscripcion";
/**
 * types.ts — Tipos de dominio para la página de detalle de preinscripción del estudiante.
 *
 * Se alinean con los contratos de estudiante/home/api.ts y se extienden
 * para soportar múltiples resultados por documento (ej. Paz y Salvo).
 */

export type NivelAcademico = "PREGRADO" | "POSGRADO";

/** Estados de validación de un documento (valores de UI) */
export type EstadoDocumento =
  | "valido"
  | "no_valido"
  | "inconsistente"
  | "por_revisar";

/** Claves de negocio de los documentos de pregrado */
export type TipoDocumento =
  | "identification"
  | "academic_evaluation"
  | "estampilla_pro_cultura"
  | "saber_pro"
  | "paz_y_salvo_bib";

/** Un resultado individual de análisis (un documento puede tener varios) */
export interface ResultadoAnalisis {
  estado: EstadoDocumento;
  /** Mensaje legible. Viene del backend o se resuelve con messages.ts */
  mensaje: string;
  /** Confianza opcional (ej. cédula 98%) */
  confianza?: number;
}

export interface DocumentoSolicitud {
  version?: number;
  id?: string;
  orden?: number;
  expiraEn?: string;
  archivoDisponible?: boolean;
  analisis?: {
    extracted_data?: Record<string, { value: string | number | boolean | null; confidence: number | null }>;
    rules?: { rule: string; result: string; message: string }[];
    errors?: string[];
    validation_status?: string;
    estado_procesamiento?: string;
  } | null;
  /** Clave de negocio */
  tipo: TipoDocumento;
  /** Nombre legible */
  nombre: string;
  /** Descripción corta para la lista de estado */
  descripcion: string;
  /** Uno o varios resultados (Paz y Salvo puede tener varios) */
  resultados: ResultadoAnalisis[];
  /**
   * Indica si el backend permite reenviar este documento.
   * La UI NUNCA lo deduce del estado; solo usa este flag.
   */
  resubmission_allowed: boolean;
  /** Nombre del archivo actual (si existe) */
  fileName?: string;
}

export interface InformacionEstudiante {
  codigo: string;
  nombre: string;
  tipoDocumento: string;
  numeroDocumento: string;
  fechaNacimiento: string;
  programa: string;
  facultad: string;
  nivel: NivelAcademico;
  correo: string;
  telefono: string;
  ciudad: string;
  fechaSolicitud: string;
}

export interface PoliticaReenvios {
  /** Reenvíos ya usados hoy */
  usados: number;
  /** Límite diario */
  limite: number;
  /** Zona horaria de reinicio */
  zona: "America/Bogota";
}

export interface SolicitudDetalle {
  estadoSolicitud: string;
  estadoAnalisis: "pendiente" | "registrado";
  informacion: DatosInformacionEstudiante;
  id: string;
  estudiante: InformacionEstudiante;
  documentos: DocumentoSolicitud[];
  periodos?: ContextoPeriodo | null;
  politicaReenvios: PoliticaReenvios;
}

/** Estado general de la preinscripción (derivado en UI, pero tipado aquí) */
export type EstadoGeneral =
  | "lista_para_continuar"
  | "requiere_correccion"
  | "por_revisar";