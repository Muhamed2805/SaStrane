import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ApiErrors,
  COMMON_ERRORS,
  SIGNED_IN_ERRORS,
} from '../openapi/api-errors.decorator';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListingDto, ListingsPageDto } from './dto/listing-response.dto';
import { ListingsQueryDto } from './dto/listings-query.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { UpdateListingStatusDto } from './dto/update-listing-status.dto';
import { ListingsService } from './listings.service';

@ApiTags('listings')
@ApiErrors(COMMON_ERRORS)
@Controller('listings')
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  /**
   * Lists jobs, newest first.
   *
   * @remarks `q` searches the title and the description without regard to
   * case. The other filters must match exactly. The job list on the site
   * asks for OPEN jobs only.
   */
  @ApiErrors({ 400: 'A query parameter is invalid.' })
  @Get()
  getAll(@Query() query: ListingsQueryDto): Promise<ListingsPageDto> {
    return this.listings.getAll(query);
  }

  /** Returns one job with its description. */
  @ApiErrors({ 404: 'The job does not exist.' })
  @Get(':id')
  getById(@Param('id') id: string): Promise<ListingDto> {
    return this.listings.getById(id);
  }

  /** Posts a job as the signed-in user. */
  @ApiBearerAuth()
  @ApiErrors({ ...SIGNED_IN_ERRORS, 400: 'A field is missing or invalid.' })
  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Body() dto: CreateListingDto,
    @Req() req: Request,
  ): Promise<ListingDto> {
    const user = req.user as { id: string };
    return this.listings.create(dto, user.id);
  }

  /** Changes the given fields of the user's own job. */
  @ApiBearerAuth()
  @ApiErrors({
    ...SIGNED_IN_ERRORS,
    400: 'No field is given, or a field is invalid.',
    403: 'The job belongs to another user.',
    404: 'The job does not exist.',
  })
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateListingDto,
    @Req() req: Request,
  ): Promise<ListingDto> {
    const user = req.user as { id: string };
    return this.listings.update(id, dto, user.id);
  }

  /**
   * Opens or closes the user's own job.
   *
   * @remarks A closed job takes no new applications. The client can still
   * accept or reject the ones already sent.
   */
  @ApiBearerAuth()
  @ApiErrors({
    ...SIGNED_IN_ERRORS,
    400: 'The status is not OPEN or CLOSED.',
    403: 'The job belongs to another user.',
    404: 'The job does not exist.',
  })
  @UseGuards(JwtAuthGuard)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateListingStatusDto,
    @Req() req: Request,
  ): Promise<ListingDto> {
    const user = req.user as { id: string };
    return this.listings.updateStatus(id, dto, user.id);
  }

  /** Deletes the user's own job together with its applications. */
  @ApiBearerAuth()
  @ApiErrors({
    ...SIGNED_IN_ERRORS,
    403: 'The job belongs to another user.',
    404: 'The job does not exist.',
  })
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: Request): Promise<void> {
    const user = req.user as { id: string };
    await this.listings.delete(id, user.id);
  }
}
