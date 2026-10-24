import {
  Body,
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  AnalisisDocumentalService,
  type ArchivoSubido,
} from './analisis-documental.service.js';

@Controller('documentos')
export class DocumentosController {
  constructor(
    private readonly analisisDocumentalService: AnalisisDocumentalService,
  ) {}

  @Post('analizar')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'cedula', maxCount: 1 },
      { name: 'evaluacion_grado', maxCount: 1 },
      { name: 'paz_y_salvo', maxCount: 1 },
      { name: 'estampilla', maxCount: 1 },
      { name: 'saber_pro', maxCount: 1 },
    ]),
  )
  async analizar(
    @Body('datos') datos: string,
    @Body('nivel') nivel: string,
    @UploadedFiles()
    archivos: Record<string, ArchivoSubido[] | undefined>,
  ) {
    return this.analisisDocumentalService.analizar({
      datosTexto: datos,
      nivel,
      archivos: archivos ?? {},
    });
  }
}
