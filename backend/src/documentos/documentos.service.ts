import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { RespuestaAnalisis } from './documentos.types.js';

type ArchivoEntrada = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

@Injectable()
export class DocumentosService {
  private readonly motorUrl =
    process.env.MOTOR_URL?.replace(/\/$/, '') || 'http://127.0.0.1:5001';

  async analizar(params: {
    estudianteJson: string;
    tipos: string;
    archivos: ArchivoEntrada[];
  }): Promise<RespuestaAnalisis> {
    const form = new FormData();
    form.append('estudiante', params.estudianteJson);
    form.append('tipos', params.tipos);

    for (const archivo of params.archivos) {
      const bytes = new Uint8Array(archivo.buffer);
      const blob = new Blob([bytes], {
        type: archivo.mimetype || 'application/octet-stream',
      });
      form.append('documentos', blob, archivo.originalname || 'documento.pdf');
    }

    let response: Response;
    try {
      response = await fetch(`${this.motorUrl}/analizar`, {
        method: 'POST',
        body: form,
      });
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo conectar con el motor de validación documental.',
      );
    }

    const texto = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(texto) as unknown;
    } catch {
      throw new BadGatewayException(
        'El motor devolvió una respuesta que no es JSON válido.',
      );
    }

    if (!response.ok) {
      const mensaje =
        typeof data === 'object' &&
        data !== null &&
        'error' in data &&
        typeof (data as { error: unknown }).error === 'string'
          ? (data as { error: string }).error
          : `El motor respondió con HTTP ${response.status}`;
      throw new BadGatewayException(mensaje);
    }

    return data as RespuestaAnalisis;
  }
}
