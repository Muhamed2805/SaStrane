import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
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
import { ListingsPageDto } from './dto/listing-response.dto.js';
import { SavedListingsQueryDto } from './dto/saved-listings-query.dto.js';
import { ListingsService } from './listings.service.js';

@ApiTags('saved-listings')
@ApiBearerAuth()
@ApiErrors({ ...COMMON_ERRORS, ...SIGNED_IN_ERRORS })
@UseGuards(JwtAuthGuard)
@Controller('saved-listings')
export class SavedListingsController {
  constructor(private readonly listings: ListingsService) {}

  /**
   * Lists the jobs the user saved, the last saved first.
   *
   * @remarks Closed jobs stay on the list. A deleted job leaves it.
   */
  @ApiErrors({ 400: 'A query parameter is invalid.' })
  @Get()
  getAll(
    @Query() query: SavedListingsQueryDto,
    @Req() req: Request,
  ): Promise<ListingsPageDto> {
    const user = req.user as { id: string };
    return this.listings.getSaved(user.id, query);
  }

  /** Lists the IDs of all jobs the user saved. */
  @Get('ids')
  getIds(@Req() req: Request): Promise<string[]> {
    const user = req.user as { id: string };
    return this.listings.getSavedIds(user.id);
  }

  /** Saves a job. Saving it again changes nothing. */
  @ApiErrors({
    403: "The job is the user's own.",
    404: 'The job does not exist.',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Put(':listingId')
  async save(
    @Param('listingId') listingId: string,
    @Req() req: Request,
  ): Promise<void> {
    const user = req.user as { id: string };
    await this.listings.save(listingId, user.id);
  }

  /** Removes a job from the saved ones. A job that is not saved is fine. */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':listingId')
  async unsave(
    @Param('listingId') listingId: string,
    @Req() req: Request,
  ): Promise<void> {
    const user = req.user as { id: string };
    await this.listings.unsave(listingId, user.id);
  }
}
