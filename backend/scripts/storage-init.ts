// Creates the photos bucket when it is missing: `npm run storage:init`.
// Locally the SeaweedFS container from docker-compose.yml already lets
// anyone read it. For a hosted bucket, also turn on public read access in
// the provider's settings, and set S3_PUBLIC_URL to its public address.
import { existsSync } from 'node:fs';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { validateStorage } from '../src/config/environment.js';
import { createS3Client } from '../src/storage/s3-client.js';

// Values already in the environment win over .env.
if (existsSync('.env')) process.loadEnvFile('.env');

const storage = validateStorage(
  process.env,
  process.env.NODE_ENV === 'production',
);
const client = createS3Client(storage);
const Bucket = storage.S3_BUCKET;

try {
  await client.send(new HeadBucketCommand({ Bucket }));
  console.log(`The bucket ${Bucket} exists.`);
} catch (error) {
  if (
    !(error instanceof S3ServiceException) ||
    error.$metadata.httpStatusCode !== 404
  ) {
    throw error;
  }
  await client.send(new CreateBucketCommand({ Bucket }));
  console.log(`Created the bucket ${Bucket}.`);
} finally {
  client.destroy();
}
