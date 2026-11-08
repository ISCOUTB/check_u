/** Campos del formulario de preinscripción cuyas opciones administra el funcionario. */
export const CAMPOS_OPCIONES = [
  'TIPO_DOCUMENTO',
  'GENERO',
  'PROGRAMA_PREGRADO',
  'PROGRAMA_POSGRADO',
  'OPCION_GRADO',
  'TIPO_DISCAPACIDAD',
] as const;

export type CampoOpciones = (typeof CAMPOS_OPCIONES)[number];

export const ETIQUETAS_CAMPO: Record<CampoOpciones, string> = {
  TIPO_DOCUMENTO: 'Tipo de documento',
  GENERO: 'Género',
  PROGRAMA_PREGRADO: 'Programa académico de Pregrado',
  PROGRAMA_POSGRADO: 'Programa académico de Posgrado',
  OPCION_GRADO: 'Opción de grado',
  TIPO_DISCAPACIDAD: 'Tipo de discapacidad',
};

export interface OpcionCampo {
  id: number;
  campo: CampoOpciones;
  /** Lo que se guarda en la solicitud. */
  valor: string;
  /** Lo que ve el estudiante. */
  etiqueta: string;
  orden: number;
}

export interface DuplicadoImportado {
  linea: number;
  valor: string;
}

export interface InvalidoImportado {
  linea: number;
  valor: string;
  motivo: string;
}

export interface ResultadoImportacion {
  campo: CampoOpciones;
  creadas: number;
  total: number;
  duplicados: DuplicadoImportado[];
  vacias: number[];
  invalidos: InvalidoImportado[];
}

export function esCampoOpciones(valor: unknown): valor is CampoOpciones {
  return typeof valor === 'string' && (CAMPOS_OPCIONES as readonly string[]).includes(valor);
}

/**
 * Valor interno estable a partir del nombre visible: sin tildes, en mayúsculas y
 * separado por guiones bajos. Se guarda tal cual en las solicitudes.
 */
export function normalizarValorOpcion(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
    .slice(0, 80);
}

/**
 * Convierte un código interno a una versión legible (sin guiones bajos y con
 * mayúsculas y minúsculas), usada cuando el código no existe en el catálogo.
 */
export function legibilizarCodigo(codigo: string): string {
  if (!codigo) return '';
  const conectores = new Set(['de', 'del', 'y', 'e', 'en', 'el', 'la', 'los', 'las', 'a', 'o', 'u']);
  const partes = codigo.trim().split(/[_\s]+/);
  return partes
    .map((parte, index) => {
      const lower = parte.toLowerCase();
      if (index > 0 && conectores.has(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

/**
 * Devuelve el nombre legible de un programa académico:
 * 1. La etiqueta del catálogo si está disponible.
 * 2. Una versión legible del código (sin guiones bajos y en mayúsculas/minúsculas) si no está en el catálogo.
 */
export function formatearPrograma(codigo?: string | null, etiqueta?: string | null): string {
  if (!codigo && !etiqueta) return '';
  if (etiqueta && etiqueta.trim()) return etiqueta.trim();
  return legibilizarCodigo(codigo ?? '');
}
