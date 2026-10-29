import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AccessTokenPayload } from '../auth.service';
import { JWT_ALGORITHM } from '../jwt.constants';
import { SessionsService } from '../sessions.service';

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: string;
  sessionId: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly sessions: SessionsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      algorithms: [JWT_ALGORITHM],
    });
  }

  // Checking the session makes sign-out and password resets take effect
  // immediately instead of when the access token expires.
  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    if (
      typeof payload.sid !== 'string' ||
      !(await this.sessions.isActive(payload.sid, payload.sub))
    ) {
      throw new UnauthorizedException('Session is no longer active');
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      sessionId: payload.sid,
    };
  }
}
