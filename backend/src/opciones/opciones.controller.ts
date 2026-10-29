import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, type SafeUser } from '../auth/auth.service.js';
import { OpcionesService } from './opciones.service.js';

const COOKIE_NAME = 'checku.sid';

function sessionId(req: Request): string | undefined {
  const raw = req.headers.cookie;
  const part = raw
    ?.split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${COOKIE_NAME}=`));
  return part ? decodeURIComponent(part.slice(COOKIE_NAME.length + 1)) : undefined;
}

/**
 * Opciones permitidas de los campos del formulario.
 *
 * GET es de consulta para cualquier sesión (el formulario del estudiante las necesita).
 * El resto de operaciones administra el catálogo y exige sesión de funcionario.
 */
@Controller('opciones-campo')
export class OpcionesController {
  constructor(
    private readonly opciones: OpcionesService,
    private readonly auth: AuthService,
  ) {}

  private usuario(req: Request): SafeUser {
    const id = sessionId(req);
    const user = id ? this.auth.getUser(id) : null;
    if (!user) throw new UnauthorizedException('Se requiere una sesión válida.');
    return user;
  }

  private funcionario(req: Request): SafeUser {
    const user = this.usuario(req);
    if (user.role.toLowerCase() !== 'funcionario') {
      throw new UnauthorizedException('Se requiere una sesión de funcionario.');
    }
    return user;
  }

  @Get()
  listar(@Req() req: Request, @Query('campo') campo?: string) {
    this.usuario(req);
    return this.opciones.listar(campo);
  }

  @Post()
  crear(
    @Req() req: Request,
    @Body() body: { campo?: string; etiqueta?: string; valor?: string },
  ) {
    this.funcionario(req);
    return this.opciones.crear(body);
  }

  @Post('importar')
  importar(
    @Req() req: Request,
    @Body() body: { campo?: string; texto?: string },
  ) {
    this.funcionario(req);
    return this.opciones.importar(body.campo ?? '', body.texto);
  }

  @Patch('orden')
  reordenar(
    @Req() req: Request,
    @Body() body: { campo?: string; ids?: unknown },
  ) {
    this.funcionario(req);
    return this.opciones.reordenar(body.campo ?? '', body.ids);
  }

  @Patch(':id')
  actualizar(
    @Req() req: Request,
    @Body() body: { etiqueta?: string },
  ) {
    this.funcionario(req);
    const id = req.params.id;
    if (typeof id !== 'string' || !id) {
      throw new BadRequestException('Identificador de opción inválido.');
    }
    return this.opciones.actualizar(id, body);
  }

  @Delete(':id')
  eliminar(@Req() req: Request) {
    this.funcionario(req);
    const id = req.params.id;
    if (typeof id !== 'string' || !id) {
      throw new BadRequestException('Identificador de opción inválido.');
    }
    return this.opciones.eliminar(id);
  }
}
