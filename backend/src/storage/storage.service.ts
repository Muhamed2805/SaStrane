import {
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IMMUTABLE_CACHE } from './s3-client.js';

// Files in an S3-compatible bucket whose objects anyone can read at
// S3_PUBLIC_URL. Locally that is the SeaweedFS container.
@Injectable()
export class StorageService implements OnModuleDestroy {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow<string>('S3_BUCKET');
    this.publicUrl = config.getOrThrow<string>('S3_PUBLIC_URL');
    this.client = new S3Client({
      endpoint: config.get<string>('S3_ENDPOINT'),
      region: config.getOrThrow<string>('S3_REGION'),
      forcePathStyle: config.getOrThrow<boolean>('S3_FORCE_PATH_STYLE'),
      credentials: {
        accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow<string>('S3_SECRET_ACCESS_KEY'),
      },
      maxAttempts: 2,
    });
  }

  onModuleDestroy() {
    this.client.destroy();
  }

  url(key: string) {
    return `${this.publicUrl}/${key}`;
  }

  async put(key: string, body: Buffer, contentType: string) {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: IMMUTABLE_CACHE,
        }),
      );
    } catch (error) {
      this.logger.error(`Could not store ${key}`, error as Error);
      throw new ServiceUnavailableException(
        'Slike se trenutno ne mogu sačuvati. Pokušaj ponovo malo kasnije.',
      );
    }
  }

  // Best effort: a file that stays behind costs only storage, so a failure
  // is logged and never fails the request that deleted the photo.
  async delete(keys: string[]) {
    if (keys.length === 0) return;
    try {
      const result = await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
        }),
      );
      for (const error of result.Errors ?? []) {
        this.logger.warn(`Could not delete ${error.Key}: ${error.Message}`);
      }
    } catch (error) {
      this.logger.warn(
        `Could not delete ${keys.length} files: ${(error as Error).message}`,
      );
    }
  }
}
