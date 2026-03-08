import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { EmailService } from '../src/email/email.service';
import { EmailProcessor } from '../src/email/email.processor';
import { EmailController } from '../src/email/email.controller';
import { TasksService } from '../src/tasks/tasks.service';

// Mock Bull Queue
const mockQueue = {
  add: jest.fn().mockResolvedValue({ id: 'test-job-1' }),
  getWaitingCount: jest.fn().mockResolvedValue(0),
  getActiveCount: jest.fn().mockResolvedValue(0),
  getCompletedCount: jest.fn().mockResolvedValue(5),
  getFailedCount: jest.fn().mockResolvedValue(1),
};

describe('Queues (e2e)', () => {
  let app: INestApplication;
  let emailService: EmailService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [EmailController],
      providers: [
        {
          provide: EmailService,
          useFactory: () => {
            const service = new EmailService();
            // Inject mock queue
            (service as any).emailQueue = mockQueue;
            return service;
          },
        },
        EmailProcessor,
        TasksService,
      ],
    })
      .overrideProvider(EmailProcessor)
      .useValue({
        handleSendEmail: jest.fn(),
        handleWelcomeEmail: jest.fn(),
        onActive: jest.fn(),
        onCompleted: jest.fn(),
        onFailed: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    emailService = moduleFixture.get<EmailService>(EmailService);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  describe('EmailService', () => {
    it('should add a job to the queue when sending email', async () => {
      const result = await emailService.sendEmail({
        to: 'user@test.com',
        subject: 'Test',
        body: 'Hello',
      });

      expect(mockQueue.add).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.jobId).toBe('test-job-1');
      expect(result.status).toBe('queued');
    });

    it('should add a welcome job to the queue', async () => {
      const result = await emailService.sendWelcomeEmail('user@test.com', 'John');

      expect(mockQueue.add).toHaveBeenCalledWith(
        'welcome',
        expect.objectContaining({ to: 'user@test.com', username: 'John' }),
        expect.any(Object),
      );
      expect(result).toBeDefined();
    });

    it('should return queue status', async () => {
      const status = await emailService.getQueueStatus();

      expect(status).toBeDefined();
      expect(status.waiting).toBe(0);
      expect(status.active).toBe(0);
      expect(status.completed).toBe(5);
      expect(status.failed).toBe(1);
    });
  });

  describe('EmailController', () => {
    it('POST /email/send should queue an email', async () => {
      const response = await request(app.getHttpServer())
        .post('/email/send')
        .send({
          to: 'user@test.com',
          subject: 'Test Subject',
          body: 'Test Body',
        })
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.status).toBe('queued');
    });

    it('GET /email/status should return queue stats', async () => {
      const response = await request(app.getHttpServer())
        .get('/email/status')
        .expect(200);

      expect(response.body).toBeDefined();
      expect(typeof response.body.waiting).toBe('number');
      expect(typeof response.body.failed).toBe('number');
    });
  });

  describe('EmailProcessor', () => {
    it('should process email jobs', async () => {
      const processor = new EmailProcessor();
      const mockJob = {
        id: '1',
        data: { to: 'user@test.com', subject: 'Test', body: 'Hello' },
        name: 'default',
      };

      const result = await processor.handleSendEmail(mockJob as any);
      expect(result).toBeDefined();
      expect(result.sent).toBe(true);
      expect(result.to).toBe('user@test.com');
    });

    it('should process welcome email jobs', async () => {
      const processor = new EmailProcessor();
      const mockJob = {
        id: '2',
        data: { to: 'user@test.com', username: 'John' },
        name: 'welcome',
      };

      const result = await processor.handleWelcomeEmail(mockJob as any);
      expect(result).toBeDefined();
      expect(result.sent).toBe(true);
    });
  });

  describe('TasksService', () => {
    it('should have a cleanup cron handler', () => {
      const tasksService = new TasksService();
      expect(tasksService.handleCleanup).toBeDefined();
    });

    it('should have a health check interval handler', () => {
      const tasksService = new TasksService();
      expect(tasksService.handleHealthCheck).toBeDefined();
    });
  });
});
