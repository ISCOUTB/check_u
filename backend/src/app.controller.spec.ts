import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const modulo: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    controller = modulo.get(AppController);
  });

  it('health responde que el servicio está arriba', () => {
    expect(controller.getHealth()).toEqual({
      status: 'ok',
      service: 'CheckU API',
      message: 'Backend conectado correctamente',
    });
  });
});
