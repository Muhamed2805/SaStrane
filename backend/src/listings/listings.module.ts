import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module.js';
import { ListingsController } from './listings.controller.js';
import { ListingsService } from './listings.service.js';
import { ListingPhotosController } from './photos/listing-photos.controller.js';
import { ListingPhotosService } from './photos/listing-photos.service.js';

@Module({
  imports: [StorageModule],
  controllers: [ListingsController, ListingPhotosController],
  providers: [ListingsService, ListingPhotosService],
})
export class ListingsModule {}
