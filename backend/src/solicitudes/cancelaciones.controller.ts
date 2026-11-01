import {
  Controller,
  ForbiddenException,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service.js';
import { readSessionId } from '../auth/session.js';
import { CancelacionesService } from './cancelaciones.service.js';

@Controller('estudiante/solicitudes')
export class CancelacionesController {
  constructor(
    private readonly auth: AuthService,
    private readonly cancelaciones: CancelacionesService,
  ) {}
  private estudiante(req: Request) {
    const sesion = readSessionId(req);
    const user = sesion ? this.auth.getUser(sesion) : null;
    if (!user) throw new UnauthorizedException('Sesión no válida o expirada.');
    if (user.role !== 'estudiante')
      throw new ForbiddenException('Acceso restringido a estudiantes.');
    return user.id;
  }
  @Get()
  @Header('Cache-Control', 'private, no-store')
  listar(@Req() req: Request) {
    return this.cancelaciones.listar(this.estudiante(req));
  }
  @Get(':id/analisis')
  @Header('Cache-Control', 'private, no-store')
  detalle(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    return this.cancelaciones.detalle(this.estudiante(req), id);
  }
  @Post(':id/cancelacion')
  @Header('Cache-Control', 'private, no-store')
  cancelar(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    return this.cancelaciones.cancelar(this.estudiante(req), id);
  }
}
