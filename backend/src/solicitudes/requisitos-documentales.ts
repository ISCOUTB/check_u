import { BadRequestException } from '@nestjs/common';
import type { TypeDocument } from '../contratos/enums.js';

// Tarea 42a: el tipo de solicitud define los documentos requeridos. Esta tabla es la única fuente
// del backend; el envío, los reenvíos y el cálculo del estado la consultan en vez de repetirla.

export type TipoSolicitud =
  | 'PREGRADO_UN_PROGRAMA'
  | 'PREGRADO_DOBLE_PROGRAMA'
  | 'POSGRADO'
  | 'POSGRADO_DOBLE_PROGRAMA';
export interface DocumentoRequerido {
  tipo: TypeDocument;
  orden: 1 | 2;
  /** Tarea 50: «consulta» = el sistema lo verifica (Paz y Salvo con ALMA); no se sube. */
  origen: 'archivo' | 'consulta';
}

const uno = (tipo: TypeDocument): DocumentoRequerido => ({
  tipo,
  orden: 1,
  origen: tipo === 'paz_y_salvo_bib' ? 'consulta' : 'archivo',
});
const segundo = (tipo: TypeDocument): DocumentoRequerido => ({
  tipo,
  orden: 2,
  origen: 'archivo',
});

export const DOCUMENTOS_POR_TIPO: Readonly<
  Record<TipoSolicitud, readonly DocumentoRequerido[]>
> = Object.freeze({
  PREGRADO_UN_PROGRAMA: Object.freeze([
    uno('identification'),
    uno('academic_evaluation'),
    uno('paz_y_salvo_bib'),
    uno('estampilla_pro_cultura'),
    uno('saber_pro'),
  ]),
  // Doble programa: una evaluación de Banner y una estampilla por programa.
  PREGRADO_DOBLE_PROGRAMA: Object.freeze([
    uno('identification'),
    uno('academic_evaluation'),
    segundo('academic_evaluation'),
    uno('paz_y_salvo_bib'),
    uno('estampilla_pro_cultura'),
    segundo('estampilla_pro_cultura'),
    uno('saber_pro'),
  ]),
  POSGRADO: Object.freeze([
    uno('identification'),
    uno('paz_y_salvo_bib'),
    uno('estampilla_pro_cultura'),
  ]),
  POSGRADO_DOBLE_PROGRAMA: Object.freeze([
    uno('identification'),
    uno('paz_y_salvo_bib'),
    uno('estampilla_pro_cultura'),
    segundo('estampilla_pro_cultura'),
  ]),
});

/** Máximo de PDF en un envío: el mayor total de documentos que se suben. */
export const MAXIMO_DOCUMENTOS = Math.max(
  ...Object.values(DOCUMENTOS_POR_TIPO).map(
    (d) => d.filter((r) => r.origen === 'archivo').length,
  ),
);

const CON_SEGUNDO = new Set<string>(
  Object.values(DOCUMENTOS_POR_TIPO).flatMap((docs) =>
    docs.filter((d) => d.orden === 2).map((d) => d.tipo),
  ),
);
const TIPOS = new Set<string>(
  Object.values(DOCUMENTOS_POR_TIPO).flatMap((docs) => docs.map((d) => d.tipo)),
);

export function tipoSolicitud(
  nivel: string,
  doblePrograma: boolean,
): TipoSolicitud {
  if (nivel === 'POSGRADO')
    return doblePrograma ? 'POSGRADO_DOBLE_PROGRAMA' : 'POSGRADO';
  if (nivel === 'PREGRADO')
    return doblePrograma ? 'PREGRADO_DOBLE_PROGRAMA' : 'PREGRADO_UN_PROGRAMA';
  throw new BadRequestException('Nivel académico no soportado');
}

export function documentosRequeridos(
  nivel: string,
  doblePrograma: boolean,
): readonly DocumentoRequerido[] {
  return DOCUMENTOS_POR_TIPO[tipoSolicitud(nivel, doblePrograma)];
}

/** Los documentos que el estudiante sube (sin Paz y Salvo, que se consulta). */
export function documentosASubir(
  nivel: string,
  doblePrograma: boolean,
): readonly DocumentoRequerido[] {
  return documentosRequeridos(nivel, doblePrograma).filter(
    (d) => d.origen === 'archivo',
  );
}

/** Clave del transporte: el tipo, con `-2` para el documento del segundo programa. */
export function claveDocumento(d: { tipo: string; orden: number }): string {
  return d.orden === 2 ? `${d.tipo}-2` : d.tipo;
}

export function admiteSegundo(tipo: string): boolean {
  return CON_SEGUNDO.has(tipo);
}

/** null si la clave no corresponde a ningún documento que el sistema pida. */
export function leerClave(
  clave: string,
): { tipo: string; orden: 1 | 2 } | null {
  const tipo = clave.replace(/-2$/, '');
  const orden = tipo === clave ? 1 : 2;
  if (!TIPOS.has(tipo) || (orden === 2 && !admiteSegundo(tipo))) return null;
  return { tipo, orden };
}
