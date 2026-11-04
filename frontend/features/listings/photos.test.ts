import { describe, expect, it } from 'vitest';
import { MAX_PHOTO_BYTES, moveToFront, pickPhotos } from './photos';

function file(name: string, type = 'image/jpeg', size = 1000) {
  return new File([new Uint8Array(size)], name, { type });
}

describe('pickPhotos', () => {
  it('accepts images up to the free places', () => {
    const result = pickPhotos([file('a.jpg'), file('b.png', 'image/png')], 3);

    expect(result.accepted.map((photo) => photo.name)).toEqual([
      'a.jpg',
      'b.png',
    ]);
    expect(result.errors).toEqual([]);
  });

  it('says why a file is refused', () => {
    const result = pickPhotos(
      [
        file('dokument.pdf', 'application/pdf'),
        file('velika.jpg', 'image/jpeg', MAX_PHOTO_BYTES + 1),
        file('ok.webp', 'image/webp'),
      ],
      0,
    );

    expect(result.accepted.map((photo) => photo.name)).toEqual(['ok.webp']);
    expect(result.errors).toEqual([
      'dokument.pdf: slika mora biti JPG, PNG, WebP ili AVIF datoteka.',
      'velika.jpg: slika može imati najviše 5 MB.',
    ]);
  });

  it('stops at five photos', () => {
    const result = pickPhotos([file('a.jpg'), file('b.jpg'), file('c.jpg')], 4);

    expect(result.accepted.map((photo) => photo.name)).toEqual(['a.jpg']);
    expect(result.errors).toEqual(['Oglas može imati najviše 5 slika.']);
  });
});

describe('moveToFront', () => {
  it('moves an item to the front and keeps the others in order', () => {
    expect(moveToFront(['a', 'b', 'c', 'd'], 2)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('leaves the list alone for the first item or a bad index', () => {
    const items = ['a', 'b'];
    expect(moveToFront(items, 0)).toBe(items);
    expect(moveToFront(items, 5)).toBe(items);
  });
});
