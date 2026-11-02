import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { ApplicationStatus, ListingStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
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
  createdAt: true,
} satisfies Prisma.ApplicationSelect;

const LISTING_SELECT = {
  select: { title: true, category: true, location: true, status: true },
} satisfies Prisma.ListingDefaultArgs;

const EXECUTOR_SELECT = {
  select: { id: true, fullName: true, email: true },
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

// The client sees how to reach an executor only after accepting them.
function hideContactUntilAccepted<
  T extends { status: ApplicationStatus; executor: { email: string } },
>(application: T) {
  if (application.status === ApplicationStatus.ACCEPTED) return application;
  return { ...application, executor: { ...application.executor, email: null } };
}

@Injectable()
export class ApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateApplicationDto, executorId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: dto.listingId },
      select: { id: true, clientId: true, status: true },
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

    try {
      return await this.prisma.application.create({
        data: {
          listingId: dto.listingId,
          executorId,
          message: dto.message,
          proposedPrice: dto.proposedPrice,
        },
        select: APPLICATION_SELECT,
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

    return {
      items: items.map(hideContactUntilAccepted),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getForListing(listingId: string, userId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { clientId: true },
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

    return applications.map(hideContactUntilAccepted);
  }

  async updateStatus(
    id: string,
    dto: UpdateApplicationStatusDto,
    userId: string,
  ) {
    const application = await this.prisma.application.findUnique({
      where: { id },
      select: { listing: { select: { clientId: true } } },
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

    return hideContactUntilAccepted(
      await this.prisma.application.findUniqueOrThrow({
        where: { id },
        select: LISTING_APPLICATION_SELECT,
      }),
    );
  }
}
