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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ApiErrors,
  COMMON_ERRORS,
  SIGNED_IN_ERRORS,
} from '../openapi/api-errors.decorator';
import { ApplicationsService } from './applications.service';
import {
  ApplicationDto,
  ListingApplicationDto,
  MyApplicationsPageDto,
  ReceivedApplicationsPageDto,
} from './dto/application-response.dto';
import { ApplicationsQueryDto } from './dto/applications-query.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';

@ApiTags('applications')
@ApiBearerAuth()
@ApiErrors({ ...COMMON_ERRORS, ...SIGNED_IN_ERRORS })
@UseGuards(JwtAuthGuard)
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  /** Applies to a job as the signed-in user. */
  @ApiErrors({
    400: 'A field is missing or invalid.',
    403: "The job is the user's own.",
    404: 'The job does not exist.',
    409: 'The user has already applied to this job.',
  })
  @Post()
  create(
    @Body() dto: CreateApplicationDto,
    @Req() req: Request,
  ): Promise<ApplicationDto> {
    const user = req.user as { id: string };
    return this.applications.create(dto, user.id);
  }

  /** Lists the IDs of all jobs the user has applied to. */
  @Get('my/listing-ids')
  getAppliedListingIds(@Req() req: Request): Promise<string[]> {
    const user = req.user as { id: string };
    return this.applications.getAppliedListingIds(user.id);
  }

  /** Lists the applications the user has sent. */
  @ApiErrors({ 400: 'A query parameter is invalid.' })
  @Get('my')
  getMy(
    @Query() query: ApplicationsQueryDto,
    @Req() req: Request,
  ): Promise<MyApplicationsPageDto> {
    const user = req.user as { id: string };
    return this.applications.getMyApplications(user.id, query);
  }

  /** Lists the applications to all of the user's jobs. */
  @ApiErrors({ 400: 'A query parameter is invalid.' })
  @Get('received')
  getReceived(
    @Query() query: ApplicationsQueryDto,
    @Req() req: Request,
  ): Promise<ReceivedApplicationsPageDto> {
    const user = req.user as { id: string };
    return this.applications.getReceivedApplications(user.id, query);
  }

  /** Lists the applications to one of the user's jobs, newest first. */
  @ApiErrors({
    403: 'The job belongs to another user.',
    404: 'The job does not exist.',
  })
  @Get('listing/:listingId')
  getForListing(
    @Param('listingId') listingId: string,
    @Req() req: Request,
  ): Promise<ListingApplicationDto[]> {
    const user = req.user as { id: string };
    return this.applications.getForListing(listingId, user.id);
  }

  /** Accepts or rejects an application to one of the user's jobs. */
  @ApiErrors({
    400: 'The status is not ACCEPTED or REJECTED.',
    403: "The application is for another user's job.",
    404: 'The application does not exist.',
  })
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto,
    @Req() req: Request,
  ): Promise<ListingApplicationDto> {
    const user = req.user as { id: string };
    return this.applications.updateStatus(id, dto, user.id);
  }
}
