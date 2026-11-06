import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { processAvatar, processPhoto } from './photo-image.js';

function image(
  width: number,
  height: number,
  format: 'jpeg' | 'png' | 'gif' | 'tiff',
) {
  return sharp({
    create: { width, height, channels: 3, background: '#0f9d8a' },
  })
    .toFormat(format)
    .toBuffer();
}

describe('processPhoto', () => {
  it('writes a large and a small WebP version', async () => {
    const photo = await processPhoto(await image(3200, 2400, 'jpeg'));

    expect(photo.large).toMatchObject({ width: 1600, height: 1200 });
    const large = await sharp(photo.large.data).metadata();
    expect(large).toMatchObject({ format: 'webp', width: 1600, height: 1200 });
    const thumbnail = await sharp(photo.thumbnail).metadata();
    expect(thumbnail).toMatchObject({
      format: 'webp',
      width: 640,
      height: 480,
    });
  });

  it('keeps a small image at its size', async () => {
    const photo = await processPhoto(await image(300, 500, 'png'));

    expect(photo.large).toMatchObject({ width: 300, height: 500 });
    const thumbnail = await sharp(photo.thumbnail).metadata();
    expect(thumbnail).toMatchObject({ width: 300, height: 500 });
  });

  it('turns the image upright and drops the EXIF data', async () => {
    // Stored 400x200, shown rotated by 90 degrees.
    const rotated = await sharp({
      create: { width: 400, height: 200, channels: 3, background: '#fff' },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const photo = await processPhoto(rotated);

    expect(photo.large).toMatchObject({ width: 200, height: 400 });
    const metadata = await sharp(photo.large.data).metadata();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
  });

  it.each([
    ['text', Promise.resolve(Buffer.from('not an image'))],
    [
      'a cut-off JPG',
      image(400, 300, 'jpeg').then((data) => data.subarray(0, 200)),
    ],
    ['a GIF', image(40, 30, 'gif')],
    ['a TIFF', image(40, 30, 'tiff')],
  ])('refuses %s with INVALID_IMAGE', async (_, input) => {
    await expect(processPhoto(await input)).rejects.toMatchObject({
      response: { code: 'INVALID_IMAGE' },
    });
  });
});

describe('processAvatar', () => {
  it('cuts a square WebP from any shape', async () => {
    for (const [width, height] of [
      [1200, 800],
      [100, 300],
    ]) {
      const avatar = await processAvatar(await image(width, height, 'jpeg'));

      expect(await sharp(avatar).metadata()).toMatchObject({
        format: 'webp',
        width: 256,
        height: 256,
      });
    }
  });

  it('drops the EXIF data', async () => {
    const tagged = await sharp({
      create: { width: 400, height: 400, channels: 3, background: '#fff' },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const metadata = await sharp(await processAvatar(tagged)).metadata();
    expect(metadata.exif).toBeUndefined();
  });

  it('refuses a file that is not an accepted image', async () => {
    await expect(
      processAvatar(await image(40, 30, 'gif')),
    ).rejects.toMatchObject({ response: { code: 'INVALID_IMAGE' } });
  });
});
