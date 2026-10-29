// Writes openapi.json, the contract the frontend generates its API types
// from. Run it with `npm run openapi`, which builds the app first.
//
// The placeholder environment must load before AppModule, which validates
// the environment when it is imported.
import './placeholder-environment';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../app.module';
import { configureApp } from '../app.setup';
import { createOpenApiDocument } from './openapi';

const OUTPUT_PATH = join(__dirname, '..', '..', 'openapi.json');

async function main() {
  // The app is created but not started, so it never connects to the
  // database.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn'],
  });
  configureApp(app);

  const document = createOpenApiDocument(app);
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();

  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
