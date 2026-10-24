import type { Request } from 'express';

export const COOKIE_NAME = 'checku.sid';

export function readSessionId(req: Request): string | undefined {
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
