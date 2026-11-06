import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import {
  ListingStatus,
  ReportStatus,
  SessionRevocationReason,
} from '../generated/prisma/enums.js';
import { SessionsService } from '../auth/sessions.service.js';
import { expiryFor } from '../listings/listing-expiry.js';
import { ListingsService } from '../listings/listings.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateReportDto } from './dto/create-report.dto.js';
import { HandledStatus } from './dto/handle-report.dto.js';
import { ReportsQueryDto } from './dto/reports-query.dto.js';

const USER_NAME = { select: { id: true, fullName: true } } as const;

const REPORT_SELECT = {
  id: true,
  reason: true,
  details: true,
  status: true,
  listingTitle: true,
  handledAt: true,
  createdAt: true,
  reporter: USER_NAME,
  reportedUser: { select: { id: true, fullName: true, suspendedAt: true } },
  listing: { select: { id: true, title: true, status: true } },
  handledBy: USER_NAME,
} satisfies Prisma.ReportSelect;

type ReportRow = Prisma.ReportGetPayload<{ select: typeof REPORT_SELECT }>;

function toDto(report: ReportRow) {
  const { listing, listingTitle, reportedUser } = report;
  return {
    id: report.id,
    reason: report.reason,
    details: report.details,
    status: report.status,
    reporter: report.reporter,
    reportedUser: {
      id: reportedUser.id,
      fullName: reportedUser.fullName,
      suspended: reportedUser.suspendedAt !== null,
    },
    // A deleted job keeps its title on the report.
    listing: listing
      ? { id: listing.id, title: listing.title, status: listing.status }
      : listingTitle !== null
        ? { id: null, title: listingTitle, status: null }
        : null,
    handledBy: report.handledBy,
    handledAt: report.handledAt,
    createdAt: report.createdAt,
  };
}

// The fields that close a report.
function handled(status: HandledStatus, adminId: string) {
  return { status, handledById: adminId, handledAt: new Date() };
}

@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listings: ListingsService,
    private readonly sessions: SessionsService,
  ) {}

  async report(dto: CreateReportDto, reporterId: string) {
    if ((dto.listingId === undefined) === (dto.userId === undefined)) {
      throw new BadRequestException('Give either listingId or userId');
    }

    let target: {
      reportedUserId: string;
      listingId: string | null;
      listingTitle: string | null;
    };
    if (dto.listingId !== undefined) {
      const listing = await this.prisma.listing.findUnique({
        where: { id: dto.listingId },
        select: { id: true, clientId: true, title: true },
      });
      if (!listing) throw new NotFoundException('Listing not found');
      target = {
        reportedUserId: listing.clientId,
        listingId: listing.id,
        listingTitle: listing.title,
      };
    } else {
      const user = await this.prisma.user.findUnique({
        where: { id: dto.userId },
        select: { id: true },
      });
      if (!user) throw new NotFoundException('User not found');
      target = { reportedUserId: user.id, listingId: null, listingTitle: null };
    }

    if (target.reportedUserId === reporterId) {
      throw new ForbiddenException('You cannot report yourself');
    }

    // One open report per reporter and target is enough for the admins.
    const open = await this.prisma.report.findFirst({
      where: {
        reporterId,
        reportedUserId: target.reportedUserId,
        listingId: target.listingId,
        status: ReportStatus.OPEN,
      },
      select: { id: true },
    });
    if (open) {
      throw new ConflictException({
        code: 'ALREADY_REPORTED',
        message: 'Ova prijava je već poslana i čeka pregled.',
      });
    }

    await this.prisma.report.create({
      data: {
        ...target,
        reporterId,
        reason: dto.reason,
        details: dto.details || null,
      },
    });
  }

  // The newest first.
  async getReports(query: ReportsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = query.status ? { status: query.status } : {};

    const [items, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: REPORT_SELECT,
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      items: items.map(toDto),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // A report is handled once. Two admins at the same moment: the first wins.
  async handle(id: string, status: HandledStatus, adminId: string) {
    const { count } = await this.prisma.report.updateMany({
      where: { id, status: ReportStatus.OPEN },
      data: handled(status, adminId),
    });
    const report = await this.prisma.report.findUnique({
      where: { id },
      select: REPORT_SELECT,
    });
    if (!report) throw new NotFoundException('Report not found');
    if (count === 0) {
      throw new ConflictException({
        code: 'REPORT_ALREADY_HANDLED',
        message: 'Ovu prijavu je već obradio drugi administrator.',
      });
    }
    return toDto(report);
  }

  // Deletes the job with its photos. Its open reports count as resolved.
  async deleteListing(listingId: string, adminId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');

    await this.prisma.report.updateMany({
      where: { listingId, status: ReportStatus.OPEN },
      data: handled(ReportStatus.RESOLVED, adminId),
    });
    await this.listings.remove(listingId);
  }

  // Ends the user's sessions and closes their open jobs. The open reports
  // about the user and their jobs count as resolved.
  async suspend(userId: string, adminId: string) {
    if (userId === adminId) {
      throw new ForbiddenException('You cannot suspend yourself');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true, suspendedAt: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.isAdmin) {
      throw new ForbiddenException('Admins cannot be suspended');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { suspendedAt: user.suspendedAt ?? new Date() },
      });
      await this.sessions.revokeAllForUser(
        userId,
        SessionRevocationReason.SUSPENDED,
        tx,
      );
      await tx.listing.updateMany({
        where: { clientId: userId, status: ListingStatus.OPEN },
        data: {
          status: ListingStatus.CLOSED,
          ...expiryFor(ListingStatus.CLOSED),
        },
      });
      await tx.report.updateMany({
        where: { reportedUserId: userId, status: ReportStatus.OPEN },
        data: handled(ReportStatus.RESOLVED, adminId),
      });
    });
  }

  // The user can sign in again. Their jobs stay closed until they reopen
  // them.
  async unsuspend(userId: string) {
    const { count } = await this.prisma.user.updateMany({
      where: { id: userId },
      data: { suspendedAt: null },
    });
    if (count === 0) throw new NotFoundException('User not found');
  }
}
