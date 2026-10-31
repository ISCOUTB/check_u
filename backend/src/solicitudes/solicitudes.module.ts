import { CancelacionesService } from './cancelaciones.service.js';
import { CancelacionesController } from './cancelaciones.controller.js';
import { NotificacionesModule } from '../notificaciones/notificaciones.module.js';
import { ReenviosService } from './reenvios.service.js';
import { DocumentosModule } from '../documentos/documentos.module.js';
import { ArchivosTemporalesService } from './archivos-temporales.service.js';
import { AnalisisPreinscripcionService } from './analisis-preinscripcion.service.js';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { SolicitudesController } from './solicitudes.controller.js';
import { SolicitudesService } from './solicitudes.service.js';

@Module({
  imports: [DatabaseModule, AuthModule, DocumentosModule, NotificacionesModule],
  controllers: [SolicitudesController, CancelacionesController],
  providers: [
    CancelacionesService,
    ReenviosService,
    SolicitudesService,
    AnalisisPreinscripcionService,
    ArchivosTemporalesService,
  ],
  exports: [SolicitudesService],
})
export class SolicitudesModule {}
