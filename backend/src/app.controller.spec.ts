import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaService } from './prisma/prisma.service.js';

describe('AppController', () => {
  let appController: AppController;
  const prisma = {
    $queryRaw: vi.fn<() => Promise<unknown>>(),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('reports a healthy database connection', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      await expect(appController.getHealth()).resolves.toEqual({
        status: 'ok',
        database: 'up',
        timestamp: expect.any(String) as unknown,
      });
    });

    it('returns an unavailable error when the database is down', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('database unavailable'));

      await expect(appController.getHealth()).rejects.toMatchObject({
        status: 503,
      });
    });
  });
});
