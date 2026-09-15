import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ApplicationsQueryDto } from './dto/applications-query.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';

@Injectable()
export class ApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateApplicationDto, executorId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: dto.listingId },
      select: { id: true, clientId: true },
    });

    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.clientId === executorId) {
      throw new ForbiddenException('You cannot apply to your own listing');
    }

    try {
      return await this.prisma.application.create({
        data: {
          listingId: dto.listingId,
          executorId,
          message: dto.message,
          proposedPrice: dto.proposedPrice,
        },
        select: {
          id: true,
          listingId: true,
          message: true,
          proposedPrice: true,
          status: true,
          createdAt: true,
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
        select: {
          id: true,
          listingId: true,
          message: true,
          proposedPrice: true,
          status: true,
          createdAt: true,
          listing: {
            select: {
              title: true,
              category: true,
              location: true,
            },
          },
        },
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
        select: {
          id: true,
          listingId: true,
          message: true,
          proposedPrice: true,
          status: true,
          createdAt: true,
          listing: {
            select: {
              title: true,
              category: true,
              location: true,
            },
          },
          executor: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.application.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
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

    return this.prisma.application.findMany({
      where: { listingId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        listingId: true,
        message: true,
        proposedPrice: true,
        status: true,
        createdAt: true,
        executor: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });
  }

  async updateStatus(
    id: string,
    dto: UpdateApplicationStatusDto,
    userId: string,
  ) {
    const application = await this.prisma.application.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        listing: {
          select: { clientId: true },
        },
      },
    });

    if (!application) throw new NotFoundException('Application not found');
    if (application.listing.clientId !== userId) {
      throw new ForbiddenException('Not your listing');
    }

    return this.prisma.application.update({
      where: { id },
      data: { status: dto.status },
      select: {
        id: true,
        listingId: true,
        message: true,
        proposedPrice: true,
        status: true,
        createdAt: true,
        executor: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });
  }
}
