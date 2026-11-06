import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { avatarUrl } from '../auth/avatar.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { CreateListingDto } from './dto/create-listing.dto.js';
import { ListingsQueryDto } from './dto/listings-query.dto.js';
import { SavedListingsQueryDto } from './dto/saved-listings-query.dto.js';
import { UpdateListingDto } from './dto/update-listing.dto.js';
import { UpdateListingStatusDto } from './dto/update-listing-status.dto.js';
import { PHOTO_ORDER } from './photos/listing-photos.service.js';
import { allPhotoKeys, toPhotoDto } from './photos/photo-keys.js';

const PHOTO_FIELDS = { id: true, width: true, height: true } as const;

// The fields of ListingSummaryDto and ListingDto. The photos become URLs in
// toSummary and toListing.
const LISTING_SUMMARY_SELECT = {
  id: true,
  title: true,
  category: true,
  location: true,
  status: true,
  budget: true,
  createdAt: true,
  client: { select: { id: true, fullName: true, avatarId: true } },
  photos: { select: PHOTO_FIELDS, orderBy: PHOTO_ORDER, take: 1 },
} satisfies Prisma.ListingSelect;

const LISTING_SELECT = {
  ...LISTING_SUMMARY_SELECT,
  description: true,
  photos: { select: PHOTO_FIELDS, orderBy: PHOTO_ORDER },
} satisfies Prisma.ListingSelect;

type SummaryRow = Prisma.ListingGetPayload<{
  select: typeof LISTING_SUMMARY_SELECT;
}>;
type ListingRow = Prisma.ListingGetPayload<{ select: typeof LISTING_SELECT }>;

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private toSummary({ photos, client, ...listing }: SummaryRow) {
    const cover = photos.at(0);
    return {
      ...listing,
      client: {
        id: client.id,
        fullName: client.fullName,
        avatarUrl: avatarUrl(this.storage, client),
      },
      coverPhoto: cover ? toPhotoDto(this.storage, listing.id, cover) : null,
    };
  }

  private toListing(listing: ListingRow) {
    const photos = listing.photos.map((photo) =>
      toPhotoDto(this.storage, listing.id, photo),
    );
    return {
      ...this.toSummary(listing),
      description: listing.description,
      photos,
    };
  }

  async getAll(query: ListingsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.ListingWhereInput = {
      ...(query.clientId && { clientId: query.clientId }),
      ...(query.category && { category: query.category }),
      ...(query.location && { location: query.location }),
      ...(query.status && { status: query.status }),
      ...(query.q && {
        OR: [
          { title: { contains: query.q, mode: 'insensitive' } },
          { description: { contains: query.q, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: LISTING_SUMMARY_SELECT,
      }),
      this.prisma.listing.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toSummary(item)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getById(id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      select: LISTING_SELECT,
    });

    if (!listing) throw new NotFoundException('Listing not found');

    return this.toListing(listing);
  }

  async create(dto: CreateListingDto, clientId: string) {
    const listing = await this.prisma.listing.create({
      data: {
        ...dto,
        clientId,
      },
      select: LISTING_SELECT,
    });
    return this.toListing(listing);
  }

  async update(id: string, dto: UpdateListingDto, userId: string) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('At least one field must be provided');
    }

    await this.assertOwner(id, userId);

    const listing = await this.prisma.listing.update({
      where: { id },
      data: dto,
      select: LISTING_SELECT,
    });
    return this.toListing(listing);
  }

  // Closing a job stops new applications. The client can still decide on
  // the ones already sent.
  async updateStatus(id: string, dto: UpdateListingStatusDto, userId: string) {
    await this.assertOwner(id, userId);

    const listing = await this.prisma.listing.update({
      where: { id },
      data: { status: dto.status },
      select: LISTING_SELECT,
    });
    return this.toListing(listing);
  }

  // The photo rows go with the job. Their files are deleted after it.
  async delete(id: string, userId: string) {
    await this.assertOwner(id, userId);

    const photos = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.listingPhoto.findMany({
        where: { listingId: id },
        select: { id: true },
      });
      await tx.listing.delete({ where: { id } });
      return rows;
    });
    await this.storage.delete(
      allPhotoKeys(
        id,
        photos.map((photo) => photo.id),
      ),
    );
  }

  async getSaved(userId: string, query: SavedListingsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where = { userId };

    const [rows, total] = await Promise.all([
      this.prisma.savedListing.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { listingId: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: { listing: { select: LISTING_SUMMARY_SELECT } },
      }),
      this.prisma.savedListing.count({ where }),
    ]);

    return {
      items: rows.map((row) => this.toSummary(row.listing)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getSavedIds(userId: string) {
    const rows = await this.prisma.savedListing.findMany({
      where: { userId },
      select: { listingId: true },
    });
    return rows.map((row) => row.listingId);
  }

  // Saving twice keeps the first save, so the list order stays the same.
  async save(listingId: string, userId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { clientId: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.clientId === userId) {
      throw new ForbiddenException('You cannot save your own listing');
    }

    await this.prisma.savedListing.createMany({
      data: [{ userId, listingId }],
      skipDuplicates: true,
    });
  }

  async unsave(listingId: string, userId: string) {
    await this.prisma.savedListing.deleteMany({ where: { userId, listingId } });
  }

  private async assertOwner(id: string, userId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      select: { clientId: true },
    });

    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.clientId !== userId) {
      throw new ForbiddenException('Not your listing');
    }
  }
}
