import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { avatarUrl } from '../auth/avatar.js';
import { Prisma } from '../generated/prisma/client.js';
import { ListingStatus, ReportStatus } from '../generated/prisma/enums.js';
import { expiryFor } from '../listings/listing-expiry.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { AdminListingsQueryDto } from './dto/admin-listings.dto.js';
import { AdminUsersQueryDto } from './dto/admin-users.dto.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const OPEN_REPORTS = { where: { status: ReportStatus.OPEN } } as const;

const ADMIN_USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  avatarId: true,
  isAdmin: true,
  suspendedAt: true,
  emailVerifiedAt: true,
  createdAt: true,
  _count: {
    select: {
      listings: true,
      applications: true,
      reportsReceived: OPEN_REPORTS,
    },
  },
} satisfies Prisma.UserSelect;

const ADMIN_LISTING_SELECT = {
  id: true,
  title: true,
  status: true,
  category: true,
  location: true,
  createdAt: true,
  client: { select: { id: true, fullName: true, suspendedAt: true } },
  _count: { select: { applications: true, reports: OPEN_REPORTS } },
} satisfies Prisma.ListingSelect;

function pageOf<T>(items: T[], total: number, page: number, limit: number) {
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// The admin overview and the lists of every user and job.
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async getStats() {
    const weekAgo = new Date(Date.now() - WEEK_MS);
    const [
      users,
      newUsers,
      suspendedUsers,
      openListings,
      closedListings,
      newListings,
      applications,
      newApplications,
      openReports,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.user.count({ where: { suspendedAt: { not: null } } }),
      this.prisma.listing.count({ where: { status: ListingStatus.OPEN } }),
      this.prisma.listing.count({ where: { status: ListingStatus.CLOSED } }),
      this.prisma.listing.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.application.count(),
      this.prisma.application.count({
        where: { createdAt: { gte: weekAgo } },
      }),
      this.prisma.report.count({ where: { status: ReportStatus.OPEN } }),
    ]);
    return {
      users,
      newUsers,
      suspendedUsers,
      openListings,
      closedListings,
      newListings,
      applications,
      newApplications,
      openReports,
    };
  }

  // The newest first.
  async getUsers(query: AdminUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.UserWhereInput = {
      ...(query.filter === 'SUSPENDED' && { suspendedAt: { not: null } }),
      ...(query.filter === 'ADMINS' && { isAdmin: true }),
      ...(query.q && {
        OR: [
          { fullName: { contains: query.q, mode: 'insensitive' } },
          { email: { contains: query.q, mode: 'insensitive' } },
        ],
      }),
    };

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: ADMIN_USER_SELECT,
      }),
      this.prisma.user.count({ where }),
    ]);

    const items = rows.map((user) => ({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      avatarUrl: avatarUrl(this.storage, user),
      isAdmin: user.isAdmin,
      suspendedAt: user.suspendedAt,
      emailVerified: user.emailVerifiedAt !== null,
      createdAt: user.createdAt,
      listings: user._count.listings,
      applications: user._count.applications,
      openReports: user._count.reportsReceived,
    }));
    return pageOf(items, total, page, limit);
  }

  // Every job in every status, the newest first.
  async getListings(query: AdminListingsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ListingWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.q && {
        title: { contains: query.q, mode: 'insensitive' },
      }),
    };

    const [rows, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: ADMIN_LISTING_SELECT,
      }),
      this.prisma.listing.count({ where }),
    ]);

    const items = rows.map((listing) => ({
      id: listing.id,
      title: listing.title,
      status: listing.status,
      category: listing.category,
      location: listing.location,
      createdAt: listing.createdAt,
      client: {
        id: listing.client.id,
        fullName: listing.client.fullName,
        suspended: listing.client.suspendedAt !== null,
      },
      applications: listing._count.applications,
      openReports: listing._count.reports,
    }));
    return pageOf(items, total, page, limit);
  }

  // Closes or reopens any job. A suspended client's job stays closed.
  async setListingStatus(id: string, status: ListingStatus) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      select: { client: { select: { suspendedAt: true } } },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (status === ListingStatus.OPEN && listing.client.suspendedAt) {
      throw new ConflictException({
        code: 'CLIENT_SUSPENDED',
        message:
          'Nalog vlasnika oglasa je suspendovan, pa se oglas ne može ponovo otvoriti.',
      });
    }
    await this.prisma.listing.update({
      where: { id },
      data: { status, ...expiryFor(status) },
    });
  }
}
