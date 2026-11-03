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

export const MIN_SCORE = 1;
export const MAX_SCORE = 5;
export const MAX_COMMENT_LENGTH = 1000;

export class CreateRatingDto {
  /** The accepted application whose executor is rated. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  applicationId!: string;

  /** Stars from 1 to 5. */
  @IsInt()
  @Min(MIN_SCORE)
  @Max(MAX_SCORE)
  score!: number;

  /** What went well or not. Leave it out to rate with stars only. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(MAX_COMMENT_LENGTH)
  comment?: string;
}
