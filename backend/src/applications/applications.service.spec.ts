import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EmailService } from '../email/email.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { RatingsService } from '../ratings/ratings.service.js';
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

  const email = {
    sendApplicationDecision: vi.fn(),
    sendNewApplication: vi.fn(),
  };
  const ratings = { summaries: vi.fn() };
  const noRatings = { average: null, count: 0 };

  const service = new ApplicationsService(
    {
      listing: listingRepository,
      application: applicationRepository,
    } as unknown as PrismaService,
    email as unknown as EmailService,
    ratings as unknown as RatingsService,
  );

  beforeEach(() => {
    vi.resetAllMocks();
    ratings.summaries.mockResolvedValue(new Map());
  });

  describe('create', () => {
    const dto = {
      listingId: 'listing-1',
      message: 'Mogu završiti posao sutra.',
      proposedPrice: 50,
    };

    const openListing = {
      id: 'listing-1',
      clientId: 'client-1',
      status: 'OPEN',
      title: 'Košenje trave',
      client: {
        email: 'amra@example.com',
        fullName: 'Amra',
        emailNotifications: true,
      },
    };
    const created = { id: 'application-1', ...dto };

    function createdBy(fullName: string) {
      applicationRepository.create.mockResolvedValue({
        ...created,
        executor: { fullName },
      });
    }

    it('creates an application for a listing owned by another user', async () => {
      listingRepository.findUnique.mockResolvedValue(openListing);
      createdBy('Kenan');
      email.sendNewApplication.mockResolvedValue(undefined);

      await expect(service.create(dto, 'executor-1')).resolves.toEqual(created);
      expect(applicationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { ...dto, executorId: 'executor-1' },
        }),
      );
    });

    it('emails the client about the application', async () => {
      listingRepository.findUnique.mockResolvedValue(openListing);
      createdBy('Kenan');
      email.sendNewApplication.mockResolvedValue(undefined);

      await service.create(dto, 'executor-1');

      expect(email.sendNewApplication).toHaveBeenCalledWith({
        email: 'amra@example.com',
        fullName: 'Amra',
        listingTitle: 'Košenje trave',
        executorName: 'Kenan',
        proposedPrice: 50,
        message: dto.message,
      });
    });

    it('sends no email to a client who turned them off', async () => {
      listingRepository.findUnique.mockResolvedValue({
        ...openListing,
        client: { ...openListing.client, emailNotifications: false },
      });
      createdBy('Kenan');

      await service.create(dto, 'executor-1');

      expect(email.sendNewApplication).not.toHaveBeenCalled();
    });

    it('keeps the application when the email fails', async () => {
      listingRepository.findUnique.mockResolvedValue(openListing);
      createdBy('Kenan');
      const logged = vi
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      email.sendNewApplication.mockRejectedValue(new Error('provider down'));

      await expect(service.create(dto, 'executor-1')).resolves.toEqual(created);
      await vi.waitFor(() =>
        expect(logged).toHaveBeenCalledWith(
          expect.stringContaining('provider down'),
        ),
      );
      logged.mockRestore();
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
      listingRepository.findUnique.mockResolvedValue(openListing);
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
      const listing = { status: 'OPEN' };
      applicationRepository.findMany.mockResolvedValue([
        { id: 'pending', status: 'PENDING', rating: null, executor, listing },
        { id: 'accepted', status: 'ACCEPTED', rating: null, executor, listing },
        { id: 'rejected', status: 'REJECTED', rating: null, executor, listing },
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
      listingRepository.findUnique.mockResolvedValue({
        clientId: 'client-1',
        status: 'OPEN',
      });
      applicationRepository.findMany.mockResolvedValue([
        { id: 'pending', status: 'PENDING', rating: null, executor },
      ]);

      await expect(
        service.getForListing('listing-1', 'client-1'),
      ).resolves.toEqual([
        {
          id: 'pending',
          status: 'PENDING',
          rating: null,
          executor: { ...executor, email: null, rating: noRatings },
          canRate: false,
        },
      ]);
    });

    it("adds each executor's rating and lets the client rate after closing", async () => {
      listingRepository.findUnique.mockResolvedValue({
        clientId: 'client-1',
        status: 'CLOSED',
      });
      const rated = { score: 5, comment: null, createdAt: new Date() };
      applicationRepository.findMany.mockResolvedValue([
        { id: 'accepted', status: 'ACCEPTED', rating: null, executor },
        { id: 'rated', status: 'ACCEPTED', rating: rated, executor },
        { id: 'rejected', status: 'REJECTED', rating: null, executor },
      ]);
      const summary = { average: 4.5, count: 2 };
      ratings.summaries.mockResolvedValue(new Map([[executor.id, summary]]));

      const applications = await service.getForListing('listing-1', 'client-1');

      expect(applications.map((item) => item.canRate)).toEqual([
        true,
        false,
        false,
      ]);
      expect(applications[0].executor.rating).toEqual(summary);
      expect(ratings.summaries).toHaveBeenCalledWith([
        executor.id,
        executor.id,
        executor.id,
      ]);
    });
  });

  describe('updateStatus', () => {
    const ownApplication = {
      executor: { emailNotifications: true },
      listing: {
        clientId: 'client-1',
        title: 'Košenje trave',
        status: 'OPEN',
        client: { fullName: 'Amra' },
      },
    };

    function decidedAs(status: 'ACCEPTED' | 'REJECTED') {
      applicationRepository.findUnique.mockResolvedValue(ownApplication);
      applicationRepository.updateMany.mockResolvedValue({ count: 1 });
      applicationRepository.findUniqueOrThrow.mockResolvedValue({
        id: 'application-1',
        listingId: 'listing-1',
        status,
        rating: null,
        executor,
      });
    }

    it('decides a pending application and shows the email once accepted', async () => {
      decidedAs('ACCEPTED');
      email.sendApplicationDecision.mockResolvedValue(undefined);

      await expect(
        service.updateStatus(
          'application-1',
          { status: 'ACCEPTED' },
          'client-1',
        ),
      ).resolves.toEqual({
        id: 'application-1',
        listingId: 'listing-1',
        status: 'ACCEPTED',
        rating: null,
        executor: { ...executor, rating: noRatings },
        canRate: false,
      });
      expect(applicationRepository.updateMany).toHaveBeenCalledWith({
        where: { id: 'application-1', status: 'PENDING' },
        data: { status: 'ACCEPTED' },
      });
    });

    it('emails the executor about the decision', async () => {
      decidedAs('REJECTED');
      email.sendApplicationDecision.mockResolvedValue(undefined);

      await service.updateStatus(
        'application-1',
        { status: 'REJECTED' },
        'client-1',
      );

      expect(email.sendApplicationDecision).toHaveBeenCalledWith({
        email: executor.email,
        fullName: executor.fullName,
        listingId: 'listing-1',
        listingTitle: 'Košenje trave',
        clientName: 'Amra',
        accepted: false,
      });
    });

    it('sends no decision email to an executor who turned them off', async () => {
      decidedAs('ACCEPTED');
      applicationRepository.findUnique.mockResolvedValue({
        ...ownApplication,
        executor: { emailNotifications: false },
      });

      await service.updateStatus(
        'application-1',
        { status: 'ACCEPTED' },
        'client-1',
      );

      expect(email.sendApplicationDecision).not.toHaveBeenCalled();
    });

    it('keeps the decision when the email fails', async () => {
      decidedAs('ACCEPTED');
      const logged = vi
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      email.sendApplicationDecision.mockRejectedValue(
        new Error('provider down'),
      );

      await expect(
        service.updateStatus(
          'application-1',
          { status: 'ACCEPTED' },
          'client-1',
        ),
      ).resolves.toMatchObject({ status: 'ACCEPTED' });
      await vi.waitFor(() =>
        expect(logged).toHaveBeenCalledWith(
          expect.stringContaining('provider down'),
        ),
      );
      logged.mockRestore();
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
      expect(email.sendApplicationDecision).not.toHaveBeenCalled();
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
