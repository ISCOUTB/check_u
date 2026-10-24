import { BadRequestException } from '@nestjs/common';
import type { ArchivoSubido } from './analisis-documental.service.js';

const DOCUMENTOS_PREGRADO = [
  'cedula',
  'evaluacion_grado',
  'paz_y_salvo',
  'estampilla',
  'saber_pro',
] as const;

const DOCUMENTOS_POSGRADO = ['cedula', 'paz_y_salvo', 'estampilla'] as const;

export function documentosRequeridos(nivel: string): readonly string[] {
  if (nivel === 'PREGRADO') return DOCUMENTOS_PREGRADO;
  if (nivel === 'POSGRADO') return DOCUMENTOS_POSGRADO;
  throw new BadRequestException('Nivel académico no soportado');
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
