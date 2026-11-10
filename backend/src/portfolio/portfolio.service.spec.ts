import { NotFoundException } from '@nestjs/common';
import sharp from 'sharp';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { PortfolioService } from './portfolio.service.js';

describe('PortfolioService', () => {
  const prisma = {
    portfolioPhoto: {
      count: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn((run: (tx: unknown) => unknown) => run(prisma)),
  };
  const storage = {
    url: (key: string) => `https://photos.example/${key}`,
    put: vi.fn(),
    delete: vi.fn(),
  };
  const service = new PortfolioService(
    prisma as unknown as PrismaService,
    storage as unknown as StorageService,
  );

  let jpeg: Buffer;

  beforeEach(async () => {
    vi.clearAllMocks();
    prisma.portfolioPhoto.count.mockResolvedValue(0);
    prisma.portfolioPhoto.aggregate.mockResolvedValue({
      _count: 2,
      _max: { position: 4 },
    });
    prisma.portfolioPhoto.create.mockImplementation(
      ({ data }: { data: { id: string; caption: string | null } }) =>
        Promise.resolve({
          id: data.id,
          width: 800,
          height: 600,
          caption: data.caption,
        }),
    );
    jpeg ??= await sharp({
      create: { width: 800, height: 600, channels: 3, background: '#fff' },
    })
      .jpeg()
      .toBuffer();
  });

  describe('add', () => {
    it('stores both files, then the row after the last photo', async () => {
      const photo = await service.add('user-1', jpeg, 'Novi ormar');

      expect(storage.put).toHaveBeenCalledTimes(2);
      expect(storage.put).toHaveBeenCalledWith(
        `portfolio/user-1/${photo.id}.webp`,
        expect.any(Buffer),
        'image/webp',
      );
      expect(prisma.portfolioPhoto.create.mock.calls[0][0]).toMatchObject({
        data: { userId: 'user-1', position: 5, caption: 'Novi ormar' },
      });
      expect(photo).toEqual({
        id: photo.id,
        url: `https://photos.example/portfolio/user-1/${photo.id}.webp`,
        thumbnailUrl: `https://photos.example/portfolio/user-1/${photo.id}-thumb.webp`,
        width: 800,
        height: 600,
        caption: 'Novi ormar',
      });
    });

    it('stores an empty caption as none', async () => {
      const photo = await service.add('user-1', jpeg, '');
      expect(photo.caption).toBeNull();
    });

    it('refuses a ninth photo before doing the image work', async () => {
      prisma.portfolioPhoto.count.mockResolvedValue(8);

      await expect(service.add('user-1', jpeg)).rejects.toMatchObject({
        status: 409,
        response: { code: 'PORTFOLIO_LIMIT_REACHED' },
      });
      expect(storage.put).not.toHaveBeenCalled();
    });

    it('deletes the files again when another upload filled the gallery', async () => {
      prisma.portfolioPhoto.aggregate.mockResolvedValue({
        _count: 8,
        _max: { position: 7 },
      });

      await expect(service.add('user-1', jpeg)).rejects.toMatchObject({
        status: 409,
      });
      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(prisma.portfolioPhoto.create).not.toHaveBeenCalled();
      expect(storage.delete).toHaveBeenCalledWith([
        expect.stringMatching(/^portfolio\/user-1\/.+\.webp$/),
        expect.stringMatching(/^portfolio\/user-1\/.+-thumb\.webp$/),
      ]);
    });

    it('refuses a file that is not an image', async () => {
      await expect(
        service.add('user-1', Buffer.from('not an image')),
      ).rejects.toMatchObject({ response: { code: 'INVALID_IMAGE' } });
      expect(storage.put).not.toHaveBeenCalled();
    });
  });

  describe('updateCaption', () => {
    it('changes only the user’s own photo', async () => {
      prisma.portfolioPhoto.updateMany.mockResolvedValue({ count: 1 });
      prisma.portfolioPhoto.findUniqueOrThrow.mockResolvedValue({
        id: 'photo-1',
        width: 800,
        height: 600,
        caption: null,
      });

      await expect(
        service.updateCaption('user-1', 'photo-1', ''),
      ).resolves.toMatchObject({ id: 'photo-1', caption: null });
      expect(prisma.portfolioPhoto.updateMany).toHaveBeenCalledWith({
        where: { id: 'photo-1', userId: 'user-1' },
        data: { caption: null },
      });
    });

    it('returns 404 for a photo of another user', async () => {
      prisma.portfolioPhoto.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.updateCaption('user-2', 'photo-1', 'Moje'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes the row, then both files', async () => {
      prisma.portfolioPhoto.deleteMany.mockResolvedValue({ count: 1 });

      await service.remove('user-1', 'photo-1');

      expect(prisma.portfolioPhoto.deleteMany).toHaveBeenCalledWith({
        where: { id: 'photo-1', userId: 'user-1' },
      });
      expect(storage.delete).toHaveBeenCalledWith([
        'portfolio/user-1/photo-1.webp',
        'portfolio/user-1/photo-1-thumb.webp',
      ]);
    });

    it('returns 404 and keeps the files for a photo of another user', async () => {
      prisma.portfolioPhoto.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.remove('user-2', 'photo-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(storage.delete).not.toHaveBeenCalled();
    });
  });
});
