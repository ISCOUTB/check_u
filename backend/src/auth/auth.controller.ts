import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import {
  COOKIE_NAME,
  DURACION_SESION_MS,
  opcionesCookieSesion,
  readSessionId,
} from './session.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Header('Cache-Control', 'private, no-store')
  @SkipThrottle({ uploads: true })
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  async login(
    @Body() body: { username: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { sessionId, user } = await this.authService.login(
      body.username,
      body.password,
    );

    res.cookie(COOKIE_NAME, sessionId, {
      ...opcionesCookieSesion(),
      maxAge: DURACION_SESION_MS,
    });

    return { user };
  }

  @Get('me')
  @Header('Cache-Control', 'private, no-store')
  me(@Req() req: Request) {
    const sessionId = readSessionId(req);
    const user = sessionId ? this.authService.getUser(sessionId) : null;

    if (!user) {
      throw new UnauthorizedException('Sesión no válida o expirada');
    }

    return { user };
  }

  @Post('logout')
  @Header('Cache-Control', 'private, no-store')
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.authService.logout(readSessionId(req));

    res.clearCookie(COOKIE_NAME, opcionesCookieSesion());

    return { message: 'Sesión cerrada correctamente' };
  }
}
