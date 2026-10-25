import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service.js';

export type EstadoPeriodo = 'ABIERTO' | 'CERRADO';

export interface PeriodoGrado {
  id: string;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  fechaGraduacion: string;
  estado: EstadoPeriodo;
}

interface PeriodoRow {
  id: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  fecha_graduacion: string;
  estado: EstadoPeriodo;
}

interface DatosPeriodo {
  nombre?: string;
  fechaInicio?: string;
  fechaFin?: string;
  fechaGraduacion?: string;
  estado?: EstadoPeriodo;
}

@Injectable()
export class PeriodosService {
  constructor(private readonly db: DatabaseService) {}

  async listar(estado?: string): Promise<PeriodoGrado[]> {
    if (estado !== undefined && estado !== 'ABIERTO' && estado !== 'CERRADO') {
      throw new BadRequestException('El estado debe ser ABIERTO o CERRADO.');
    }
    const result = estado
      ? await this.db.query<PeriodoRow>(
          `SELECT id, nombre, fecha_inicio::text, fecha_fin::text,
                  fecha_graduacion::text, estado
           FROM periodos_grado WHERE estado = $1
           ORDER BY fecha_inicio DESC, nombre`,
          [estado],
        )
      : await this.db.query<PeriodoRow>(
          `SELECT id, nombre, fecha_inicio::text, fecha_fin::text,
                  fecha_graduacion::text, estado
           FROM periodos_grado ORDER BY fecha_inicio DESC, nombre`,
        );
    return result.rows.map((row) => this.serializar(row));
  }

  async crear(input: DatosPeriodo): Promise<PeriodoGrado> {
    const values = this.validar(input);
    const result = await this.db.query<PeriodoRow>(
      `INSERT INTO periodos_grado
        (id, nombre, fecha_inicio, fecha_fin, fecha_graduacion, estado)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nombre, fecha_inicio::text, fecha_fin::text,
                 fecha_graduacion::text, estado`,
      [randomUUID(), ...values],
    );
    return this.serializar(result.rows[0]);
  }

  async editar(id: string, input: DatosPeriodo): Promise<PeriodoGrado> {
    const actual = await this.db.query<PeriodoRow>(
      `SELECT id, nombre, fecha_inicio::text, fecha_fin::text,
              fecha_graduacion::text, estado
       FROM periodos_grado WHERE id = $1`,
      [id],
    );
    const rowActual = actual.rows[0];
    if (!rowActual) throw new NotFoundException('No existe el periodo indicado.');

    const values = this.validar({
      nombre: input.nombre ?? rowActual.nombre,
      fechaInicio: input.fechaInicio ?? rowActual.fecha_inicio,
      fechaFin: input.fechaFin ?? rowActual.fecha_fin,
      fechaGraduacion: input.fechaGraduacion ?? rowActual.fecha_graduacion,
      estado: input.estado ?? rowActual.estado,
    });
    const result = await this.db.query<PeriodoRow>(
      `UPDATE periodos_grado
       SET nombre = $2, fecha_inicio = $3, fecha_fin = $4,
           fecha_graduacion = $5, estado = $6, actualizado_en = now()
       WHERE id = $1
       RETURNING id, nombre, fecha_inicio::text, fecha_fin::text,
                 fecha_graduacion::text, estado`,
      [id, ...values],
    );
    return this.serializar(result.rows[0]);
  }

  private validar(input: DatosPeriodo): [string, string, string, string, EstadoPeriodo] {
    const nombre = input.nombre?.trim();
    const inicio = input.fechaInicio;
    const fin = input.fechaFin;
    const graduacion = input.fechaGraduacion;
    const estado = input.estado ?? 'ABIERTO';

    if (!nombre || !inicio || !fin || !graduacion) {
      throw new BadRequestException('Nombre, fecha de inicio, fecha de fin y fecha de graduación son obligatorios.');
    }
    for (const fecha of [inicio, fin, graduacion]) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !this.fechaValida(fecha)) {
        throw new BadRequestException('Las fechas deben ser válidas y tener formato AAAA-MM-DD.');
      }
    }
    if (inicio > fin) {
      throw new BadRequestException('La fecha de inicio no puede ser posterior a la fecha de fin.');
    }
    if (estado !== 'ABIERTO' && estado !== 'CERRADO') {
      throw new BadRequestException('El estado debe ser ABIERTO o CERRADO.');
    }
    return [nombre, inicio, fin, graduacion, estado];
  }

  private fechaValida(fecha: string): boolean {
    const date = new Date(`${fecha}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === fecha;
  }

  private serializar(row: PeriodoRow): PeriodoGrado {
    return {
      id: row.id,
      nombre: row.nombre,
      fechaInicio: row.fecha_inicio,
      fechaFin: row.fecha_fin,
      fechaGraduacion: row.fecha_graduacion,
      estado: row.estado,
    };
  }
}
