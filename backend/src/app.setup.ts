import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { isCorsOriginAllowed, parseCorsOrigins } from './config/cors';

// Shared by main.ts and the e2e tests, so the tests exercise the same
// security headers, CORS rules and validation as the running server.
export function configureApp(app: NestExpressApplication) {
  const config = app.get(ConfigService);
  const allowedOrigins = parseCorsOrigins(config.get<string>('CORS_ORIGINS'));
  const isProduction = config.get<string>('NODE_ENV') === 'production';

  if (isProduction) app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (isCorsOriginAllowed(origin, allowedOrigins, isProduction)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  return app;
}
