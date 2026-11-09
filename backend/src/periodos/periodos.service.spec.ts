import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../database/database.service.js';
import {
  normalizarNombrePeriodo,
  PeriodosService,
} from './periodos.service.js';

describe('PeriodosService', () => {
  describe('normalizarNombre', () => {
    it.each([
      ['Grados 2027-1', '  grados   2027-1  ', true],
      ['Grados 2027-1', 'GRADOS 2027-1', true],
      ['Período de Grado', 'periodo de grado', true],
      ['Graduación 2026', 'graduacion 2026', true],
      ['Convocatoria Única', 'convocatoria unica', true],
      ['Año 2027', 'ano 2027', true],
      ['Grados 2027-1', 'Grados 2027-2', false],
    ])('compara "%s" con "%s" (coincide: %s)', (a, b, coincide) => {
      expect(normalizarNombrePeriodo(a) === normalizarNombrePeriodo(b)).toBe(
        coincide,
      );
    });
  });

  describe('comprobarDuplicado en crear y editar', () => {
    const mockDb = {
      query: vi.fn(),
    } as unknown as DatabaseService;

    const service = new PeriodosService(mockDb);

    it('rechaza crear un periodo cuyo nombre normalizado ya exista', async () => {
      vi.mocked(mockDb.query).mockImplementation(async (sql: string) => {
        if (sql.includes('regexp_replace')) {
          return { rows: [{ id: 'existente-id' }] } as any;
        }
        return { rows: [] } as any;
      });

      await expect(
        service.crear({
          nombre: '  grados   2027-1  ',
          fechaInicio: '2027-01-10',
          fechaFin: '2027-03-01',
          fechaGraduacion: '2027-04-01',
        }),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.crear({
          nombre: '  grados   2027-1  ',
          fechaInicio: '2027-01-10',
          fechaFin: '2027-03-01',
          fechaGraduacion: '2027-04-01',
        }),
      ).rejects.toThrow('Ya existe un periodo con este nombre');
    });

    it('rechaza crear un periodo con las mismas fechas de recepción', async () => {
      vi.mocked(mockDb.query).mockImplementation(async (sql: string) => {
        if (sql.includes('fecha_inicio=$1 AND fecha_fin=$2')) {
          return { rows: [{ id: 'existente-id' }] } as any;
        }
        return { rows: [] } as any;
      });

      await expect(
        service.crear({
          nombre: 'Nombre Nuevo',
          fechaInicio: '2027-01-10',
          fechaFin: '2027-03-01',
          fechaGraduacion: '2027-04-01',
        }),
      ).rejects.toThrow(
        'Ya existe un periodo con estas fechas de recepción. Edita el periodo registrado o selecciona otro rango.',
      );
    });

    it('permite editar el mismo periodo conservando su propio nombre', async () => {
      const periodoActual = {
        id: 'mi-id',
        nombre: 'Grados 2027-1',
        fecha_inicio: '2027-01-10',
        fecha_fin: '2027-03-01',
        fecha_graduacion: '2027-04-01',
        estado: 'ABIERTO' as const,
      };

      vi.mocked(mockDb.query).mockImplementation(async (sql: string) => {
        if (sql.includes('WHERE id = $1')) {
          return { rows: [periodoActual] } as any;
        }
        if (sql.includes('UPDATE periodos_grado')) {
          return { rows: [periodoActual] } as any;
        }
        return { rows: [] } as any;
      });

      const res = await service.editar('mi-id', {
        nombre: 'Grados 2027-1',
        estado: 'CERRADO',
      });
      expect(res.id).toBe('mi-id');
    });

    it('rechaza renombrar un periodo al nombre de otro periodo existente', async () => {
      const periodoActual = {
        id: 'mi-id',
        nombre: 'Grados 2027-1',
        fecha_inicio: '2027-01-10',
        fecha_fin: '2027-03-01',
        fecha_graduacion: '2027-04-01',
        estado: 'ABIERTO' as const,
      };

      vi.mocked(mockDb.query).mockImplementation(async (sql: string) => {
        if (sql.includes('WHERE id = $1')) {
          return { rows: [periodoActual] } as any;
        }
        if (sql.includes('regexp_replace')) {
          return { rows: [{ id: 'otro-periodo-id' }] } as any;
        }
        return { rows: [] } as any;
      });

      await expect(
        service.editar('mi-id', {
          nombre: 'Otro Periodo Existente',
        }),
      ).rejects.toThrow('Ya existe un periodo con este nombre');
    });

    it('procesa el error de la restricción uq_periodos_grado_nombre convirtiéndolo en ConflictException', async () => {
      vi.mocked(mockDb.query).mockImplementation(async (sql: string) => {
        if (sql.includes('INSERT INTO periodos_grado')) {
          const sqlError = new Error('duplicate key');
          (sqlError as any).code = '23505';
          (sqlError as any).constraint = 'uq_periodos_grado_nombre';
          throw sqlError;
        }
        return { rows: [] } as any;
      });

      await expect(
        service.crear({
          nombre: 'Grados Concurrentes',
          fechaInicio: '2027-01-10',
          fechaFin: '2027-03-01',
          fechaGraduacion: '2027-04-01',
        }),
      ).rejects.toThrow('Ya existe un periodo con este nombre');
    });
  });

  describe('listar', () => {
    const mockDb = {
      query: vi.fn(),
    } as unknown as DatabaseService;

    const service = new PeriodosService(mockDb);

    it('ordena los periodos por fecha_inicio DESC y nombre al listar', async () => {
      vi.mocked(mockDb.query).mockImplementation(async (sql: string) => {
        expect(sql).toContain('ORDER BY fecha_inicio DESC, nombre');
        return {
          rows: [
            {
              id: 'p-reciente',
              nombre: 'Grados 2027-2',
              fecha_inicio: '2027-06-01',
              fecha_fin: '2027-08-01',
              fecha_graduacion: '2027-09-01',
              estado: 'ABIERTO',
            },
            {
              id: 'p-antiguo',
              nombre: 'Grados 2027-1',
              fecha_inicio: '2027-01-10',
              fecha_fin: '2027-03-01',
              fecha_graduacion: '2027-04-01',
              estado: 'CERRADO',
            },
          ],
        } as any;
      });

      const res = await service.listar();
      expect(res).toHaveLength(2);
      expect(res[0].id).toBe('p-reciente');
      expect(res[1].id).toBe('p-antiguo');
    });

    it('aplica el filtro por estado cuando se especifica y mantiene el orden', async () => {
      vi.mocked(mockDb.query).mockImplementation(async (sql: string, params: any) => {
        expect(sql).toContain('WHERE estado = $1');
        expect(sql).toContain('ORDER BY fecha_inicio DESC, nombre');
        expect(params).toEqual(['ABIERTO']);
        return {
          rows: [
            {
              id: 'p-reciente',
              nombre: 'Grados 2027-2',
              fecha_inicio: '2027-06-01',
              fecha_fin: '2027-08-01',
              fecha_graduacion: '2027-09-01',
              estado: 'ABIERTO',
            },
          ],
        } as any;
      });

      const res = await service.listar('ABIERTO');
      expect(res).toHaveLength(1);
      expect(res[0].estado).toBe('ABIERTO');
    });
  });
});
