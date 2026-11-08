import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { DatabaseService } from '../database/database.service.js';

export type UserRole = 'estudiante' | 'funcionario';

export interface SafeUser {
  id: number;
  username: string;
  name: string;
  role: UserRole;
}

interface TestUser extends SafeUser {
  password: string;
}

interface Session {
  user: SafeUser;
  expiresAt: number;
}

interface EstudianteDb {
  id_usuario: number;
  nombres: string;
  apellidos: string;
  correo: string;
}

type OrigenAutenticacion = 'ENV' | 'DB';

function leerObligatorio(nombre: string): string {
  const valor = process.env[nombre]?.trim();
  if (!valor) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. ` +
        `Cópiala desde backend/.env.example a backend/.env y define un valor.`,
    );
  }
  return valor;
}

/** AUTH_INIT define de dónde sale la información del estudiante. */
function origenAutenticacion(): OrigenAutenticacion {
  const valor = process.env.AUTH_INIT?.trim().toUpperCase();
  if (!valor || valor === 'ENV') return 'ENV';
  if (valor === 'DB') return 'DB';
  throw new Error(
    `AUTH_INIT debe ser ENV o DB. Valor recibido: ${process.env.AUTH_INIT}`,
  );
}

function usuarioFuncionarioDesdeEntorno(): TestUser {
  return {
    id: 2,
    username: leerObligatorio('AUTH_FUNCIONARIO_USERNAME'),
    password: leerObligatorio('AUTH_FUNCIONARIO_PASSWORD'),
    name: process.env.AUTH_FUNCIONARIO_NAME?.trim() || 'Funcionario',
    role: 'funcionario',
  };
}

@Injectable()
export class AuthService {
  private readonly sessions = new Map<string, Session>();

  constructor(private readonly db: DatabaseService) {}

  async login(username: string, password: string) {
    const user = await this.autenticar(username, password);

    if (!user) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    const safeUser: SafeUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    };

    const sessionId = randomBytes(32).toString('hex');

    this.sessions.set(sessionId, {
      user: safeUser,
      expiresAt: Date.now() + 30 * 60 * 1000,
    });

    return { sessionId, user: safeUser };
  }

  getUser(sessionId: string): SafeUser | null {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return null;
    }

    if (Date.now() >= session.expiresAt) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session.user;
  }

  logout(sessionId: string | undefined): void {
    if (sessionId) {
      this.sessions.delete(sessionId);
    }
  }

  private async autenticar(
    username: string,
    password: string,
  ): Promise<TestUser | null> {
    if (typeof username !== 'string' || typeof password !== 'string') {
      return null;
    }

    const funcionario = usuarioFuncionarioDesdeEntorno();
    if (username === funcionario.username) {
      return password === funcionario.password ? funcionario : null;
    }

    const estudiante = await this.usuarioEstudiante(username);
    return estudiante?.password === password ? estudiante : null;
  }

  /** Información del estudiante, sin contraseña: esta siempre viene del entorno. */
  private async usuarioEstudiante(
    username: string,
  ): Promise<TestUser | null> {
    const password = leerObligatorio('AUTH_ESTUDIANTE_PASSWORD');

    if (origenAutenticacion() === 'DB') {
      const resultado = await this.db.query<EstudianteDb>(
        `SELECT id_usuario, nombres, apellidos, correo
         FROM usuarios
         WHERE rol = 'ESTUDIANTE'
           AND activo = TRUE
           AND lower(correo) = lower($1)
         LIMIT 1;`,
        [username],
      );
      const estudiante = resultado.rows[0];
      if (!estudiante) return null;

      return {
        id: estudiante.id_usuario,
        username: estudiante.correo,
        name: `${estudiante.nombres} ${estudiante.apellidos}`.trim(),
        role: 'estudiante',
        password,
      };
    }

    if (username !== leerObligatorio('AUTH_ESTUDIANTE_USERNAME')) return null;

    return {
      id: 1,
      username,
      name: process.env.AUTH_ESTUDIANTE_NAME?.trim() || 'Estudiante',
      role: 'estudiante',
      password,
    };
  }
}
