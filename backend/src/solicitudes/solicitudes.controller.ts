import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service.js';
import { readSessionId } from '../auth/session.js';
import { traducirErrorBorrador } from './errores-borrador.js';
import { SolicitudesService } from './solicitudes.service.js';
import type {
  DatosEnvioPreinscripcion,
  RespuestaEnvioPreinscripcion,
  RespuestaEstadoNavegacion,
  RespuestaGuardarBorrador,
  RespuestaSolicitudEstudiante,
} from './solicitudes.types.js';

@Controller()
export class SolicitudesController {
  constructor(
    private readonly solicitudesService: SolicitudesService,
    private readonly authService: AuthService,
  ) {}

  @Get('estudiante/solicitud')
  async obtenerSolicitud(
    @Req() req: Request,
  ): Promise<RespuestaSolicitudEstudiante> {
    const user = this.obtenerEstudianteAutenticado(req);
    // El identificador del estudiante proviene estrictamente de la sesión.
    // Ignora cualquier identificador enviado por el cliente en query, params o body.
    return this.solicitudesService.obtenerSolicitudEstudiante(user.id);
  }

  @Get('solicitudes/estado')
  async obtenerEstadoNavegacion(
    @Req() req: Request,
  ): Promise<RespuestaEstadoNavegacion> {
    const user = this.obtenerEstudianteAutenticado(req);
    return this.solicitudesService.obtenerEstadoNavegacion(user.id);
  }

  @Post('solicitudes/enviar')
  async enviarPreinscripcion(
    @Req() req: Request,
    @Body() body?: DatosEnvioPreinscripcion,
  ): Promise<RespuestaEnvioPreinscripcion> {
    const user = this.obtenerEstudianteAutenticado(req);
    return this.solicitudesService.enviarPreinscripcion(user.id, body);
  }

  @Get('solicitudes/borrador')
  async obtenerBorrador(@Req() req: Request) {
    const user = this.obtenerEstudianteAutenticado(req);
    return this.solicitudesService.obtenerBorrador(user.id);
  }

  @Post('solicitudes/borrador')
  async guardarBorrador(
    @Req() req: Request,
    @Body() body?: DatosEnvioPreinscripcion,
  ): Promise<RespuestaGuardarBorrador> {
    try {
      const user = this.obtenerEstudianteAutenticado(req);
      return await this.solicitudesService.guardarBorrador(user.id, body);
    } catch (error) {
      throw traducirErrorBorrador(error);
    }
  }

  private obtenerEstudianteAutenticado(req: Request) {
    const sessionId = readSessionId(req);
    const user = sessionId ? this.authService.getUser(sessionId) : null;

    if (!user) {
      throw new UnauthorizedException('Sesión no válida o expirada');
    }

    if (user.role !== 'estudiante') {
      throw new ForbiddenException('Acceso restringido a estudiantes');
    }

    return user;
  }
}
