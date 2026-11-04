import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsString,
  MaxLength,
} from 'class-validator';
import { MAX_PHOTOS_PER_LISTING } from '../photo-image.js';

export class ReorderPhotosDto {
  /** Every photo of the job, in the new order. The first is the cover. */
  @IsArray()
  @ArrayMaxSize(MAX_PHOTOS_PER_LISTING)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  photoIds!: string[];
}
