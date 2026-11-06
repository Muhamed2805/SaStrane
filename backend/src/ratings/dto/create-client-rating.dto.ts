import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trimString } from '../../common/transforms/trim-string.transform.js';
import {
  MAX_COMMENT_LENGTH,
  MAX_SCORE,
  MIN_SCORE,
} from './create-rating.dto.js';

export class CreateClientRatingDto {
  /** The user's accepted application. Its job's client is rated. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  applicationId!: string;

  /** Stars from 1 to 5. */
  @IsInt()
  @Min(MIN_SCORE)
  @Max(MAX_SCORE)
  score!: number;

  /** How the client was to work for. Leave it out to rate with stars only. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(MAX_COMMENT_LENGTH)
  comment?: string;
}
