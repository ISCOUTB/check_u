import { Module } from '@nestjs/common';
import {
  BibliotecaMotorService,
  BibliotecaService,
} from './biblioteca.service.js';

@Module({
  // Tarea 50: el motor consulta ALMA (simulado o real según ALMA_MODO). Cambiar de fuente no toca
  // a quienes consumen BibliotecaService.
  providers: [{ provide: BibliotecaService, useClass: BibliotecaMotorService }],
  exports: [BibliotecaService],
})
export class BibliotecaModule {}
