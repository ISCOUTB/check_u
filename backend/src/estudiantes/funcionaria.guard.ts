import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service.js';
import { readSessionId } from '../auth/session.js';

@Injectable()
export class FuncionariaGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(contexto: ExecutionContext): boolean {
    const request = contexto.switchToHttp().getRequest<Request>();
    let sessionId: string | undefined;
    try {
      sessionId = readSessionId(request);
    } catch {
      throw new UnauthorizedException('Se requiere una sesión válida.');
    }
    const usuario = sessionId ? this.auth.getUser(sessionId) : null;
    if (!usuario)
      throw new UnauthorizedException('Se requiere una sesión válida.');
    if (usuario.role !== 'funcionario')
      throw new ForbiddenException(
        'Solo la funcionaria puede registrar estudiantes.',
      );
    return true;
  }
}
