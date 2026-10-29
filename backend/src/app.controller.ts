import { Controller, Get } from '@nestjs/common';
import { ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { AppService } from './app.service';
import { HealthDto, HealthUnavailableDto } from './health.dto';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** Checks that the API runs and the database answers. */
  @ApiServiceUnavailableResponse({
    description: 'The database does not answer.',
    type: HealthUnavailableDto,
  })
  @SkipThrottle()
  @Get('health')
  getHealth(): Promise<HealthDto> {
    return this.appService.getHealth();
  }
}
