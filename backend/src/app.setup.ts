import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { API_PREFIX } from './common/http.constants';
import { isCorsOriginAllowed, parseCorsOrigins } from './config/cors';

// Shared by main.ts and the e2e tests, so the tests exercise the same
// security headers, CORS rules and validation as the running server.
export function configureApp(app: NestExpressApplication) {
  const config = app.get(ConfigService);
  const allowedOrigins = parseCorsOrigins(config.get<string>('CORS_ORIGINS'));
  const isProduction = config.get<string>('NODE_ENV') === 'production';
  const trustProxyHops = config.getOrThrow<number>('TRUST_PROXY_HOPS');

  // Rate limits use the client IP. Behind proxies (the host's load balancer,
  // the frontend's /api proxy), the IP comes from X-Forwarded-For, which is
  // trusted for exactly this many hops.
  if (trustProxyHops > 0) app.set('trust proxy', trustProxyHops);

  app.setGlobalPrefix(API_PREFIX, {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cookieParser());

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
