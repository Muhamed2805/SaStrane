import { PageDto } from '../../common/dto/page.dto';

// The user who posted the job.
export class ListingClientDto {
  id!: string;

  fullName!: string;
}

// A job as lists show it, without the description.
export class ListingSummaryDto {
  id!: string;

  title!: string;

  category!: string;

  location!: string;

  /** Free text, such as "50 KM". */
  budget!: string | null;

  createdAt!: Date;

  client!: ListingClientDto;
}

export class ListingDto extends ListingSummaryDto {
  description!: string | null;
}

// Newest first.
export class ListingsPageDto extends PageDto {
  items!: ListingSummaryDto[];
}
