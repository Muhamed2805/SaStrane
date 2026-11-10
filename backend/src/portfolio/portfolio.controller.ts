import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { MAX_PHOTO_BYTES } from '../listings/photos/photo-image.js';
import {
  ApiErrors,
  COMMON_ERRORS,
  SIGNED_IN_ERRORS,
} from '../openapi/api-errors.decorator.js';
import { PortfolioCaptionDto } from './dto/portfolio-caption.dto.js';
import { PortfolioPhotoDto } from './dto/portfolio-photo.dto.js';
import { MAX_CAPTION_LENGTH } from './portfolio-photo.js';
import { PortfolioService } from './portfolio.service.js';

// The signed-in user's gallery of work. Everyone sees it on the public
// profile, in `GET /api/users/{id}`.
@ApiTags('auth')
@ApiBearerAuth()
@ApiErrors({ ...COMMON_ERRORS, ...SIGNED_IN_ERRORS })
@UseGuards(JwtAuthGuard)
@Controller('auth/me/portfolio')
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}

  /**
   * Adds a photo of work to the signed-in user's profile.
   *
   * @remarks Send the file as `photo` in a multipart form, up to 5 MB, as
   * JPG, PNG, WebP or AVIF, with an optional `caption` of up to 120
   * characters. The API stores two WebP versions without the EXIF data. A
   * profile takes up to eight photos.
   */
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['photo'],
      properties: {
        photo: { type: 'string', format: 'binary' },
        caption: { type: 'string', maxLength: MAX_CAPTION_LENGTH },
      },
    },
  })
  @ApiErrors({
    400: 'The file is missing, it is not a JPG, PNG, WebP or AVIF image (INVALID_IMAGE), or the caption is too long.',
    409: 'The profile has eight photos already (PORTFOLIO_LIMIT_REACHED).',
    413: 'The file is larger than 5 MB.',
    503: 'The database or the photo storage is unavailable.',
  })
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: { fileSize: MAX_PHOTO_BYTES, files: 1, fields: 1 },
    }),
  )
  @Post()
  add(
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @Body() dto: PortfolioCaptionDto,
    @Req() req: Request,
  ): Promise<PortfolioPhotoDto> {
    if (!file) throw new BadRequestException('Dodaj sliku.');
    const user = req.user as { id: string };
    return this.portfolio.add(user.id, file.buffer, dto.caption);
  }

  /** Changes the caption of a photo in the signed-in user's gallery. */
  @ApiErrors({
    400: 'The caption is too long.',
    404: 'The photo does not exist.',
  })
  @Patch(':photoId')
  updateCaption(
    @Param('photoId') photoId: string,
    @Body() dto: PortfolioCaptionDto,
    @Req() req: Request,
  ): Promise<PortfolioPhotoDto> {
    const user = req.user as { id: string };
    return this.portfolio.updateCaption(user.id, photoId, dto.caption);
  }

  /** Deletes a photo from the signed-in user's gallery. */
  @ApiErrors({ 404: 'The photo does not exist.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':photoId')
  async remove(
    @Param('photoId') photoId: string,
    @Req() req: Request,
  ): Promise<void> {
    const user = req.user as { id: string };
    await this.portfolio.remove(user.id, photoId);
  }
}
