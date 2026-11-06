import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { JobAlertsController } from './job-alerts.controller.js';
import { JobAlertsService } from './job-alerts.service.js';

@Module({
  imports: [EmailModule, NotificationsModule],
  controllers: [JobAlertsController],
  providers: [JobAlertsService],
  exports: [JobAlertsService],
})
export class JobAlertsModule {}
