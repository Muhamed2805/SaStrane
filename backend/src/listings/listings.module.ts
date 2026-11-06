import { Module } from '@nestjs/common';
import { JobAlertsModule } from '../job-alerts/job-alerts.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { ListingsController } from './listings.controller.js';
import { ListingsService } from './listings.service.js';
import { ListingPhotosController } from './photos/listing-photos.controller.js';
import { ListingPhotosService } from './photos/listing-photos.service.js';
import { SavedListingsController } from './saved-listings.controller.js';

@Module({
  imports: [JobAlertsModule, StorageModule],
  controllers: [
    ListingsController,
    ListingPhotosController,
    SavedListingsController,
  ],
  providers: [ListingsService, ListingPhotosService],
  exports: [ListingsService],
})
export class ListingsModule {}
