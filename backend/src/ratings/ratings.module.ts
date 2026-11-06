import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module.js';
import { RatingsController } from './ratings.controller.js';
import { RatingsService } from './ratings.service.js';
import { UsersController } from './users.controller.js';

@Module({
  imports: [StorageModule],
  controllers: [RatingsController, UsersController],
  providers: [RatingsService],
  exports: [RatingsService],
})
export class RatingsModule {}
