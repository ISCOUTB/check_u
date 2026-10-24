import { ServiceUnavailableException } from '@nestjs/common';
import type { QueryResult } from 'pg';
import type { DatabaseService } from '../database/database.service.js';
import { SolicitudesService } from './solicitudes.service.js';
import type { SolicitudResumen } from './solicitudes.types.js';

describe('SolicitudesService', () => {
  let service: SolicitudesService;
  let mockDatabaseService: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockDatabaseService = {
      query: vi.fn(),
    };
    service = new SolicitudesService(
      mockDatabaseService as unknown as DatabaseService,
    );
  });

  it('cuando devuelve 0 filas, responde { tiene_solicitud: false, solicitud: null }', async () => {
    mockDatabaseService.query.mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
      command: 'SELECT',
      oid: 0,
      fields: [],
    } as QueryResult<SolicitudResumen>);

    const res = await service.obtenerSolicitudEstudiante(1);

    expect(res).toEqual({
      tiene_solicitud: false,
      solicitud: null,
    });
    expect(mockDatabaseService.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id_estudiante = $1'),
      [1],
    );
  });

  it('cuando devuelve 1 fila, responde { tiene_solicitud: true, solicitud: { ... } }', async () => {
    const mockFila: SolicitudResumen = {
      id_solicitud: 42,
      tipo_solicitud: 'PREGRADO',
      estado: 'BORRADOR',
    };

    mockDatabaseService.query.mockResolvedValueOnce({
      rows: [mockFila],
      rowCount: 1,
      command: 'SELECT',
      oid: 0,
      fields: [],
    } as QueryResult<SolicitudResumen>);

    const res = await service.obtenerSolicitudEstudiante(1);

    expect(res).toEqual({
      tiene_solicitud: true,
      solicitud: {
        id_solicitud: 42,
        tipo_solicitud: 'PREGRADO',
        estado: 'BORRADOR',
      },
    });
    expect(mockDatabaseService.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id_estudiante = $1'),
      [1],
    );
  });

  it('cuando ocurre un error de conexión en la base de datos, propaga ServiceUnavailableException', async () => {
    mockDatabaseService.query.mockRejectedValueOnce(
      new ServiceUnavailableException('Base de datos no disponible'),
    );

    await expect(service.obtenerSolicitudEstudiante(1)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
