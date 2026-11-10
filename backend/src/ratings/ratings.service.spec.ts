import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { RatingsService } from './ratings.service.js';

describe('RatingsService', () => {
  const applicationRepository = { findUnique: vi.fn(), groupBy: vi.fn() };
  const ratingRepository = {
    create: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  };
  const clientRatingRepository = {
    create: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  };
  const userRepository = { findUnique: vi.fn(), findMany: vi.fn() };
  const queryRaw = vi.fn();

  const storage = { url: (key: string) => `https://files.test/${key}` };
  const notifications = { notify: vi.fn() };

  const service = new RatingsService(
    {
      application: applicationRepository,
      rating: ratingRepository,
      clientRating: clientRatingRepository,
      user: userRepository,
      $queryRaw: queryRaw,
    } as unknown as PrismaService,
    storage as unknown as StorageService,
    notifications as unknown as NotificationsService,
  );

  beforeEach(() => {
    vi.resetAllMocks();
    // No completed jobs, no answers and no ratings as a client, unless a
    // test says otherwise.
    applicationRepository.groupBy.mockResolvedValue([]);
    clientRatingRepository.groupBy.mockResolvedValue([]);
    queryRaw.mockResolvedValue([]);
  });

  describe('create', () => {
    const dto = {
      applicationId: 'application-1',
      score: 5,
      comment: 'Odlično',
    };

    function application(overrides: object = {}) {
      return {
        id: 'application-1',
        status: 'ACCEPTED',
        executorId: 'executor-1',
        rating: null,
        listing: {
          id: 'listing-1',
          title: 'Košenje trave',
          clientId: 'client-1',
          status: 'CLOSED',
          client: { fullName: 'Amra' },
        },
        ...overrides,
      };
    }

    it('rates the accepted executor of a closed job', async () => {
      applicationRepository.findUnique.mockResolvedValue(application());
      ratingRepository.create.mockResolvedValue({ id: 'rating-1' });

      await expect(service.create(dto, 'client-1')).resolves.toEqual({
        id: 'rating-1',
      });
      expect(ratingRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            applicationId: 'application-1',
            listingId: 'listing-1',
            listingTitle: 'Košenje trave',
            clientId: 'client-1',
            executorId: 'executor-1',
            score: 5,
            comment: 'Odlično',
          },
        }),
      );
      expect(notifications.notify).toHaveBeenCalledWith({
        userId: 'executor-1',
        type: 'NEW_RATING',
        listingId: 'listing-1',
        listingTitle: 'Košenje trave',
        actorName: 'Amra',
      });
    });

    it('stores an empty comment as null', async () => {
      applicationRepository.findUnique.mockResolvedValue(application());
      ratingRepository.create.mockResolvedValue({ id: 'rating-1' });

      await service.create({ ...dto, comment: '' }, 'client-1');

      expect(ratingRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ comment: null }) as unknown,
        }),
      );
    });

    it('returns 404 for an unknown application', async () => {
      applicationRepository.findUnique.mockResolvedValue(null);

      await expect(service.create(dto, 'client-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it("refuses to rate for another client's job", async () => {
      applicationRepository.findUnique.mockResolvedValue(application());

      await expect(service.create(dto, 'client-2')).rejects.toThrow(
        ForbiddenException,
      );
      expect(ratingRepository.create).not.toHaveBeenCalled();
    });

    it.each([
      [{ status: 'PENDING' }, 'APPLICATION_NOT_ACCEPTED'],
      [{ status: 'REJECTED' }, 'APPLICATION_NOT_ACCEPTED'],
      [
        {
          listing: {
            id: 'listing-1',
            title: 'Košenje trave',
            clientId: 'client-1',
            status: 'OPEN',
          },
        },
        'LISTING_NOT_CLOSED',
      ],
      [{ rating: { id: 'rating-1' } }, 'ALREADY_RATED'],
    ])('returns 409 when %o (%s)', async (overrides, code) => {
      applicationRepository.findUnique.mockResolvedValue(
        application(overrides),
      );

      await expect(service.create(dto, 'client-1')).rejects.toMatchObject({
        status: 409,
        response: { code },
      });
      expect(ratingRepository.create).not.toHaveBeenCalled();
    });

    it('maps a rating sent at the same time to ALREADY_RATED', async () => {
      applicationRepository.findUnique.mockResolvedValue(application());
      ratingRepository.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(service.create(dto, 'client-1')).rejects.toMatchObject({
        status: 409,
        response: { code: 'ALREADY_RATED' },
      });
    });
  });

  describe('createForClient', () => {
    const dto = {
      applicationId: 'application-1',
      score: 4,
      comment: 'Tačno plaćeno',
    };

    function application(overrides: object = {}) {
      return {
        id: 'application-1',
        status: 'ACCEPTED',
        executorId: 'executor-1',
        executor: { fullName: 'Kenan' },
        clientRating: null,
        listing: {
          id: 'listing-1',
          title: 'Košenje trave',
          clientId: 'client-1',
          status: 'CLOSED',
        },
        ...overrides,
      };
    }

    it('rates the client of a closed job the user did', async () => {
      applicationRepository.findUnique.mockResolvedValue(application());
      clientRatingRepository.create.mockResolvedValue({ id: 'rating-1' });

      await expect(service.createForClient(dto, 'executor-1')).resolves.toEqual(
        { id: 'rating-1' },
      );
      expect(clientRatingRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            applicationId: 'application-1',
            listingId: 'listing-1',
            listingTitle: 'Košenje trave',
            clientId: 'client-1',
            executorId: 'executor-1',
            score: 4,
            comment: 'Tačno plaćeno',
          },
        }),
      );
      expect(notifications.notify).toHaveBeenCalledWith({
        userId: 'client-1',
        type: 'NEW_CLIENT_RATING',
        listingId: 'listing-1',
        listingTitle: 'Košenje trave',
        actorName: 'Kenan',
      });
    });

    it('returns 404 for an unknown application', async () => {
      applicationRepository.findUnique.mockResolvedValue(null);

      await expect(service.createForClient(dto, 'executor-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it("refuses another user's application", async () => {
      applicationRepository.findUnique.mockResolvedValue(application());

      await expect(service.createForClient(dto, 'executor-2')).rejects.toThrow(
        ForbiddenException,
      );
      expect(clientRatingRepository.create).not.toHaveBeenCalled();
    });

    it.each([
      [{ status: 'PENDING' }, 'APPLICATION_NOT_ACCEPTED'],
      [
        {
          listing: {
            id: 'listing-1',
            title: 'Košenje trave',
            clientId: 'client-1',
            status: 'OPEN',
          },
        },
        'LISTING_NOT_CLOSED',
      ],
      [{ clientRating: { id: 'rating-1' } }, 'ALREADY_RATED'],
    ])('returns 409 when %o (%s)', async (overrides, code) => {
      applicationRepository.findUnique.mockResolvedValue(
        application(overrides),
      );

      await expect(
        service.createForClient(dto, 'executor-1'),
      ).rejects.toMatchObject({ status: 409, response: { code } });
      expect(clientRatingRepository.create).not.toHaveBeenCalled();
    });

    it('maps a rating sent at the same time to ALREADY_RATED', async () => {
      applicationRepository.findUnique.mockResolvedValue(application());
      clientRatingRepository.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.createForClient(dto, 'executor-1'),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: 'ALREADY_RATED' },
      });
    });
  });

  describe('clientSummaries', () => {
    it('rounds the average and fills in clients without ratings', async () => {
      clientRatingRepository.groupBy.mockResolvedValue([
        { clientId: 'a', _avg: { score: 3.333 }, _count: { _all: 3 } },
      ]);

      const result = await service.clientSummaries(['a', 'b']);

      expect(result.get('a')).toEqual({ average: 3.3, count: 3 });
      expect(result.get('b')).toEqual({ average: null, count: 0 });
      expect(clientRatingRepository.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clientId: { in: ['a', 'b'] } } }),
      );
    });
  });

  describe('summaries', () => {
    it('rounds the average and fills in executors without ratings', async () => {
      ratingRepository.groupBy.mockResolvedValue([
        { executorId: 'a', _avg: { score: 4.666 }, _count: { _all: 3 } },
      ]);

      const result = await service.summaries(['a', 'b', 'a']);

      expect(result.get('a')).toEqual({ average: 4.7, count: 3 });
      expect(result.get('b')).toEqual({ average: null, count: 0 });
      expect(ratingRepository.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ where: { executorId: { in: ['a', 'b'] } } }),
      );
    });

    it('asks nothing for an empty list', async () => {
      await expect(service.summaries([])).resolves.toEqual(new Map());
      expect(ratingRepository.groupBy).not.toHaveBeenCalled();
    });
  });

  describe('getExecutors', () => {
    function profile(id: string) {
      return {
        id,
        fullName: id,
        avatarId: null,
        bio: null,
        skills: ['MOVING'],
        location: 'TUZLA',
        createdAt: new Date(0),
      };
    }

    it('keeps the order from SQL and adds the rating summaries', async () => {
      queryRaw
        .mockResolvedValueOnce([
          { id: 'b', average: 4.666, count: 3 },
          { id: 'a', average: null, count: null },
        ])
        .mockResolvedValueOnce([{ total: 14 }]);
      userRepository.findMany.mockResolvedValue([profile('a'), profile('b')]);

      const result = await service.getExecutors({ page: 2, limit: 12 });

      expect(result).toMatchObject({
        total: 14,
        page: 2,
        limit: 12,
        totalPages: 2,
      });
      expect(result.items.map((item) => [item.id, item.rating])).toEqual([
        ['b', { average: 4.7, count: 3 }],
        ['a', { average: null, count: 0 }],
      ]);
      expect(result.items[0].stats).toEqual({
        completedJobs: 0,
        responseMinutes: null,
      });
      expect(result.items[0].clientRating).toEqual({
        average: null,
        count: 0,
      });
      expect(result.items[0]).not.toHaveProperty('avatarId');
    });

    it('leaves out a user deleted between the reads', async () => {
      queryRaw
        .mockResolvedValueOnce([{ id: 'gone', average: null, count: null }])
        .mockResolvedValueOnce([{ total: 1 }]);
      userRepository.findMany.mockResolvedValue([]);

      await expect(service.getExecutors({})).resolves.toMatchObject({
        items: [],
        page: 1,
        limit: 12,
      });
    });
  });

  describe('getProfile', () => {
    it('returns the public fields with the rating summary', async () => {
      const createdAt = new Date();
      userRepository.findUnique.mockResolvedValue({
        id: 'user-1',
        fullName: 'Kenan',
        avatarId: 'avatar-1',
        bio: 'Montiram namještaj.',
        skills: ['ASSEMBLY'],
        location: 'ILIDZA',
        createdAt,
        portfolioPhotos: [
          { id: 'photo-1', width: 800, height: 600, caption: 'Ormar' },
        ],
      });
      ratingRepository.aggregate.mockResolvedValue({
        _avg: { score: null },
        _count: { _all: 0 },
      });

      await expect(service.getProfile('user-1')).resolves.toEqual({
        id: 'user-1',
        fullName: 'Kenan',
        avatarUrl: 'https://files.test/avatars/user-1/avatar-1.webp',
        bio: 'Montiram namještaj.',
        skills: ['ASSEMBLY'],
        location: 'ILIDZA',
        createdAt,
        rating: { average: null, count: 0 },
        clientRating: { average: null, count: 0 },
        stats: { completedJobs: 0, responseMinutes: null },
        portfolio: [
          {
            id: 'photo-1',
            url: 'https://files.test/portfolio/user-1/photo-1.webp',
            thumbnailUrl:
              'https://files.test/portfolio/user-1/photo-1-thumb.webp',
            width: 800,
            height: 600,
            caption: 'Ormar',
          },
        ],
      });
      expect(userRepository.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          select: {
            id: true,
            fullName: true,
            avatarId: true,
            bio: true,
            skills: true,
            location: true,
            createdAt: true,
            portfolioPhotos: {
              orderBy: [
                { position: 'asc' },
                { createdAt: 'asc' },
                { id: 'asc' },
              ],
              select: { id: true, width: true, height: true, caption: true },
            },
          },
        }),
      );
    });

    it('has no photo URL for a user without one', async () => {
      userRepository.findUnique.mockResolvedValue({
        id: 'user-1',
        fullName: 'Kenan',
        avatarId: null,
        bio: null,
        skills: [],
        location: null,
        createdAt: new Date(),
        portfolioPhotos: [],
      });
      ratingRepository.aggregate.mockResolvedValue({
        _avg: { score: null },
        _count: { _all: 0 },
      });

      await expect(service.getProfile('user-1')).resolves.toMatchObject({
        avatarUrl: null,
        portfolio: [],
      });
    });

    it('returns 404 for an unknown user', async () => {
      userRepository.findUnique.mockResolvedValue(null);
      ratingRepository.aggregate.mockResolvedValue({
        _avg: { score: null },
        _count: { _all: 0 },
      });

      await expect(service.getProfile('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('stats', () => {
    it('counts completed jobs and rounds the response time', async () => {
      applicationRepository.groupBy.mockResolvedValue([
        { executorId: 'a', _count: { _all: 4 } },
      ]);
      queryRaw.mockResolvedValue([
        { userId: 'a', minutes: 42.6, replies: 3 },
        { userId: 'b', minutes: 0.2, replies: 5 },
      ]);

      const stats = await service.stats(['a', 'b', 'a']);

      expect(Object.fromEntries(stats)).toEqual({
        a: { completedJobs: 4, responseMinutes: 43 },
        b: { completedJobs: 0, responseMinutes: 1 },
      });
      expect(applicationRepository.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            executorId: { in: ['a', 'b'] },
            status: 'ACCEPTED',
            listing: { status: 'CLOSED' },
          },
        }),
      );
    });

    it('needs three answers for a response time', async () => {
      queryRaw.mockResolvedValue([{ userId: 'a', minutes: 5, replies: 2 }]);

      const stats = await service.stats(['a']);

      expect(stats.get('a')).toEqual({
        completedJobs: 0,
        responseMinutes: null,
      });
    });

    it('asks nothing for an empty list', async () => {
      await expect(service.stats([])).resolves.toEqual(new Map());
      expect(queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('getRatings', () => {
    it("pages a user's ratings, newest first", async () => {
      userRepository.findUnique.mockResolvedValue({ id: 'user-1' });
      ratingRepository.findMany.mockResolvedValue([]);
      ratingRepository.count.mockResolvedValue(11);

      await expect(
        service.getRatings('user-1', { page: 2, limit: 5 }),
      ).resolves.toEqual({
        items: [],
        total: 11,
        page: 2,
        limit: 5,
        totalPages: 3,
      });
      expect(ratingRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { executorId: 'user-1' },
          skip: 5,
          take: 5,
        }),
      );
    });
  });

  describe('getClientRatings', () => {
    it("pages a user's ratings as a client, newest first", async () => {
      userRepository.findUnique.mockResolvedValue({ id: 'user-1' });
      clientRatingRepository.findMany.mockResolvedValue([]);
      clientRatingRepository.count.mockResolvedValue(3);

      await expect(
        service.getClientRatings('user-1', { page: 1, limit: 10 }),
      ).resolves.toEqual({
        items: [],
        total: 3,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
      expect(clientRatingRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clientId: 'user-1' } }),
      );
    });

    it('returns 404 for an unknown user', async () => {
      userRepository.findUnique.mockResolvedValue(null);
      clientRatingRepository.findMany.mockResolvedValue([]);
      clientRatingRepository.count.mockResolvedValue(0);

      await expect(service.getClientRatings('nobody', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
