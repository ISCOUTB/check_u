import { NotificacionesModule } from '../notificaciones/notificaciones.module.js';
import { ReenviosService } from './reenvios.service.js';
import { ResolucionesService } from './resoluciones.service.js';
import { PlazosSolicitudService } from './plazos-solicitud.service.js';
import { DocumentosModule } from '../documentos/documentos.module.js';
import { ArchivosTemporalesService } from './archivos-temporales.service.js';
import { AnalisisPreinscripcionService } from './analisis-preinscripcion.service.js';
import { Module } from '@nestjs/common';
import { BibliotecaModule } from '../biblioteca/biblioteca.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { SolicitudesController } from './solicitudes.controller.js';
import { SolicitudesService } from './solicitudes.service.js';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    DocumentosModule,
    NotificacionesModule,
    BibliotecaModule,
  ],
  controllers: [SolicitudesController],
  providers: [
    ReenviosService,
    ResolucionesService,
    PlazosSolicitudService,
    SolicitudesService,
    AnalisisPreinscripcionService,
    ArchivosTemporalesService,
  ],
  exports: [SolicitudesService],
})
export class SolicitudesModule {}
