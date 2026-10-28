import { BadRequestException, ConflictException, ServiceUnavailableException } from '@nestjs/common';
import type { PoolClient, QueryResult } from 'pg';
import type { DatabaseService } from '../database/database.service.js';
import type { AnalisisPreinscripcionService } from './analisis-preinscripcion.service.js';
import { SolicitudesService } from './solicitudes.service.js';
import type { SolicitudResumen } from './solicitudes.types.js';

describe('SolicitudesService', () => {
  let service: SolicitudesService;
  let mockDatabaseService: {
    query: ReturnType<typeof vi.fn>;
    transaction: ReturnType<typeof vi.fn>;
  };
  let mockClient: {
    query: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
    };
    mockDatabaseService = {
      query: vi.fn(),
      transaction: vi.fn().mockImplementation(async (cb: (client: PoolClient) => Promise<unknown>) => {
        return cb(mockClient as unknown as PoolClient);
      }),
    };
    service = new SolicitudesService(
      mockDatabaseService as unknown as DatabaseService,
      { procesar: vi.fn(), descartar: vi.fn() } as unknown as AnalisisPreinscripcionService,
    );
  });

  describe('obtenerSolicitudEstudiante', () => {
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

  describe('enviarPreinscripcion', () => {
    // El flujo completo y sus variantes se comprueban con PostgreSQL en
    // test/analisis-preinscripcion.e2e-spec.ts. Los mocks secuenciales del envío
    // de solo metadatos ya no representan el transporte multipart.
    it('rechaza un envío sin archivos reales antes de modificar la base', async () => {
      await expect(service.enviarPreinscripcion(1)).rejects.toThrow(BadRequestException);
      expect(mockDatabaseService.transaction).not.toHaveBeenCalled();
    });
  });

  describe('guardarBorrador (Inmutabilidad post-envío)', () => {
    it('lanza ConflictException si la solicitud está en EN_PROCESO (inmutabilidad post-envío)', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
        rows: [{ id_solicitud: 102, id_periodo: '11111111-1111-4111-8111-111111111111', tipo_solicitud: 'PREGRADO', estado: 'EN_PROCESO' }],
      });

      await expect(service.guardarBorrador(1, { nivel: 'PREGRADO' })).rejects.toThrow(ConflictException);
    });

    it('permite guardar borrador si la solicitud está en BORRADOR', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // bloqueo de usuario
        .mockResolvedValueOnce({
          rows: [{ id_solicitud: 102, id_periodo: '11111111-1111-4111-8111-111111111111', tipo_solicitud: 'PREGRADO', estado: 'BORRADOR' }],
        })
        .mockResolvedValueOnce({ rows: [{ fecha_actualizacion: new Date() }] })
        .mockResolvedValue({ rows: [] });

      const res = await service.guardarBorrador(1, {
        nombres: 'Lisandro',
        apellidos: 'Zapata',
      });

      expect(res.ok).toBe(true);
      expect(typeof res.guardadoEn).toBe('string');
    });

    describe('el programa 2 solo se guarda si el estudiante respondió que sí', () => {
      const programas = [
        { orden: 1, programa: 'Ingeniería de Sistemas', modalidad: 'PRESENCIAL', tipoOpcionGrado: 'TRABAJO' },
        { orden: 2, programa: 'Ingeniería Industrial', modalidad: 'PRESENCIAL', tipoOpcionGrado: 'TRABAJO' },
      ];
      const llamadas = () => mockClient.query.mock.calls as [string, unknown[]][];
      const guardoPrograma = (orden: number) =>
        llamadas().some(([sql, params]) => sql.includes('INSERT INTO solicitud_programa') && params[1] === orden);
      const borroPrograma2 = () =>
        llamadas().some(([sql]) => sql.includes('DELETE FROM solicitud_programa') && sql.includes('orden = 2'));

      beforeEach(() => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [] }) // bloqueo de usuario
          .mockResolvedValueOnce({
            rows: [{ id_solicitud: 102, id_periodo: '11111111-1111-4111-8111-111111111111', tipo_solicitud: 'PREGRADO', estado: 'BORRADOR' }],
          })
          .mockResolvedValueOnce({ rows: [{ fecha_actualizacion: new Date() }] })
          .mockResolvedValue({ rows: [] });
      });

      it.each([false, null, undefined])(
        'con segundoPrograma %s no guarda el programa 2 y borra el que hubiera',
        async (segundoPrograma) => {
          await service.guardarBorrador(1, { nivel: 'PREGRADO', segundoPrograma, programas });
          expect(guardoPrograma(1)).toBe(true);
          expect(guardoPrograma(2)).toBe(false);
          expect(borroPrograma2()).toBe(true);
        },
      );

      it('con segundoPrograma true guarda los dos programas', async () => {
        await service.guardarBorrador(1, { nivel: 'PREGRADO', segundoPrograma: true, programas });
        expect(guardoPrograma(1)).toBe(true);
        expect(guardoPrograma(2)).toBe(true);
        expect(borroPrograma2()).toBe(false);
      });
    });

    describe('discapacidad y asistencia (Tarea 37)', () => {
      const llamadas = () => mockClient.query.mock.calls as [string, unknown[]][];
      const insertPerfil = () =>
        llamadas().find(([sql]) => sql.includes('INSERT INTO perfil_estudiante'));

      beforeEach(() => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [] }) // bloqueo de usuario
          .mockResolvedValueOnce({
            rows: [{ id_solicitud: 102, tipo_solicitud: 'PREGRADO', estado: 'BORRADOR' }],
          })
          .mockResolvedValueOnce({ rows: [{ fecha_actualizacion: new Date() }] })
          .mockResolvedValue({ rows: [] });
      });

      it('guarda la respuesta afirmativa con su tipo y detalles', async () => {
        await service.guardarBorrador(1, {
          perfil: {
            tieneDiscapacidad: true,
            tipoDiscapacidad: 'FISICA',
            detallesAsistencia: '  Requiere rampa  ',
          },
        });

        const insert = insertPerfil();
        expect(insert).toBeDefined();
        const [sql, params] = insert!;
        expect(sql).toContain('tiene_discapacidad');
        expect(sql).toContain('tipo_discapacidad');
        expect(sql).toContain('detalles_necesidades_asistencia');
        expect(params).toContain(true);
        expect(params).toContain('FISICA');
        expect(params).toContain('Requiere rampa');
      });

      it.each([false, null])(
        'con respuesta %s no conserva tipo ni detalles residuales',
        async (tieneDiscapacidad) => {
          await service.guardarBorrador(1, {
            perfil: {
              tieneDiscapacidad,
              tipoDiscapacidad: 'FISICA',
              detallesAsistencia: 'Valor residual',
            },
          });

          const [, params] = insertPerfil()!;
          expect(params).toContain(tieneDiscapacidad);
          expect(params).not.toContain('FISICA');
          expect(params).not.toContain('Valor residual');
        },
      );

      it('no toca las columnas de discapacidad en un guardado parcial del perfil', async () => {
        await service.guardarBorrador(1, { perfil: { ciudad: 'Cartagena' } });

        const [sql, params] = insertPerfil()!;
        expect(sql).not.toContain('tiene_discapacidad');
        expect(sql).not.toContain('tipo_discapacidad');
        expect(sql).not.toContain('detalles_necesidades_asistencia');
        expect(params).not.toContain(false);
        expect(params).not.toContain(null);
      });

      it('rechaza una respuesta afirmativa sin tipo antes de abrir la transacción', async () => {
        await expect(
          service.guardarBorrador(1, {
            perfil: { tieneDiscapacidad: true, detallesAsistencia: 'Sin tipo' },
          }),
        ).rejects.toThrow(BadRequestException);

        expect(mockDatabaseService.transaction).not.toHaveBeenCalled();
        expect(insertPerfil()).toBeUndefined();
      });
    });
  });
});
