import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { NotificacionesController } from './notificaciones.controller.js';
import { NotificacionesService } from './notificaciones.service.js';
import { NotificacionesPlazosService } from './notificaciones-plazos.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [NotificacionesController],
  providers: [NotificacionesService, NotificacionesPlazosService],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
