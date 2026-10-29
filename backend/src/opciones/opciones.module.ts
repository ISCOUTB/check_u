import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { OpcionesController } from './opciones.controller.js';
import { OpcionesService } from './opciones.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [OpcionesController],
  providers: [OpcionesService],
})
export class OpcionesModule {}
