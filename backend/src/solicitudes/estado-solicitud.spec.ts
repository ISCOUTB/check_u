import {
  calcularEstadoSolicitud,
  type DocumentoActual,
} from './estado-solicitud.js';
import { documentosRequeridos } from './requisitos-documentales.js';

const doc = (
  tipo: string,
  estado: string,
  orden = 1,
  version = 1,
): DocumentoActual => ({
  tipo,
  orden,
  version,
  estado,
});
const POSGRADO = documentosRequeridos('POSGRADO', false);
const PREGRADO_1 = documentosRequeridos('PREGRADO', false);
const PREGRADO_2 = documentosRequeridos('PREGRADO', true);
/** Todos los requeridos en VALIDO, con los cambios indicados por clave `tipo` o `tipo-2`. */
function todos(
  requeridos: typeof PREGRADO_2,
  cambios: Record<string, string> = {},
): DocumentoActual[] {
  return requeridos.map((r) => {
    const clave = r.orden === 2 ? `${r.tipo}-2` : r.tipo;
    return doc(r.tipo, cambios[clave] ?? 'VALIDO', r.orden);
  });
}

describe('calcularEstadoSolicitud', () => {
  it.each([
    ['Posgrado, 3 válidos', POSGRADO, todos(POSGRADO), 'VALIDA'],
    [
      'Posgrado sin estampilla',
      POSGRADO,
      [doc('identification', 'VALIDO'), doc('paz_y_salvo_bib', 'VALIDO')],
      'POR_REVISAR',
    ],
    [
      'Pregrado 1, Saber Pro con 95',
      PREGRADO_1,
      todos(PREGRADO_1, { saber_pro: 'NO_VALIDO' }),
      'NO_VALIDA',
    ],
    [
      'Pregrado 1, cédula inconsistente',
      PREGRADO_1,
      todos(PREGRADO_1, { identification: 'INCONSISTENTE' }),
      'INCONSISTENTE',
    ],
    [
      'Pregrado 2, programa 2 con requisito faltante',
      PREGRADO_2,
      todos(PREGRADO_2, { 'academic_evaluation-2': 'NO_VALIDO' }),
      'NO_VALIDA',
    ],
    [
      'Pregrado 2, prioridad: biblioteca no válida y cédula inconsistente',
      PREGRADO_2,
      todos(PREGRADO_2, {
        paz_y_salvo_bib: 'NO_VALIDO',
        identification: 'INCONSISTENTE',
      }),
      'NO_VALIDA',
    ],
    [
      'Versión vieja no cuenta',
      PREGRADO_1,
      [
        ...todos(PREGRADO_1).filter((d) => d.tipo !== 'saber_pro'),
        doc('saber_pro', 'NO_VALIDO', 1, 1),
        doc('saber_pro', 'VALIDO', 1, 2),
      ],
      'VALIDA',
    ],
    [
      'Un documento que el tipo no pide se ignora',
      POSGRADO,
      [...todos(POSGRADO), doc('saber_pro', 'NO_VALIDO')],
      'VALIDA',
    ],
    [
      'Un requerido aún analizándose',
      POSGRADO,
      todos(POSGRADO, { identification: 'POR_VALIDAR' }),
      'POR_REVISAR',
    ],
    [
      'Doble programa sin la segunda estampilla',
      PREGRADO_2,
      todos(PREGRADO_2).filter(
        (d) => !(d.tipo === 'estampilla_pro_cultura' && d.orden === 2),
      ),
      'POR_REVISAR',
    ],
  ])('%s', (_caso, requeridos, documentos, esperado) => {
    expect(calcularEstadoSolicitud(requeridos, documentos)).toBe(esperado);
  });
});
