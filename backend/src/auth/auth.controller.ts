import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import {
  ApiErrors,
  COMMON_ERRORS,
  SIGNED_IN_ERRORS,
} from '../openapi/api-errors.decorator';
import { AuthService, type AuthSession } from './auth.service';
import {
  AuthSessionDto,
  PublicUserDto,
  RegistrationDto,
  SuccessDto,
} from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from './refresh-cookie';
import type { AuthenticatedUser } from './strategies/jwt.strategy';

// Shared by verify-email and reset-password.
const WRONG_CODE = 'A field is invalid, or the code is wrong or has expired.';
const TOO_MANY_WRONG_CODES =
  'Too many requests, or too many wrong codes for this one. Request a new code.';

@ApiTags('auth')
@ApiErrors(COMMON_ERRORS)
@Controller('auth')
export class AuthController {
  private readonly secureCookies: boolean;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.secureCookies = config.get<string>('NODE_ENV') === 'production';
  }

  // The refresh token goes into an httpOnly cookie; the body carries only
  // what the client may read.
  private respondWithSession(
    res: Response,
    session: AuthSession,
  ): AuthSessionDto {
    if (session.refreshToken) {
      setRefreshCookie(res, session.refreshToken, this.secureCookies);
    }
    return { user: session.user, accessToken: session.accessToken };
  }

  /**
   * Creates an account and emails a verification code.
   *
   * @remarks The account can sign in after POST /api/auth/verify-email.
   */
  // Stricter limits than the global default: these endpoints are the main
  // brute-force / credential-stuffing / signup-spam targets.
  @ApiErrors({
    400: 'A field is missing or invalid.',
    409: 'The email is registered (EMAIL_ALREADY_REGISTERED) or waits for verification (EMAIL_VERIFICATION_PENDING).',
  })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<RegistrationDto> {
    return this.auth.register(dto);
  }

  /**
   * Verifies the email with the emailed code and signs in.
   *
   * @remarks Sets the refresh cookie.
   */
  @ApiErrors({ 400: WRONG_CODE, 429: TOO_MANY_WRONG_CODES })
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('verify-email')
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSessionDto> {
    const session = await this.auth.verifyEmail(dto, req.get('user-agent'));
    return this.respondWithSession(res, session);
  }

  /**
   * Emails a new verification code.
   *
   * @remarks Answers the same for unknown and already verified addresses,
   * and then sends nothing.
   */
  @ApiErrors({
    400: 'The email is invalid.',
    429: 'Too many requests, or the last code was sent less than a minute ago.',
  })
  @Throttle({ default: { limit: 3, ttl: 5 * 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('resend-verification')
  resendVerification(@Body() dto: ResendVerificationDto): Promise<SuccessDto> {
    return this.auth.resendVerification(dto.email);
  }

  /**
   * Emails a code for setting a new password.
   *
   * @remarks Answers the same for addresses without a verified account, and
   * then sends nothing.
   */
  @ApiErrors({ 400: 'The email is invalid.' })
  @Throttle({ default: { limit: 3, ttl: 5 * 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<SuccessDto> {
    return this.auth.forgotPassword(dto.email);
  }

  /**
   * Sets a new password with the emailed code.
   *
   * @remarks Ends every session of the user, so other devices must sign in
   * again.
   */
  @ApiErrors({ 400: WRONG_CODE, 429: TOO_MANY_WRONG_CODES })
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto): Promise<SuccessDto> {
    return this.auth.resetPassword(dto);
  }

  /**
   * Signs in with email and password.
   *
   * @remarks Sets the refresh cookie.
   */
  @ApiErrors({
    400: 'A field is missing or invalid.',
    401: 'The email or the password is wrong.',
    403: 'The email is not verified yet (EMAIL_NOT_VERIFIED).',
  })
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSessionDto> {
    const session = await this.auth.login(dto, req.get('user-agent'));
    return this.respondWithSession(res, session);
  }

  /**
   * Issues a new access token from the refresh cookie.
   *
   * @remarks Replaces the refresh cookie. Presenting a replaced cookie again
   * ends the session, except within 30 seconds of the replacement, which
   * covers parallel requests.
   */
  @ApiCookieAuth()
  @ApiErrors({
    401: 'The cookie is missing, expired or revoked. The response clears it.',
  })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSessionDto> {
    const refreshToken = readRefreshCookie(req);
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    try {
      const session = await this.auth.refresh(refreshToken);
      return this.respondWithSession(res, session);
    } catch (error) {
      // Remove a cookie that can no longer be used, so the browser stops
      // sending it.
      if (error instanceof UnauthorizedException) {
        clearRefreshCookie(res, this.secureCookies);
      }
      throw error;
    }
  }

  /**
   * Ends the session of the refresh cookie and clears the cookie.
   *
   * @remarks Uses the cookie rather than the access token, so a user can
   * sign out even after the access token has expired.
   */
  @ApiCookieAuth()
  @ApiNoContentResponse({ description: 'Also when there was no session.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const refreshToken = readRefreshCookie(req);
    if (refreshToken) await this.auth.logout(refreshToken);
    clearRefreshCookie(res, this.secureCookies);
  }

  /** Returns the signed-in user. */
  @ApiBearerAuth()
  @ApiErrors(SIGNED_IN_ERRORS)
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: Request): Promise<PublicUserDto> {
    const user = req.user as AuthenticatedUser;
    return this.auth.getMe(user.id);
  }
}
