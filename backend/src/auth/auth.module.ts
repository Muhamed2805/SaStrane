import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { PassportModule } from '@nestjs/passport';

import { EmailModule } from '../email/email.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { AccountController } from './account.controller.js';
import { AccountService } from './account.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JWT_ALGORITHM } from './jwt.constants.js';
import { SessionsService } from './sessions.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';

@Module({
  imports: [
    PrismaModule,
    EmailModule,
    StorageModule,
    PassportModule,
    // registerAsync reads the validated configuration after ConfigModule has
    // loaded .env, instead of reading process.env while this file is imported.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          algorithm: JWT_ALGORITHM,
          expiresIn: config.getOrThrow<StringValue>('JWT_EXPIRES_IN'),
        },
      }),
    }),
  ],
  controllers: [AuthController, AccountController],
  providers: [AuthService, AccountService, SessionsService, JwtStrategy],
  exports: [SessionsService],
})
export class AuthModule {}
