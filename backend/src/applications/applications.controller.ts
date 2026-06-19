import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateApplicationDto, @Req() req: Request) {
    const user = req.user as { id: string };
    return this.applications.create(dto, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  getMy(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.applications.getMyApplications(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('listing/:listingId')
  getForListing(@Param('listingId') listingId: string, @Req() req: Request) {
    const user = req.user as { id: string };
    return this.applications.getForListing(listingId, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.applications.updateStatus(id, dto, user.id);
  }
}
