import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import {
  ApiErrors,
  COMMON_ERRORS,
  SIGNED_IN_ERRORS,
} from '../../openapi/api-errors.decorator.js';
import { ListingPhotoDto } from './dto/listing-photo-response.dto.js';
import { ReorderPhotosDto } from './dto/reorder-photos.dto.js';
import { ListingPhotosService } from './listing-photos.service.js';
import { MAX_PHOTO_BYTES } from './photo-image.js';

const OWNER_ERRORS = {
  ...SIGNED_IN_ERRORS,
  403: 'The job belongs to another user.',
  404: 'The job does not exist.',
} as const;

@ApiTags('listings')
@ApiBearerAuth()
@ApiErrors(COMMON_ERRORS)
@UseGuards(JwtAuthGuard)
@Controller('listings/:id/photos')
export class ListingPhotosController {
  constructor(private readonly photos: ListingPhotosService) {}

  /**
   * Adds a photo to the user's own job.
   *
   * @remarks Send the file as `photo` in a multipart form, up to 5 MB, as
   * JPG, PNG, WebP or AVIF. The API stores two WebP versions without the
   * EXIF data. A job takes up to five photos; the first one is the cover.
   */
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['photo'],
      properties: { photo: { type: 'string', format: 'binary' } },
    },
  })
  @ApiErrors({
    ...OWNER_ERRORS,
    400: 'The file is missing, or it is not a JPG, PNG, WebP or AVIF image (INVALID_IMAGE).',
    409: 'The job has five photos already (PHOTO_LIMIT_REACHED).',
    413: 'The file is larger than 5 MB.',
    503: 'The database or the photo storage is unavailable.',
  })
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: { fileSize: MAX_PHOTO_BYTES, files: 1, fields: 0 },
    }),
  )
  @Post()
  add(
    @Param('id') id: string,
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @Req() req: Request,
  ): Promise<ListingPhotoDto> {
    if (!file) throw new BadRequestException('Dodaj sliku.');
    const user = req.user as { id: string };
    return this.photos.add(id, user.id, file.buffer);
  }

  /** Sets the order of the photos of the user's own job. */
  @ApiErrors({
    ...OWNER_ERRORS,
    400: 'photoIds does not list every photo of the job exactly once.',
  })
  @Put('order')
  reorder(
    @Param('id') id: string,
    @Body() dto: ReorderPhotosDto,
    @Req() req: Request,
  ): Promise<ListingPhotoDto[]> {
    const user = req.user as { id: string };
    return this.photos.reorder(id, dto.photoIds, user.id);
  }

  /** Deletes a photo of the user's own job. */
  @ApiErrors({
    ...OWNER_ERRORS,
    404: 'The job or the photo does not exist.',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':photoId')
  async remove(
    @Param('id') id: string,
    @Param('photoId') photoId: string,
    @Req() req: Request,
  ): Promise<void> {
    const user = req.user as { id: string };
    await this.photos.remove(id, photoId, user.id);
  }
}
