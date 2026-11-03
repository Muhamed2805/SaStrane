import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RatingsService } from './ratings.service.js';

describe('RatingsService', () => {
  const applicationRepository = { findUnique: vi.fn() };
  const ratingRepository = {
    create: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  };
  const userRepository = { findUnique: vi.fn() };

  const service = new RatingsService({
    application: applicationRepository,
    rating: ratingRepository,
    user: userRepository,
  } as unknown as PrismaService);

  beforeEach(() => {
    vi.resetAllMocks();
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

  describe('getProfile', () => {
    it('returns the public fields with the rating summary', async () => {
      const createdAt = new Date();
      userRepository.findUnique.mockResolvedValue({
        id: 'user-1',
        fullName: 'Kenan',
        createdAt,
      });
      ratingRepository.aggregate.mockResolvedValue({
        _avg: { score: null },
        _count: { _all: 0 },
      });

      await expect(service.getProfile('user-1')).resolves.toEqual({
        id: 'user-1',
        fullName: 'Kenan',
        createdAt,
        rating: { average: null, count: 0 },
      });
      expect(userRepository.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          select: { id: true, fullName: true, createdAt: true },
        }),
      );
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
});
