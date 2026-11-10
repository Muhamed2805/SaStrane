import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ApplicationsModule } from './applications/applications.module.js';
import { ConversationsModule } from './conversations/conversations.module.js';
import { RatingsModule } from './ratings/ratings.module.js';
import { ListingsModule } from './listings/listings.module.js';
import { ModerationModule } from './moderation/moderation.module.js';
import { InvitationsModule } from './invitations/invitations.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { JobAlertsModule } from './job-alerts/job-alerts.module.js';
import { PortfolioModule } from './portfolio/portfolio.module.js';
import { validateEnvironment } from './config/environment.js';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),
    PrismaModule,
    AuthModule,
    ListingsModule,
    ApplicationsModule,
    ConversationsModule,
    RatingsModule,
    ModerationModule,
    InvitationsModule,
    NotificationsModule,
    JobAlertsModule,
    PortfolioModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule {}
