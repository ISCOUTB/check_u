
import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'CheckU API',
      message: 'Backend conectado correctamente',
    };
  }
}