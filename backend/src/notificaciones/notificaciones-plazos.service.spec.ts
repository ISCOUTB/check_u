import { Logger } from '@nestjs/common';
import { NotificacionesPlazosService } from './notificaciones-plazos.service.js';
import type { NotificacionesService } from './notificaciones.service.js';

describe('Recordatorios periódicos de plazos', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  it('recupera al arrancar, vuelve a generar y detiene el temporizador al cerrar', async () => {
    const generarRecordatorios = vi.fn().mockResolvedValue(undefined);
    const job = new NotificacionesPlazosService({
      generarRecordatorios,
    } as unknown as NotificacionesService);
    await job.onModuleInit();
    expect(generarRecordatorios).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
    expect(generarRecordatorios).toHaveBeenCalledTimes(2);
    job.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
    expect(generarRecordatorios).toHaveBeenCalledTimes(2);
  });
  it('un fallo temporal se registra y se reintenta sin detener el servicio', async () => {
    const log = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    const generarRecordatorios = vi
      .fn()
      .mockRejectedValueOnce(new Error('base no disponible'))
      .mockResolvedValue(undefined);
    const job = new NotificacionesPlazosService({
      generarRecordatorios,
    } as unknown as NotificacionesService);
    await job.onModuleInit();
    expect(log).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
    expect(generarRecordatorios).toHaveBeenCalledTimes(2);
    job.onModuleDestroy();
  });
  it('no superpone ejecuciones si una consulta está pendiente', async () => {
    let terminar!: () => void;
    const espera = new Promise<void>((r) => {
      terminar = r;
    });
    const generarRecordatorios = vi.fn().mockReturnValue(espera);
    const job = new NotificacionesPlazosService({
      generarRecordatorios,
    } as unknown as NotificacionesService);
    const primero = job.generar();
    await job.generar();
    expect(generarRecordatorios).toHaveBeenCalledTimes(1);
    terminar();
    await primero;
    await job.generar();
    expect(generarRecordatorios).toHaveBeenCalledTimes(2);
  });
});
