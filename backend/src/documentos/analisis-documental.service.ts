import { Injectable } from '@nestjs/common';
import { MotorOcrClient } from './motor-ocr.client.js';
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
  constructor(private readonly motorOcrClient: MotorOcrClient) {}

  async analizar(solicitud: SolicitudAnalisis) {
    const datos = validarDatos(solicitud.datosTexto);
    const documentos = validarDocumentos(solicitud.nivel, solicitud.archivos);

    return this.motorOcrClient.analizar(solicitud.nivel, datos, documentos);
  }
}
