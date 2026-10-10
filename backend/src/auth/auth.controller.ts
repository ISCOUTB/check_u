
import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';

const COOKIE_NAME = 'checku.sid';

function readSessionId(req: Request): string | undefined {
  const cookieHeader = req.headers.cookie;

  if (!cookieHeader) {
    return undefined;
  }

  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));

  return cookie
    ? decodeURIComponent(cookie.slice(COOKIE_NAME.length + 1))
    : undefined;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(
    @Body() body: { username: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { sessionId, user } = this.authService.login(
      body.username,
      body.password,
    );

    res.cookie(COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 60 * 1000,
    });

    return { user };
  }

  @Get('me')
  me(@Req() req: Request) {
    const sessionId = readSessionId(req);
    const user = sessionId
      ? this.authService.getUser(sessionId)
      : null;

    if (!user) {
      throw new UnauthorizedException('Sesión no válida o expirada');
    }

    return { user };
  }

  @Post('logout')
  logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.authService.logout(readSessionId(req));

    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return { message: 'Sesión cerrada correctamente' };
  }
}