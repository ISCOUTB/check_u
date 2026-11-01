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
