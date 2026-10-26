import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class FiltroErroresAnalisis implements ExceptionFilter {
  private readonly logger = new Logger(FiltroErroresAnalisis.name);

  catch(excepcion: unknown, host: ArgumentsHost) {
    const respuesta = host.switchToHttp().getResponse<Response>();

    let estado = HttpStatus.INTERNAL_SERVER_ERROR;
    let mensaje = 'Ocurrió un error al analizar los documentos';

    if (excepcion instanceof HttpException) {
      estado = excepcion.getStatus();
      const cuerpo = excepcion.getResponse();

      if (typeof cuerpo === 'string') {
        mensaje = cuerpo;
      } else if (cuerpo && typeof cuerpo === 'object' && 'message' in cuerpo) {
        const texto = (cuerpo as { message: unknown }).message;
        mensaje = Array.isArray(texto) ? texto.join(', ') : String(texto);
      }
    } else {
      this.logger.error('Error inesperado en el análisis documental');
    }

    respuesta.status(estado).json({
      statusCode: estado,
      message: mensaje,
    });
  }
}
