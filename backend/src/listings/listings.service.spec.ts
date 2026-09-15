import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListingsService } from './listings.service';

describe('ListingsService', () => {
  const listingRepository = {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  };

  const service = new ListingsService({
    listing: listingRepository,
  } as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
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
          category: 'Košenje trave',
          location: 'Sarajevo',
        }),
      ).resolves.toEqual({
        items: [],
        total: 0,
        page: 2,
        limit: 5,
        totalPages: 0,
      });

      const where = {
        category: 'Košenje trave',
        location: 'Sarajevo',
        OR: [
          { title: { contains: 'trava', mode: 'insensitive' } },
          { description: { contains: 'trava', mode: 'insensitive' } },
          { category: { contains: 'trava', mode: 'insensitive' } },
        ],
      };

      expect(listingRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where, skip: 5, take: 5 }),
      );
      expect(listingRepository.count).toHaveBeenCalledWith({ where });
    });
  });

  describe('update', () => {
    it('updates a listing owned by the authenticated user', async () => {
      const updatedListing = {
        id: 'listing-1',
        title: 'Updated title',
        category: 'IT pomoć',
        location: 'Sarajevo',
        budget: null,
        description: null,
        createdAt: new Date(),
        client: { id: 'user-1', fullName: 'Test User' },
      };

      listingRepository.findUnique.mockResolvedValue({ clientId: 'user-1' });
      listingRepository.update.mockResolvedValue(updatedListing);

      await expect(
        service.update('listing-1', { title: 'Updated title' }, 'user-1'),
      ).resolves.toEqual(updatedListing);

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
});
