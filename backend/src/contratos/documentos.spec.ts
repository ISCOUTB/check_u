import { requiredDocuments } from './documentos.js';
import type { AcademicLevel } from './enums.js';

describe('requiredDocuments', () => {
  it('pregrado pide 5 documentos en el orden del spec', () => {
    expect(requiredDocuments('pregrado')).toEqual([
      'identification',
      'academic_evaluation',
      'paz_y_salvo_bib',
      'estampilla_pro_cultura',
      'saber_pro',
    ]);
  });

  it('posgrado pide 3', () => {
    expect(requiredDocuments('posgrado')).toEqual([
      'identification',
      'paz_y_salvo_bib',
      'estampilla_pro_cultura',
    ]);
  });

  it('devuelve una copia: modificarla no cambia la siguiente llamada', () => {
    requiredDocuments('posgrado').push('saber_pro');

    expect(requiredDocuments('posgrado')).toHaveLength(3);
  });

  it('un nivel inválido es un error', () => {
    expect(() => requiredDocuments('doctorado' as AcademicLevel)).toThrow();
  });
});
