import { Injectable } from '@nestjs/common';
import { validarDatos, validarDocumentos } from './validar-solicitud.js';

export interface ArchivoSubido {
  fieldname: string;
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface SolicitudAnalisis {
  datosTexto: string;
  nivel: string;
  archivos: Record<string, ArchivoSubido[] | undefined>;
}

@Injectable()
export class AnalisisDocumentalService {
  async analizar(solicitud: SolicitudAnalisis) {
    const datos = validarDatos(solicitud.datosTexto);
    const documentos = validarDocumentos(solicitud.nivel, solicitud.archivos);

    return {
      estado: 'PENDIENTE_IMPLEMENTACION',
      nivel: solicitud.nivel,
      datosRecibidos: datos,
      documentosRecibidos: documentos.map((archivo) => archivo.fieldname),
    };
  }
}
