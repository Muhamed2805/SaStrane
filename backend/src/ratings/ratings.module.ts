import { Module } from '@nestjs/common';
import { RatingsController } from './ratings.controller.js';
import { RatingsService } from './ratings.service.js';
import { UsersController } from './users.controller.js';

@Module({
  controllers: [RatingsController, UsersController],
  providers: [RatingsService],
  exports: [RatingsService],
})
export class RatingsModule {}
