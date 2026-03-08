import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { LoggerService } from '../src/logger/logger.service';
import { ConfigService } from '../src/config/config.service';

describe('Providers & DI (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('ConfigService', () => {
    it('should provide config values via factory', () => {
      const configService = app.get(ConfigService);
      expect(configService.get('greeting.prefix')).toBe('Hello');
      expect(configService.get('app.name')).toBe('NestJS Lab 11');
    });

    it('should return undefined for missing keys', () => {
      const configService = app.get(ConfigService);
      expect(configService.get('non.existent')).toBeUndefined();
    });
  });

  describe('LoggerService', () => {
    it('should be injectable and log messages', () => {
      const loggerService = app.get(LoggerService);
      loggerService.log('test message');
      expect(loggerService.logs).toContain('[LOG] test message');
    });

    it('should handle warn level', () => {
      const loggerService = app.get(LoggerService);
      loggerService.warn('warning message');
      expect(loggerService.logs).toContain('[WARN] warning message');
    });

    it('should handle error level', () => {
      const loggerService = app.get(LoggerService);
      loggerService.error('error message');
      expect(loggerService.logs).toContain('[ERROR] error message');
    });
  });

  describe('GreetingController', () => {
    it('GET /greeting/:name — should return greeting with config prefix', async () => {
      const res = await request(app.getHttpServer())
        .get('/greeting/World')
        .expect(200);

      expect(res.body).toEqual({ message: 'Hello, World!' });
    });

    it('GET /greeting/:name — should work with different names', async () => {
      const res = await request(app.getHttpServer())
        .get('/greeting/NestJS')
        .expect(200);

      expect(res.body).toEqual({ message: 'Hello, NestJS!' });
    });

    it('should log the greeting', async () => {
      const loggerService = app.get(LoggerService);
      const logsBefore = loggerService.logs.length;

      await request(app.getHttpServer())
        .get('/greeting/TestUser')
        .expect(200);

      expect(loggerService.logs.length).toBeGreaterThan(logsBefore);
    });
  });
});
