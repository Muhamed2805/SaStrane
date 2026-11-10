import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { MAX_CAPTION_LENGTH } from '../portfolio-photo.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class PortfolioCaptionDto {
  /** What the photo shows, up to 120 characters. Empty removes it. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(MAX_CAPTION_LENGTH)
  caption?: string;
}
