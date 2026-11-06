import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import {
  ApplicationStatus,
  ListingStatus,
  NotificationType,
} from '../generated/prisma/enums.js';
import { avatarUrl } from '../auth/avatar.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { CreateClientRatingDto } from './dto/create-client-rating.dto.js';
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

// The fields of ClientRatingDto.
const CLIENT_RATING_SELECT = {
  id: true,
  score: true,
  comment: true,
  listingId: true,
  listingTitle: true,
  createdAt: true,
  executor: { select: { id: true, fullName: true } },
} satisfies Prisma.ClientRatingSelect;

export type RatingSummary = { average: number | null; count: number };

const NO_RATINGS: RatingSummary = { average: null, count: 0 };

function toSummary(average: number | null, count: number): RatingSummary {
  if (count === 0 || average === null) return NO_RATINGS;
  return { average: Math.round(average * 10) / 10, count };
}

export type UserStats = {
  completedJobs: number;
  responseMinutes: number | null;
};

// A response time needs this many answers, so one quick reply does not
// make it.
const MIN_REPLIES = 3;
const RESPONSE_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

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
    private readonly notifications: NotificationsService,
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
          select: {
            id: true,
            title: true,
            clientId: true,
            status: true,
            client: { select: { fullName: true } },
          },
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

    let rating;
    try {
      rating = await this.prisma.rating.create({
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

    await this.notifications.notify({
      userId: application.executorId,
      type: NotificationType.NEW_RATING,
      listingId: application.listing.id,
      listingTitle: application.listing.title,
      actorName: application.listing.client.fullName,
    });
    return rating;
  }

  // The executor rates the client of a job they did, once it is closed.
  async createForClient(dto: CreateClientRatingDto, executorId: string) {
    const application = await this.prisma.application.findUnique({
      where: { id: dto.applicationId },
      select: {
        id: true,
        status: true,
        executorId: true,
        executor: { select: { fullName: true } },
        clientRating: { select: { id: true } },
        listing: {
          select: { id: true, title: true, clientId: true, status: true },
        },
      },
    });

    if (!application) throw new NotFoundException('Application not found');
    if (application.executorId !== executorId) {
      throw new ForbiddenException('Not your application');
    }
    if (application.status !== ApplicationStatus.ACCEPTED) {
      throw new ConflictException({
        code: 'APPLICATION_NOT_ACCEPTED',
        message:
          'Klijenta možeš ocijeniti samo kad je tvoja prijava prihvaćena.',
      });
    }
    if (application.listing.status !== ListingStatus.CLOSED) {
      throw new ConflictException({
        code: 'LISTING_NOT_CLOSED',
        message: 'Klijenta možeš ocijeniti kad oglas bude zatvoren.',
      });
    }

    const alreadyRated = new ConflictException({
      code: 'ALREADY_RATED',
      message: 'Klijent je za ovaj posao već ocijenjen.',
    });
    if (application.clientRating) throw alreadyRated;

    let rating;
    try {
      rating = await this.prisma.clientRating.create({
        data: {
          applicationId: application.id,
          listingId: application.listing.id,
          listingTitle: application.listing.title,
          clientId: application.listing.clientId,
          executorId,
          score: dto.score,
          comment: dto.comment || null,
        },
        select: CLIENT_RATING_SELECT,
      });
    } catch (error) {
      // A second rating sent at the same time.
      if (isUniqueViolation(error)) throw alreadyRated;
      throw error;
    }

    await this.notifications.notify({
      userId: application.listing.clientId,
      type: NotificationType.NEW_CLIENT_RATING,
      listingId: application.listing.id,
      listingTitle: application.listing.title,
      actorName: application.executor.fullName,
    });
    return rating;
  }

  // How the executors rated several clients, for lists.
  async clientSummaries(clientIds: string[]) {
    const ids = [...new Set(clientIds)];
    const result = new Map<string, RatingSummary>();
    if (ids.length === 0) return result;

    const groups = await this.prisma.clientRating.groupBy({
      by: ['clientId'],
      where: { clientId: { in: ids } },
      _avg: { score: true },
      _count: { _all: true },
    });
    for (const id of ids) result.set(id, NO_RATINGS);
    for (const group of groups) {
      result.set(
        group.clientId,
        toSummary(group._avg.score, group._count._all),
      );
    }
    return result;
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

  // Completed jobs and response times for several users at once.
  async stats(userIds: string[]) {
    const ids = [...new Set(userIds)];
    const result = new Map<string, UserStats>();
    if (ids.length === 0) return result;
    const since = new Date(Date.now() - RESPONSE_WINDOW_MS);

    // A reply is the first message of one side after a run of messages from
    // the other side. It is timed from the first message of that run.
    const [completed, replies] = await Promise.all([
      this.prisma.application.groupBy({
        by: ['executorId'],
        where: {
          executorId: { in: ids },
          status: ApplicationStatus.ACCEPTED,
          listing: { status: ListingStatus.CLOSED },
        },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<
        { userId: string; minutes: number; replies: number }[]
      >`
        WITH messages AS (
          SELECT m.id, m."conversationId", m."senderId", m."createdAt",
            LAG(m."senderId") OVER (
              PARTITION BY m."conversationId" ORDER BY m."createdAt", m.id
            ) AS "previousSender"
          FROM "Message" m
          JOIN "Conversation" c ON c.id = m."conversationId"
          WHERE (c."clientId" = ANY(${ids}) OR c."executorId" = ANY(${ids}))
            AND m."createdAt" >= ${since}
        ),
        runs AS (
          SELECT "senderId", "createdAt",
            LAG("createdAt") OVER (
              PARTITION BY "conversationId" ORDER BY "createdAt", id
            ) AS "previousRunAt"
          FROM messages
          WHERE "previousSender" IS DISTINCT FROM "senderId"
        )
        SELECT "senderId" AS "userId",
          percentile_cont(0.5) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM ("createdAt" - "previousRunAt")) / 60
          )::float8 AS minutes,
          COUNT(*)::int AS replies
        FROM runs
        WHERE "previousRunAt" IS NOT NULL AND "senderId" = ANY(${ids})
        GROUP BY "senderId"`,
    ]);

    for (const id of ids) {
      result.set(id, { completedJobs: 0, responseMinutes: null });
    }
    for (const group of completed) {
      result.get(group.executorId)!.completedJobs = group._count._all;
    }
    for (const row of replies) {
      if (row.replies < MIN_REPLIES) continue;
      result.get(row.userId)!.responseMinutes = Math.max(
        1,
        Math.round(row.minutes),
      );
    }
    return result;
  }

  async getProfile(userId: string) {
    const [user, aggregate, clientSummaries, stats] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: PROFILE_SELECT,
      }),
      this.prisma.rating.aggregate({
        where: { executorId: userId },
        _avg: { score: true },
        _count: { _all: true },
      }),
      this.clientSummaries([userId]),
      this.stats([userId]),
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
      clientRating: clientSummaries.get(userId)!,
      stats: stats.get(userId)!,
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

    const ids = rows.map((row) => row.id);
    const [users, clientSummaries, stats] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: ids } },
        select: PROFILE_SELECT,
      }),
      this.clientSummaries(ids),
      this.stats(ids),
    ]);
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
          clientRating: clientSummaries.get(user.id)!,
          stats: stats.get(user.id)!,
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

  async getClientRatings(userId: string, query: RatingsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where = { clientId: userId };

    const [user, items, total] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      }),
      this.prisma.clientRating.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: CLIENT_RATING_SELECT,
      }),
      this.prisma.clientRating.count({ where }),
    ]);

    if (!user) throw new NotFoundException('User not found');
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
