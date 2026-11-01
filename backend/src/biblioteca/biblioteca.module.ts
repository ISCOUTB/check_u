import { Module } from '@nestjs/common';
import {
  BibliotecaDemoService,
  BibliotecaService,
} from './biblioteca.service.js';

@Module({
  providers: [{ provide: BibliotecaService, useClass: BibliotecaDemoService }],
  exports: [BibliotecaService],
})
export class BibliotecaModule {}
