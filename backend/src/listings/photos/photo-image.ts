import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

export const MAX_PHOTOS_PER_LISTING = 5;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

// The longest side of each stored version, in pixels.
const LARGE_SIZE = 1600;
const THUMBNAIL_SIZE = 640;
// Larger images are refused before they are decoded, so a small file that
// expands to a huge bitmap cannot use up the server's memory.
const MAX_INPUT_PIXELS = 50_000_000;

const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp', 'heif']);

export const INVALID_IMAGE_MESSAGE =
  'Slika mora biti JPG, PNG, WebP ili AVIF datoteka.';

export type ProcessedPhoto = {
  large: { data: Buffer; width: number; height: number };
  thumbnail: Buffer;
};

function invalidImage() {
  return new BadRequestException({
    code: 'INVALID_IMAGE',
    message: INVALID_IMAGE_MESSAGE,
  });
}

// Decodes the upload and writes two WebP versions. The file's own type and
// name are not trusted: only what decodes is stored. Turning the image
// upright also drops the EXIF data, such as the GPS position of the camera.
export async function processPhoto(input: Buffer): Promise<ProcessedPhoto> {
  const options = {
    limitInputPixels: MAX_INPUT_PIXELS,
    failOn: 'error' as const,
  };

  try {
    const { format } = await sharp(input, options).metadata();
    if (!format || !ACCEPTED_FORMATS.has(format)) throw invalidImage();

    const resize = (size: number) =>
      sharp(input, options).rotate().resize({
        width: size,
        height: size,
        fit: 'inside',
        withoutEnlargement: true,
      });

    const [large, thumbnail] = await Promise.all([
      resize(LARGE_SIZE)
        .webp({ quality: 80 })
        .toBuffer({ resolveWithObject: true }),
      resize(THUMBNAIL_SIZE).webp({ quality: 75 }).toBuffer(),
    ]);

    return {
      large: {
        data: large.data,
        width: large.info.width,
        height: large.info.height,
      },
      thumbnail,
    };
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    // sharp could not read the file: it is not an image, it is cut off, or
    // it is too large.
    throw invalidImage();
  }
}
