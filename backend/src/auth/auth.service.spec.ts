import { UnauthorizedException } from '@nestjs/common';
import type { DatabaseService } from '../database/database.service.js';
import { AuthService } from './auth.service.js';

// La contraseña del estudiante siempre viene de AUTH_ESTUDIANTE_PASSWORD.
const TREINTA_MINUTOS = 30 * 60 * 1000;

function obligatorio(nombre: string): string {
  const valor = process.env[nombre]?.trim();
  if (!valor) {
    throw new Error(
      `Falta ${nombre} para los tests de AuthService. Defínela en backend/.env`,
    );
  }
  return valor;
}

describe('AuthService', () => {
  let service: AuthService;
  let estudianteUser: string;
  let estudiantePass: string;
  let estudianteName: string;
  let funcionarioUser: string;
  let funcionarioPass: string;
  let funcionarioName: string;

  beforeEach(() => {
    estudianteUser = obligatorio('AUTH_ESTUDIANTE_USERNAME');
    estudiantePass = obligatorio('AUTH_ESTUDIANTE_PASSWORD');
    estudianteName = process.env.AUTH_ESTUDIANTE_NAME?.trim() || 'Estudiante';
    funcionarioUser = obligatorio('AUTH_FUNCIONARIO_USERNAME');
    funcionarioPass = obligatorio('AUTH_FUNCIONARIO_PASSWORD');
    funcionarioName =
      process.env.AUTH_FUNCIONARIO_NAME?.trim() || 'Funcionario';

    service = new AuthService();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('con credenciales válidas crea una sesión y no devuelve la contraseña', () => {
    const { sessionId, user } = service.login(funcionarioUser, funcionarioPass);

    expect(sessionId).toMatch(/^[0-9a-f]{64}$/);
    expect(user).toEqual({
      id: 2,
      username: funcionarioUser,
      name: funcionarioName,
      role: 'funcionario',
    });
    expect(user).not.toHaveProperty('password');
  });

  it('con contraseña incorrecta responde 401', () => {
    expect(() => service.login(funcionarioUser, 'otra')).toThrow(
      UnauthorizedException,
    );
  });

  it('con un usuario que no existe responde 401', () => {
    expect(() =>
      service.login('nadie@ejemplo.edu.co', funcionarioPass),
    ).toThrow(UnauthorizedException);
  });

  it('getUser devuelve el usuario de una sesión vigente', () => {
    const { sessionId } = service.login(estudianteUser, estudiantePass);

    expect(service.getUser(sessionId)).toEqual({
      id: 1,
      username: estudianteUser,
      name: estudianteName,
      role: 'estudiante',
    });
  });

  it('la sesión dura 30 minutos', async () => {
    vi.useFakeTimers();
    const { sessionId } = service.login(estudianteUser, estudiantePass);

    vi.advanceTimersByTime(TREINTA_MINUTOS - 1);
    expect(service.getUser(sessionId)).not.toBeNull();

    vi.advanceTimersByTime(1);
    expect(service.getUser(sessionId)).toBeNull();
  });

  it('una sesión desconocida no devuelve usuario', () => {
    expect(service.getUser('no-existe')).toBeNull();
  });

  it('logout borra la sesión', () => {
    const { sessionId } = service.login(estudianteUser, estudiantePass);

    service.logout(sessionId);

    expect(service.getUser(sessionId)).toBeNull();
  });

  it('logout sin sesión no falla', () => {
    expect(() => service.logout(undefined)).not.toThrow();
  });

  it('rechaza un AUTH_INIT desconocido en lugar de adivinar el origen', async () => {
    vi.stubEnv('AUTH_INIT', 'LDAP');

    await expect(
      service.login('lizapata@utb.edu.co', '12345'),
    ).rejects.toThrow(/AUTH_INIT debe ser ENV o DB/);
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
      await service.login('rmarriaga@utb.edu.co', '12345');

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
