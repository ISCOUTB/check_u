import {
  Body,
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
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
  @UseInterceptors(FilesInterceptor('documentos'))
  async analizar(
    @Body('datos') datos: string,
    @Body('nivel') nivel: string,
    @UploadedFiles() documentos: ArchivoSubido[],
  ) {
    return this.analisisDocumentalService.analizar({
      datos: JSON.parse(datos),
      nivel,
      documentos: documentos ?? [],
    });
  }
}
