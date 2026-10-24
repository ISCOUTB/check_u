import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import type { Pool, PoolClient, QueryResult } from 'pg';
import { DatabaseService } from './database.service.js';

describe('DatabaseService', () => {
  let service: DatabaseService;

  beforeEach(() => {
    service = new DatabaseService();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('lanza ServiceUnavailableException si la base de datos no está configurada (sin pool)', async () => {
    await expect(service.query('SELECT 1')).rejects.toThrow(ServiceUnavailableException);
    await expect(service.transaction(async () => 1)).rejects.toThrow(ServiceUnavailableException);
  });

  it('ejecuta consultas correctamente cuando el pool está configurado', async () => {
    const mockResultado: QueryResult<{ id: number }> = {
      command: 'SELECT',
      rowCount: 1,
      oid: 0,
      fields: [],
      rows: [{ id: 1 }],
    };

    const querySpy = vi.fn().mockResolvedValue(mockResultado);
    const mockPool = {
      query: querySpy,
      end: vi.fn().mockResolvedValue(undefined),
    } as unknown as Pool;

    // Asignamos el pool simulado
    (service as unknown as { pool: Pool }).pool = mockPool;

    const res = await service.query<{ id: number }>('SELECT 1 WHERE $1 = 1', [1]);
    expect(querySpy).toHaveBeenCalledWith('SELECT 1 WHERE $1 = 1', [1]);
    expect(res.rows).toEqual([{ id: 1 }]);
  });

  it('lanza ServiceUnavailableException si la consulta al pool falla', async () => {
    const mockPool = {
      query: vi.fn().mockRejectedValue(new Error('Connection lost')),
      end: vi.fn().mockResolvedValue(undefined),
    } as unknown as Pool;

    (service as unknown as { pool: Pool }).pool = mockPool;

    await expect(service.query('SELECT 1')).rejects.toThrow(ServiceUnavailableException);
  });

  it('ejecuta transacciones exitosas con BEGIN, commit y liberación de cliente', async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    } as unknown as PoolClient;

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      end: vi.fn().mockResolvedValue(undefined),
    } as unknown as Pool;

    (service as unknown as { pool: Pool }).pool = mockPool;

    const resultado = await service.transaction(async (client) => {
      await client.query('SELECT 1');
      return 'ok';
    });

    expect(resultado).toBe('ok');
    expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(mockClient.query).toHaveBeenNthCalledWith(2, 'SELECT 1');
    expect(mockClient.query).toHaveBeenNthCalledWith(3, 'COMMIT');
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('hace rollback y propaga HttpException en error de transacción', async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    } as unknown as PoolClient;

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      end: vi.fn().mockResolvedValue(undefined),
    } as unknown as Pool;

    (service as unknown as { pool: Pool }).pool = mockPool;

    await expect(
      service.transaction(async () => {
        throw new BadRequestException('Datos inválidos');
      }),
    ).rejects.toThrow(BadRequestException);

    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalled();
  });
});
