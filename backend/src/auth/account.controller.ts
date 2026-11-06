import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  ApiErrors,
  COMMON_ERRORS,
  SIGNED_IN_ERRORS,
} from '../openapi/api-errors.decorator.js';
import { AccountService } from './account.service.js';
import { PublicUserDto } from './dto/auth-response.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { DeleteAccountDto } from './dto/delete-account.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { clearRefreshCookie } from './refresh-cookie.js';
import type { AuthenticatedUser } from './strategies/jwt.strategy.js';

const WRONG_PASSWORD =
  'A field is invalid, or the password is wrong (WRONG_PASSWORD).';

// The signed-in user's own account.
@ApiTags('auth')
@ApiBearerAuth()
@ApiErrors({ ...COMMON_ERRORS, ...SIGNED_IN_ERRORS })
@UseGuards(JwtAuthGuard)
@Controller('auth')
export class AccountController {
  private readonly secureCookies: boolean;

  constructor(
    private readonly account: AccountService,
    config: ConfigService,
  ) {
    this.secureCookies = config.get<string>('NODE_ENV') === 'production';
  }

  /**
   * Changes the name, the role or the email setting of the signed-in user.
   *
   * @remarks Fields that are left out stay as they are.
   */
  @ApiErrors({ 400: 'A field is invalid.' })
  @Patch('me')
  updateProfile(
    @Req() req: Request,
    @Body() dto: UpdateProfileDto,
  ): Promise<PublicUserDto> {
    const user = req.user as AuthenticatedUser;
    return this.account.updateProfile(user.id, dto);
  }

  /**
   * Sets a new password after checking the current one.
   *
   * @remarks Ends the user's other sessions and emails a notice. This
   * session stays signed in.
   */
  @ApiErrors({ 400: WRONG_PASSWORD })
  @ApiNoContentResponse({ description: 'The password is changed.' })
  // Each guess at the current password costs a bcrypt comparison, and a
  // stolen access token must not allow guessing it quickly.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('change-password')
  async changePassword(
    @Req() req: Request,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    const user = req.user as AuthenticatedUser;
    await this.account.changePassword(user.id, user.sessionId, dto);
  }

  /**
   * Deletes the signed-in user's account after checking the password.
   *
   * @remarks Also deletes their jobs with photos, applications,
   * conversations and ratings, and clears the refresh cookie. This cannot
   * be undone.
   */
  @ApiErrors({ 400: WRONG_PASSWORD })
  @ApiNoContentResponse({ description: 'The account is deleted.' })
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('me')
  async deleteAccount(
    @Req() req: Request,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const user = req.user as AuthenticatedUser;
    await this.account.deleteAccount(user.id, dto.password);
    clearRefreshCookie(res, this.secureCookies);
  }
}
