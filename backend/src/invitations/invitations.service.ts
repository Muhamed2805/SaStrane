import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import {
  ListingStatus,
  NotificationType,
  UserRole,
} from '../generated/prisma/enums.js';
import { avatarUrl } from '../auth/avatar.js';
import { EmailService } from '../email/email.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { CreateInvitationDto } from './dto/create-invitation.dto.js';
import type { InvitationOptionState } from './dto/invitation-response.dto.js';
import { InvitationsQueryDto } from './dto/invitations-query.dto.js';

// Keeps one job from being sent to everyone on the executor list.
export const MAX_INVITATIONS_PER_LISTING = 20;

// The client's newest open jobs offered in the invite dialog.
const MAX_OPTIONS = 50;

const INVITATION_SELECT = {
  id: true,
  listingId: true,
  executorId: true,
  createdAt: true,
} satisfies Prisma.InvitationSelect;

// Like the executor list: only confirmed, not suspended users who do jobs
// and picked at least one kind of job get invitations.
function receivesInvitations(user: {
  role: UserRole;
  skills: unknown[];
  emailVerifiedAt: Date | null;
  suspendedAt: Date | null;
}) {
  return (
    user.role !== UserRole.CLIENT &&
    user.skills.length > 0 &&
    user.emailVerifiedAt !== null &&
    user.suspendedAt === null
  );
}

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(dto: CreateInvitationDto, clientId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: dto.listingId },
      select: {
        id: true,
        clientId: true,
        status: true,
        title: true,
        budget: true,
        client: { select: { fullName: true } },
      },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.clientId !== clientId) {
      throw new ForbiddenException('Only the client can invite to the job');
    }
    if (dto.executorId === clientId) {
      throw new ForbiddenException('You cannot invite yourself');
    }
    if (listing.status !== ListingStatus.OPEN) {
      throw new ConflictException({
        code: 'LISTING_CLOSED',
        message: 'Ovaj oglas je zatvoren i više ne prima prijave.',
      });
    }

    const executor = await this.prisma.user.findUnique({
      where: { id: dto.executorId },
      select: {
        email: true,
        fullName: true,
        role: true,
        skills: true,
        emailVerifiedAt: true,
        suspendedAt: true,
        emailNotifications: true,
      },
    });
    if (!executor) throw new NotFoundException('User not found');
    if (!receivesInvitations(executor)) {
      throw new ConflictException({
        code: 'EXECUTOR_UNAVAILABLE',
        message: 'Ovaj korisnik trenutno ne prima pozive.',
      });
    }

    const pair = { listingId: listing.id, executorId: dto.executorId };
    const [application, invitationCount] = await Promise.all([
      this.prisma.application.findUnique({
        where: { listingId_executorId: pair },
        select: { id: true },
      }),
      this.prisma.invitation.count({ where: { listingId: listing.id } }),
    ]);
    if (application) {
      throw new ConflictException({
        code: 'ALREADY_APPLIED',
        message: 'Ovaj izvođač se već prijavio na tvoj oglas.',
      });
    }
    // Two invitations at the same moment can pass the limit by one. It
    // only has to stop mass invitations.
    if (invitationCount >= MAX_INVITATIONS_PER_LISTING) {
      throw new ConflictException({
        code: 'INVITATION_LIMIT',
        message: `Na jedan oglas možeš pozvati najviše ${MAX_INVITATIONS_PER_LISTING} izvođača.`,
      });
    }

    let invitation;
    try {
      invitation = await this.prisma.invitation.create({
        data: pair,
        select: INVITATION_SELECT,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'ALREADY_INVITED',
          message: 'Ovaj izvođač je već pozvan na tvoj oglas.',
        });
      }
      throw error;
    }

    await this.notifications.notify({
      userId: dto.executorId,
      type: NotificationType.INVITATION,
      listingId: listing.id,
      listingTitle: listing.title,
      actorName: listing.client.fullName,
    });
    if (executor.emailNotifications) {
      const invitationId = invitation.id;
      // Sent after the response. A failure does not undo the invitation.
      this.email
        .sendInvitation({
          email: executor.email,
          fullName: executor.fullName,
          listingId: listing.id,
          listingTitle: listing.title,
          clientName: listing.client.fullName,
          budget: listing.budget,
        })
        .catch((error: unknown) => {
          this.logger.error(
            `Invitation email for ${invitationId} failed: ${(error as Error).message}`,
          );
        });
    }
    return invitation;
  }

  // The user's invitations to jobs that are still open, newest first.
  async getReceived(executorId: string, query: InvitationsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where = {
      executorId,
      listing: { status: ListingStatus.OPEN },
    } satisfies Prisma.InvitationWhereInput;

    const [rows, total] = await Promise.all([
      this.prisma.invitation.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          createdAt: true,
          listing: {
            select: {
              id: true,
              title: true,
              category: true,
              location: true,
              budget: true,
              client: {
                select: { id: true, fullName: true, avatarId: true },
              },
            },
          },
        },
      }),
      this.prisma.invitation.count({ where }),
    ]);

    const applications = await this.prisma.application.findMany({
      where: {
        executorId,
        listingId: { in: rows.map((row) => row.listing.id) },
      },
      select: { listingId: true },
    });
    const applied = new Set(applications.map((item) => item.listingId));

    return {
      items: rows.map(({ listing: { client, ...listing }, ...row }) => ({
        id: row.id,
        applied: applied.has(listing.id),
        listing,
        client: {
          id: client.id,
          fullName: client.fullName,
          avatarUrl: avatarUrl(this.storage, client),
        },
        createdAt: row.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // The user declines: the invitation is deleted, the client is not told.
  async decline(id: string, executorId: string) {
    const { count } = await this.prisma.invitation.deleteMany({
      where: { id, executorId },
    });
    if (count === 0) throw new NotFoundException('Invitation not found');
  }

  // The client's open jobs and whether the user can be invited to each.
  async getOptions(clientId: string, executorId: string) {
    const listings = await this.prisma.listing.findMany({
      where: { clientId, status: ListingStatus.OPEN },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MAX_OPTIONS,
      select: {
        id: true,
        title: true,
        category: true,
        location: true,
        invitations: { where: { executorId }, select: { id: true } },
        applications: { where: { executorId }, select: { id: true } },
      },
    });

    return listings.map((listing) => {
      const state: InvitationOptionState =
        listing.applications.length > 0
          ? 'APPLIED'
          : listing.invitations.length > 0
            ? 'INVITED'
            : 'AVAILABLE';
      return {
        listingId: listing.id,
        title: listing.title,
        category: listing.category,
        location: listing.location,
        state,
      };
    });
  }
}
