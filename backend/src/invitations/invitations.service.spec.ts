import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EmailService } from '../email/email.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import {
  InvitationsService,
  MAX_INVITATIONS_PER_LISTING,
} from './invitations.service.js';

describe('InvitationsService', () => {
  const listingRepository = { findUnique: vi.fn(), findMany: vi.fn() };
  const userRepository = { findUnique: vi.fn() };
  const applicationRepository = { findUnique: vi.fn(), findMany: vi.fn() };
  const invitationRepository = {
    create: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  };
  const email = { sendInvitation: vi.fn() };

  const service = new InvitationsService(
    {
      listing: listingRepository,
      user: userRepository,
      application: applicationRepository,
      invitation: invitationRepository,
    } as unknown as PrismaService,
    email as unknown as EmailService,
    {
      url: (key: string) => `https://files.test/${key}`,
    } as unknown as StorageService,
  );

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('create', () => {
    const dto = { listingId: 'listing-1', executorId: 'executor-1' };
    const openListing = {
      id: 'listing-1',
      clientId: 'client-1',
      status: 'OPEN',
      title: 'Selidba',
      budget: 100,
      client: { fullName: 'Amra' },
    };
    const executor = {
      email: 'kenan@example.com',
      fullName: 'Kenan',
      role: 'BOTH',
      skills: ['MOVING'],
      emailVerifiedAt: new Date(),
      suspendedAt: null,
      emailNotifications: true,
    };
    const created = {
      id: 'invitation-1',
      ...dto,
      createdAt: new Date('2026-11-06T10:00:00Z'),
    };

    function ready() {
      listingRepository.findUnique.mockResolvedValue(openListing);
      userRepository.findUnique.mockResolvedValue(executor);
      applicationRepository.findUnique.mockResolvedValue(null);
      invitationRepository.count.mockResolvedValue(0);
      invitationRepository.create.mockResolvedValue(created);
      email.sendInvitation.mockResolvedValue(undefined);
    }

    it('invites the user and sends them an email', async () => {
      ready();

      await expect(service.create(dto, 'client-1')).resolves.toEqual(created);
      expect(invitationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: dto }),
      );
      expect(email.sendInvitation).toHaveBeenCalledWith({
        email: 'kenan@example.com',
        fullName: 'Kenan',
        listingId: 'listing-1',
        listingTitle: 'Selidba',
        clientName: 'Amra',
        budget: 100,
      });
    });

    it('sends no email to a user who turned notices off', async () => {
      ready();
      userRepository.findUnique.mockResolvedValue({
        ...executor,
        emailNotifications: false,
      });

      await service.create(dto, 'client-1');
      expect(email.sendInvitation).not.toHaveBeenCalled();
    });

    it('keeps the invitation when the email fails', async () => {
      ready();
      const logged = vi
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      email.sendInvitation.mockRejectedValue(new Error('provider down'));

      await expect(service.create(dto, 'client-1')).resolves.toEqual(created);
      await vi.waitFor(() =>
        expect(logged).toHaveBeenCalledWith(
          'Invitation email for invitation-1 failed: provider down',
        ),
      );
      logged.mockRestore();
    });

    it('refuses a missing job, a stranger and the client themselves', async () => {
      listingRepository.findUnique.mockResolvedValue(null);
      await expect(service.create(dto, 'client-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );

      listingRepository.findUnique.mockResolvedValue(openListing);
      await expect(service.create(dto, 'someone')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(
        service.create({ ...dto, executorId: 'client-1' }, 'client-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses a closed job', async () => {
      ready();
      listingRepository.findUnique.mockResolvedValue({
        ...openListing,
        status: 'CLOSED',
      });

      await expect(service.create(dto, 'client-1')).rejects.toMatchObject({
        response: { code: 'LISTING_CLOSED' },
      });
    });

    it('refuses a missing user', async () => {
      ready();
      userRepository.findUnique.mockResolvedValue(null);

      await expect(service.create(dto, 'client-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it.each([
      ['only posts jobs', { role: 'CLIENT' }],
      ['picked no jobs', { skills: [] }],
      ['is not confirmed', { emailVerifiedAt: null }],
      ['is suspended', { suspendedAt: new Date() }],
    ])('refuses a user who %s', async (_, change) => {
      ready();
      userRepository.findUnique.mockResolvedValue({ ...executor, ...change });

      await expect(service.create(dto, 'client-1')).rejects.toMatchObject({
        response: { code: 'EXECUTOR_UNAVAILABLE' },
      });
      expect(invitationRepository.create).not.toHaveBeenCalled();
    });

    it('refuses a user who already applied', async () => {
      ready();
      applicationRepository.findUnique.mockResolvedValue({ id: 'app-1' });

      await expect(service.create(dto, 'client-1')).rejects.toMatchObject({
        response: { code: 'ALREADY_APPLIED' },
      });
    });

    it('stops at the limit per job', async () => {
      ready();
      invitationRepository.count.mockResolvedValue(MAX_INVITATIONS_PER_LISTING);

      await expect(service.create(dto, 'client-1')).rejects.toMatchObject({
        response: { code: 'INVITATION_LIMIT' },
      });
    });

    it('refuses a second invitation', async () => {
      ready();
      invitationRepository.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      const refused = service.create(dto, 'client-1');
      await expect(refused).rejects.toBeInstanceOf(ConflictException);
      await expect(refused).rejects.toMatchObject({
        response: { code: 'ALREADY_INVITED' },
      });
      expect(email.sendInvitation).not.toHaveBeenCalled();
    });
  });

  describe('getReceived', () => {
    it('lists open jobs with the client and whether the user applied', async () => {
      const createdAt = new Date('2026-11-06T10:00:00Z');
      invitationRepository.findMany.mockResolvedValue([
        {
          id: 'invitation-2',
          createdAt,
          listing: {
            id: 'listing-2',
            title: 'Montaža',
            category: 'ASSEMBLY',
            location: 'MOSTAR',
            budget: null,
            client: { id: 'client-1', fullName: 'Amra', avatarId: 'a1' },
          },
        },
        {
          id: 'invitation-1',
          createdAt,
          listing: {
            id: 'listing-1',
            title: 'Selidba',
            category: 'MOVING',
            location: 'SARAJEVO',
            budget: 100,
            client: { id: 'client-1', fullName: 'Amra', avatarId: null },
          },
        },
      ]);
      invitationRepository.count.mockResolvedValue(12);
      applicationRepository.findMany.mockResolvedValue([
        { listingId: 'listing-1' },
      ]);

      const result = await service.getReceived('executor-1', {
        page: 2,
        limit: 10,
      });

      expect(invitationRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { executorId: 'executor-1', listing: { status: 'OPEN' } },
          skip: 10,
          take: 10,
        }),
      );
      expect(result).toEqual({
        items: [
          {
            id: 'invitation-2',
            applied: false,
            listing: {
              id: 'listing-2',
              title: 'Montaža',
              category: 'ASSEMBLY',
              location: 'MOSTAR',
              budget: null,
            },
            client: {
              id: 'client-1',
              fullName: 'Amra',
              avatarUrl: expect.stringContaining(
                'https://files.test/',
              ) as unknown,
            },
            createdAt,
          },
          expect.objectContaining({
            id: 'invitation-1',
            applied: true,
            client: { id: 'client-1', fullName: 'Amra', avatarUrl: null },
          }) as unknown,
        ],
        total: 12,
        page: 2,
        limit: 10,
        totalPages: 2,
      });
    });
  });

  describe('decline', () => {
    it("deletes only the user's own invitation", async () => {
      invitationRepository.deleteMany.mockResolvedValue({ count: 1 });
      await service.decline('invitation-1', 'executor-1');
      expect(invitationRepository.deleteMany).toHaveBeenCalledWith({
        where: { id: 'invitation-1', executorId: 'executor-1' },
      });

      invitationRepository.deleteMany.mockResolvedValue({ count: 0 });
      await expect(
        service.decline('invitation-1', 'someone'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getOptions', () => {
    it("marks each of the client's open jobs", async () => {
      const job = { category: 'MOVING', location: 'SARAJEVO' };
      listingRepository.findMany.mockResolvedValue([
        { id: 'l3', title: 'A', ...job, invitations: [], applications: [] },
        {
          id: 'l2',
          title: 'B',
          ...job,
          invitations: [{ id: 'i' }],
          applications: [],
        },
        {
          id: 'l1',
          title: 'C',
          ...job,
          invitations: [{ id: 'i' }],
          applications: [{ id: 'a' }],
        },
      ]);

      await expect(
        service.getOptions('client-1', 'executor-1'),
      ).resolves.toEqual([
        { listingId: 'l3', title: 'A', ...job, state: 'AVAILABLE' },
        { listingId: 'l2', title: 'B', ...job, state: 'INVITED' },
        { listingId: 'l1', title: 'C', ...job, state: 'APPLIED' },
      ]);
      expect(listingRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clientId: 'client-1', status: 'OPEN' },
          take: 50,
        }),
      );
    });
  });
});
