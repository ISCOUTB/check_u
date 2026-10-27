import { DocumentosModule } from '../documentos/documentos.module.js';
import { ArchivosTemporalesService } from './archivos-temporales.service.js';
import { AnalisisPreinscripcionService } from './analisis-preinscripcion.service.js';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { SolicitudesController } from './solicitudes.controller.js';
import { SolicitudesService } from './solicitudes.service.js';

@Module({
  imports: [DatabaseModule, AuthModule, DocumentosModule],
  controllers: [SolicitudesController],
  providers: [
    SolicitudesService,
    AnalisisPreinscripcionService,
    ArchivosTemporalesService,
  ],
  exports: [SolicitudesService],
})
export class SolicitudesModule {}
