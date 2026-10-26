import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { traducirErrorBorrador } from './errores-borrador.js';
import { validarBorrador } from './borrador.js';

describe('Errores del borrador (Tarea 33)', () => {
  it.each([
    [
      new UnauthorizedException('detalle interno'),
      401,
      'BORRADOR_SESION_EXPIRADA',
    ],
    [new ForbiddenException('detalle interno'), 403, 'BORRADOR_SIN_PERMISO'],
    [new ConflictException('detalle interno'), 409, 'BORRADOR_NO_EDITABLE'],
    [
      new ServiceUnavailableException('DB_HOST falta'),
      503,
      'BORRADOR_SERVICIO_NO_DISPONIBLE',
    ],
    [new Error('SELECT secreto; stacktrace'), 500, 'BORRADOR_ERROR_SERVIDOR'],
    [
      new BadRequestException('SELECT secreto'),
      400,
      'BORRADOR_DATOS_INVALIDOS',
    ],
  ])('traduce el error %s sin filtrar detalles', (error, status, codigo) => {
    const res = traducirErrorBorrador(error);
    expect(res.getStatus()).toBe(status);
    expect(res.getResponse()).toMatchObject({ codigo });
    expect(JSON.stringify(res.getResponse())).not.toMatch(
      /SELECT|stacktrace|DB_HOST|detalle interno/,
    );
  });

  it('identifica un NOT NULL real sin cambiar la política de campos del borrador', () => {
    const error = new ServiceUnavailableException('SQL falló', {
      cause: {
        code: '23502',
        column: 'tipo_documento_identidad',
        detail: 'datos privados',
      },
    });
    const res = traducirErrorBorrador(error);
    expect(res.getResponse()).toMatchObject({
      codigo: 'BORRADOR_CAMPO_REQUERIDO',
      message: expect.stringContaining(
        'falta completar el tipo de documento de identidad',
      ),
    });
    expect(JSON.stringify(res.getResponse())).not.toMatch(
      /SQL|23502|datos privados/,
    );
    expect(validarBorrador({ perfil: {} })).toEqual({ perfil: {} });
  });

  it('conserva la causa SQL internamente para distinguir identidad duplicada', () => {
    const res = traducirErrorBorrador(
      new ServiceUnavailableException('consulta SQL', {
        cause: { code: '23505', constraint: 'uq_perfil_estudiante_identidad' },
      }),
    );
    expect(res.getStatus()).toBe(409);
    expect(res.getResponse()).toMatchObject({
      codigo: 'BORRADOR_IDENTIDAD_REPETIDA',
    });
  });

  it('un campo ausente en el esquema es un fallo del servidor y no del estudiante', () => {
    const res = traducirErrorBorrador(
      new ServiceUnavailableException('columna inexistente', {
        cause: { code: '42703' },
      }),
    );
    expect(res.getStatus()).toBe(500);
    expect(res.getResponse()).toMatchObject({
      codigo: 'BORRADOR_ERROR_SERVIDOR',
    });
  });

  it.each(['ECONNREFUSED', 'ECONNRESET', '08006', '57P03'])(
    'identifica indisponibilidad de PostgreSQL: %s',
    (code) => {
      expect(traducirErrorBorrador({ code }).getStatus()).toBe(503);
    },
  );

  it('describe datos inválidos de Zod con un campo público, sin devolver el valor', () => {
    try {
      validarBorrador({ perfil: { numeroDocumento: 'DATO PRIVADO!' } });
      throw new Error('La validación debió fallar');
    } catch (error) {
      const res = traducirErrorBorrador(error).getResponse();
      expect(res).toMatchObject({
        codigo: 'BORRADOR_DATOS_INVALIDOS',
        campos: [{ campo: 'perfil.numeroDocumento', motivo: 'INVALIDO' }],
      });
      expect(JSON.stringify(res)).not.toContain('DATO PRIVADO!');
    }
  });
});
