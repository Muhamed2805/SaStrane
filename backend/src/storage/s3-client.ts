import { S3Client } from '@aws-sdk/client-s3';
import type { validateStorage } from '../config/environment.js';

export type StorageConfig = ReturnType<typeof validateStorage>;

// A key is never written twice: a changed photo gets a new key. Browsers and
// CDNs may therefore keep a file for a year.
export const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

// For the scripts, which run without Nest: storage-init and the seed.
export function createS3Client(storage: StorageConfig) {
  return new S3Client({
    endpoint: storage.S3_ENDPOINT,
    region: storage.S3_REGION,
    forcePathStyle: storage.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: storage.S3_ACCESS_KEY_ID,
      secretAccessKey: storage.S3_SECRET_ACCESS_KEY,
    },
    maxAttempts: 2,
  });
}
