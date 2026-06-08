import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListingsService } from './listings.service';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Get()
  getAll() {
    return this.listings.getAll();
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.listings.getById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateListingDto, @Req() req: Request) {
    const user = req.user as { id: string };
    return this.listings.create(dto, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as { id: string };
    return this.listings.delete(id, user.id);
  }
}