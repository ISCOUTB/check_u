import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

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

function usuariosDesdeEntorno(): TestUser[] {
  return [
    {
      id: 1,
      username: leerObligatorio('AUTH_ESTUDIANTE_USERNAME'),
      password: leerObligatorio('AUTH_ESTUDIANTE_PASSWORD'),
      name: process.env.AUTH_ESTUDIANTE_NAME?.trim() || 'Estudiante',
      role: 'estudiante',
    },
    {
      id: 2,
      username: leerObligatorio('AUTH_FUNCIONARIO_USERNAME'),
      password: leerObligatorio('AUTH_FUNCIONARIO_PASSWORD'),
      name: process.env.AUTH_FUNCIONARIO_NAME?.trim() || 'Funcionario',
      role: 'funcionario',
    },
  ];
}

@Injectable()
export class AuthService {
  private readonly users: TestUser[];
  private readonly sessions = new Map<string, Session>();

  constructor() {
    this.users = usuariosDesdeEntorno();
  }

  login(username: string, password: string) {
    const user = this.users.find(
      (item) => item.username === username && item.password === password,
    );

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
}
