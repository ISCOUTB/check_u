import { describe, expect, it } from 'vitest';
import { formatearPrograma, legibilizarCodigo } from './opciones.types.js';

describe('legibilizarCodigo y formatearPrograma (Tarea 65)', () => {
  describe('legibilizarCodigo', () => {
    it('elimina guiones bajos y aplica mayúsculas/minúsculas legibles', () => {
      expect(legibilizarCodigo('PROGRAMA_DESCONOCIDO')).toBe('Programa Desconocido');
    });

    it('conserva conectores en minúsculas en español', () => {
      expect(legibilizarCodigo('INGENIERIA_DE_SISTEMAS_Y_COMPUTACION')).toBe(
        'Ingenieria de Sistemas y Computacion',
      );
      expect(legibilizarCodigo('OTRO_PROGRAMA_DE_EJEMPLO')).toBe('Otro Programa de Ejemplo');
      expect(legibilizarCodigo('ESPECIALIZACION_EN_FINANZAS')).toBe('Especializacion en Finanzas');
    });

    it('maneja strings vacíos o nulos', () => {
      expect(legibilizarCodigo('')).toBe('');
      expect(legibilizarCodigo('   ')).toBe('');
    });
  });

  describe('formatearPrograma', () => {
    it('caso conocido: usa la etiqueta del catálogo con sus tildes y caracteres exactos', () => {
      const resultado = formatearPrograma(
        'INGENIERIA_DE_SISTEMAS_Y_COMPUTACION',
        'Ingeniería de Sistemas y Computación',
      );
      expect(resultado).toBe('Ingeniería de Sistemas y Computación');
    });

    it('caso desconocido: no se rompe y muestra versión legible sin guiones bajos', () => {
      const resultado = formatearPrograma('PROGRAMA_NO_CATALOGADO', null);
      expect(resultado).toBe('Programa No Catalogado');
      expect(resultado).not.toContain('_');
      expect(resultado).not.toBe('PROGRAMA_NO_CATALOGADO');
    });

    it('caso de dos programas: permite formatear ambos de forma independiente', () => {
      const prog1 = formatearPrograma(
        'INGENIERIA_DE_SISTEMAS_Y_COMPUTACION',
        'Ingeniería de Sistemas y Computación',
      );
      const prog2 = formatearPrograma(
        'INGENIERIA_INDUSTRIAL',
        'Ingeniería Industrial',
      );

      expect(prog1).toBe('Ingeniería de Sistemas y Computación');
      expect(prog2).toBe('Ingeniería Industrial');
      const encabezado = `${prog1} · ${prog2}`;
      expect(encabezado).toBe('Ingeniería de Sistemas y Computación · Ingeniería Industrial');
    });
  });
});
