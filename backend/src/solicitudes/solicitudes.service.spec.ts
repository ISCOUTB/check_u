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

    describe('código estudiantil registrado (evita el duplicado 23505)', () => {
      const llamadas = () => mockClient.query.mock.calls as [string, unknown[]][];
      const updateUsuarios = () =>
        llamadas().find(([sql]) => sql.startsWith('UPDATE usuarios SET'));

      const preparar = (codigo: string | null) => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [{ codigo_estudiante: codigo }] }) // bloqueo de usuario
          .mockResolvedValueOnce({
            rows: [{ id_solicitud: 102, id_periodo: '11111111-1111-4111-8111-111111111111', tipo_solicitud: 'PREGRADO', estado: 'BORRADOR' }],
          })
          .mockResolvedValueOnce({ rows: [{ fecha_actualizacion: new Date() }] })
          .mockResolvedValue({ rows: [] });
      };

      it('no sobrescribe el código que ya existe en usuarios', async () => {
        preparar('T00071293');

        await service.guardarBorrador(1, {
          nombres: 'Ana',
          apellidos: 'Pérez',
          codigoEstudiantil: 'T00099999',
        });

        const update = updateUsuarios();
        expect(update?.[0]).toContain('nombres');
        expect(update?.[0]).not.toContain('codigo_estudiante');
      });

      it('completa el código cuando usuarios aún no lo tiene', async () => {
        preparar(null);

        await service.guardarBorrador(1, {
          nombres: 'Ana',
          apellidos: 'Pérez',
          codigoEstudiantil: 'T00099999',
        });

        const update = updateUsuarios();
        expect(update?.[0]).toContain('codigo_estudiante');
        expect(update?.[1]).toContain('T00099999');
      });
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
            rows: [{
              id_solicitud: 102,
              id_periodo: '11111111-1111-4111-8111-111111111111',
              tipo_solicitud: 'PREGRADO',
              estado: 'BORRADOR',
            }],
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

  describe('validarRequisitosCompletos (Tarea 54: campos obligatorios)', () => {
    const base = {
      usuario: {
        nombres: 'Ana',
        apellidos: 'Pérez',
        codigo_estudiante: '123456',
      },
      perfil: {
        tipo_documento_identidad: 'CC',
        numero_documento: '123456789',
        fecha_nacimiento: '2000-01-01',
        genero: 'FEMENINO',
        telefono_celular: '3001234567',
        departamento_residencia: 'Bolívar',
        ciudad_residencia: 'Cartagena',
        direccion_residencia: 'Calle 1 # 2-3',
        tiene_discapacidad: false as boolean | null,
        tipo_discapacidad: null as string | null,
      },
      segundoPrograma: false as boolean | null,
      programas: [
        {
          orden: 1,
          programa: 'Ingeniería de Sistemas',
          modalidad: 'PRESENCIAL',
          tipo_opcion_grado: 'TRABAJO',
        },
      ] as Array<{
        orden: number;
        programa: string | null;
        modalidad: string | null;
        tipo_opcion_grado: string | null;
      }>,
      pregrado: {
        conoce_registro_saber_pro: false as boolean | null,
        numero_registro_saber_pro: null as string | null,
        fecha_examen_saber_pro: '2024-06-01' as string | null,
        es_empleado_utb: false as boolean | null,
        es_hijo_empleado_utb: false as boolean | null,
      },
      posgrado: {
        nivel_estudios_alcanzado: 'PREGRADO',
        titulo_obtenido: 'Ingeniero',
        es_egresado_pregrado_utb: false as boolean | null,
      },
      documentos: [
        { tipo_documento: 'identification', orden: 1 },
        { tipo_documento: 'academic_evaluation', orden: 1 },
        { tipo_documento: 'estampilla_pro_cultura', orden: 1 },
        { tipo_documento: 'saber_pro', orden: 1 },
      ] as Array<{ tipo_documento: string; orden: number }>,
    };

    const preparar = (
      cambios: {
        perfil?: Partial<typeof base.perfil>;
        pregrado?: Partial<typeof base.pregrado>;
        posgrado?: Partial<typeof base.posgrado>;
        programas?: typeof base.programas;
        documentos?: typeof base.documentos;
        segundoPrograma?: boolean | null;
      } = {},
    ) => {
      const perfil = { ...base.perfil, ...cambios.perfil };
      const pregrado = { ...base.pregrado, ...cambios.pregrado };
      const posgrado = { ...base.posgrado, ...cambios.posgrado };
      const datos = {
        ...base,
        ...cambios,
        perfil,
        pregrado,
        posgrado,
      };
      mockClient.query.mockImplementation((sql: string) => {
        if (sql.includes('FROM usuarios'))
          return Promise.resolve({ rows: [datos.usuario] });
        if (sql.includes('FROM perfil_estudiante'))
          return Promise.resolve({ rows: [datos.perfil] });
        if (sql.includes('SELECT segundo_programa'))
          return Promise.resolve({
            rows: [{ segundo_programa: datos.segundoPrograma }],
          });
        if (sql.includes('FROM solicitud_programa'))
          return Promise.resolve({ rows: datos.programas });
        if (sql.includes('FROM informacion_pregrado'))
          return Promise.resolve({ rows: [datos.pregrado] });
        if (sql.includes('FROM informacion_posgrado'))
          return Promise.resolve({ rows: [datos.posgrado] });
        if (sql.includes('FROM documentos'))
          return Promise.resolve({ rows: datos.documentos });
        return Promise.resolve({ rows: [] });
      });
    };

    const validar = (tipo: 'PREGRADO' | 'POSGRADO' = 'PREGRADO') =>
      (
        service as unknown as {
          validarRequisitosCompletos: (
            client: PoolClient,
            idEstudiante: number,
            idSolicitud: number,
            tipoSolicitud: string,
          ) => Promise<void>;
        }
      ).validarRequisitosCompletos(
        mockClient as unknown as PoolClient,
        1,
        102,
        tipo,
      );

    it('acepta un perfil y una solicitud de pregrado completos', async () => {
      preparar();
      await expect(validar()).resolves.toBeUndefined();
    });

    it.each([
      ['fecha_nacimiento', 'fecha de nacimiento'],
      ['genero', 'género'],
      ['telefono_celular', 'número de celular'],
      ['departamento_residencia', 'departamento'],
      ['ciudad_residencia', 'ciudad o municipio'],
      ['direccion_residencia', 'dirección de residencia'],
    ] as const)('exige %s en el perfil', async (campo, etiqueta) => {
      preparar({ perfil: { [campo]: '   ' } });
      await expect(validar()).rejects.toThrow(etiqueta);
    });

    it('exige responder si posee alguna discapacidad', async () => {
      preparar({ perfil: { tiene_discapacidad: null } });
      await expect(validar()).rejects.toThrow(/respuesta sobre discapacidad/);
    });

    it('solo exige el tipo de discapacidad cuando la respuesta es afirmativa', async () => {
      preparar({ perfil: { tiene_discapacidad: true } });
      await expect(validar()).rejects.toThrow(/tipo de discapacidad/);

      preparar({
        perfil: { tiene_discapacidad: true, tipo_discapacidad: 'FISICA' },
      });
      await expect(validar()).resolves.toBeUndefined();
    });

    it('exige responder si solicita grado en un segundo programa', async () => {
      preparar({ segundoPrograma: null });
      await expect(validar()).rejects.toThrow(
        /Debe indicar si solicita grado en un segundo programa/,
      );
    });

    it('exige los datos del segundo programa solo cuando la respuesta es sí', async () => {
      preparar({ segundoPrograma: true });
      await expect(validar()).rejects.toThrow(/segundo programa/);

      preparar({ segundoPrograma: false });
      await expect(validar()).resolves.toBeUndefined();
    });

    it('rechaza un segundo programa igual al primero', async () => {
      preparar({
        segundoPrograma: true,
        programas: [base.programas[0], { ...base.programas[0], orden: 2 }],
      });
      await expect(validar()).rejects.toThrow(
        /segundo programa debe ser diferente al primer programa/,
      );
    });

    it('acepta un segundo programa distinto al primero', async () => {
      preparar({
        segundoPrograma: true,
        programas: [
          base.programas[0],
          { ...base.programas[0], orden: 2, programa: 'Ingeniería Industrial' },
        ],
        documentos: [
          ...base.documentos,
          { tipo_documento: 'academic_evaluation', orden: 2 },
          { tipo_documento: 'estampilla_pro_cultura', orden: 2 },
        ],
      });
      await expect(validar()).resolves.toBeUndefined();
    });

    it('exige la opción de grado del primer programa en pregrado', async () => {
      preparar({
        programas: [{ ...base.programas[0], tipo_opcion_grado: null }],
      });
      await expect(validar()).rejects.toThrow(/opción de grado del primer programa/);
    });

    it('no exige opción de grado en posgrado', async () => {
      preparar({
        programas: [{ ...base.programas[0], tipo_opcion_grado: null }],
        documentos: [
          { tipo_documento: 'identification', orden: 1 },
          { tipo_documento: 'estampilla_pro_cultura', orden: 1 },
        ],
      });
      await expect(validar('POSGRADO')).resolves.toBeUndefined();
    });

    it.each([
      ['nivel_estudios_alcanzado', 'nivel de estudios alcanzado'],
      ['titulo_obtenido', 'título obtenido'],
    ] as const)('exige %s en posgrado', async (campo, etiqueta) => {
      preparar({
        posgrado: { [campo]: '   ' },
        documentos: [
          { tipo_documento: 'identification', orden: 1 },
          { tipo_documento: 'estampilla_pro_cultura', orden: 1 },
        ],
      });
      await expect(validar('POSGRADO')).rejects.toThrow(etiqueta);
    });

    it('exige responder si es egresado de pregrado de la UTB en posgrado', async () => {
      preparar({
        posgrado: { es_egresado_pregrado_utb: null },
        documentos: [
          { tipo_documento: 'identification', orden: 1 },
          { tipo_documento: 'estampilla_pro_cultura', orden: 1 },
        ],
      });
      await expect(validar('POSGRADO')).rejects.toThrow(
        /responder si es egresado o egresada de pregrado de la UTB/,
      );
    });

    it('exige la fecha del examen aunque no conozca el número de registro', async () => {
      preparar({ pregrado: { fecha_examen_saber_pro: null } });
      await expect(validar()).rejects.toThrow(/fecha del examen Saber Pro/);
    });

    it('exige el número de registro solo cuando dice conocerlo', async () => {
      preparar({
        pregrado: { conoce_registro_saber_pro: true, numero_registro_saber_pro: ' ' },
      });
      await expect(validar()).rejects.toThrow(/número de registro Saber Pro/);

      preparar({
        pregrado: { conoce_registro_saber_pro: false, numero_registro_saber_pro: null },
      });
      await expect(validar()).resolves.toBeUndefined();
    });

    it.each([
      ['es_empleado_utb', /es empleado de la UTB/],
      ['es_hijo_empleado_utb', /hijo o hija de un empleado de la UTB/],
    ] as const)('exige responder la pregunta %s', async (campo, mensaje) => {
      preparar({ pregrado: { [campo]: null } });
      await expect(validar()).rejects.toThrow(mensaje);
    });
  });
});
