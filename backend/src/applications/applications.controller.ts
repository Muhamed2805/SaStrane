import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApplicationsService } from './applications.service';
import { ApplicationsQueryDto } from './dto/applications-query.dto';
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
  @Get('my/listing-ids')
  getAppliedListingIds(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.applications.getAppliedListingIds(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  getMy(@Query() query: ApplicationsQueryDto, @Req() req: Request) {
    const user = req.user as { id: string };
    return this.applications.getMyApplications(user.id, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('received')
  getReceived(@Query() query: ApplicationsQueryDto, @Req() req: Request) {
    const user = req.user as { id: string };
    return this.applications.getReceivedApplications(user.id, query);
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
