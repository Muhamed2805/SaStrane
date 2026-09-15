import { PrismaService } from '../prisma/prisma.service';
import { ApplicationsService } from './applications.service';

describe('ApplicationsService', () => {
  const applicationRepository = {
    findMany: jest.fn(),
    count: jest.fn(),
  };

  const service = new ApplicationsService({
    application: applicationRepository,
  } as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
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
});
