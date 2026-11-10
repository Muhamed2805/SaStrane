import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JobAlertsService } from '../job-alerts/job-alerts.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { ListingsService } from './listings.service.js';

describe('ListingsService', () => {
  const listingRepository = {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  };
  const photoRepository = { findMany: vi.fn() };
  const savedRepository = {
    findMany: vi.fn(),
    count: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  };
  const prisma = {
    listing: listingRepository,
    listingPhoto: photoRepository,
    savedListing: savedRepository,
    $transaction: vi.fn((run: (tx: unknown) => unknown) => run(prisma)),
  };
  const storage = {
    url: (key: string) => `https://photos.example/${key}`,
    delete: vi.fn(),
  };

  const jobAlerts = { listingPosted: vi.fn() };

  const service = new ListingsService(
    prisma as unknown as PrismaService,
    storage as unknown as StorageService,
    jobAlerts as unknown as JobAlertsService,
  );

  const photo = { id: 'photo-1', width: 1600, height: 1200 };
  const photoDto = {
    id: 'photo-1',
    url: 'https://photos.example/listings/listing-1/photo-1.webp',
    thumbnailUrl:
      'https://photos.example/listings/listing-1/photo-1-thumb.webp',
    width: 1600,
    height: 1200,
  };

  // The client as the database returns it, and as the API sends it.
  const client = { id: 'user-1', fullName: 'Test User', avatarId: 'avatar-1' };
  const clientDto = {
    id: 'user-1',
    fullName: 'Test User',
    avatarUrl: 'https://photos.example/avatars/user-1/avatar-1.webp',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('applies server-side filters to both items and total count', async () => {
      listingRepository.findMany.mockResolvedValue([]);
      listingRepository.count.mockResolvedValue(0);

      await expect(
        service.getAll({
          page: 2,
          limit: 5,
          q: 'trava',
          category: 'LAWN_MOWING',
          location: 'SARAJEVO',
          status: 'OPEN',
        }),
      ).resolves.toEqual({
        items: [],
        total: 0,
        page: 2,
        limit: 5,
        totalPages: 0,
      });

      const where = {
        category: 'LAWN_MOWING',
        location: 'SARAJEVO',
        status: 'OPEN',
        OR: [
          { title: { contains: 'trava', mode: 'insensitive' } },
          { description: { contains: 'trava', mode: 'insensitive' } },
        ],
      };

      expect(listingRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where, skip: 5, take: 5 }),
      );
      expect(listingRepository.count).toHaveBeenCalledWith({ where });
    });

    it('sorts by budget and filters a budget range', async () => {
      listingRepository.findMany.mockResolvedValue([]);
      listingRepository.count.mockResolvedValue(0);

      await service.getAll({
        minBudget: 50,
        maxBudget: 200,
        sort: 'BUDGET_HIGH',
      });

      const where = { budget: { not: null, gte: 50, lte: 200 } };
      expect(listingRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where,
          orderBy: [
            { budget: { sort: 'desc', nulls: 'last' } },
            { createdAt: 'desc' },
            { id: 'desc' },
          ],
        }),
      );
      expect(listingRepository.count).toHaveBeenCalledWith({ where });
    });

    it('lists the newest first by default and leaves the budget alone', async () => {
      listingRepository.findMany.mockResolvedValue([]);
      listingRepository.count.mockResolvedValue(0);

      await service.getAll({ sort: 'BUDGET_LOW' });
      expect(listingRepository.findMany.mock.calls[0][0]).toMatchObject({
        where: {},
        orderBy: [
          { budget: { sort: 'asc', nulls: 'last' } },
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
      });

      await service.getAll({ maxBudget: 0 });
      expect(listingRepository.findMany.mock.calls[1][0]).toMatchObject({
        where: { budget: { not: null, lte: 0 } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
    });

    it('refuses a minimum above the maximum', async () => {
      await expect(
        service.getAll({ minBudget: 300, maxBudget: 100 }),
      ).rejects.toMatchObject({
        status: 400,
        response: { code: 'INVALID_BUDGET_RANGE' },
      });
      expect(listingRepository.findMany).not.toHaveBeenCalled();
    });

    it('turns the first photo into the cover with public URLs', async () => {
      listingRepository.findMany.mockResolvedValue([
        { id: 'listing-1', title: 'Košenje', client, photos: [photo] },
        {
          id: 'listing-2',
          title: 'Selidba',
          client: { ...client, avatarId: null },
          photos: [],
        },
      ]);
      listingRepository.count.mockResolvedValue(2);

      const page = await service.getAll({});

      expect(page.items).toEqual([
        {
          id: 'listing-1',
          title: 'Košenje',
          client: clientDto,
          coverPhoto: photoDto,
        },
        {
          id: 'listing-2',
          title: 'Selidba',
          client: { ...clientDto, avatarUrl: null },
          coverPhoto: null,
        },
      ]);
      expect(listingRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            photos: expect.objectContaining({ take: 1 }) as unknown,
          }) as unknown,
        }),
      );
    });
  });

  describe('create', () => {
    it('posts the job and announces it to matching alerts', async () => {
      const row = {
        id: 'listing-1',
        title: 'Selidba',
        category: 'MOVING',
        location: 'TUZLA',
        budget: 80,
        description: null,
        client,
        photos: [],
      };
      listingRepository.create.mockResolvedValue(row);

      const listing = await service.create(
        { title: 'Selidba', category: 'MOVING', location: 'TUZLA' },
        'client-1',
      );

      expect(jobAlerts.listingPosted).toHaveBeenCalledWith(row);
      expect(listingRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expiresAt: expect.any(Date) as unknown,
          }) as unknown,
        }),
      );
      expect(listing).toMatchObject({ id: 'listing-1', client: clientDto });
    });
  });

  describe('getById', () => {
    it('lists every photo, the cover first', async () => {
      listingRepository.findUnique.mockResolvedValue({
        id: 'listing-1',
        description: null,
        client,
        photos: [photo],
      });

      await expect(service.getById('listing-1')).resolves.toEqual({
        id: 'listing-1',
        description: null,
        client: clientDto,
        coverPhoto: photoDto,
        photos: [photoDto],
      });
    });
  });

  describe('update', () => {
    it('updates a listing owned by the authenticated user', async () => {
      const updatedListing = {
        id: 'listing-1',
        title: 'Updated title',
        category: 'IT_HELP',
        location: 'SARAJEVO',
        status: 'OPEN',
        budget: null,
        description: null,
        createdAt: new Date(),
      };

      listingRepository.findUnique.mockResolvedValue({ clientId: 'user-1' });
      listingRepository.update.mockResolvedValue({
        ...updatedListing,
        client,
        photos: [],
      });

      await expect(
        service.update('listing-1', { title: 'Updated title' }, 'user-1'),
      ).resolves.toEqual({
        ...updatedListing,
        client: clientDto,
        coverPhoto: null,
        photos: [],
      });

      expect(listingRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'listing-1' },
          data: { title: 'Updated title' },
        }),
      );
    });

    it('rejects an empty update', async () => {
      await expect(service.update('listing-1', {}, 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(listingRepository.findUnique).not.toHaveBeenCalled();
    });

    it('rejects updates for a missing listing', async () => {
      listingRepository.findUnique.mockResolvedValue(null);

      await expect(
        service.update('missing', { title: 'Updated title' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
      expect(listingRepository.update).not.toHaveBeenCalled();
    });

    it('rejects updates from a user who does not own the listing', async () => {
      listingRepository.findUnique.mockResolvedValue({ clientId: 'user-2' });

      await expect(
        service.update('listing-1', { title: 'Updated title' }, 'user-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(listingRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('closes a listing owned by the authenticated user', async () => {
      listingRepository.findUnique.mockResolvedValue({ clientId: 'user-1' });
      listingRepository.update.mockResolvedValue({
        id: 'listing-1',
        status: 'CLOSED',
        description: null,
        client,
        photos: [],
      });

      await expect(
        service.updateStatus('listing-1', { status: 'CLOSED' }, 'user-1'),
      ).resolves.toEqual({
        id: 'listing-1',
        status: 'CLOSED',
        description: null,
        client: clientDto,
        coverPhoto: null,
        photos: [],
      });
      expect(listingRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'listing-1' },
          data: {
            status: 'CLOSED',
            expiresAt: null,
            expiryReminderSentAt: null,
          },
        }),
      );
    });

    it('gives a reopened job a new 30 days', async () => {
      listingRepository.findUnique.mockResolvedValue({ clientId: 'user-1' });
      listingRepository.update.mockResolvedValue({
        id: 'listing-1',
        description: null,
        client,
        photos: [],
      });
      const before = Date.now();

      await service.updateStatus('listing-1', { status: 'OPEN' }, 'user-1');

      const { data } = listingRepository.update.mock.calls[0][0] as {
        data: { expiresAt: Date; expiryReminderSentAt: null };
      };
      expect(data.expiryReminderSentAt).toBeNull();
      expect(data.expiresAt.getTime() - before).toBeGreaterThanOrEqual(
        30 * 24 * 60 * 60_000,
      );
    });

    it('rejects a status change from a user who does not own the listing', async () => {
      listingRepository.findUnique.mockResolvedValue({ clientId: 'user-2' });

      await expect(
        service.updateStatus('listing-1', { status: 'CLOSED' }, 'user-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(listingRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('extend', () => {
    it('keeps an open job open for 30 more days', async () => {
      listingRepository.findUnique
        .mockResolvedValueOnce({ clientId: 'user-1' })
        .mockResolvedValueOnce({
          id: 'listing-1',
          description: null,
          client,
          photos: [],
        });
      listingRepository.updateMany.mockResolvedValue({ count: 1 });

      await expect(
        service.extend('listing-1', 'user-1'),
      ).resolves.toMatchObject({ id: 'listing-1' });
      expect(listingRepository.updateMany).toHaveBeenCalledWith({
        where: { id: 'listing-1', status: 'OPEN' },
        data: {
          expiresAt: expect.any(Date) as unknown,
          expiryReminderSentAt: null,
        },
      });
    });

    it('refuses a closed job', async () => {
      listingRepository.findUnique.mockResolvedValue({ clientId: 'user-1' });
      listingRepository.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.extend('listing-1', 'user-1')).rejects.toMatchObject(
        { status: 409, response: { code: 'LISTING_CLOSED' } },
      );
    });

    it("refuses another user's job", async () => {
      listingRepository.findUnique.mockResolvedValue({ clientId: 'user-2' });

      await expect(service.extend('listing-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(listingRepository.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('rejects deleting a missing listing', async () => {
      listingRepository.findUnique.mockResolvedValue(null);

      await expect(service.delete('missing', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(listingRepository.delete).not.toHaveBeenCalled();
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('deletes the files of the photos after the job', async () => {
      listingRepository.findUnique.mockResolvedValue({ clientId: 'user-1' });
      photoRepository.findMany.mockResolvedValue([{ id: 'photo-1' }]);
      listingRepository.delete.mockResolvedValue({});

      await service.delete('listing-1', 'user-1');

      expect(listingRepository.delete).toHaveBeenCalledWith({
        where: { id: 'listing-1' },
      });
      expect(storage.delete).toHaveBeenCalledWith([
        'listings/listing-1/photo-1.webp',
        'listings/listing-1/photo-1-thumb.webp',
      ]);
    });
  });

  describe('saved jobs', () => {
    it('lists the saved jobs, the last saved first', async () => {
      savedRepository.findMany.mockResolvedValue([
        { listing: { id: 'listing-1', title: 'Košenje', client, photos: [] } },
      ]);
      savedRepository.count.mockResolvedValue(11);

      await expect(
        service.getSaved('user-2', { page: 2, limit: 10 }),
      ).resolves.toEqual({
        items: [
          {
            id: 'listing-1',
            title: 'Košenje',
            client: clientDto,
            coverPhoto: null,
          },
        ],
        total: 11,
        page: 2,
        limit: 10,
        totalPages: 2,
      });
      expect(savedRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-2' },
          orderBy: [{ createdAt: 'desc' }, { listingId: 'desc' }],
          skip: 10,
          take: 10,
        }),
      );
    });

    it('saves a job once', async () => {
      listingRepository.findUnique.mockResolvedValue({ clientId: 'user-1' });

      await service.save('listing-1', 'user-2');

      expect(savedRepository.createMany).toHaveBeenCalledWith({
        data: [{ userId: 'user-2', listingId: 'listing-1' }],
        skipDuplicates: true,
      });
    });

    it('does not save a missing job or the user own job', async () => {
      listingRepository.findUnique.mockResolvedValueOnce(null);
      await expect(service.save('missing', 'user-2')).rejects.toBeInstanceOf(
        NotFoundException,
      );

      listingRepository.findUnique.mockResolvedValueOnce({
        clientId: 'user-1',
      });
      await expect(service.save('listing-1', 'user-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(savedRepository.createMany).not.toHaveBeenCalled();
    });

    it('removes only the user own save', async () => {
      await service.unsave('listing-1', 'user-2');

      expect(savedRepository.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-2', listingId: 'listing-1' },
      });
    });
  });
});
