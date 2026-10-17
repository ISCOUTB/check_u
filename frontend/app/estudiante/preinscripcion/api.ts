/**
 * api.ts — Capa de datos simulados para el detalle de preinscripción del estudiante.
 *
 * ⚠️  SIMULADO: Cuando el backend exponga los endpoints reales, reemplaza
 * el cuerpo de cada función y elimina los comentarios "SIMULADO".
 *
 * REAL hoy:   GET ${API_URL}/auth/me
 * TODO:       GET ${API_URL}/solicitudes/activa (o /solicitudes/mia)
 * TODO:       POST ${API_URL}/solicitudes/:id/documentos (reenvío)
 */

import type {
  DocumentoSolicitud,
  InformacionEstudiante,
  PoliticaReenvios,
  SolicitudDetalle,
  TipoDocumento,
} from "./types";
import { obtenerMensaje } from "./messages";

// ─────────────────────────────────────────────────────────────────────────────
// Control de escenario de demostración
// Cambia este valor para probar los distintos casos del issue.
// ─────────────────────────────────────────────────────────────────────────────

export type EscenarioDemo =
  | "mixto" // Caso de las capturas: 1 válido + 4 con problemas
  | "todos_validos"
  | "sin_reenvios"
  | "paz_salvo_multiple";

export const ESCENARIO_DEMO: EscenarioDemo = "mixto";

// ─────────────────────────────────────────────────────────────────────────────
// Datos base del estudiante (coinciden con las capturas)
// ─────────────────────────────────────────────────────────────────────────────

const ESTUDIANTE_DEMO: InformacionEstudiante = {
  codigo: "T00012345",
  nombre: "Lisandro Zapata",
  tipoDocumento: "Cédula de ciudadanía",
  numeroDocumento: "1.234.567.890",
  fechaNacimiento: "12 de marzo de 2003",
  programa: "Ingeniería de Sistemas y Computación",
  facultad: "Facultad de Ingeniería",
  nivel: "PREGRADO",
  correo: "lizapata@utb.edu.co",
  telefono: "300 123 4567",
  ciudad: "Cartagena de Indias",
  fechaSolicitud: "7 de octubre de 2026",
};

const POLITICA_NORMAL: PoliticaReenvios = {
  usados: 1,
  limite: 3,
  zona: "America/Bogota",
};

const POLITICA_SIN_CUPOS: PoliticaReenvios = {
  usados: 3,
  limite: 3,
  zona: "America/Bogota",
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper para construir un documento
// ─────────────────────────────────────────────────────────────────────────────

function crearDocumento(
  tipo: TipoDocumento,
  nombre: string,
  descripcion: string,
  estados: Array<{ estado: DocumentoSolicitud["resultados"][0]["estado"]; confianza?: number }>,
  resubmission_allowed: boolean,
  fileName?: string
): DocumentoSolicitud {
  return {
    tipo,
    nombre,
    descripcion,
    resultados: estados.map(({ estado, confianza }) => ({
      estado,
      mensaje: obtenerMensaje(tipo, estado, confianza),
      confianza,
    })),
    resubmission_allowed,
    fileName,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Escenarios
// ─────────────────────────────────────────────────────────────────────────────

function documentosMixto(): DocumentoSolicitud[] {
  return [
    crearDocumento(
      "identification",
      "Cédula de ciudadanía",
      "Documento de identificación del estudiante",
      [{ estado: "inconsistente" }],
      true
    ),
    crearDocumento(
      "academic_evaluation",
      "Evaluación de Grado expedida por Banner",
      "Evaluación generada por el sistema académico",
      [{ estado: "valido" }],
      false
    ),
    crearDocumento(
      "estampilla_pro_cultura",
      "Comprobante de pago de estampilla Pro-Cultura",
      "Comprobante de la estampilla de la Gobernación",
      [{ estado: "por_revisar" }],
      true
    ),
    crearDocumento(
      "saber_pro",
      "Resultados de las Pruebas Saber Pro",
      "Reporte de resultados de las pruebas de Estado",
      [{ estado: "no_valido" }],
      true
    ),
    crearDocumento(
      "paz_y_salvo_bib",
      "Paz y Salvo de Biblioteca",
      "Certificado expedido por la Biblioteca",
      [{ estado: "no_valido" }, { estado: "inconsistente" }],
      true
    ),
  ];
}

function documentosTodosValidos(): DocumentoSolicitud[] {
  return [
    crearDocumento(
      "identification",
      "Cédula de ciudadanía",
      "Documento de identificación del estudiante",
      [{ estado: "valido", confianza: 98 }],
      false
    ),
    crearDocumento(
      "academic_evaluation",
      "Evaluación de Grado expedida por Banner",
      "Evaluación generada por el sistema académico",
      [{ estado: "valido" }],
      false
    ),
    crearDocumento(
      "estampilla_pro_cultura",
      "Comprobante de pago de estampilla Pro-Cultura",
      "Comprobante de la estampilla de la Gobernación",
      [{ estado: "valido" }],
      false
    ),
    crearDocumento(
      "saber_pro",
      "Resultados de las Pruebas Saber Pro",
      "Reporte de resultados de las pruebas de Estado",
      [{ estado: "valido" }],
      false
    ),
    crearDocumento(
      "paz_y_salvo_bib",
      "Paz y Salvo de Biblioteca",
      "Certificado expedido por la Biblioteca",
      [{ estado: "valido" }],
      false
    ),
  ];
}

function documentosPazSalvoMultiple(): DocumentoSolicitud[] {
  const base = documentosMixto();
  // Ya incluye Paz y Salvo con dos resultados
  return base;
}

// ─────────────────────────────────────────────────────────────────────────────
// Funciones públicas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene el detalle de la solicitud activa del estudiante autenticado.
 *
 * SIMULADO — TODO: GET ${API_URL}/solicitudes/activa
 * (o el endpoint que defina el backend)
 */
export async function obtenerSolicitudDetalle(): Promise<SolicitudDetalle> {
  // Simula latencia de red
  await new Promise((r) => setTimeout(r, 120));

  let documentos: DocumentoSolicitud[];
  let politica = POLITICA_NORMAL;

  switch (ESCENARIO_DEMO) {
    case "todos_validos":
      documentos = documentosTodosValidos();
      break;
    case "sin_reenvios":
      documentos = documentosMixto();
      politica = POLITICA_SIN_CUPOS;
      break;
    case "paz_salvo_multiple":
      documentos = documentosPazSalvoMultiple();
      break;
    case "mixto":
    default:
      documentos = documentosMixto();
      break;
  }

  return {
    id: "sol-detalle-001",
    estudiante: ESTUDIANTE_DEMO,
    documentos,
    politicaReenvios: politica,
  };
}

/**
 * Simula el envío de documentos seleccionados para reenvío.
 *
 * SIMULADO — TODO: POST ${API_URL}/solicitudes/:id/documentos
 * Debe enviar clave de idempotencia.
 */
export async function enviarDocumentosReenvio(
  _solicitudId: string,
  tipos: TipoDocumento[],
  idempotencyKey: string
): Promise<{ ok: boolean; mensaje: string }> {
  await new Promise((r) => setTimeout(r, 400));

  // SIMULADO: en producción se envía la cabecera Idempotency-Key
  void idempotencyKey;

  if (tipos.length === 0) {
    return { ok: false, mensaje: "No hay documentos seleccionados." };
  }

  return {
    ok: true,
    mensaje: `Se enviaron ${tipos.length} documento(s) para revalidación.`,
  };
}