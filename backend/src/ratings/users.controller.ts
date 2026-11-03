import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiErrors, COMMON_ERRORS } from '../openapi/api-errors.decorator.js';
import { RatingsPageDto, UserProfileDto } from './dto/rating-response.dto.js';
import { RatingsQueryDto } from './dto/ratings-query.dto.js';
import { RatingsService } from './ratings.service.js';

// Public profiles. They show a user's name and ratings, never the email.
@ApiTags('users')
@ApiErrors(COMMON_ERRORS)
@Controller('users')
export class UsersController {
  constructor(private readonly ratings: RatingsService) {}

  /** Returns a user's public profile with their rating as an executor. */
  @ApiErrors({ 404: 'The user does not exist.' })
  @Get(':id')
  getProfile(@Param('id') id: string): Promise<UserProfileDto> {
    return this.ratings.getProfile(id);
  }

  /** Lists the ratings a user received as an executor, newest first. */
  @ApiErrors({
    400: 'A query parameter is invalid.',
    404: 'The user does not exist.',
  })
  @Get(':id/ratings')
  getRatings(
    @Param('id') id: string,
    @Query() query: RatingsQueryDto,
  ): Promise<RatingsPageDto> {
    return this.ratings.getRatings(id, query);
  }
}
