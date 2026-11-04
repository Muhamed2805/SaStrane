import {
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageService } from './storage.service.js';

describe('StorageService', () => {
  const config = new ConfigService({
    S3_ENDPOINT: 'http://localhost:8333',
    S3_REGION: 'us-east-1',
    S3_BUCKET: 'photos',
    S3_ACCESS_KEY_ID: 'key',
    S3_SECRET_ACCESS_KEY: 'secret',
    S3_FORCE_PATH_STYLE: true,
    S3_PUBLIC_URL: 'https://cdn.example/photos',
  });
  const send = vi.fn<(command: unknown) => Promise<unknown>>();
  let service: StorageService;

  beforeEach(() => {
    send.mockReset();
    vi.spyOn(S3Client.prototype, 'send').mockImplementation(send as never);
    service = new StorageService(config);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds public URLs from S3_PUBLIC_URL', () => {
    expect(service.url('listings/a/b.webp')).toBe(
      'https://cdn.example/photos/listings/a/b.webp',
    );
  });

  it('stores a file with a long cache lifetime', async () => {
    send.mockResolvedValue({});

    await service.put('listings/a/b.webp', Buffer.from('x'), 'image/webp');

    const command = send.mock.calls[0][0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: 'photos',
      Key: 'listings/a/b.webp',
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    });
  });

  it('answers 503 when the storage is down', async () => {
    send.mockRejectedValue(new Error('connect ECONNREFUSED'));

    await expect(
      service.put('listings/a/b.webp', Buffer.from('x'), 'image/webp'),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('deletes files in one request and never throws', async () => {
    send.mockResolvedValueOnce({});
    await service.delete(['a.webp', 'a-thumb.webp']);

    const command = send.mock.calls[0][0] as DeleteObjectsCommand;
    expect(command).toBeInstanceOf(DeleteObjectsCommand);
    expect(command.input.Delete?.Objects).toEqual([
      { Key: 'a.webp' },
      { Key: 'a-thumb.webp' },
    ]);

    send.mockRejectedValueOnce(new Error('down'));
    await expect(service.delete(['a.webp'])).resolves.toBeUndefined();
  });

  it('sends nothing for an empty list', async () => {
    await service.delete([]);
    expect(send).not.toHaveBeenCalled();
  });
});
