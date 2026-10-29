import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { createOpenApiDocument } from './openapi/openapi';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  const config = app.get(ConfigService);

  // Interactive API docs at /api/docs, and the document at /api/docs-json.
  // Not in production, where nobody needs them.
  if (config.get<string>('NODE_ENV') !== 'production') {
    SwaggerModule.setup('docs', app, () => createOpenApiDocument(app), {
      useGlobalPrefix: true,
    });
  }

  // Run onModuleDestroy hooks (for example closing the database pool) when
  // the host stops the process with SIGTERM during a deploy or restart.
  app.enableShutdownHooks();

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port, '0.0.0.0');
}
void bootstrap();
