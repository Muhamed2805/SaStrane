import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListingsQueryDto } from './dto/listings-query.dto';
import { UpdateListingDto } from './dto/update-listing.dto';

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
        select: {
          id: true,
          title: true,
          category: true,
          location: true,
          budget: true,
          createdAt: true,
          client: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      }),
      this.prisma.listing.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        category: true,
        location: true,
        budget: true,
        description: true,
        createdAt: true,
        client: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
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
      select: {
        id: true,
        title: true,
        category: true,
        location: true,
        budget: true,
        description: true,
        createdAt: true,
      },
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
      select: {
        id: true,
        title: true,
        category: true,
        location: true,
        budget: true,
        description: true,
        createdAt: true,
        client: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
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

    return this.prisma.listing.delete({ where: { id } });
  }
}
