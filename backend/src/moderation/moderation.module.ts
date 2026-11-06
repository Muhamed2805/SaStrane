import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ListingsModule } from '../listings/listings.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { AdminController } from './admin.controller.js';
import { AdminGuard } from './admin.guard.js';
import { AdminService } from './admin.service.js';
import { ModerationService } from './moderation.service.js';
import { ReportsController } from './reports.controller.js';

@Module({
  imports: [AuthModule, ListingsModule, StorageModule],
  controllers: [ReportsController, AdminController],
  providers: [ModerationService, AdminService, AdminGuard],
})
export class ModerationModule {}
