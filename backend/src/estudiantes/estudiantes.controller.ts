import {
  BadRequestException,
  Body,
  Controller,
  Header,
  HttpCode,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { EstudiantesService } from './estudiantes.service.js';
import { FuncionariaGuard } from './funcionaria.guard.js';
import { MAXIMO_BYTES_CSV } from './estudiantes-csv.js';
import { Throttle } from '@nestjs/throttler';
import { limiteCargas } from '../limites.js';
@Controller('funcionario/estudiantes')
@UseGuards(FuncionariaGuard)
export class EstudiantesController {
  constructor(private readonly estudiantes: EstudiantesService) {}

  @Post()
  @Header('Cache-Control', 'private, no-store')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  registrar(@Body() input: unknown) {
    return this.estudiantes.registrar(input);
  }

  @Post('importar')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @Throttle(limiteCargas())
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: memoryStorage(),
      limits: { fileSize: MAXIMO_BYTES_CSV, files: 1, fields: 0, parts: 1 },
    }),
  )
  importar(@UploadedFile() archivo?: Express.Multer.File) {
    if (!archivo || !archivo.originalname.toLowerCase().endsWith('.csv'))
      throw new BadRequestException(
        'Selecciona un archivo con extensión .csv.',
      );
    let texto: string;
    try {
      texto = new TextDecoder('utf-8', { fatal: true }).decode(archivo.buffer);
    } catch {
      throw new BadRequestException(
        'Guarda el CSV con codificación UTF-8 antes de importarlo.',
      );
    }
    return this.estudiantes.importar(texto);
  }
}
