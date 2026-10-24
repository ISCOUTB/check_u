import { BadRequestException, Injectable } from '@nestjs/common';

export interface ArchivoSubido {
  fieldname: string;
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface SolicitudAnalisis {
  datos: Record<string, unknown>;
  nivel: string;
  documentos: ArchivoSubido[];
}

@Injectable()
export class AnalisisDocumentalService {
  async analizar(solicitud: SolicitudAnalisis) {
    if (!solicitud.datos || typeof solicitud.datos !== 'object') {
      throw new BadRequestException('Datos del estudiante inválidos');
    }

    if (solicitud.nivel !== 'PREGRADO' && solicitud.nivel !== 'POSGRADO') {
      throw new BadRequestException('Nivel académico no soportado');
    }

    return {
      estado: 'PENDIENTE_IMPLEMENTACION',
      nivel: solicitud.nivel,
    };
  }
}
