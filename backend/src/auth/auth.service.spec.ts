import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';

// Usa los usuarios de prueba fijos de AuthService (se reemplazan en la Tarea 13).
const TREINTA_MINUTOS = 30 * 60 * 1000;

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('con credenciales válidas crea una sesión y no devuelve la contraseña', () => {
    const { sessionId, user } = service.login('rmarriaga@utb.edu.co', '12345');

    expect(sessionId).toMatch(/^[0-9a-f]{64}$/);
    expect(user).toEqual({
      id: 2,
      username: 'rmarriaga@utb.edu.co',
      name: 'Rosana Marriaga',
      role: 'funcionario',
    });
    expect(user).not.toHaveProperty('password');
  });

  it('con contraseña incorrecta responde 401', () => {
    expect(() => service.login('rmarriaga@utb.edu.co', 'otra')).toThrow(UnauthorizedException);
  });

  it('con un usuario que no existe responde 401', () => {
    expect(() => service.login('nadie@utb.edu.co', '12345')).toThrow(UnauthorizedException);
  });

  it('getUser devuelve el usuario de una sesión vigente', () => {
    const { sessionId } = service.login('lizapata@utb.edu.co', '12345');

    expect(service.getUser(sessionId)).toEqual({
      id: 1,
      username: 'lizapata@utb.edu.co',
      name: 'Lisandro Zapata',
      role: 'estudiante',
    });
  });

  it('la sesión dura 30 minutos', () => {
    vi.useFakeTimers();
    const { sessionId } = service.login('lizapata@utb.edu.co', '12345');

    vi.advanceTimersByTime(TREINTA_MINUTOS - 1);
    expect(service.getUser(sessionId)).not.toBeNull();

    vi.advanceTimersByTime(1);
    expect(service.getUser(sessionId)).toBeNull();
  });

  it('una sesión desconocida no devuelve usuario', () => {
    expect(service.getUser('no-existe')).toBeNull();
  });

  it('logout borra la sesión', () => {
    const { sessionId } = service.login('lizapata@utb.edu.co', '12345');

    service.logout(sessionId);

    expect(service.getUser(sessionId)).toBeNull();
  });

  it('logout sin sesión no falla', () => {
    expect(() => service.logout(undefined)).not.toThrow();
  });
});
