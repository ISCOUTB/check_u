import { BadRequestException } from '@nestjs/common';
import { validarArchivos } from './analisis-preinscripcion.service.js';
import {
  admiteSegundo,
  claveDocumento,
  documentosRequeridos,
  leerClave,
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
    expect(claves('POSGRADO', false)).toEqual([
      'identification',
      'paz_y_salvo_bib',
      'estampilla_pro_cultura',
    ]);
    expect(MAXIMO_DOCUMENTOS).toBe(7);
  });

  it('posgrado ignora el doble programa', () => {
    expect(tipoSolicitud('POSGRADO', true)).toBe('POSGRADO');
    expect(claves('POSGRADO', true)).toEqual(claves('POSGRADO', false));
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

  it('acepta los 7 PDF del doble programa', () => {
    expect(() =>
      validarArchivos(claves('PREGRADO', true).map(pdf)),
    ).not.toThrow();
  });

  it('rechaza un segundo documento de un tipo que no lo admite', () => {
    expect(() =>
      validarArchivos([pdf('saber_pro'), pdf('saber_pro-2')]),
    ).toThrow('Tipos documentales inválidos o repetidos.');
  });

  it('rechaza más de 7 archivos', () => {
    const ocho = [...claves('PREGRADO', true), 'identification'].map(pdf);
    expect(() => validarArchivos(ocho)).toThrow(
      'Adjunta nuevamente los PDF requeridos para enviar la preinscripción.',
    );
  });
});
