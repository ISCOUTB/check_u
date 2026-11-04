import { Injectable } from '@nestjs/common';
import { z } from 'zod';

// Tarea 50: el Paz y Salvo ya no se sube. Lo consulta el motor en ALMA (simulado o real según
// ALMA_MODO; ver modules/validadores/fuentes/alma) y aquí solo se valida y se interpreta su respuesta.

/** Lo que devuelve el motor en POST /biblioteca/paz-y-salvo (consultar_para_checku). */
export const ResultadoBiblioteca = z
  .object({
    estado: z.enum([
      'cumple',
      'no_cumple',
      'no_evaluable',
      'no_encontrado',
      'inconsistente',
    ]),
    paz_y_salvo: z.boolean().nullable(),
    mensaje: z.string(),
    fuente: z.string(),
    consultado_en: z.string().nullable(),
    identidad: z.object({
      coincide: z.boolean().nullable(),
      campos_distintos: z.array(z.string()),
    }),
    criterios: z.record(z.string(), z.record(z.string(), z.unknown())),
    acciones_requeridas: z.array(z.string()),
  })
  .passthrough();
export type ResultadoBiblioteca = z.infer<typeof ResultadoBiblioteca>;

export interface EstudianteBiblioteca {
  codigo: string;
  numeroDocumento: string;
  nombres: string;
  apellidos: string;
}

/** Cuando no hay respuesta usable: el documento queda Por revisar y lo decide una funcionaria. */
export const SIN_RESPUESTA: ResultadoBiblioteca = Object.freeze({
  estado: 'no_evaluable',
  paz_y_salvo: null,
  mensaje:
    'No fue posible consultar a Biblioteca. Una funcionaria lo revisará.',
  fuente: 'sin_respuesta',
  consultado_en: null,
  identidad: { coincide: null, campos_distintos: [] },
  criterios: {},
  acciones_requeridas: [],
}) as ResultadoBiblioteca;

/**
 * Consulta de Paz y Salvo de Biblioteca. La implementación registrada en BibliotecaModule pide el
 * resultado al motor; quien la consuma recibe siempre un ResultadoBiblioteca vía consultarConLimite.
 */
export abstract class BibliotecaService {
  abstract consultar(estudiante: EstudianteBiblioteca): Promise<unknown>;
}

@Injectable()
export class BibliotecaMotorService extends BibliotecaService {
  async consultar(estudiante: EstudianteBiblioteca): Promise<unknown> {
    const base =
      process.env.MOTOR_URL?.replace(/\/$/, '') || 'http://127.0.0.1:5001';
    const respuesta = await fetch(`${base}/biblioteca/paz-y-salvo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_student: estudiante.codigo,
        identidad: {
          numero_documento: estudiante.numeroDocumento,
          nombres: estudiante.nombres,
          apellidos: estudiante.apellidos,
        },
      }),
    });
    if (!respuesta.ok)
      throw new Error(`El motor respondió HTTP ${respuesta.status}.`);
    return respuesta.json();
  }
}

/** Estado del documento de Paz y Salvo según el resultado de Biblioteca. */
export function estadoDocumentoBiblioteca(
  r: ResultadoBiblioteca,
): 'VALIDO' | 'NO_VALIDO' | 'INCONSISTENTE' | 'POR_REVISAR' {
  if (r.estado === 'cumple') return 'VALIDO';
  if (r.estado === 'no_cumple') return 'NO_VALIDO';
  if (r.estado === 'inconsistente') return 'INCONSISTENTE';
  return 'POR_REVISAR';
}

/**
 * La consulta corre dentro de la transacción del envío, con la solicitud bloqueada: nunca debe
 * colgarla ni tumbarla. Un error (también uno lanzado sin promesa), una respuesta con otra forma
 * o la falta de respuesta en `limiteMs` quedan como SIN_RESPUESTA, es decir, Por revisar.
 */
export async function consultarConLimite(
  biblioteca: BibliotecaService,
  estudiante: EstudianteBiblioteca,
  limiteMs = 5000,
): Promise<ResultadoBiblioteca> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<unknown>((resolver) => {
    temporizador = setTimeout(() => resolver(null), limiteMs);
    temporizador.unref?.();
  });
  try {
    const respuesta = await Promise.race([
      Promise.resolve().then(() => biblioteca.consultar(estudiante)),
      limite,
    ]);
    const validado = ResultadoBiblioteca.safeParse(respuesta);
    return validado.success ? validado.data : SIN_RESPUESTA;
  } catch {
    return SIN_RESPUESTA;
  } finally {
    clearTimeout(temporizador);
  }
}
