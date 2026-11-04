import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import sharp from 'sharp';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StorageService } from '../../storage/storage.service.js';
import { ListingPhotosService } from './listing-photos.service.js';

describe('ListingPhotosService', () => {
  const prisma = {
    listing: { findUnique: vi.fn() },
    listingPhoto: {
      count: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn((run: (tx: unknown) => unknown) => run(prisma)),
  };
  const storage = {
    url: (key: string) => `https://photos.example/${key}`,
    put: vi.fn(),
    delete: vi.fn(),
  };
  const service = new ListingPhotosService(
    prisma as unknown as PrismaService,
    storage as unknown as StorageService,
  );

  let jpeg: Buffer;

  beforeEach(async () => {
    vi.clearAllMocks();
    prisma.listing.findUnique.mockResolvedValue({ clientId: 'user-1' });
    prisma.listingPhoto.count.mockResolvedValue(0);
    prisma.listingPhoto.aggregate.mockResolvedValue({
      _count: 2,
      _max: { position: 4 },
    });
    prisma.listingPhoto.create.mockImplementation(
      ({ data }: { data: { id: string } }) =>
        Promise.resolve({ id: data.id, width: 800, height: 600 }),
    );
    jpeg ??= await sharp({
      create: { width: 800, height: 600, channels: 3, background: '#fff' },
    })
      .jpeg()
      .toBuffer();
  });

  describe('add', () => {
    it('stores both files, then the row after the last photo', async () => {
      const photo = await service.add('listing-1', 'user-1', jpeg);

      const keys = storage.put.mock.calls.map(([key]) => key as string);
      expect(keys).toEqual([
        `listings/listing-1/${photo.id}.webp`,
        `listings/listing-1/${photo.id}-thumb.webp`,
      ]);
      expect(storage.put).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Buffer),
        'image/webp',
      );
      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(prisma.listingPhoto.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            id: photo.id,
            listingId: 'listing-1',
            position: 5,
            width: 800,
            height: 600,
          },
        }),
      );
      expect(photo).toEqual({
        id: photo.id,
        url: `https://photos.example/listings/listing-1/${photo.id}.webp`,
        thumbnailUrl: `https://photos.example/listings/listing-1/${photo.id}-thumb.webp`,
        width: 800,
        height: 600,
      });
    });

    it('refuses a sixth photo before any image work', async () => {
      prisma.listingPhoto.count.mockResolvedValue(5);

      await expect(
        service.add('listing-1', 'user-1', jpeg),
      ).rejects.toMatchObject({ response: { code: 'PHOTO_LIMIT_REACHED' } });
      expect(storage.put).not.toHaveBeenCalled();
    });

    it('deletes the files again when the limit is reached meanwhile', async () => {
      prisma.listingPhoto.aggregate.mockResolvedValue({
        _count: 5,
        _max: { position: 4 },
      });

      await expect(
        service.add('listing-1', 'user-1', jpeg),
      ).rejects.toMatchObject({ response: { code: 'PHOTO_LIMIT_REACHED' } });
      expect(prisma.listingPhoto.create).not.toHaveBeenCalled();
      const stored = storage.put.mock.calls.map(([key]) => key as string);
      expect(storage.delete).toHaveBeenCalledWith(stored);
    });

    it('refuses a file that is not an image', async () => {
      await expect(
        service.add('listing-1', 'user-1', Buffer.from('hello')),
      ).rejects.toMatchObject({ response: { code: 'INVALID_IMAGE' } });
      expect(storage.put).not.toHaveBeenCalled();
    });

    it('lets only the owner add photos', async () => {
      prisma.listing.findUnique.mockResolvedValueOnce({ clientId: 'user-2' });
      await expect(service.add('listing-1', 'user-1', jpeg)).rejects.toThrow(
        ForbiddenException,
      );

      prisma.listing.findUnique.mockResolvedValueOnce(null);
      await expect(service.add('missing', 'user-1', jpeg)).rejects.toThrow(
        NotFoundException,
      );
      expect(storage.put).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the row, then both files', async () => {
      prisma.listingPhoto.deleteMany.mockResolvedValue({ count: 1 });

      await service.remove('listing-1', 'photo-1', 'user-1');

      expect(prisma.listingPhoto.deleteMany).toHaveBeenCalledWith({
        where: { id: 'photo-1', listingId: 'listing-1' },
      });
      expect(storage.delete).toHaveBeenCalledWith([
        'listings/listing-1/photo-1.webp',
        'listings/listing-1/photo-1-thumb.webp',
      ]);
    });

    it('returns 404 for a photo of another job', async () => {
      prisma.listingPhoto.deleteMany.mockResolvedValue({ count: 0 });

      await expect(
        service.remove('listing-1', 'photo-9', 'user-1'),
      ).rejects.toThrow(NotFoundException);
      expect(storage.delete).not.toHaveBeenCalled();
    });
  });

  describe('reorder', () => {
    beforeEach(() => {
      prisma.listingPhoto.findMany.mockResolvedValueOnce([
        { id: 'a' },
        { id: 'b' },
      ]);
    });

    it('numbers the photos in the given order', async () => {
      prisma.listingPhoto.findMany.mockResolvedValueOnce([
        { id: 'b', width: 10, height: 10 },
        { id: 'a', width: 10, height: 10 },
      ]);

      const photos = await service.reorder('listing-1', ['b', 'a'], 'user-1');

      expect(prisma.listingPhoto.update).toHaveBeenCalledWith({
        where: { id: 'b' },
        data: { position: 0 },
      });
      expect(prisma.listingPhoto.update).toHaveBeenCalledWith({
        where: { id: 'a' },
        data: { position: 1 },
      });
      expect(photos.map((photo) => photo.id)).toEqual(['b', 'a']);
    });

    it.each([[['a']], [['a', 'c']], [['a', 'b', 'c']]])(
      'refuses %j, which is not every photo once',
      async (photoIds) => {
        await expect(
          service.reorder('listing-1', photoIds, 'user-1'),
        ).rejects.toThrow(BadRequestException);
        expect(prisma.listingPhoto.update).not.toHaveBeenCalled();
      },
    );
  });
});
