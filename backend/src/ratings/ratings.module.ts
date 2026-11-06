import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { StorageModule } from '../storage/storage.module.js';
import {
  ClientRatingsController,
  RatingsController,
} from './ratings.controller.js';
import { RatingsService } from './ratings.service.js';
import { UsersController } from './users.controller.js';

@Module({
  imports: [NotificationsModule, StorageModule],
  controllers: [RatingsController, ClientRatingsController, UsersController],
  providers: [RatingsService],
  exports: [RatingsService],
})
export class RatingsModule {}
