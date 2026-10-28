import { ReenviosService, type ArchivoCorreccion } from './reenvios.service.js';
import { flujoProgreso, type InformarAvance } from './progreso-envio.js';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  AnalisisPreinscripcionService,
  type PdfPreinscripcion,
} from './analisis-preinscripcion.service.js';
import {
  BadRequestException,
  HttpException,
  Param,
  ParseIntPipe,
  Res,
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
import type { Request, Response } from 'express';
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
    private readonly reenvios: ReenviosService,
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
    @Res() res?: Response,
  ): Promise<RespuestaEnvioPreinscripcion | void> {
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
    return this.ejecutarEnvio(req, res, archivos.length, (informar) =>
      this.solicitudesService.enviarPreinscripcion(
        user.id,
        datos,
        archivos.map((a, i) => ({ ...a, tipo: tipos[i] })),
        informar,
      ),
    );
  }

  @Get('estudiante/documentos/:id/original')
  async documentoOriginal(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const a = await this.reenvios.original(
      this.obtenerEstudianteAutenticado(req).id,
      id,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(a.nombre)}`,
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(a.bytes);
  }

  @Post('solicitudes/:id/correcciones')
  @UseInterceptors(
    FilesInterceptor('documentos', 6, {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024, fieldSize: 4096, fields: 2 },
    }),
  )
  async corregir(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { ids?: string; clave?: string },
    @UploadedFiles() archivos: Omit<ArchivoCorreccion, 'id'>[],
    @Res() res?: Response,
  ) {
    const user = this.obtenerEstudianteAutenticado(req);
    let ids: unknown;
    try {
      ids = JSON.parse(body?.ids ?? 'null');
    } catch {
      throw new BadRequestException('Lista de documentos inválida.');
    }
    if (
      !Array.isArray(ids) ||
      !archivos?.length ||
      ids.length !== archivos.length ||
      typeof body.clave !== 'string'
    )
      throw new BadRequestException(
        'Adjunta los PDF seleccionados y sus identificadores.',
      );
    const corregidos = archivos.map((a, i) => ({ ...a, id: ids[i] as number }));
    return this.ejecutarEnvio(req, res, archivos.length, (informar) =>
      this.reenvios.reenviar(user.id, id, body.clave!, corregidos, informar),
    );
  }

  private async ejecutarEnvio<T>(
    req: Request,
    res: Response | undefined,
    cantidad: number,
    accion: (informar: InformarAvance) => Promise<T>,
  ): Promise<T | void> {
    if (!res) return accion(() => {}); // invocaciones unitarias del controlador
    if (!req.headers.accept?.includes('application/x-ndjson')) {
      const resultado = await accion(() => {});
      res.status(201).json(resultado);
      return;
    }
    const flujo = flujoProgreso(res, cantidad);
    try {
      flujo.confirmar(await accion(flujo.informar));
    } catch (error) {
      const codigo = error instanceof HttpException ? error.getStatus() : 500;
      const mensaje =
        error instanceof HttpException && codigo < 500
          ? error.message
          : 'No fue posible completar el análisis. Los resultados anteriores se conservan. Revisa los documentos e intenta nuevamente.';
      flujo.fallar(mensaje, codigo);
    }
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
