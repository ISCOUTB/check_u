import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { PeriodosController } from './periodos.controller.js';
import { PeriodosService } from './periodos.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [PeriodosController],
  providers: [PeriodosService],
})
export class PeriodosModule {}
