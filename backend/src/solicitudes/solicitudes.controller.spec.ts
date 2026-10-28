import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthService } from '../auth/auth.service.js';
import { COOKIE_NAME } from '../auth/session.js';
import type { AnalisisPreinscripcionService } from './analisis-preinscripcion.service.js';
import { SolicitudesController } from './solicitudes.controller.js';
import type { SolicitudesService } from './solicitudes.service.js';

describe('SolicitudesController', () => {
  let controller: SolicitudesController;
  let mockSolicitudesService: {
    obtenerSolicitudEstudiante: ReturnType<typeof vi.fn>;
    enviarPreinscripcion: ReturnType<typeof vi.fn>;
    guardarBorrador: ReturnType<typeof vi.fn>;
  };
  let mockAuthService: {
    getUser: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockSolicitudesService = {
      obtenerSolicitudEstudiante: vi.fn(),
      enviarPreinscripcion: vi.fn(),
      guardarBorrador: vi.fn(),
    };
    mockAuthService = {
      getUser: vi.fn(),
    };

    controller = new SolicitudesController(
      mockSolicitudesService as unknown as SolicitudesService,
      mockAuthService as unknown as AuthService,
      {} as AnalisisPreinscripcionService,
    );
  });

  function crearRequest(cookie?: string, query?: Record<string, unknown>, body?: unknown): Request {
    return {
      headers: {
        cookie,
      },
      query: query ?? {},
      body,
    } as unknown as Request;
  }

  describe('GET estudiante/solicitud', () => {
    it('sin sesión responde 401 Unauthorized', async () => {
      const req = crearRequest();
      await expect(controller.obtenerSolicitud(req)).rejects.toThrow(UnauthorizedException);
    });

    it('con sesión no válida o expirada responde 401 Unauthorized', async () => {
      const req = crearRequest(`${COOKIE_NAME}=expirada`);
      mockAuthService.getUser.mockReturnValueOnce(null);

      await expect(controller.obtenerSolicitud(req)).rejects.toThrow(UnauthorizedException);
    });

    it('con rol funcionario responde 403 Forbidden', async () => {
      const req = crearRequest(`${COOKIE_NAME}=sesion-valida`);
      mockAuthService.getUser.mockReturnValueOnce({
        id: 2,
        username: 'funcionario@utb.edu.co',
        name: 'Rosa Marriaga',
        role: 'funcionario',
      });

      await expect(controller.obtenerSolicitud(req)).rejects.toThrow(ForbiddenException);
    });

    it('con rol estudiante sin solicitud responde con tiene_solicitud: false', async () => {
      const req = crearRequest(`${COOKIE_NAME}=sesion-valida`);
      mockAuthService.getUser.mockReturnValueOnce({
        id: 1,
        username: 'lizapata@utb.edu.co',
        name: 'Lisandro Zapata',
        role: 'estudiante',
      });
      mockSolicitudesService.obtenerSolicitudEstudiante.mockResolvedValueOnce({
        tiene_solicitud: false,
        solicitud: null,
      });

      const respuesta = await controller.obtenerSolicitud(req);

      expect(respuesta).toEqual({
        tiene_solicitud: false,
        solicitud: null,
      });
      expect(mockSolicitudesService.obtenerSolicitudEstudiante).toHaveBeenCalledWith(1);
    });

    it('con rol estudiante con solicitud responde con tiene_solicitud: true y los datos de la solicitud', async () => {
      const req = crearRequest(`${COOKIE_NAME}=sesion-valida`);
      mockAuthService.getUser.mockReturnValueOnce({
        id: 1,
        username: 'lizapata@utb.edu.co',
        name: 'Lisandro Zapata',
        role: 'estudiante',
      });
      mockSolicitudesService.obtenerSolicitudEstudiante.mockResolvedValueOnce({
        tiene_solicitud: true,
        solicitud: {
          id_solicitud: 5,
          tipo_solicitud: 'PREGRADO',
          estado: 'BORRADOR',
        },
      });

      const respuesta = await controller.obtenerSolicitud(req);

      expect(respuesta).toEqual({
        tiene_solicitud: true,
        solicitud: {
          id_solicitud: 5,
          tipo_solicitud: 'PREGRADO',
          estado: 'BORRADOR',
        },
      });
      expect(mockSolicitudesService.obtenerSolicitudEstudiante).toHaveBeenCalledWith(1);
    });

    it('ignora cualquier identificador enviado por el cliente en query, params o body', async () => {
      const req = crearRequest(
        `${COOKIE_NAME}=sesion-valida`,
        { id_estudiante: 999, id: 888 },
        { id_estudiante: 777 },
      );
      mockAuthService.getUser.mockReturnValueOnce({
        id: 1,
        username: 'lizapata@utb.edu.co',
        name: 'Lisandro Zapata',
        role: 'estudiante',
      });
      mockSolicitudesService.obtenerSolicitudEstudiante.mockResolvedValueOnce({
        tiene_solicitud: true,
        solicitud: {
          id_solicitud: 1,
          tipo_solicitud: 'PREGRADO',
          estado: 'BORRADOR',
        },
      });

      await controller.obtenerSolicitud(req);

      expect(mockSolicitudesService.obtenerSolicitudEstudiante).toHaveBeenCalledWith(1);
      expect(mockSolicitudesService.obtenerSolicitudEstudiante).not.toHaveBeenCalledWith(999);
    });
  });

  describe('POST solicitudes/enviar', () => {
    it('sin sesión responde 401 Unauthorized', async () => {
      const req = crearRequest();
      await expect(controller.enviarPreinscripcion(req)).rejects.toThrow(UnauthorizedException);
    });

    it('con rol funcionario responde 403 Forbidden', async () => {
      const req = crearRequest(`${COOKIE_NAME}=sesion-valida`);
      mockAuthService.getUser.mockReturnValueOnce({
        id: 2,
        username: 'funcionario@utb.edu.co',
        name: 'Rosa Marriaga',
        role: 'funcionario',
      });

      await expect(controller.enviarPreinscripcion(req)).rejects.toThrow(ForbiddenException);
    });

    it('con estudiante registra la preinscripción exitosamente y devuelve respuesta unificada', async () => {
      const req = crearRequest(`${COOKIE_NAME}=sesion-valida`, undefined, {
        nivel: 'PREGRADO',
        id_estudiante: 999, // Debe ser ignorado
      });
      mockAuthService.getUser.mockReturnValueOnce({
        id: 1,
        username: 'lizapata@utb.edu.co',
        name: 'Lisandro Zapata',
        role: 'estudiante',
      });
      mockSolicitudesService.enviarPreinscripcion.mockResolvedValueOnce({
        ok: true,
        id_solicitud: 102,
        id_entrega: 1,
        estado: 'EN_PROCESO',
        mensaje: 'Preinscripción registrada correctamente. Pendiente de análisis.',
      });

      const archivo = { buffer: Buffer.from('%PDF-1.4'), originalname: 'prueba.pdf', mimetype: 'application/pdf' };
      const respuesta = await controller.enviarPreinscripcion(req, { datos: JSON.stringify(req.body), tipos: 'identification' }, [archivo]);

      expect(respuesta).toEqual({
        ok: true,
        id_solicitud: 102,
        id_entrega: 1,
        estado: 'EN_PROCESO',
        mensaje: 'Preinscripción registrada correctamente. Pendiente de análisis.',
      });
      expect(mockSolicitudesService.enviarPreinscripcion).toHaveBeenCalledWith(1, req.body, [expect.objectContaining({ tipo: 'identification' })], expect.any(Function));
    });
  });

  describe('POST solicitudes/borrador', () => {
    it('sin sesión responde 401 Unauthorized', async () => {
      const req = crearRequest();
      await expect(controller.guardarBorrador(req)).rejects.toThrow(UnauthorizedException);
    });

    it('con rol funcionario responde 403 Forbidden', async () => {
      const req = crearRequest(`${COOKIE_NAME}=sesion-valida`);
      mockAuthService.getUser.mockReturnValueOnce({
        id: 2,
        username: 'funcionario@utb.edu.co',
        name: 'Rosa Marriaga',
        role: 'funcionario',
      });

      await expect(controller.guardarBorrador(req)).rejects.toThrow(ForbiddenException);
    });

    it('con estudiante guarda el borrador', async () => {
      const req = crearRequest(`${COOKIE_NAME}=sesion-valida`, undefined, {
        nivel: 'PREGRADO',
      });
      mockAuthService.getUser.mockReturnValueOnce({
        id: 1,
        username: 'lizapata@utb.edu.co',
        name: 'Lisandro Zapata',
        role: 'estudiante',
      });
      mockSolicitudesService.guardarBorrador.mockResolvedValueOnce({
        ok: true,
        guardadoEn: '2026-10-24T18:00:00.000Z',
      });

      const respuesta = await controller.guardarBorrador(req, req.body);

      expect(respuesta).toEqual({
        ok: true,
        guardadoEn: '2026-10-24T18:00:00.000Z',
      });
      expect(mockSolicitudesService.guardarBorrador).toHaveBeenCalledWith(1, req.body);
    });
  });
});
