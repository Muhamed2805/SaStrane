import { ApiProperty } from '@nestjs/swagger';
import { PageDto } from '../../common/dto/page.dto.js';
import {
  ListingCategory,
  ListingLocation,
} from '../../generated/prisma/enums.js';

export const INVITATION_OPTION_STATES = [
  'AVAILABLE',
  'INVITED',
  'APPLIED',
] as const;
export type InvitationOptionState = (typeof INVITATION_OPTION_STATES)[number];

export class InvitationDto {
  id!: string;

  listingId!: string;

  executorId!: string;

  createdAt!: Date;
}

// The job an invitation is for.
export class InvitationListingDto {
  id!: string;

  title!: string;

  @ApiProperty({ enum: ListingCategory, enumName: 'ListingCategory' })
  category!: ListingCategory;

  @ApiProperty({ enum: ListingLocation, enumName: 'ListingLocation' })
  location!: ListingLocation;

  /** In whole KM. Null means the price is agreed later. */
  budget!: number | null;
}

// The client who sent the invitation.
export class InvitationClientDto {
  id!: string;

  fullName!: string;

  /** A square WebP image of 256 pixels. Null without a profile photo. */
  avatarUrl!: string | null;
}

// An invitation as the invited user sees it.
export class ReceivedInvitationDto {
  id!: string;

  /** True once the user has applied to the job. */
  applied!: boolean;

  listing!: InvitationListingDto;

  client!: InvitationClientDto;

  createdAt!: Date;
}

// Newest first. Only invitations to open jobs.
export class ReceivedInvitationsPageDto extends PageDto {
  items!: ReceivedInvitationDto[];
}

// One of the client's open jobs, and whether the user can be invited to it.
export class InvitationOptionDto {
  listingId!: string;

  title!: string;

  @ApiProperty({ enum: ListingCategory, enumName: 'ListingCategory' })
  category!: ListingCategory;

  @ApiProperty({ enum: ListingLocation, enumName: 'ListingLocation' })
  location!: ListingLocation;

  /**
   * AVAILABLE: the user can be invited. INVITED: the user already has an
   * invitation. APPLIED: the user already applied.
   */
  @ApiProperty({
    enum: INVITATION_OPTION_STATES,
    enumName: 'InvitationOptionState',
  })
  state!: InvitationOptionState;
}
