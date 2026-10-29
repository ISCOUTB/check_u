import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, type UserRole } from '../auth/auth.service.js';
import { readSessionId } from '../auth/session.js';
import {
  NotificacionesService,
  type AccionRevision,
} from './notificaciones.service.js';

@Controller()
export class NotificacionesController {
  constructor(
    private readonly auth: AuthService,
    private readonly notificaciones: NotificacionesService,
  ) {}
  private usuario(req: Request, rol: UserRole) {
    const id = readSessionId(req);
    const user = id ? this.auth.getUser(id) : null;
    if (!user) throw new UnauthorizedException('Sesión no válida o expirada');
    if (user.role !== rol)
      throw new ForbiddenException('Acceso restringido al rol autorizado.');
    return user;
  }
  @Get('estudiante/notificaciones')
  @Header('Cache-Control', 'private, no-store')
  listar(@Req() req: Request) {
    return this.notificaciones.listar(this.usuario(req, 'estudiante').id);
  }
  @Patch('estudiante/notificaciones/:id/leida')
  @Header('Cache-Control', 'private, no-store')
  marcarLeida(@Req() req: Request, @Param('id') id: string) {
    return this.notificaciones.marcarLeida(
      this.usuario(req, 'estudiante').id,
      id,
    );
  }
  @Post('funcionario/solicitudes/:id/revisiones')
  @Header('Cache-Control', 'private, no-store')
  registrarRevision(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AccionRevision,
  ) {
    return this.notificaciones.registrarRevision(
      this.usuario(req, 'funcionario').id,
      id,
      body,
    );
  }
}
