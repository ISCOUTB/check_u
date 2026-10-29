/** Campos del formulario de preinscripción cuyas opciones administra el funcionario. */
export const CAMPOS_OPCIONES = [
  'TIPO_DOCUMENTO',
  'GENERO',
  'PROGRAMA',
  'OPCION_GRADO',
  'TIPO_DISCAPACIDAD',
] as const;

export type CampoOpciones = (typeof CAMPOS_OPCIONES)[number];

export const ETIQUETAS_CAMPO: Record<CampoOpciones, string> = {
  TIPO_DOCUMENTO: 'Tipo de documento',
  GENERO: 'Género',
  PROGRAMA: 'Programa académico',
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
