import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;
  const prisma = {
    $queryRaw: jest.fn<() => Promise<unknown>>(),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
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
