import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { ApplicationStatus, ListingStatus } from '../generated/prisma/enums.js';
import { avatarUrl } from '../auth/avatar.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { CreateRatingDto } from './dto/create-rating.dto.js';
import { ExecutorsQueryDto } from './dto/executors-query.dto.js';
import { RatingsQueryDto } from './dto/ratings-query.dto.js';

// The fields of UserProfileDto, besides the rating.
const PROFILE_SELECT = {
  id: true,
  fullName: true,
  avatarId: true,
  bio: true,
  skills: true,
  location: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

// The fields of RatingDto.
const RATING_SELECT = {
  id: true,
  score: true,
  comment: true,
  listingId: true,
  listingTitle: true,
  createdAt: true,
  client: { select: { id: true, fullName: true } },
} satisfies Prisma.RatingSelect;

export type RatingSummary = { average: number | null; count: number };

const NO_RATINGS: RatingSummary = { average: null, count: 0 };

function toSummary(average: number | null, count: number): RatingSummary {
  if (count === 0 || average === null) return NO_RATINGS;
  return { average: Math.round(average * 10) / 10, count };
}

// For ILIKE: the user's % and _ match themselves.
function likePattern(text: string) {
  return `%${text.replace(/[\\%_]/g, '\\$&')}%`;
}

function isUniqueViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

@Injectable()
export class RatingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // The client rates the executor they accepted, once the job is closed.
  async create(dto: CreateRatingDto, clientId: string) {
    const application = await this.prisma.application.findUnique({
      where: { id: dto.applicationId },
      select: {
        id: true,
        status: true,
        executorId: true,
        rating: { select: { id: true } },
        listing: {
          select: { id: true, title: true, clientId: true, status: true },
        },
      },
    });

    if (!application) throw new NotFoundException('Application not found');
    if (application.listing.clientId !== clientId) {
      throw new ForbiddenException('Not your listing');
    }
    if (application.status !== ApplicationStatus.ACCEPTED) {
      throw new ConflictException({
        code: 'APPLICATION_NOT_ACCEPTED',
        message: 'Možeš ocijeniti samo izvođača čija je prijava prihvaćena.',
      });
    }
    if (application.listing.status !== ListingStatus.CLOSED) {
      throw new ConflictException({
        code: 'LISTING_NOT_CLOSED',
        message: 'Zatvori oglas kad je posao završen, pa ocijeni izvođača.',
      });
    }

    const alreadyRated = new ConflictException({
      code: 'ALREADY_RATED',
      message: 'Izvođač je za ovaj posao već ocijenjen.',
    });
    if (application.rating) throw alreadyRated;

    try {
      return await this.prisma.rating.create({
        data: {
          applicationId: application.id,
          listingId: application.listing.id,
          listingTitle: application.listing.title,
          clientId,
          executorId: application.executorId,
          score: dto.score,
          comment: dto.comment || null,
        },
        select: RATING_SELECT,
      });
    } catch (error) {
      // A second rating sent at the same time.
      if (isUniqueViolation(error)) throw alreadyRated;
      throw error;
    }
  }

  // Rating summaries for several executors at once, for lists.
  async summaries(executorIds: string[]) {
    const ids = [...new Set(executorIds)];
    const result = new Map<string, RatingSummary>();
    if (ids.length === 0) return result;

    const groups = await this.prisma.rating.groupBy({
      by: ['executorId'],
      where: { executorId: { in: ids } },
      _avg: { score: true },
      _count: { _all: true },
    });
    for (const group of groups) {
      result.set(
        group.executorId,
        toSummary(group._avg.score, group._count._all),
      );
    }
    for (const id of ids) {
      if (!result.has(id)) result.set(id, NO_RATINGS);
    }
    return result;
  }

  async getProfile(userId: string) {
    const [user, aggregate] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: PROFILE_SELECT,
      }),
      this.prisma.rating.aggregate({
        where: { executorId: userId },
        _avg: { score: true },
        _count: { _all: true },
      }),
    ]);

    if (!user) throw new NotFoundException('User not found');
    return {
      id: user.id,
      fullName: user.fullName,
      avatarUrl: avatarUrl(this.storage, user),
      bio: user.bio,
      skills: user.skills,
      location: user.location,
      createdAt: user.createdAt,
      rating: toSummary(aggregate._avg.score, aggregate._count._all),
    };
  }

  // Users who do jobs and named at least one kind of job, the best rated
  // first. Prisma cannot order by an average, so the page of IDs comes from
  // SQL. Suspended and unconfirmed accounts are left out.
  async getExecutors(query: ExecutorsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;

    const conditions = [
      Prisma.sql`u."role" IN ('EXECUTOR', 'BOTH')`,
      Prisma.sql`u."suspendedAt" IS NULL`,
      Prisma.sql`u."emailVerifiedAt" IS NOT NULL`,
      Prisma.sql`cardinality(u."skills") > 0`,
    ];
    if (query.skill) {
      conditions.push(
        Prisma.sql`${query.skill}::"ListingCategory" = ANY(u."skills")`,
      );
    }
    if (query.location) {
      conditions.push(
        Prisma.sql`u."location" = ${query.location}::"ListingLocation"`,
      );
    }
    if (query.q) {
      const pattern = likePattern(query.q);
      conditions.push(
        Prisma.sql`(u."fullName" ILIKE ${pattern} OR u."bio" ILIKE ${pattern})`,
      );
    }
    const where = Prisma.join(conditions, ' AND ');

    const [rows, [{ total }]] = await Promise.all([
      this.prisma.$queryRaw<
        { id: string; average: number | null; count: number | null }[]
      >`
        SELECT u.id, r.average, r.count
        FROM "User" u
        LEFT JOIN (
          SELECT "executorId", AVG(score)::float8 AS average, COUNT(*)::int AS count
          FROM "Rating"
          GROUP BY "executorId"
        ) r ON r."executorId" = u.id
        WHERE ${where}
        ORDER BY r.average DESC NULLS LAST, r.count DESC NULLS LAST,
          u."createdAt" DESC, u.id DESC
        LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      this.prisma.$queryRaw<{ total: number }[]>`
        SELECT COUNT(*)::int AS total FROM "User" u WHERE ${where}`,
    ]);

    const users = await this.prisma.user.findMany({
      where: { id: { in: rows.map((row) => row.id) } },
      select: PROFILE_SELECT,
    });
    const byId = new Map(users.map((user) => [user.id, user]));

    // A user deleted between the two reads is left out.
    const items = rows.flatMap((row) => {
      const user = byId.get(row.id);
      if (!user) return [];
      return [
        {
          id: user.id,
          fullName: user.fullName,
          avatarUrl: avatarUrl(this.storage, user),
          bio: user.bio,
          skills: user.skills,
          location: user.location,
          createdAt: user.createdAt,
          rating: toSummary(row.average, row.count ?? 0),
        },
      ];
    });
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getRatings(userId: string, query: RatingsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where = { executorId: userId };

    const [user, items, total] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      }),
      this.prisma.rating.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: RATING_SELECT,
      }),
      this.prisma.rating.count({ where }),
    ]);

    if (!user) throw new NotFoundException('User not found');
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
