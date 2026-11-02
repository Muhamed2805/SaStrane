import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ApplicationsService } from './applications.service.js';

describe('ApplicationsService', () => {
  const listingRepository = {
    findUnique: vi.fn(),
  };
  const applicationRepository = {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
  };

  const service = new ApplicationsService({
    listing: listingRepository,
    application: applicationRepository,
  } as unknown as PrismaService);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('create', () => {
    const dto = {
      listingId: 'listing-1',
      message: 'Mogu završiti posao sutra.',
      proposedPrice: 50,
    };

    it('creates an application for a listing owned by another user', async () => {
      const created = { id: 'application-1', ...dto };
      listingRepository.findUnique.mockResolvedValue({
        id: 'listing-1',
        clientId: 'client-1',
        status: 'OPEN',
      });
      applicationRepository.create.mockResolvedValue(created);

      await expect(service.create(dto, 'executor-1')).resolves.toEqual(created);
      expect(applicationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { ...dto, executorId: 'executor-1' },
        }),
      );
    });

    it('rejects an application for a missing listing', async () => {
      listingRepository.findUnique.mockResolvedValue(null);

      await expect(service.create(dto, 'executor-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(applicationRepository.create).not.toHaveBeenCalled();
    });

    it('rejects an application to the executor own listing', async () => {
      listingRepository.findUnique.mockResolvedValue({
        id: 'listing-1',
        clientId: 'executor-1',
      });

      await expect(service.create(dto, 'executor-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(applicationRepository.create).not.toHaveBeenCalled();
    });

    it('rejects an application to a closed listing', async () => {
      listingRepository.findUnique.mockResolvedValue({
        id: 'listing-1',
        clientId: 'client-1',
        status: 'CLOSED',
      });

      await expect(service.create(dto, 'executor-1')).rejects.toMatchObject({
        status: 409,
        response: { code: 'LISTING_CLOSED' },
      });
      expect(applicationRepository.create).not.toHaveBeenCalled();
    });

    it('maps the database unique constraint to a conflict response', async () => {
      listingRepository.findUnique.mockResolvedValue({
        id: 'listing-1',
        clientId: 'client-1',
        status: 'OPEN',
      });
      applicationRepository.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '6.19.3',
        }),
      );

      await expect(service.create(dto, 'executor-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('getAppliedListingIds', () => {
    it('returns only listing identifiers for the executor', async () => {
      applicationRepository.findMany.mockResolvedValue([
        { listingId: 'listing-1' },
        { listingId: 'listing-2' },
      ]);

      await expect(service.getAppliedListingIds('executor-1')).resolves.toEqual(
        ['listing-1', 'listing-2'],
      );

      expect(applicationRepository.findMany).toHaveBeenCalledWith({
        where: { executorId: 'executor-1' },
        select: { listingId: true },
      });
    });
  });

  const executor = { id: 'executor-1', fullName: 'Kenan', email: 'k@x.ba' };

  describe('getReceivedApplications', () => {
    it('returns an owner-scoped page of applications', async () => {
      applicationRepository.findMany.mockResolvedValue([]);
      applicationRepository.count.mockResolvedValue(12);

      await expect(
        service.getReceivedApplications('client-1', { page: 2, limit: 5 }),
      ).resolves.toEqual({
        items: [],
        total: 12,
        page: 2,
        limit: 5,
        totalPages: 3,
      });

      const where = { listing: { clientId: 'client-1' } };
      expect(applicationRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where,
          orderBy: { createdAt: 'desc' },
          skip: 5,
          take: 5,
        }),
      );
      expect(applicationRepository.count).toHaveBeenCalledWith({ where });
    });

    it('shows the executor email only on accepted applications', async () => {
      applicationRepository.findMany.mockResolvedValue([
        { id: 'pending', status: 'PENDING', executor },
        { id: 'accepted', status: 'ACCEPTED', executor },
        { id: 'rejected', status: 'REJECTED', executor },
      ]);
      applicationRepository.count.mockResolvedValue(3);

      const page = await service.getReceivedApplications('client-1', {});

      expect(page.items.map((item) => item.executor.email)).toEqual([
        null,
        'k@x.ba',
        null,
      ]);
    });
  });

  describe('getForListing', () => {
    it('hides the email of executors who are not accepted', async () => {
      listingRepository.findUnique.mockResolvedValue({ clientId: 'client-1' });
      applicationRepository.findMany.mockResolvedValue([
        { id: 'pending', status: 'PENDING', executor },
      ]);

      await expect(
        service.getForListing('listing-1', 'client-1'),
      ).resolves.toEqual([
        {
          id: 'pending',
          status: 'PENDING',
          executor: { ...executor, email: null },
        },
      ]);
    });
  });

  describe('updateStatus', () => {
    const ownApplication = { listing: { clientId: 'client-1' } };

    it('decides a pending application and shows the email once accepted', async () => {
      applicationRepository.findUnique.mockResolvedValue(ownApplication);
      applicationRepository.updateMany.mockResolvedValue({ count: 1 });
      applicationRepository.findUniqueOrThrow.mockResolvedValue({
        id: 'application-1',
        status: 'ACCEPTED',
        executor,
      });

      await expect(
        service.updateStatus(
          'application-1',
          { status: 'ACCEPTED' },
          'client-1',
        ),
      ).resolves.toEqual({ id: 'application-1', status: 'ACCEPTED', executor });
      expect(applicationRepository.updateMany).toHaveBeenCalledWith({
        where: { id: 'application-1', status: 'PENDING' },
        data: { status: 'ACCEPTED' },
      });
    });

    it('treats a decision as final', async () => {
      applicationRepository.findUnique.mockResolvedValue(ownApplication);
      applicationRepository.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.updateStatus(
          'application-1',
          { status: 'REJECTED' },
          'client-1',
        ),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: 'APPLICATION_ALREADY_DECIDED' },
      });
      expect(applicationRepository.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it('rejects a status update for a missing application', async () => {
      applicationRepository.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus('missing', { status: 'REJECTED' }, 'client-1'),
      ).rejects.toThrow(NotFoundException);
      expect(applicationRepository.updateMany).not.toHaveBeenCalled();
    });

    it('rejects a status update from a non-owner', async () => {
      applicationRepository.findUnique.mockResolvedValue({
        listing: { clientId: 'client-2' },
      });

      await expect(
        service.updateStatus(
          'application-1',
          { status: 'ACCEPTED' },
          'client-1',
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(applicationRepository.updateMany).not.toHaveBeenCalled();
    });
  });
});
