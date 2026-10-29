import { ApiProperty } from '@nestjs/swagger';

export class HealthDto {
  @ApiProperty({ enum: ['ok'] })
  status!: 'ok';

  @ApiProperty({ enum: ['up'] })
  database!: 'up';

  /** The server time as an ISO 8601 string. */
  timestamp!: string;
}

export class HealthUnavailableDto {
  @ApiProperty({ enum: ['error'] })
  status!: 'error';

  @ApiProperty({ enum: ['down'] })
  database!: 'down';
}
