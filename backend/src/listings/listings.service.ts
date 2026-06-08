import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListingDto } from './dto/create-listing.dto';

@Injectable()
export class ListingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll() {
    return this.prisma.listing.findMany({
      orderBy: { createdAt: 'desc' },
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
    });
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

  async delete(id: string, userId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      select: { clientId: true },
    });

    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.clientId !== userId) throw new ForbiddenException('Not your listing');

    return this.prisma.listing.delete({ where: { id } });
  }
}