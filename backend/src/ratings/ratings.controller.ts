import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import {
  ApiErrors,
  COMMON_ERRORS,
  SIGNED_IN_ERRORS,
} from '../openapi/api-errors.decorator.js';
import { CreateClientRatingDto } from './dto/create-client-rating.dto.js';
import { CreateRatingDto } from './dto/create-rating.dto.js';
import { ClientRatingDto, RatingDto } from './dto/rating-response.dto.js';
import { RatingsService } from './ratings.service.js';

@ApiTags('ratings')
@ApiBearerAuth()
@ApiErrors({ ...COMMON_ERRORS, ...SIGNED_IN_ERRORS })
@UseGuards(JwtAuthGuard)
@Controller('ratings')
export class RatingsController {
  constructor(private readonly ratings: RatingsService) {}

  /**
   * Rates the executor of an accepted application to one of the user's jobs.
   *
   * @remarks The job must be closed. A rating is final, and there is one per
   * application.
   */
  @ApiErrors({
    400: 'A field is missing or invalid.',
    403: "The application is for another user's job.",
    404: 'The application does not exist.',
    409: 'The application is not accepted (APPLICATION_NOT_ACCEPTED), the job is still open (LISTING_NOT_CLOSED), or the executor is rated already (ALREADY_RATED).',
  })
  @Post()
  create(
    @Body() dto: CreateRatingDto,
    @Req() req: Request,
  ): Promise<RatingDto> {
    const user = req.user as { id: string };
    return this.ratings.create(dto, user.id);
  }
}

@ApiTags('ratings')
@ApiBearerAuth()
@ApiErrors({ ...COMMON_ERRORS, ...SIGNED_IN_ERRORS })
@UseGuards(JwtAuthGuard)
@Controller('client-ratings')
export class ClientRatingsController {
  constructor(private readonly ratings: RatingsService) {}

  /**
   * Rates the client of a job the user did, through the user's accepted
   * application.
   *
   * @remarks The job must be closed. A rating is final, and there is one per
   * application.
   */
  @ApiErrors({
    400: 'A field is missing or invalid.',
    403: "The application is another user's.",
    404: 'The application does not exist.',
    409: 'The application is not accepted (APPLICATION_NOT_ACCEPTED), the job is still open (LISTING_NOT_CLOSED), or the client is rated already (ALREADY_RATED).',
  })
  @Post()
  create(
    @Body() dto: CreateClientRatingDto,
    @Req() req: Request,
  ): Promise<ClientRatingDto> {
    const user = req.user as { id: string };
    return this.ratings.createForClient(dto, user.id);
  }
}
