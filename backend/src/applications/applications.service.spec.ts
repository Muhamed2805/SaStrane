import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApplicationsService } from './applications.service';

describe('ApplicationsService', () => {
  const listingRepository = {
    findUnique: jest.fn(),
  };
  const applicationRepository = {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  };

  const service = new ApplicationsService({
    listing: listingRepository,
    application: applicationRepository,
  } as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('create', () => {
    const dto = {
      listingId: 'listing-1',
      message: 'Mogu završiti posao sutra.',
      proposedPrice: '50 KM',
    };

    it('creates an application for a listing owned by another user', async () => {
      const created = { id: 'application-1', ...dto };
      listingRepository.findUnique.mockResolvedValue({
        id: 'listing-1',
        clientId: 'client-1',
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

    it('maps the database unique constraint to a conflict response', async () => {
      listingRepository.findUnique.mockResolvedValue({
        id: 'listing-1',
        clientId: 'client-1',
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

  describe('getReceivedApplications', () => {
    it('returns an owner-scoped page of applications', async () => {
      const applications = [{ id: 'application-1' }];
      applicationRepository.findMany.mockResolvedValue(applications);
      applicationRepository.count.mockResolvedValue(12);

      await expect(
        service.getReceivedApplications('client-1', { page: 2, limit: 5 }),
      ).resolves.toEqual({
        items: applications,
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
  });

  describe('updateStatus', () => {
    it('allows the listing owner to update an application status', async () => {
      applicationRepository.findUnique.mockResolvedValue({
        id: 'application-1',
        status: 'PENDING',
        listing: { clientId: 'client-1' },
      });
      applicationRepository.update.mockResolvedValue({
        id: 'application-1',
        status: 'ACCEPTED',
      });

      await expect(
        service.updateStatus(
          'application-1',
          { status: 'ACCEPTED' },
          'client-1',
        ),
      ).resolves.toEqual({ id: 'application-1', status: 'ACCEPTED' });
      expect(applicationRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'application-1' },
          data: { status: 'ACCEPTED' },
        }),
      );
    });

    it('rejects a status update for a missing application', async () => {
      applicationRepository.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus('missing', { status: 'REJECTED' }, 'client-1'),
      ).rejects.toThrow(NotFoundException);
      expect(applicationRepository.update).not.toHaveBeenCalled();
    });

    it('rejects a status update from a non-owner', async () => {
      applicationRepository.findUnique.mockResolvedValue({
        id: 'application-1',
        status: 'PENDING',
        listing: { clientId: 'client-2' },
      });

      await expect(
        service.updateStatus(
          'application-1',
          { status: 'ACCEPTED' },
          'client-1',
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(applicationRepository.update).not.toHaveBeenCalled();
    });
  });
});
