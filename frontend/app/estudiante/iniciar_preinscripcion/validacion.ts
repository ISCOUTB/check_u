/**
 * validacion.ts — Qué falta en el borrador, cuánto se lleva y cómo se revisa un PDF.
 *
 * Son funciones puras, sin React: reciben el borrador y devuelven datos.
 * No modifican el borrador ni reescriben lo que escribió el estudiante.
 */

import {
  documentosRequeridos,
  type DocumentoDelFormulario,
  type NivelAcademico as Nivel,
} from '@/app/estudiante/documentos-requeridos';
import { borradorVacio, type BorradorPreinscripcion } from './tipos';

// ─────────────────────────────────────────────────────────────────────────────
// Documentos requeridos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve los documentos que debe cargar el estudiante.
 * Incluye el Paz y Salvo y agrega una segunda estampilla cuando corresponde.
 */
function obtenerDocumentosRequeridos(
  nivel: Nivel,
  segundoPrograma: boolean,
): DocumentoDelFormulario[] {
  return documentosRequeridos(nivel, segundoPrograma);
}

// ─────────────────────────────────────────────────────────────────────────────
// IDs de la página
// ─────────────────────────────────────────────────────────────────────────────

/** Los campos que aparecen una sola vez en el formulario. */
export const ID_CAMPOS = {
  nombres: 'campo-nombres',
  apellidos: 'campo-apellidos',
  tipoDocumento: 'campo-tipo-documento',
  numeroDocumento: 'campo-numero-documento',
  fechaNacimiento: 'campo-fecha-nacimiento',
  genero: 'campo-genero',
  correo: 'campo-correo',
  telefonoFijo: 'campo-telefono-fijo',
  celular: 'campo-celular',
  departamento: 'campo-departamento',
  ciudad: 'campo-ciudad',
  direccion: 'campo-direccion',
  tieneDiscapacidad: 'campo-tiene-discapacidad',
  tipoDiscapacidad: 'campo-tipo-discapacidad',
  detallesAsistencia: 'campo-detalles-asistencia',
  codigoEstudiantil: 'campo-codigo-estudiantil',
  segundoPrograma: 'campo-segundo-programa',
  conoceRegistroSaberPro: 'campo-conoce-registro-saber-pro',
  numeroRegistroSaberPro: 'campo-numero-registro-saber-pro',
  fechaExamenSaberPro: 'campo-fecha-examen-saber-pro',
  esEmpleadoUtb: 'campo-es-empleado-utb',
  tipoContrato: 'campo-tipo-contrato',
  esHijoDeEmpleadoUtb: 'campo-es-hijo-de-empleado-utb',
  nivelEstudios: 'campo-nivel-estudios',
  tituloObtenido: 'campo-titulo-obtenido',
  esEgresadoPregradoUtb: 'campo-es-egresado-pregrado-utb',
} as const;

/** Orden de un programa o de un cargo: 1 es el primero y 2 es el segundo. */
export type Orden = 1 | 2;

const BASE_CAMPO_PROGRAMA = {
  programa: 'campo-programa',
  modalidad: 'campo-modalidad',
  tipoOpcionGrado: 'campo-opcion-grado',
} as const;

export type CampoPrograma = keyof typeof BASE_CAMPO_PROGRAMA;

/** Genera el ID de un campo de programa. */
export function idCampoPrograma(campo: CampoPrograma, orden: Orden): string {
  return `${BASE_CAMPO_PROGRAMA[campo]}-${orden}`;
}

const BASE_CAMPO_EXPERIENCIA = {
  empresa: 'campo-empresa',
  cargo: 'campo-cargo',
  tiempo: 'campo-tiempo',
} as const;

export type CampoExperiencia = keyof typeof BASE_CAMPO_EXPERIENCIA;

/** Genera el ID de un campo de experiencia. */
export function idCampoExperiencia(
  campo: CampoExperiencia,
  orden: Orden,
): string {
  return `${BASE_CAMPO_EXPERIENCIA[campo]}-${orden}`;
}

/** Genera el ID de la zona de carga de un documento. */
export function idDocumento(id: string): string {
  return `documento-${id}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Secciones
// ─────────────────────────────────────────────────────────────────────────────

export type SeccionId =
  | 'identificacion'
  | 'contacto'
  | 'academico'
  | 'saber_pro'
  | 'estudios'
  | 'documentos';

export const SECCIONES: Record<SeccionId, string> = {
  identificacion: 'Identificación',
  contacto: 'Contacto y residencia',
  academico: 'Información académica',
  saber_pro: 'Saber Pro y vinculación con la UTB',
  estudios: 'Estudios y experiencia',
  documentos: 'Documentos',
};

/** Devuelve las secciones que corresponden al nivel académico. */
export function seccionesDelNivel(nivel: Nivel): SeccionId[] {
  return nivel === 'PREGRADO'
    ? ['identificacion', 'contacto', 'academico', 'saber_pro', 'documentos']
    : ['identificacion', 'contacto', 'academico', 'estudios', 'documentos'];
}

// ─────────────────────────────────────────────────────────────────────────────
// Faltantes
// ─────────────────────────────────────────────────────────────────────────────

export const MENSAJE_OBLIGATORIO = 'Completa este campo.';
export const MENSAJE_DOCUMENTO = 'Carga este documento en PDF.';

export interface CampoFaltante {
  /** ID del elemento en la página. */
  id: string;
  seccion: SeccionId;
  /** Nombre del campo o documento que ve el estudiante. */
  etiqueta: string;
  mensaje: string;
}

function estaVacio(texto: string | undefined): boolean {
  return (texto ?? '').trim() === '';
}

function documentoCargado(
  borrador: BorradorPreinscripcion,
  id: string,
): boolean {
  if (borrador.documentos[id]) return true;
  if (id === 'estampilla_pro_cultura-2' && borrador.documentos['estampilla2'])
    return true;
  if (id === 'estampilla2' && borrador.documentos['estampilla_pro_cultura-2'])
    return true;
  return false;
}

/**
 * Devuelve los campos y documentos obligatorios pendientes.
 * Si todo está completo, devuelve un arreglo vacío.
 */
export function faltantes(borrador: BorradorPreinscripcion): CampoFaltante[] {
  const resultado: CampoFaltante[] = [];

  const exigir = (
    texto: string | undefined,
    id: string,
    seccion: SeccionId,
    etiqueta: string,
  ) => {
    if (estaVacio(texto)) {
      resultado.push({ id, seccion, etiqueta, mensaje: MENSAJE_OBLIGATORIO });
    }
  };

  exigir(borrador.nombres, ID_CAMPOS.nombres, 'identificacion', 'Nombres');
  exigir(
    borrador.apellidos,
    ID_CAMPOS.apellidos,
    'identificacion',
    'Apellidos',
  );
  exigir(
    borrador.perfil.tipoDocumento,
    ID_CAMPOS.tipoDocumento,
    'identificacion',
    'Tipo de documento',
  );
  exigir(
    borrador.perfil.numeroDocumento,
    ID_CAMPOS.numeroDocumento,
    'identificacion',
    'Número de documento',
  );
  exigir(
    borrador.perfil.fechaNacimiento,
    ID_CAMPOS.fechaNacimiento,
    'identificacion',
    'Fecha de nacimiento',
  );
  exigir(
    borrador.perfil.genero,
    ID_CAMPOS.genero,
    'identificacion',
    'Género',
  );

  const exigirRespuesta = (
    respuesta: boolean | null,
    id: string,
    seccion: SeccionId,
    etiqueta: string,
  ) => {
    if (respuesta === null) {
      resultado.push({ id, seccion, etiqueta, mensaje: MENSAJE_OBLIGATORIO });
    }
  };

  /** Los campos de un programa; la opción de grado solo existe en pregrado. */
  const exigirPrograma = (orden: Orden) => {
    const solicitud = borrador.programas[orden - 1];
    const sufijo = orden === 2 ? ' (segundo programa)' : '';

    exigir(
      solicitud?.modalidad,
      idCampoPrograma('modalidad', orden),
      'academico',
      `Modalidad${sufijo}`,
    );
    exigir(
      solicitud?.programa,
      idCampoPrograma('programa', orden),
      'academico',
      `Programa${sufijo}`,
    );
    if (borrador.nivel === 'PREGRADO') {
      exigir(
        solicitud?.tipoOpcionGrado,
        idCampoPrograma('tipoOpcionGrado', orden),
        'academico',
        `Opción de grado${sufijo}`,
      );
    }
  };

  exigir(
    borrador.codigoEstudiantil,
    ID_CAMPOS.codigoEstudiantil,
    'academico',
    'Código estudiantil',
  );
  exigirPrograma(1);
  exigirRespuesta(
    borrador.segundoPrograma,
    ID_CAMPOS.segundoPrograma,
    'academico',
    '¿Solicitas grado en un segundo programa?',
  );
  if (borrador.segundoPrograma === true) exigirPrograma(2);

  exigir(
    borrador.perfil.celular,
    ID_CAMPOS.celular,
    'contacto',
    'Celular',
  );
  exigir(
    borrador.perfil.departamento,
    ID_CAMPOS.departamento,
    'contacto',
    'Departamento',
  );
  exigir(
    borrador.perfil.ciudad,
    ID_CAMPOS.ciudad,
    'contacto',
    'Ciudad o municipio',
  );
  exigir(
    borrador.perfil.direccion,
    ID_CAMPOS.direccion,
    'contacto',
    'Dirección',
  );
  exigirRespuesta(
    borrador.perfil.tieneDiscapacidad,
    ID_CAMPOS.tieneDiscapacidad,
    'contacto',
    '¿Posee alguna discapacidad?',
  );
  // El tipo solo se exige cuando la respuesta es afirmativa; los detalles son opcionales.
  if (borrador.perfil.tieneDiscapacidad === true) {
    exigir(
      borrador.perfil.tipoDiscapacidad,
      ID_CAMPOS.tipoDiscapacidad,
      'contacto',
      'Tipo de discapacidad',
    );
  }

  // Saber Pro y vinculación solo se preguntan en pregrado.
  if (borrador.nivel === 'PREGRADO') {
    exigirRespuesta(
      borrador.pregrado.conoceRegistroSaberPro,
      ID_CAMPOS.conoceRegistroSaberPro,
      'saber_pro',
      '¿Conoces tu número de registro?',
    );
    if (borrador.pregrado.conoceRegistroSaberPro === true) {
      exigir(
        borrador.pregrado.numeroRegistroSaberPro,
        ID_CAMPOS.numeroRegistroSaberPro,
        'saber_pro',
        'Número de registro',
      );
    }
    // La fecha del examen no depende de conocer el número de registro.
    exigir(
      borrador.pregrado.fechaExamenSaberPro,
      ID_CAMPOS.fechaExamenSaberPro,
      'saber_pro',
      'Fecha del examen',
    );
    exigirRespuesta(
      borrador.pregrado.esEmpleadoUtb,
      ID_CAMPOS.esEmpleadoUtb,
      'saber_pro',
      '¿Eres empleado de la UTB?',
    );
    exigirRespuesta(
      borrador.pregrado.esHijoDeEmpleadoUtb,
      ID_CAMPOS.esHijoDeEmpleadoUtb,
      'saber_pro',
      '¿Eres hijo o hija de un empleado de la UTB?',
    );
  } else if (borrador.nivel === 'POSGRADO') {
    exigir(
      borrador.posgrado.nivelEstudios,
      ID_CAMPOS.nivelEstudios,
      'estudios',
      'Nivel de estudios alcanzado',
    );
    exigir(
      borrador.posgrado.tituloObtenido,
      ID_CAMPOS.tituloObtenido,
      'estudios',
      'Título obtenido',
    );
    exigirRespuesta(
      borrador.posgrado.esEgresadoPregradoUtb,
      ID_CAMPOS.esEgresadoPregradoUtb,
      'estudios',
      '¿Eres egresado o egresada de un pregrado de la UTB?',
    );
  }

  const documentos = obtenerDocumentosRequeridos(
    borrador.nivel,
    borrador.segundoPrograma === true,
  );

  for (const documento of documentos) {
    if (!documentoCargado(borrador, documento.id)) {
      resultado.push({
        id: idDocumento(documento.id),
        seccion: 'documentos',
        etiqueta: documento.etiqueta,
        mensaje: MENSAJE_DOCUMENTO,
      });
    }
  }

  return resultado;
}

/**
 * Determina qué secciones tienen campos obligatorios según el nivel académico.
 * La sección de documentos se calcula por separado.
 */
function seccionesConObligatorios(nivel: Nivel): Set<SeccionId> {
  return new Set(
    faltantes(borradorVacio(nivel, ''))
      .map((pendiente) => pendiente.seccion)
      .filter((seccion) => seccion !== 'documentos'),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Progreso
// ─────────────────────────────────────────────────────────────────────────────

export interface ProgresoSeccion {
  id: SeccionId;
  titulo: string;
  /** Campos obligatorios sin completar o documentos requeridos sin cargar. */
  faltan: number;
  /** Indica si la sección no tiene campos obligatorios para este nivel. */
  opcional: boolean;
}

export interface Progreso {
  /** Secciones del nivel, en orden, incluida la sección de documentos. */
  secciones: ProgresoSeccion[];
  documentos: { cargados: number; requeridos: number };
  /** Secciones con campos pendientes, sin contar documentos. */
  seccionesPendientes: number;
  documentosPendientes: number;
  /** Indica si el formulario está listo para enviarse. */
  listo: boolean;
}

/** Calcula el progreso del estudiante. */
export function progreso(borrador: BorradorPreinscripcion): Progreso {
  const pendientes = faltantes(borrador);
  const requeridos = obtenerDocumentosRequeridos(
    borrador.nivel,
    borrador.segundoPrograma === true,
  );

  const cargados = requeridos.filter((documento) =>
    documentoCargado(borrador, documento.id),
  ).length;
  const conObligatorios = seccionesConObligatorios(borrador.nivel);

  const secciones = seccionesDelNivel(borrador.nivel).map((id) => ({
    id,
    titulo: SECCIONES[id],
    faltan: pendientes.filter((pendiente) => pendiente.seccion === id).length,
    opcional: id !== 'documentos' && !conObligatorios.has(id),
  }));

  return {
    secciones,
    documentos: { cargados, requeridos: requeridos.length },
    seccionesPendientes: secciones.filter(
      (seccion) => seccion.id !== 'documentos' && seccion.faltan > 0,
    ).length,
    documentosPendientes: requeridos.length - cargados,
    listo: pendientes.length === 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Formato
// ─────────────────────────────────────────────────────────────────────────────

/** Deja solo letras y dígitos; quita puntos, comas, espacios y guiones. */
export function limpiarNumeroDocumento(texto: string): string {
  return texto.replace(/[^A-Za-z0-9]/g, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// Formato y validación de PDF (Tarea 47)
// ─────────────────────────────────────────────────────────────────────────────

/** Límite fijo de la Tarea 47: 5 MB por documento. */
export const TAMANO_MAXIMO_PDF_MB = 5;
export const TAMANO_MAXIMO_PDF_BYTES = TAMANO_MAXIMO_PDF_MB * 1024 * 1024;

export const MENSAJE_NO_ES_PDF = 'Solo se aceptan archivos PDF.';

const FORMATO_MEGAS = new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

/** Extensión o subtipo MIME legible (JPG, PNG, PDF, …). */
export function tipoArchivoVisible(nombre: string, mime: string): string {
  const ext = nombre.split('.').pop()?.trim().toUpperCase();
  if (ext && /^[A-Z0-9]{1,5}$/.test(ext)) {
    return ext === 'JPEG' ? 'JPG' : ext;
  }
  const sub = mime?.split('/')[1]?.toUpperCase();
  if (sub) return sub.replace('JPEG', 'JPG');
  return 'desconocido';
}

export function mensajeRechazoArchivo(archivo: {
  name: string;
  type: string;
  size: number;
}): string {
  const tipo = tipoArchivoVisible(archivo.name, archivo.type);
  const megas = Math.max(0.1, archivo.size / (1024 * 1024));
  const n = FORMATO_MEGAS.format(megas);
  return `Intento subir un archivo ${tipo} de ${n} MB. Solo se aceptan PDF de máximo ${TAMANO_MAXIMO_PDF_MB} MB. Verifica e intenta de nuevo.`;
}

/**
 * Comprueba extensión, tipo MIME y tamaño (máx. 5 MB por defecto).
 * No lee el contenido; la firma %PDF- se valida aparte con tieneFirmaPdf.
 */
export function validarPdf(
  archivo: { name: string; type: string; size: number },
  maximo: number | null = TAMANO_MAXIMO_PDF_BYTES,
): string | null {
  const nombrePdf = /\.pdf$/i.test(archivo.name);
  const mime = (archivo.type || '').toLowerCase();
  const mimePdf = mime === '' || mime === 'application/pdf';

  if (!nombrePdf || !mimePdf) {
    return mensajeRechazoArchivo(archivo);
  }
  if (archivo.size === 0) return 'El archivo está vacío.';
  if (maximo !== null && archivo.size > maximo) {
    return mensajeRechazoArchivo(archivo);
  }
  return null;
}

/** Firma inicial de un archivo PDF: "%PDF-". */
const FIRMA_PDF = [0x25, 0x50, 0x44, 0x46, 0x2d];

/** Número máximo de bytes en los que se busca la firma. */
const BYTES_CON_FIRMA = 1024;

/**
 * Comprueba que el archivo tenga la firma de un PDF en sus primeros bytes.
 * Lee como máximo el primer KB y no guarda ni envía el archivo.
 */
export async function tieneFirmaPdf(archivo: Blob): Promise<boolean> {
  const bytes = new Uint8Array(
    await archivo.slice(0, BYTES_CON_FIRMA).arrayBuffer(),
  );

  for (let inicio = 0; inicio + FIRMA_PDF.length <= bytes.length; inicio++) {
    if (FIRMA_PDF.every((byte, i) => bytes[inicio + i] === byte)) {
      return true;
    }
  }

  return false;
}
