import {
  Controller,
  ForbiddenException,
  Get,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service.js';
import { readSessionId } from '../auth/session.js';
import { SolicitudesService } from './solicitudes.service.js';
import type { RespuestaSolicitudEstudiante } from './solicitudes.types.js';

@Controller('estudiante')
export class SolicitudesController {
  constructor(
    private readonly solicitudesService: SolicitudesService,
    private readonly authService: AuthService,
  ) {}

  @Get('solicitud')
  async obtenerSolicitud(
    @Req() req: Request,
  ): Promise<RespuestaSolicitudEstudiante> {
    const sessionId = readSessionId(req);
    const user = sessionId ? this.authService.getUser(sessionId) : null;

    if (!user) {
      throw new UnauthorizedException('Sesión no válida o expirada');
    }

    if (user.role !== 'estudiante') {
      throw new ForbiddenException('Acceso restringido a estudiantes');
    }

    // El identificador del estudiante proviene estrictamente de la sesión.
    // Ignora cualquier identificador enviado por el cliente en query, params o body.
    return this.solicitudesService.obtenerSolicitudEstudiante(user.id);
  }
}
