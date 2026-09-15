import { PrismaService } from '../prisma/prisma.service';
import { ApplicationsService } from './applications.service';

describe('ApplicationsService', () => {
  const applicationRepository = {
    findMany: jest.fn(),
  };

  const service = new ApplicationsService({
    application: applicationRepository,
  } as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getReceivedApplications', () => {
    it('returns applications only for listings owned by the user', async () => {
      const applications = [{ id: 'application-1' }];
      applicationRepository.findMany.mockResolvedValue(applications);

      await expect(
        service.getReceivedApplications('client-1'),
      ).resolves.toEqual(applications);

      expect(applicationRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            listing: { clientId: 'client-1' },
          },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });
});
