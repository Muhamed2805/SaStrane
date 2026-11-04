// Creates the photos bucket when it is missing: `npm run storage:init`.
// Locally the SeaweedFS container from docker-compose.yml already lets
// anyone read it. For a hosted bucket, also turn on public read access in
// the provider's settings, and set S3_PUBLIC_URL to its public address.
import { existsSync } from 'node:fs';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { validateStorage } from '../src/config/environment.js';

// Values already in the environment win over .env.
if (existsSync('.env')) process.loadEnvFile('.env');

const storage = validateStorage(
  process.env,
  process.env.NODE_ENV === 'production',
);
const client = new S3Client({
  endpoint: storage.S3_ENDPOINT,
  region: storage.S3_REGION,
  forcePathStyle: storage.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: storage.S3_ACCESS_KEY_ID,
    secretAccessKey: storage.S3_SECRET_ACCESS_KEY,
  },
});
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
