import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import {
  ApplicationStatus,
  ListingStatus,
  NotificationType,
} from '../generated/prisma/enums.js';
import { avatarUrl } from '../auth/avatar.js';
import { EmailService } from '../email/email.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  RatingsService,
  type RatingSummary,
} from '../ratings/ratings.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { CreateApplicationDto } from './dto/create-application.dto.js';
import { ApplicationsQueryDto } from './dto/applications-query.dto.js';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto.js';

// The fields of the DTOs in application-response.dto.ts.
const APPLICATION_SELECT = {
  id: true,
  listingId: true,
  message: true,
  proposedPrice: true,
  status: true,
  rating: { select: { score: true, comment: true, createdAt: true } },
  createdAt: true,
} satisfies Prisma.ApplicationSelect;

const LISTING_SELECT = {
  select: { title: true, category: true, location: true, status: true },
} satisfies Prisma.ListingDefaultArgs;

const EXECUTOR_SELECT = {
  select: { id: true, fullName: true, email: true, avatarId: true },
} satisfies Prisma.UserDefaultArgs;

const MY_APPLICATION_SELECT = {
  ...APPLICATION_SELECT,
  listing: LISTING_SELECT,
} satisfies Prisma.ApplicationSelect;

const LISTING_APPLICATION_SELECT = {
  ...APPLICATION_SELECT,
  executor: EXECUTOR_SELECT,
} satisfies Prisma.ApplicationSelect;

const RECEIVED_APPLICATION_SELECT = {
  ...LISTING_APPLICATION_SELECT,
  listing: LISTING_SELECT,
} satisfies Prisma.ApplicationSelect;

// An application as the job's client sees it. The client sees how to
// reach an executor only after accepting them, and rates them once the
// job is closed.
function forClient<
  T extends {
    status: ApplicationStatus;
    rating: object | null;
    executor: {
      id: string;
      fullName: string;
      email: string;
      avatarId: string | null;
    };
  },
>(
  application: T,
  listingStatus: ListingStatus,
  summaries: Map<string, RatingSummary>,
  storage: StorageService,
) {
  const accepted = application.status === ApplicationStatus.ACCEPTED;
  const { executor } = application;
  return {
    ...application,
    executor: {
      id: executor.id,
      fullName: executor.fullName,
      email: accepted ? executor.email : null,
      avatarUrl: avatarUrl(storage, executor),
      rating: summaries.get(executor.id) ?? {
        average: null,
        count: 0,
      },
    },
    canRate:
      accepted &&
      listingStatus === ListingStatus.CLOSED &&
      application.rating === null,
  };
}

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly ratings: RatingsService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
  ) {}

  private summariesFor(applications: { executor: { id: string } }[]) {
    return this.ratings.summaries(
      applications.map((application) => application.executor.id),
    );
  }

  async create(dto: CreateApplicationDto, executorId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: dto.listingId },
      select: {
        id: true,
        clientId: true,
        status: true,
        title: true,
        client: {
          select: { email: true, fullName: true, emailNotifications: true },
        },
      },
    });

    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.clientId === executorId) {
      throw new ForbiddenException('You cannot apply to your own listing');
    }
    if (listing.status !== ListingStatus.OPEN) {
      throw new ConflictException({
        code: 'LISTING_CLOSED',
        message: 'Ovaj oglas je zatvoren i više ne prima prijave.',
      });
    }

    let created;
    try {
      created = await this.prisma.application.create({
        data: {
          listingId: dto.listingId,
          executorId,
          message: dto.message,
          proposedPrice: dto.proposedPrice,
        },
        select: {
          ...APPLICATION_SELECT,
          executor: { select: { fullName: true } },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('You have already applied to this listing');
      }
      throw error;
    }

    const { executor, ...application } = created;
    await this.notifications.notify({
      userId: listing.clientId,
      type: NotificationType.NEW_APPLICATION,
      listingId: listing.id,
      listingTitle: listing.title,
      actorName: executor.fullName,
    });
    if (listing.client.emailNotifications) {
      // Like the decision email: sent after the response, and a failure
      // does not undo the application.
      this.email
        .sendNewApplication({
          email: listing.client.email,
          fullName: listing.client.fullName,
          listingTitle: listing.title,
          executorName: executor.fullName,
          proposedPrice: application.proposedPrice,
          message: application.message,
        })
        .catch((error: unknown) => {
          this.logger.error(
            `New application email for ${application.id} failed: ${(error as Error).message}`,
          );
        });
    }
    return application;
  }

  async getAppliedListingIds(executorId: string) {
    const applications = await this.prisma.application.findMany({
      where: { executorId },
      select: { listingId: true },
    });

    return applications.map((application) => application.listingId);
  }

  async getMyApplications(executorId: string, query: ApplicationsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where = { executorId };

    const [items, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: MY_APPLICATION_SELECT,
      }),
      this.prisma.application.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getReceivedApplications(clientId: string, query: ApplicationsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where = { listing: { clientId } };

    const [items, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: RECEIVED_APPLICATION_SELECT,
      }),
      this.prisma.application.count({ where }),
    ]);

    const summaries = await this.summariesFor(items);
    return {
      items: items.map((item) =>
        forClient(item, item.listing.status, summaries, this.storage),
      ),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getForListing(listingId: string, userId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { clientId: true, status: true },
    });

    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.clientId !== userId) {
      throw new ForbiddenException('Not your listing');
    }

    const applications = await this.prisma.application.findMany({
      where: { listingId },
      orderBy: { createdAt: 'desc' },
      select: LISTING_APPLICATION_SELECT,
    });

    const summaries = await this.summariesFor(applications);
    return applications.map((application) =>
      forClient(application, listing.status, summaries, this.storage),
    );
  }

  async updateStatus(
    id: string,
    dto: UpdateApplicationStatusDto,
    userId: string,
  ) {
    const application = await this.prisma.application.findUnique({
      where: { id },
      select: {
        executor: { select: { emailNotifications: true } },
        listing: {
          select: {
            clientId: true,
            title: true,
            status: true,
            client: { select: { fullName: true } },
          },
        },
      },
    });

    if (!application) throw new NotFoundException('Application not found');
    if (application.listing.clientId !== userId) {
      throw new ForbiddenException('Not your listing');
    }

    // A decision is final. The status check is part of the update, so of
    // two decisions sent at once only one goes through.
    const { count } = await this.prisma.application.updateMany({
      where: { id, status: ApplicationStatus.PENDING },
      data: { status: dto.status },
    });
    if (count === 0) {
      throw new ConflictException({
        code: 'APPLICATION_ALREADY_DECIDED',
        message: 'O ovoj prijavi je već odlučeno.',
      });
    }

    const decided = await this.prisma.application.findUniqueOrThrow({
      where: { id },
      select: LISTING_APPLICATION_SELECT,
    });

    await this.notifications.notify({
      userId: decided.executor.id,
      type:
        decided.status === ApplicationStatus.ACCEPTED
          ? NotificationType.APPLICATION_ACCEPTED
          : NotificationType.APPLICATION_REJECTED,
      listingId: decided.listingId,
      listingTitle: application.listing.title,
      actorName: application.listing.client.fullName,
    });

    // The decision is already saved, so a failed email must not fail the
    // request. The client does not wait for the email provider either.
    if (application.executor.emailNotifications) {
      this.email
        .sendApplicationDecision({
          email: decided.executor.email,
          fullName: decided.executor.fullName,
          listingId: decided.listingId,
          listingTitle: application.listing.title,
          clientName: application.listing.client.fullName,
          accepted: decided.status === ApplicationStatus.ACCEPTED,
        })
        .catch((error: unknown) => {
          this.logger.error(
            `Application decision email for ${id} failed: ${(error as Error).message}`,
          );
        });
    }

    return forClient(
      decided,
      application.listing.status,
      await this.summariesFor([decided]),
      this.storage,
    );
  }
}
