import { BadRequestException, ConflictException, ServiceUnavailableException } from '@nestjs/common';
import type { PoolClient, QueryResult } from 'pg';
import type { DatabaseService } from '../database/database.service.js';
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
    it('lanza BadRequestException si no existe solicitud ni datos para crearla', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // SELECT solicitud

      await expect(service.enviarPreinscripcion(1)).rejects.toThrow(BadRequestException);
    });

    it('lanza ConflictException si la solicitud ya fue enviada (estado EN_PROCESO)', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id_solicitud: 10, tipo_solicitud: 'PREGRADO', estado: 'EN_PROCESO' }],
      });

      await expect(service.enviarPreinscripcion(1)).rejects.toThrow(ConflictException);
    });

    it('lanza BadRequestException si faltan datos obligatorios de usuario o perfil', async () => {
      mockClient.query
        .mockResolvedValueOnce({
          rows: [{ id_solicitud: 10, tipo_solicitud: 'PREGRADO', estado: 'BORRADOR' }],
        }) // solicitud
        .mockResolvedValueOnce({
          rows: [{ nombres: 'Lisandro', apellidos: '', codigo_estudiante: 'T00000001' }],
        }); // usuario con apellidos vacíos

      await expect(service.enviarPreinscripcion(1)).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si faltan documentos obligatorios en PREGRADO (menos de 5)', async () => {
      mockClient.query
        .mockResolvedValueOnce({
          rows: [{ id_solicitud: 10, tipo_solicitud: 'PREGRADO', estado: 'BORRADOR' }],
        }) // solicitud
        .mockResolvedValueOnce({
          rows: [{ nombres: 'Lisandro', apellidos: 'Zapata', codigo_estudiante: 'T00000001' }],
        }) // usuario
        .mockResolvedValueOnce({
          rows: [{ tipo_documento_identidad: 'CC', numero_documento: '1047123456' }],
        }) // perfil
        .mockResolvedValueOnce({
          rows: [{ orden: 1, programa: 'Ingeniería de Sistemas', modalidad: 'PRESENCIAL', tipo_opcion_grado: 'TRABAJO' }],
        }) // programa
        .mockResolvedValueOnce({
          rows: [{ conoce_registro_saber_pro: false, numero_registro_saber_pro: null }],
        }) // pregrado
        .mockResolvedValueOnce({
          rows: [
            { tipo_documento: 'identification' },
            { tipo_documento: 'academic_evaluation' },
          ],
        }); // documentos (solo 2 de 5)

      await expect(service.enviarPreinscripcion(1)).rejects.toThrow(BadRequestException);
    });

    it('completa el flujo exitoso en PREGRADO (5 documentos)', async () => {
      mockClient.query
        .mockResolvedValueOnce({
          rows: [{ id_solicitud: 102, tipo_solicitud: 'PREGRADO', estado: 'BORRADOR' }],
        }) // solicitud
        .mockResolvedValueOnce({
          rows: [{ nombres: 'Lisandro', apellidos: 'Zapata', codigo_estudiante: 'T00000001' }],
        }) // usuario
        .mockResolvedValueOnce({
          rows: [{ tipo_documento_identidad: 'CC', numero_documento: '1047123456' }],
        }) // perfil
        .mockResolvedValueOnce({
          rows: [{ orden: 1, programa: 'Ingeniería de Sistemas', modalidad: 'PRESENCIAL', tipo_opcion_grado: 'TRABAJO' }],
        }) // programa
        .mockResolvedValueOnce({
          rows: [{ conoce_registro_saber_pro: false, numero_registro_saber_pro: null }],
        }) // pregrado
        .mockResolvedValueOnce({
          rows: [
            { tipo_documento: 'cedula' },
            { tipo_documento: 'academic_evaluation' },
            { tipo_documento: 'paz_y_salvo_bib' },
            { tipo_documento: 'estampilla_pro_cultura' },
            { tipo_documento: 'saber-pro' },
          ],
        }) // documentos (los 5 con mapeos)
        .mockResolvedValueOnce({
          rows: [{ id_entrega: 1 }],
        }) // INSERT entregas
        .mockResolvedValueOnce({ rows: [] }) // UPDATE documentos
        .mockResolvedValueOnce({ rows: [] }); // UPDATE solicitud_grado

      const res = await service.enviarPreinscripcion(1);

      expect(res).toEqual({
        ok: true,
        id_solicitud: 102,
        id_entrega: 1,
        estado: 'EN_PROCESO',
        mensaje: 'Preinscripción registrada correctamente. Pendiente de análisis.',
      });

      // Verificar que se insertó en entregas con tipo_entrega = 'INICIAL' y numero_entrega = 1
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO entregas'),
        [102],
      );

      // Verificar que se asociaron los documentos a la entrega 1 y pasaron a POR_VALIDAR
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE documentos\n         SET id_entrega = $1, estado = 'POR_VALIDAR'"),
        [1, 102],
      );

      // Verificar que la solicitud pasó a EN_PROCESO
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE solicitud_grado\n         SET estado = 'EN_PROCESO'"),
        [102],
      );
    });

    describe('doble programa en PREGRADO: una estampilla por programa', () => {
      const conSegundoPrograma = (documentos: { tipo_documento: string; orden?: number }[]) =>
        mockClient.query
          .mockResolvedValueOnce({
            rows: [{ id_solicitud: 103, tipo_solicitud: 'PREGRADO', estado: 'BORRADOR' }],
          }) // solicitud
          .mockResolvedValueOnce({
            rows: [{ nombres: 'Ana', apellidos: 'Prueba', codigo_estudiante: 'T00000002' }],
          }) // usuario
          .mockResolvedValueOnce({
            rows: [{ tipo_documento_identidad: 'CC', numero_documento: '1000000001' }],
          }) // perfil
          .mockResolvedValueOnce({
            rows: [
              { orden: 1, programa: 'Ingeniería de Sistemas', modalidad: 'PRESENCIAL', tipo_opcion_grado: 'TRABAJO' },
              { orden: 2, programa: 'Ingeniería Industrial', modalidad: 'PRESENCIAL', tipo_opcion_grado: 'TRABAJO' },
            ],
          }) // programas (el 2 existe)
          .mockResolvedValueOnce({
            rows: [{ conoce_registro_saber_pro: false, numero_registro_saber_pro: null }],
          }) // pregrado
          .mockResolvedValueOnce({ rows: documentos }) // documentos
          .mockResolvedValueOnce({ rows: [{ id_entrega: 7 }] }) // INSERT entregas
          .mockResolvedValue({ rows: [] }); // UPDATE documentos / solicitud_grado

      const cinco = [
        { tipo_documento: 'identification', orden: 1 },
        { tipo_documento: 'academic_evaluation', orden: 1 },
        { tipo_documento: 'paz_y_salvo_bib', orden: 1 },
        { tipo_documento: 'estampilla_pro_cultura', orden: 1 },
        { tipo_documento: 'saber_pro', orden: 1 },
      ];

      it('rechaza el envío si falta la estampilla del segundo programa (orden 2)', async () => {
        conSegundoPrograma(cinco);
        await expect(service.enviarPreinscripcion(1)).rejects.toThrow(
          /estampilla_pro_cultura \(segundo programa\)/,
        );
      });

      it('completa el envío con las dos estampillas', async () => {
        conSegundoPrograma([...cinco, { tipo_documento: 'estampilla_pro_cultura', orden: 2 }]);
        const res = await service.enviarPreinscripcion(1);
        expect(res).toMatchObject({ ok: true, id_solicitud: 103, id_entrega: 7, estado: 'EN_PROCESO' });
      });
    });

    it('completa el flujo exitoso en POSGRADO (3 documentos)', async () => {
      mockClient.query
        .mockResolvedValueOnce({
          rows: [{ id_solicitud: 200, tipo_solicitud: 'POSGRADO', estado: 'BORRADOR' }],
        }) // solicitud
        .mockResolvedValueOnce({
          rows: [{ nombres: 'Ana', apellidos: 'Prueba', codigo_estudiante: 'T00000002' }],
        }) // usuario
        .mockResolvedValueOnce({
          rows: [{ tipo_documento_identidad: 'CC', numero_documento: '98765432' }],
        }) // perfil
        .mockResolvedValueOnce({
          rows: [{ orden: 1, programa: 'Maestría en TI', modalidad: 'VIRTUAL', tipo_opcion_grado: null }],
        }) // programa
        .mockResolvedValueOnce({
          rows: [{ nivel_estudios_alcanzado: 'PROFESIONAL', titulo_obtenido: 'Ingeniero' }],
        }) // posgrado
        .mockResolvedValueOnce({
          rows: [
            { tipo_documento: 'identification' },
            { tipo_documento: 'paz_y_salvo_bib' },
            { tipo_documento: 'estampilla_pro_cultura' },
          ],
        }) // documentos (los 3 de posgrado)
        .mockResolvedValueOnce({
          rows: [{ id_entrega: 5 }],
        }) // INSERT entregas
        .mockResolvedValueOnce({ rows: [] }) // UPDATE documentos
        .mockResolvedValueOnce({ rows: [] }); // UPDATE solicitud_grado

      const res = await service.enviarPreinscripcion(2);

      expect(res).toEqual({
        ok: true,
        id_solicitud: 200,
        id_entrega: 5,
        estado: 'EN_PROCESO',
        mensaje: 'Preinscripción registrada correctamente. Pendiente de análisis.',
      });
    });
  });

  describe('guardarBorrador (Inmutabilidad post-envío)', () => {
    it('lanza ConflictException si la solicitud está en EN_PROCESO (inmutabilidad post-envío)', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
        rows: [{ id_solicitud: 102, tipo_solicitud: 'PREGRADO', estado: 'EN_PROCESO' }],
      });

      await expect(service.guardarBorrador(1, { nivel: 'PREGRADO' })).rejects.toThrow(ConflictException);
    });

    it('permite guardar borrador si la solicitud está en BORRADOR', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // bloqueo de usuario
        .mockResolvedValueOnce({
          rows: [{ id_solicitud: 102, tipo_solicitud: 'PREGRADO', estado: 'BORRADOR' }],
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
          .mockResolvedValueOnce({
            rows: [{ id_solicitud: 102, tipo_solicitud: 'PREGRADO', estado: 'BORRADOR' }],
          })
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
  });
});
