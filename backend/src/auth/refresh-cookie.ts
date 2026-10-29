import type { CookieOptions, Request, Response } from 'express';
import { API_PREFIX } from '../common/http.constants';
import type { IssuedRefreshToken } from './sessions.service';

export const REFRESH_COOKIE_NAME = 'sastrane_refresh';

// The refresh token never reaches JavaScript. The browser sends it only to
// the auth endpoints (path) and only from the SaStrane site (SameSite).
function cookieOptions(secure: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: `/${API_PREFIX}/auth`,
  };
}

export function setRefreshCookie(
  res: Response,
  token: IssuedRefreshToken,
  secure: boolean,
) {
  res.cookie(REFRESH_COOKIE_NAME, token.value, {
    ...cookieOptions(secure),
    expires: token.expiresAt,
  });
}

export function clearRefreshCookie(res: Response, secure: boolean) {
  res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions(secure));
}

export function readRefreshCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[REFRESH_COOKIE_NAME];
  // A refresh token is 43 base64url characters; reject anything that
  // cannot be one before it reaches the database.
  return typeof value === 'string' && value.length > 0 && value.length <= 128
    ? value
    : undefined;
}
