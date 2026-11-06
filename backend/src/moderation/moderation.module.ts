import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ListingsModule } from '../listings/listings.module.js';
import { AdminController } from './admin.controller.js';
import { AdminGuard } from './admin.guard.js';
import { ModerationService } from './moderation.service.js';
import { ReportsController } from './reports.controller.js';

@Module({
  imports: [AuthModule, ListingsModule],
  controllers: [ReportsController, AdminController],
  providers: [ModerationService, AdminGuard],
})
export class ModerationModule {}
