import {
  claveDocumento,
  type DocumentoRequerido,
} from './requisitos-documentales.js';

// Tarea 42a: el estado de la solicitud sale de la versión actual de cada documento requerido.
// Todos son bloqueantes y gana el primer estado de la lista que se cumpla.

export type EstadoCalculado =
  'VALIDA' | 'NO_VALIDA' | 'INCONSISTENTE' | 'POR_REVISAR';
export interface DocumentoActual {
  tipo: string;
  orden: number;
  version: number;
  estado: string;
}

export function calcularEstadoSolicitud(
  requeridos: readonly DocumentoRequerido[],
  documentos: readonly DocumentoActual[],
): EstadoCalculado {
  const actuales = new Map<string, DocumentoActual>();
  for (const d of documentos) {
    const clave = claveDocumento(d);
    const previo = actuales.get(clave);
    if (!previo || d.version > previo.version) actuales.set(clave, d);
  }
  // Un requerido que falta se trata como uno por revisar.
  const estados = requeridos.map(
    (r) => actuales.get(claveDocumento(r))?.estado,
  );
  if (estados.includes('NO_VALIDO')) return 'NO_VALIDA';
  if (estados.includes('INCONSISTENTE')) return 'INCONSISTENTE';
  if (estados.every((e) => e === 'VALIDO')) return 'VALIDA';
  return 'POR_REVISAR';
}
