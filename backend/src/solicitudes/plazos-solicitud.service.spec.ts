import { Logger } from '@nestjs/common';
import type { DatabaseService } from '../database/database.service.js';
import type { NotificacionesService } from '../notificaciones/notificaciones.service.js';
import { PlazosSolicitudService } from './plazos-solicitud.service.js';

/** Base simulada sin solicitudes pendientes: el barrido no encuentra nada que hacer. */
function baseVacia(query = vi.fn().mockResolvedValue({ rows: [] })) {
  return {
    query,
    transaction: vi.fn(),
  } as unknown as DatabaseService;
}
const notificaciones = {} as NotificacionesService;

describe('Barrido de plazos de la solicitud (Tarea 42a)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('corre al arrancar, cada 15 minutos, y se detiene al cerrar', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const job = new PlazosSolicitudService(baseVacia(query), notificaciones);
    await job.onModuleInit();
    const porPasada = query.mock.calls.length;
    expect(porPasada).toBeGreaterThan(0);
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
    expect(query).toHaveBeenCalledTimes(porPasada * 2);
    job.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
    expect(query).toHaveBeenCalledTimes(porPasada * 2);
  });

  it('un fallo se registra y no detiene el servicio', async () => {
    const log = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    const query = vi
      .fn()
      .mockRejectedValueOnce(new Error('base no disponible'))
      .mockResolvedValue({ rows: [] });
    const job = new PlazosSolicitudService(baseVacia(query), notificaciones);
    await expect(job.onModuleInit()).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
    job.onModuleDestroy();
  });

  it('no superpone pasadas si una consulta está pendiente', async () => {
    let terminar!: (v: { rows: [] }) => void;
    const espera = new Promise<{ rows: [] }>((r) => {
      terminar = r;
    });
    const query = vi
      .fn()
      .mockReturnValueOnce(espera)
      .mockResolvedValue({ rows: [] });
    const job = new PlazosSolicitudService(baseVacia(query), notificaciones);
    const primera = job.barrer();
    await job.barrer();
    expect(query).toHaveBeenCalledTimes(1);
    terminar({ rows: [] });
    await primera;
  });

  it('si una solicitud falla, la pasada sigue con las demás y lo registra', async () => {
    const log = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] })
      .mockResolvedValue({ rows: [] });
    const transaction = vi
      .fn()
      .mockRejectedValueOnce(new Error('fila bloqueada'))
      .mockResolvedValue('POR_REVISAR');
    const job = new PlazosSolicitudService(
      { query, transaction } as unknown as DatabaseService,
      notificaciones,
    );
    await expect(job.ejecutar()).resolves.toEqual({
      recalculadas: 1,
      anuladas: 0,
    });
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledTimes(1);
  });
});
