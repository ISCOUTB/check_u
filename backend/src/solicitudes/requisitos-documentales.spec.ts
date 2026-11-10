import { BadRequestException } from '@nestjs/common';
import { validarArchivos } from './analisis-preinscripcion.service.js';
import {
  admiteSegundo,
  claveDocumento,
  documentosRequeridos,
  leerClave,
  documentosASubir,
  MAXIMO_DOCUMENTOS,
  tipoSolicitud,
} from './requisitos-documentales.js';

const claves = (nivel: string, doble: boolean) =>
  documentosRequeridos(nivel, doble).map(claveDocumento);

describe('requisitos documentales por tipo de solicitud', () => {
  it('pregrado de un programa pide 5, doble programa 7 y posgrado 3', () => {
    expect(claves('PREGRADO', false)).toEqual([
      'identification',
      'academic_evaluation',
      'paz_y_salvo_bib',
      'estampilla_pro_cultura',
      'saber_pro',
    ]);
    expect(claves('PREGRADO', true)).toEqual([
      'identification',
      'academic_evaluation',
      'academic_evaluation-2',
      'paz_y_salvo_bib',
      'estampilla_pro_cultura',
      'estampilla_pro_cultura-2',
      'saber_pro',
    ]);
    expect(claves('POSGRADO', true)).toEqual([
      'identification',
      'paz_y_salvo_bib',
      'estampilla_pro_cultura',
      'estampilla_pro_cultura-2',
    ]);
    // Tarea 50: Paz y Salvo no se sube, así que el máximo de PDF es 6 (doble programa).
    expect(MAXIMO_DOCUMENTOS).toBe(6);
  });

  it('Paz y Salvo es una consulta: se suben 4, 6 y 2 PDF', () => {
    const subir = (nivel: string, doble: boolean) =>
      documentosASubir(nivel, doble).map(claveDocumento);
    expect(subir('PREGRADO', false)).toEqual([
      'identification',
      'academic_evaluation',
      'estampilla_pro_cultura',
      'saber_pro',
    ]);
    expect(subir('PREGRADO', true)).toHaveLength(6);
    expect(subir('PREGRADO', true)).not.toContain('paz_y_salvo_bib');
    expect(subir('POSGRADO', false)).toEqual([
      'identification',
      'estampilla_pro_cultura',
    ]);
    expect(subir('POSGRADO', true)).toEqual([
      'identification',
      'estampilla_pro_cultura',
      'estampilla_pro_cultura-2',
    ]);
    const paz = documentosRequeridos('POSGRADO', false).find(
      (d) => d.tipo === 'paz_y_salvo_bib',
    );
    expect(paz?.origen).toBe('consulta');
  });

  it('posgrado con doble programa exige segunda estampilla (H-08)', () => {
    expect(tipoSolicitud('POSGRADO', false)).toBe('POSGRADO');
    expect(tipoSolicitud('POSGRADO', true)).toBe('POSGRADO_DOBLE_PROGRAMA');
    expect(claves('POSGRADO', true)).toEqual([
      'identification',
      'paz_y_salvo_bib',
      'estampilla_pro_cultura',
      'estampilla_pro_cultura-2',
    ]);
    expect(tipoSolicitud('PREGRADO', true)).toBe('PREGRADO_DOBLE_PROGRAMA');
    expect(tipoSolicitud('PREGRADO', false)).toBe('PREGRADO_UN_PROGRAMA');
  });

  it('un nivel desconocido se rechaza', () => {
    expect(() => tipoSolicitud('MAESTRIA', false)).toThrow(BadRequestException);
  });

  it('leerClave reconoce -2 solo en los tipos que admiten segundo', () => {
    expect(leerClave('academic_evaluation-2')).toEqual({
      tipo: 'academic_evaluation',
      orden: 2,
    });
    expect(leerClave('estampilla_pro_cultura-2')).toEqual({
      tipo: 'estampilla_pro_cultura',
      orden: 2,
    });
    expect(leerClave('saber_pro')).toEqual({ tipo: 'saber_pro', orden: 1 });
    expect(leerClave('saber_pro-2')).toBeNull();
    expect(leerClave('acta_grado')).toBeNull();
    expect(admiteSegundo('academic_evaluation')).toBe(true);
    expect(admiteSegundo('identification')).toBe(false);
  });
});

describe('validarArchivos', () => {
  const pdf = (tipo: string) => ({
    buffer: Buffer.from('%PDF-1.4 prueba'),
    originalname: `${tipo}.pdf`,
    mimetype: 'application/pdf',
    tipo,
  });

  it('acepta los 6 PDF del doble programa', () => {
    expect(() =>
      validarArchivos(
        documentosASubir('PREGRADO', true).map(claveDocumento).map(pdf),
      ),
    ).not.toThrow();
  });

  it('rechaza un PDF de Paz y Salvo: se consulta con Biblioteca', () => {
    expect(() => validarArchivos([pdf('paz_y_salvo_bib')])).toThrow(
      'Paz y Salvo se consulta automáticamente con Biblioteca; no se sube.',
    );
  });

  it('rechaza un segundo documento de un tipo que no lo admite', () => {
    expect(() =>
      validarArchivos([pdf('saber_pro'), pdf('saber_pro-2')]),
    ).toThrow('Tipos documentales inválidos o repetidos.');
  });

  it('rechaza más de 6 archivos', () => {
    const siete = [
      ...documentosASubir('PREGRADO', true).map(claveDocumento),
      'identification',
    ].map(pdf);
    expect(() => validarArchivos(siete)).toThrow(
      'Adjunta nuevamente los PDF requeridos para enviar la preinscripción.',
    );
  });
});
