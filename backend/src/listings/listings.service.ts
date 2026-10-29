import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListingsQueryDto } from './dto/listings-query.dto';
import { UpdateListingDto } from './dto/update-listing.dto';

// The fields of ListingSummaryDto and ListingDto.
const LISTING_SUMMARY_SELECT = {
  id: true,
  title: true,
  category: true,
  location: true,
  budget: true,
  createdAt: true,
  client: { select: { id: true, fullName: true } },
} satisfies Prisma.ListingSelect;

const LISTING_SELECT = {
  ...LISTING_SUMMARY_SELECT,
  description: true,
} satisfies Prisma.ListingSelect;

@Injectable()
export class ListingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(query: ListingsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.ListingWhereInput = {
      ...(query.clientId && { clientId: query.clientId }),
      ...(query.category && { category: query.category }),
      ...(query.location && { location: query.location }),
      ...(query.q && {
        OR: [
          { title: { contains: query.q, mode: 'insensitive' } },
          { description: { contains: query.q, mode: 'insensitive' } },
          { category: { contains: query.q, mode: 'insensitive' } },
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

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      select: LISTING_SELECT,
    });

    if (!listing) throw new NotFoundException('Listing not found');

    return listing;
  }

  async create(dto: CreateListingDto, clientId: string) {
    return this.prisma.listing.create({
      data: {
        ...dto,
        clientId,
      },
      select: LISTING_SELECT,
    });
  }

  async update(id: string, dto: UpdateListingDto, userId: string) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('At least one field must be provided');
    }

    const listing = await this.prisma.listing.findUnique({
      where: { id },
      select: { clientId: true },
    });

    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.clientId !== userId) {
      throw new ForbiddenException('Not your listing');
    }

    return this.prisma.listing.update({
      where: { id },
      data: dto,
      select: LISTING_SELECT,
    });
  }

  async delete(id: string, userId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      select: { clientId: true },
    });

    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.clientId !== userId)
      throw new ForbiddenException('Not your listing');

    await this.prisma.listing.delete({ where: { id } });
  }
}
