import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { EstudiantesController } from './estudiantes.controller.js';
import { EstudiantesService } from './estudiantes.service.js';
import { FuncionariaGuard } from './funcionaria.guard.js';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [EstudiantesController],
  providers: [EstudiantesService, FuncionariaGuard],
})
export class EstudiantesModule {}
