import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  AnalisisPreinscripcionService,
  type PdfPreinscripcion,
} from './analisis-preinscripcion.service.js';
import {
  BadRequestException,
  UploadedFiles,
  UseInterceptors,
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
  RespuestaGuardarBorrador,
  RespuestaSolicitudEstudiante,
} from './solicitudes.types.js';

@Controller()
export class SolicitudesController {
  constructor(
    private readonly solicitudesService: SolicitudesService,
    private readonly authService: AuthService,
    private readonly analisis: AnalisisPreinscripcionService,
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

  @Get('estudiante/solicitud/analisis')
  async obtenerAnalisis(@Req() req: Request) {
    return this.analisis.obtenerDetalle(
      this.obtenerEstudianteAutenticado(req).id,
    );
  }

  @Post('solicitudes/enviar')
  @UseInterceptors(
    FilesInterceptor('documentos', 6, {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024, fieldSize: 1024 * 1024, fields: 3 },
    }),
  )
  async enviarPreinscripcion(
    @Req() req: Request,
    @Body() body: { datos?: string; tipos?: string },
    @UploadedFiles() archivos?: Omit<PdfPreinscripcion, 'tipo'>[],
  ): Promise<RespuestaEnvioPreinscripcion> {
    const user = this.obtenerEstudianteAutenticado(req);
    let datos: DatosEnvioPreinscripcion;
    try {
      datos = JSON.parse(body?.datos ?? 'null') as DatosEnvioPreinscripcion;
    } catch {
      throw new BadRequestException(
        'El campo datos debe contener JSON válido.',
      );
    }
    if (!datos || typeof datos !== 'object' || Array.isArray(datos))
      throw new BadRequestException(
        'Adjunta los datos y PDF de la preinscripción.',
      );
    if (typeof body.tipos !== 'string')
      throw new BadRequestException('Falta la lista de tipos documentales.');
    const tipos = body.tipos.split(',');
    if (!archivos?.length || archivos.length !== tipos.length)
      throw new BadRequestException('La cantidad de tipos y PDF no coincide.');
    return this.solicitudesService.enviarPreinscripcion(
      user.id,
      datos,
      archivos.map((a, i) => ({ ...a, tipo: tipos[i] })),
    );
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
