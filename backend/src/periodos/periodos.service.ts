import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
    await this.comprobarDuplicado(values[1], values[2]);
    try {
      const result = await this.db.query<PeriodoRow>(
        `INSERT INTO periodos_grado
        (id, nombre, fecha_inicio, fecha_fin, fecha_graduacion, estado)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nombre, fecha_inicio::text, fecha_fin::text,
                 fecha_graduacion::text, estado`,
        [randomUUID(), ...values],
      );
      return this.serializar(result.rows[0]);
    } catch (error) {
      return this.procesarError(error);
    }
  }

  async editar(id: string, input: DatosPeriodo): Promise<PeriodoGrado> {
    const actual = await this.db.query<PeriodoRow>(
      `SELECT id, nombre, fecha_inicio::text, fecha_fin::text,
              fecha_graduacion::text, estado
       FROM periodos_grado WHERE id = $1`,
      [id],
    );
    const rowActual = actual.rows[0];
    if (!rowActual)
      throw new NotFoundException('No existe el periodo indicado.');

    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new BadRequestException(
        'Los datos del periodo deben ser un objeto.',
      );
    const values = this.validar({
      nombre: input.nombre === undefined ? rowActual.nombre : input.nombre,
      fechaInicio:
        input.fechaInicio === undefined
          ? rowActual.fecha_inicio
          : input.fechaInicio,
      fechaFin:
        input.fechaFin === undefined ? rowActual.fecha_fin : input.fechaFin,
      fechaGraduacion:
        input.fechaGraduacion === undefined
          ? rowActual.fecha_graduacion
          : input.fechaGraduacion,
      estado: input.estado === undefined ? rowActual.estado : input.estado,
    });
    await this.comprobarDuplicado(values[1], values[2], id);
    try {
      const result = await this.db.query<PeriodoRow>(
        `UPDATE periodos_grado
       SET nombre = $2, fecha_inicio = $3, fecha_fin = $4,
           fecha_graduacion = $5, estado = $6, actualizado_en = now()
       WHERE id = $1
       RETURNING id, nombre, fecha_inicio::text, fecha_fin::text,
                 fecha_graduacion::text, estado`,
        [id, ...values],
      );
      if (!result.rows[0])
        throw new NotFoundException('No existe el periodo indicado.');
      return this.serializar(result.rows[0]);
    } catch (error) {
      return this.procesarError(error);
    }
  }

  private async comprobarDuplicado(
    inicio: string,
    fin: string,
    id?: string,
  ): Promise<void> {
    const existente = await this.db.query(
      `SELECT id FROM periodos_grado WHERE fecha_inicio=$1 AND fecha_fin=$2 AND ($3::uuid IS NULL OR id<>$3::uuid) LIMIT 1`,
      [inicio, fin, id ?? null],
    );
    if (existente.rows.length)
      throw new ConflictException(
        'Ya existe un periodo con estas fechas de recepción. Edita el periodo registrado o selecciona otro rango.',
      );
  }

  private procesarError(error: unknown): never {
    // DatabaseService conserva el error PostgreSQL en cause al convertirlo en HTTP 503.
    const causa = error instanceof Error && error.cause ? error.cause : error;
    if (
      typeof causa === 'object' &&
      causa !== null &&
      'code' in causa &&
      causa.code === '23505' &&
      'constraint' in causa &&
      causa.constraint === 'uq_periodos_grado_recepcion'
    ) {
      throw new ConflictException(
        'Ya existe un periodo con estas fechas de recepción. Edita el periodo registrado o selecciona otro rango.',
      );
    }
    throw error;
  }

  private validar(
    input: DatosPeriodo,
  ): [string, string, string, string, EstadoPeriodo] {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new BadRequestException(
        'Los datos del periodo deben ser un objeto.',
      );
    const nombre = typeof input.nombre === 'string' ? input.nombre.trim() : '';
    const inicio = input.fechaInicio;
    const fin = input.fechaFin;
    const graduacion = input.fechaGraduacion;
    const estado = input.estado === undefined ? 'ABIERTO' : input.estado;

    if (!nombre || !inicio || !fin || !graduacion) {
      throw new BadRequestException(
        'Nombre, fecha de inicio, fecha de fin y fecha de graduación son obligatorios.',
      );
    }
    if (nombre.length > 120)
      throw new BadRequestException(
        'El nombre del periodo debe tener como máximo 120 caracteres.',
      );
    for (const fecha of [inicio, fin, graduacion]) {
      if (
        typeof fecha !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(fecha) ||
        fecha.startsWith('0000') ||
        !this.fechaValida(fecha)
      ) {
        throw new BadRequestException(
          'Las fechas deben ser válidas y tener formato AAAA-MM-DD.',
        );
      }
    }
    if (inicio >= fin) {
      throw new BadRequestException(
        'La fecha de inicio debe ser anterior a la fecha de finalización. Selecciona un cierre posterior al inicio.',
      );
    }
    if (graduacion <= fin) {
      throw new BadRequestException(
        'La fecha de graduación debe ser posterior a la fecha de finalización de recepción de documentos. Selecciona una fecha después del cierre.',
      );
    }
    if (estado !== 'ABIERTO' && estado !== 'CERRADO') {
      throw new BadRequestException('El estado debe ser ABIERTO o CERRADO.');
    }
    return [nombre, inicio, fin, graduacion, estado];
  }

  private fechaValida(fecha: string): boolean {
    const date = new Date(`${fecha}T00:00:00.000Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === fecha
    );
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
