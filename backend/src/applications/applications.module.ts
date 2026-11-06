import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { RatingsModule } from '../ratings/ratings.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { ApplicationsController } from './applications.controller.js';
import { ApplicationsService } from './applications.service.js';

@Module({
  imports: [EmailModule, NotificationsModule, RatingsModule, StorageModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
})
export class ApplicationsModule {}
