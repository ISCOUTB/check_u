import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthService } from '../auth/auth.service.js';
import { COOKIE_NAME } from '../auth/session.js';
import { SolicitudesController } from './solicitudes.controller.js';
import type { SolicitudesService } from './solicitudes.service.js';

describe('SolicitudesController', () => {
  let controller: SolicitudesController;
  let mockSolicitudesService: {
    obtenerSolicitudEstudiante: ReturnType<typeof vi.fn>;
  };
  let mockAuthService: {
    getUser: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockSolicitudesService = {
      obtenerSolicitudEstudiante: vi.fn(),
    };
    mockAuthService = {
      getUser: vi.fn(),
    };

    controller = new SolicitudesController(
      mockSolicitudesService as unknown as SolicitudesService,
      mockAuthService as unknown as AuthService,
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
    // El cliente malicioso o externo envía id_estudiante = 999 en query o body
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

    // Se verifica que NUNCA se usó 999, 888 ni 777; únicamente el id 1 del usuario de sesión
    expect(mockSolicitudesService.obtenerSolicitudEstudiante).toHaveBeenCalledWith(1);
    expect(mockSolicitudesService.obtenerSolicitudEstudiante).not.toHaveBeenCalledWith(999);
  });
});
