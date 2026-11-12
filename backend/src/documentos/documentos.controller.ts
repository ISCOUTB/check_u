import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DocumentosService } from './documentos.service.js';
import type { RespuestaAnalisis } from './documentos.types.js';
import { Throttle } from '@nestjs/throttler';
import { limiteCargas } from '../limites.js';

// Igual que en SolicitudesController: en pruebas se apagan los límites de
// frecuencia para que la suite pueda repetir peticiones desde una sola IP.
const esTest =
  process.env.NODE_ENV === 'test' ||
  process.env.VITEST === 'true' ||
  !!process.env.VITEST_WORKER_ID;

/** Evita depender de Express.Multer.File (rompe el typecheck en este proyecto). */
type ArchivoSubido = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

@Controller('documentos')
export class DocumentosController {
  constructor(private readonly documentosService: DocumentosService) {}

  @Post('analizar')
  @Throttle({ uploads: { limit: esTest ? 10_000 : 8, ttl: 60_000 } })
  @UseInterceptors(
    FilesInterceptor('documentos', 10, {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  async analizar(
    @UploadedFiles() archivos: ArchivoSubido[] | undefined,
    @Body('estudiante') estudiante: string | undefined,
    @Body('tipos') tipos: string | undefined,
  ): Promise<RespuestaAnalisis> {
    if (!estudiante?.trim()) {
      throw new BadRequestException(
        "Falta el campo 'estudiante' (JSON con id_student).",
      );
    }
    if (!tipos?.trim()) {
      throw new BadRequestException(
        "Falta el campo 'tipos' (lista separada por comas).",
      );
    }
    if (!archivos?.length) {
      throw new BadRequestException(
        "Debe adjuntar al menos un archivo en 'documentos'.",
      );
    }

    try {
      JSON.parse(estudiante);
    } catch {
      throw new BadRequestException("El campo 'estudiante' no es JSON válido.");
    }

    return this.documentosService.analizar({
      estudianteJson: estudiante,
      tipos: tipos.trim(),
      archivos: archivos.map((f) => ({
        buffer: f.buffer,
        originalname: f.originalname,
        mimetype: f.mimetype,
      })),
    });
  }
}
