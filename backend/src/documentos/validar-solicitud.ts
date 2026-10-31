import { BadRequestException } from '@nestjs/common';
import type { ArchivoSubido } from './analisis-documental.service.js';
import { documentosRequeridos as requeridosPorTipo } from '../solicitudes/requisitos-documentales.js';

/** Nombres de campo del formulario viejo para cada tipo documental de la configuración. */
const CAMPO_FORMULARIO: Readonly<Record<string, string>> = {
  identification: 'cedula',
  academic_evaluation: 'evaluacion_grado',
  paz_y_salvo_bib: 'paz_y_salvo',
  estampilla_pro_cultura: 'estampilla',
  saber_pro: 'saber_pro',
};

export function documentosRequeridos(nivel: string): readonly string[] {
  return requeridosPorTipo(nivel, false).map((d) => CAMPO_FORMULARIO[d.tipo]);
}

export function validarDatos(datosTexto: string): Record<string, unknown> {
  let datos: unknown;

  try {
    datos = JSON.parse(datosTexto);
  } catch {
    throw new BadRequestException('El campo datos no es un JSON válido');
  }

  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    throw new BadRequestException('El campo datos debe ser un objeto JSON');
  }

  return datos as Record<string, unknown>;
}

export function validarDocumentos(
  nivel: string,
  archivos: Record<string, ArchivoSubido[] | undefined>,
): ArchivoSubido[] {
  const requeridos = documentosRequeridos(nivel);
  const faltantes = requeridos.filter((nombre) => !archivos[nombre]?.length);

  if (faltantes.length > 0) {
    throw new BadRequestException(
      `Faltan documentos requeridos: ${faltantes.join(', ')}`,
    );
  }

  return requeridos.map((nombre) => {
    const archivo = archivos[nombre]![0];

    if (archivo.mimetype !== 'application/pdf') {
      throw new BadRequestException(`${nombre} debe ser un PDF`);
    }

    return archivo;
  });
}
