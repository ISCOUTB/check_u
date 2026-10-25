import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { SolicitudesController } from './solicitudes.controller.js';
import { SolicitudesService } from './solicitudes.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [SolicitudesController],
  providers: [SolicitudesService],
  exports: [SolicitudesService],
})
export class SolicitudesModule {}
