import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module.js';
import { JobAlertsModule } from '../job-alerts/job-alerts.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { ListingExpiryService } from './listing-expiry.service.js';
import { ListingsController } from './listings.controller.js';
import { ListingsService } from './listings.service.js';
import { ListingPhotosController } from './photos/listing-photos.controller.js';
import { ListingPhotosService } from './photos/listing-photos.service.js';
import { SavedListingsController } from './saved-listings.controller.js';

@Module({
  imports: [EmailModule, JobAlertsModule, NotificationsModule, StorageModule],
  controllers: [
    ListingsController,
    ListingPhotosController,
    SavedListingsController,
  ],
  providers: [ListingsService, ListingPhotosService, ListingExpiryService],
  exports: [ListingsService],
})
export class ListingsModule {}
