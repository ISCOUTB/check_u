import { Module } from '@nestjs/common';
import { DocumentosController } from './documentos.controller.js';
import { DocumentosService } from './documentos.service.js';

@Module({
  controllers: [DocumentosController],
  providers: [DocumentosService],
  exports: [DocumentosService],
})
export class DocumentosModule {}
