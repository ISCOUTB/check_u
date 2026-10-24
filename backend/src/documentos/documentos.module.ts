import { Module } from '@nestjs/common';
import { DocumentosController } from './documentos.controller.js';
import { AnalisisDocumentalService } from './analisis-documental.service.js';
import { MotorOcrClient } from './motor-ocr.client.js';

@Module({
  controllers: [DocumentosController],
  providers: [AnalisisDocumentalService, MotorOcrClient],
  exports: [AnalisisDocumentalService],
})
export class DocumentosModule {}
