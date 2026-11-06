import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import {
  ApiErrors,
  COMMON_ERRORS,
  SIGNED_IN_ERRORS,
} from '../openapi/api-errors.decorator.js';
import { CreateInvitationDto } from './dto/create-invitation.dto.js';
import { InvitationOptionsQueryDto } from './dto/invitation-options-query.dto.js';
import {
  InvitationDto,
  InvitationOptionDto,
  ReceivedInvitationsPageDto,
} from './dto/invitation-response.dto.js';
import { InvitationsQueryDto } from './dto/invitations-query.dto.js';
import { InvitationsService } from './invitations.service.js';

@ApiTags('invitations')
@ApiBearerAuth()
@ApiErrors({ ...COMMON_ERRORS, ...SIGNED_IN_ERRORS })
@UseGuards(JwtAuthGuard)
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  /**
   * Invites a user who does jobs to apply to one of the client's open jobs.
   *
   * @remarks The user gets an email unless they turned notices off. A job
   * takes at most 20 invitations.
   */
  @ApiErrors({
    400: 'A field is missing or invalid.',
    403: "The job is not the user's own, or the user invites themselves.",
    404: 'The job or the invited user does not exist.',
    409: 'The job is closed (LISTING_CLOSED), the user does not take invitations (EXECUTOR_UNAVAILABLE), already applied (ALREADY_APPLIED) or is already invited (ALREADY_INVITED), or the job has 20 invitations (INVITATION_LIMIT).',
  })
  @Post()
  create(
    @Body() dto: CreateInvitationDto,
    @Req() req: Request,
  ): Promise<InvitationDto> {
    const user = req.user as { id: string };
    return this.invitations.create(dto, user.id);
  }

  /** Lists the user's invitations to open jobs, newest first. */
  @ApiErrors({ 400: 'A query parameter is invalid.' })
  @Get()
  getReceived(
    @Query() query: InvitationsQueryDto,
    @Req() req: Request,
  ): Promise<ReceivedInvitationsPageDto> {
    const user = req.user as { id: string };
    return this.invitations.getReceived(user.id, query);
  }

  /**
   * Lists the client's open jobs, the newest 50, and whether a user can be
   * invited to each.
   */
  @ApiErrors({ 400: 'A query parameter is invalid.' })
  @Get('options')
  getOptions(
    @Query() query: InvitationOptionsQueryDto,
    @Req() req: Request,
  ): Promise<InvitationOptionDto[]> {
    const user = req.user as { id: string };
    return this.invitations.getOptions(user.id, query.executorId);
  }

  /** Declines an invitation. The client is not told. */
  @ApiErrors({ 404: "The invitation does not exist or is not the user's." })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async decline(@Param('id') id: string, @Req() req: Request): Promise<void> {
    const user = req.user as { id: string };
    await this.invitations.decline(id, user.id);
  }
}
