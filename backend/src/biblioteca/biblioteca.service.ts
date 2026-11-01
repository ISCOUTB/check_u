import { Injectable } from '@nestjs/common';
import { CODIGOS_A_PAZ_Y_SALVO } from './paz-y-salvo-demo.js';

export type RespuestaPazYSalvo = 'paz_y_salvo' | 'con_deuda' | 'sin_respuesta';

/**
 * Consulta de Paz y Salvo de Biblioteca. Hoy la implementa un demo estático; cuando exista la
 * integración con ALMA basta con registrar otra implementación en BibliotecaModule.
 */
export abstract class BibliotecaService {
  abstract consultarPazYSalvo(
    codigoEstudiante: string,
  ): Promise<RespuestaPazYSalvo>;
}

@Injectable()
export class BibliotecaDemoService extends BibliotecaService {
  private readonly codigos = new Set(CODIGOS_A_PAZ_Y_SALVO);

  consultarPazYSalvo(codigoEstudiante: string): Promise<RespuestaPazYSalvo> {
    return Promise.resolve(
      this.codigos.has(codigoEstudiante.trim()) ? 'paz_y_salvo' : 'con_deuda',
    );
  }
}

const RESPUESTAS: readonly RespuestaPazYSalvo[] = [
  'paz_y_salvo',
  'con_deuda',
  'sin_respuesta',
];

/**
 * La consulta corre dentro de la transacción del envío, con la solicitud bloqueada: nunca debe
 * colgarla ni tumbarla. Un error (también uno lanzado sin promesa), una respuesta desconocida o
 * la falta de respuesta en `limiteMs` quedan como sin_respuesta, es decir, Por revisar.
 */
export async function consultarConLimite(
  biblioteca: BibliotecaService,
  codigoEstudiante: string,
  limiteMs = 5000,
): Promise<RespuestaPazYSalvo> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<RespuestaPazYSalvo>((resolver) => {
    temporizador = setTimeout(() => resolver('sin_respuesta'), limiteMs);
    temporizador.unref?.();
  });
  try {
    const respuesta = await Promise.race([
      Promise.resolve().then(() =>
        biblioteca.consultarPazYSalvo(codigoEstudiante),
      ),
      limite,
    ]);
    return RESPUESTAS.includes(respuesta) ? respuesta : 'sin_respuesta';
  } catch {
    return 'sin_respuesta';
  } finally {
    clearTimeout(temporizador);
  }
}
