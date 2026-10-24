import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  BadGatewayException,
} from '@nestjs/common';
import type { ArchivoSubido } from './analisis-documental.service.js';

const TIMEOUT_MS = 60_000;

@Injectable()
export class MotorOcrClient {
  private readonly logger = new Logger(MotorOcrClient.name);

  async analizar(
    nivel: string,
    datos: Record<string, unknown>,
    documentos: ArchivoSubido[],
  ): Promise<Record<string, unknown>> {
    const url = process.env.OCR_ENGINE_URL;

    if (!url) {
      throw new ServiceUnavailableException('El motor OCR no está configurado');
    }

    const formulario = new FormData();
    formulario.append('nivel', nivel);
    formulario.append('datos', JSON.stringify(datos));

    for (const documento of documentos) {
      formulario.append(
        documento.fieldname,
        new Blob([new Uint8Array(documento.buffer)], {
          type: documento.mimetype,
        }),
        documento.originalname,
      );
    }

    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);

    try {
      const respuesta = await fetch(`${url}/analizar`, {
        method: 'POST',
        body: formulario,
        signal: controlador.signal,
      });

      if (respuesta.status === 503 || respuesta.status === 504) {
        throw new ServiceUnavailableException(
          'El motor OCR no está disponible',
        );
      }

      if (!respuesta.ok) {
        this.logger.error(`El motor OCR respondió ${respuesta.status}`);
        throw new BadGatewayException(
          'El motor OCR devolvió una respuesta inválida',
        );
      }

      const cuerpo: unknown = await respuesta.json();

      if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
        throw new BadGatewayException(
          'El motor OCR devolvió una respuesta inválida',
        );
      }

      return cuerpo as Record<string, unknown>;
    } catch (error) {
      if (
        error instanceof ServiceUnavailableException ||
        error instanceof BadGatewayException
      ) {
        throw error;
      }

      this.logger.error('Fallo la comunicación con el motor OCR');
      throw new ServiceUnavailableException(
        'No fue posible comunicarse con el motor OCR',
      );
    } finally {
      clearTimeout(temporizador);
    }
  }
}
