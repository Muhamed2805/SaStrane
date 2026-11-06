import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module.js';
import { ConversationsController } from './conversations.controller.js';
import { ConversationsService } from './conversations.service.js';
import { MessageEmailsService } from './message-emails.service.js';

@Module({
  imports: [EmailModule],
  controllers: [ConversationsController],
  providers: [ConversationsService, MessageEmailsService],
})
export class ConversationsModule {}
