import { Global, Module } from '@nestjs/common';
import { LiveController } from './live.controller.js';
import { LiveService } from './live.service.js';

// Global, like PrismaModule: any service that changes what a user sees can
// tell that user's open tabs.
@Global()
@Module({
  controllers: [LiveController],
  providers: [LiveService],
  exports: [LiveService],
})
export class LiveModule {}
