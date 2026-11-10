import { UnauthorizedException } from '@nestjs/common';
import type { DatabaseService } from '../database/database.service.js';
import { AuthService } from './auth.service.js';

const TREINTA_MINUTOS = 30 * 60 * 1000;

describe('AuthService', () => {
  const estudianteUser = 'estudiante@f10.example';
  const estudiantePass = 'prueba-estudiante';
  const estudianteName = 'Estudiante de Prueba';
  const funcionarioUser = 'funcionaria@f10.example';
  const funcionarioPass = 'prueba-funcionaria';
  const funcionarioName = 'Funcionaria de Prueba';
  const db = { query: vi.fn() };
  let service: AuthService;

  beforeEach(() => {
    vi.stubEnv('AUTH_INIT', 'ENV');
    vi.stubEnv('AUTH_ESTUDIANTE_USERNAME', estudianteUser);
    vi.stubEnv('AUTH_ESTUDIANTE_PASSWORD', estudiantePass);
    vi.stubEnv('AUTH_ESTUDIANTE_NAME', estudianteName);
    vi.stubEnv('AUTH_FUNCIONARIO_USERNAME', funcionarioUser);
    vi.stubEnv('AUTH_FUNCIONARIO_PASSWORD', funcionarioPass);
    vi.stubEnv('AUTH_FUNCIONARIO_NAME', funcionarioName);
    db.query.mockReset();
    service = new AuthService(db as unknown as DatabaseService);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('con credenciales válidas crea una sesión y no devuelve la contraseña', async () => {
    const { sessionId, user } = await service.login(
      funcionarioUser,
      funcionarioPass,
    );

    expect(sessionId).toMatch(/^[0-9a-f]{64}$/);
    expect(user).toEqual({
      id: 2,
      username: funcionarioUser,
      name: funcionarioName,
      role: 'funcionario',
    });
    expect(user).not.toHaveProperty('password');
  });

  it('con contraseña incorrecta responde 401', async () => {
    await expect(service.login(funcionarioUser, 'otra')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('con un usuario que no existe responde 401', async () => {
    await expect(
      service.login('nadie@ejemplo.edu.co', funcionarioPass),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('getUser devuelve el usuario de una sesión vigente', async () => {
    const { sessionId } = await service.login(estudianteUser, estudiantePass);

    expect(service.getUser(sessionId)).toEqual({
      id: 1,
      username: estudianteUser,
      name: estudianteName,
      role: 'estudiante',
    });
  });

  it('la sesión dura 30 minutos', async () => {
    vi.useFakeTimers();
    const { sessionId } = await service.login(estudianteUser, estudiantePass);

    vi.advanceTimersByTime(TREINTA_MINUTOS - 1);
    expect(service.getUser(sessionId)).not.toBeNull();

    vi.advanceTimersByTime(1);
    expect(service.getUser(sessionId)).toBeNull();
  });

  it('una sesión desconocida no devuelve usuario', () => {
    expect(service.getUser('no-existe')).toBeNull();
  });

  it('logout borra la sesión', async () => {
    const { sessionId } = await service.login(estudianteUser, estudiantePass);

    service.logout(sessionId);

    expect(service.getUser(sessionId)).toBeNull();
  });

  it('logout sin sesión no falla', () => {
    expect(() => service.logout(undefined)).not.toThrow();
  });

  it('rechaza un AUTH_INIT desconocido en lugar de adivinar el origen', async () => {
    vi.stubEnv('AUTH_INIT', 'LDAP');

    await expect(service.login('lizapata@utb.edu.co', '12345')).rejects.toThrow(
      /AUTH_INIT debe ser ENV o DB/,
    );
  });

  describe('con AUTH_INIT=DB', () => {
    beforeEach(() => {
      vi.stubEnv('AUTH_INIT', 'DB');
      vi.stubEnv('AUTH_ESTUDIANTE_PASSWORD', 'compartida');
    });

    it('obtiene la información del estudiante de la base de datos y usa la contraseña del entorno', async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            id_usuario: 7,
            nombres: 'Lisandro',
            apellidos: 'Zapata',
            correo: 'lizapata@utb.edu.co',
          },
        ],
      });

      const { user } = await service.login(
        'ESTUDIANTE.DB@utb.edu.co',
        'compartida',
      );

      expect(user).toEqual({
        id: 7,
        username: 'lizapata@utb.edu.co',
        name: 'Lisandro Zapata',
        role: 'estudiante',
      });
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("rol = 'ESTUDIANTE'"),
        ['ESTUDIANTE.DB@utb.edu.co'],
      );
    });

    it('no consulta la base de datos para el funcionario', async () => {
      await service.login(funcionarioUser, funcionarioPass);

      expect(db.query).not.toHaveBeenCalled();
    });

    it('rechaza la contraseña de la base de datos: solo vale AUTH_ESTUDIANTE_PASSWORD', async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            id_usuario: 7,
            nombres: 'Lisandro',
            apellidos: 'Zapata',
            correo: 'lizapata@utb.edu.co',
          },
        ],
      });

      await expect(
        service.login('lizapata@utb.edu.co', 'otra'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('responde 401 si el estudiante no existe en la base de datos', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(
        service.login('nadie@utb.edu.co', 'compartida'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
