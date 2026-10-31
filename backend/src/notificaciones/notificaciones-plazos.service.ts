import {
  Injectable,
  Logger,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service.js';

@Injectable()
export class NotificacionesPlazosService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NotificacionesPlazosService.name);
  private timer?: ReturnType<typeof setInterval>;
  private ejecutando = false;
  constructor(private readonly notificaciones: NotificacionesService) {}
  async generar() {
    if (this.ejecutando) return;
    this.ejecutando = true;
    try {
      await this.notificaciones.generarRecordatorios();
    } catch {
      this.logger.error(
        'No fue posible generar los recordatorios de plazo; se reintentará.',
      );
    } finally {
      this.ejecutando = false;
    }
  }
  async onModuleInit() {
    await this.generar();
    this.timer = setInterval(
      () => {
        void this.generar();
      },
      15 * 60 * 1000,
    );
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
