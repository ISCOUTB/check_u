import {
  BadRequestException, Body, Controller, Get, Patch, Post, Query,
  Req, UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service.js';
import { PeriodosService, type EstadoPeriodo } from './periodos.service.js';

const COOKIE_NAME = 'checku.sid';

function sessionId(req: Request): string | undefined {
  const raw = req.headers.cookie;
  const part = raw?.split(';').map((value) => value.trim()).find((value) => value.startsWith(`${COOKIE_NAME}=`));
  return part ? decodeURIComponent(part.slice(COOKIE_NAME.length + 1)) : undefined;
}

@Controller('periodos-grado')
export class PeriodosController {
  constructor(private readonly periodos: PeriodosService, private readonly auth: AuthService) {}

  private funcionario(req: Request): void {
    const id = sessionId(req);
    const user = id ? this.auth.getUser(id) : null;
    if (!user || user.role.toLowerCase() !== 'funcionario') {
      throw new UnauthorizedException('Se requiere una sesión de funcionario.');
    }
  }

  @Get()
  listar(@Req() req: Request, @Query('estado') estado?: EstadoPeriodo) {
    this.funcionario(req);
    return this.periodos.listar(estado);
  }

  @Post()
  crear(@Req() req: Request, @Body() body: {
    nombre?: string; fechaInicio?: string; fechaFin?: string;
    fechaGraduacion?: string; estado?: EstadoPeriodo;
  }) {
    this.funcionario(req);
    return this.periodos.crear(body);
  }

  @Patch(':id')
  editar(@Req() req: Request, @Body() body: {
    nombre?: string; fechaInicio?: string; fechaFin?: string;
    fechaGraduacion?: string; estado?: EstadoPeriodo;
  }) {
    this.funcionario(req);
    const id = req.params.id;
    if (typeof id !== 'string' || !id) throw new BadRequestException('Identificador de periodo inválido.');
    return this.periodos.editar(id, body);
  }
}
