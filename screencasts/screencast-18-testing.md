# Screencast 18 — Testing NestJS

## Informations
- **Duree estimee** : 18-22 min
- **Module** : `modules/18-nestjs-testing.md`
- **Lab associe** : `labs/lab-18-testing/`
- **Prérequis** : Screencast 17 (Prisma Avance & Comparaison)

## Setup
- [ ] Node.js 20+ installe
- [ ] Terminal ouvert dans `nest-course/`
- [ ] Projet NestJS avec services et controllers fonctionnels
- [ ] Editeur de code ouvert
- [ ] Jest déjà installe (fourni par NestJS)

## Script

### [00:00-03:00] Introduction — Pourquoi tester ?

> Salut ! Aujourd'hui, on va apprendre à tester une application NestJS. Les tests, c'est votre filet de sécurité. Ils vous permettent de modifier le code en toute confiance, de détecter les regressions, et de documenter le comportement attendu.

**Action** : Afficher le slide de titre "Module 18 — Testing NestJS".

> NestJS est livre avec Jest, un framework de test complet. On a deux types de tests : les tests unitaires (qui testent une classe isolee) et les tests end-to-end (qui testent l'API de bout en bout).

**Action** : Vérifier que les tests existants passent.

```bash
npm run test
```

### [03:00-09:00] Tests unitaires — Tester un service avec des mocks

> Un test unitaire isole une classe de ses dépendances. On remplace les dépendances reelles par des mocks.

**Action** : Écrire un test unitaire pour le TasksService.

```typescript
// src/tasks/tasks.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('TasksService', () => {
  let service: TasksService;
  let prisma: PrismaService;

  const mockPrisma = {
    task: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('doit creer une tache', async () => {
      const dto = { title: 'Test', description: 'Description' };
      const expected = { id: 1, ...dto, done: false, createdAt: new Date() };

      mockPrisma.task.create.mockResolvedValue(expected);

      const result = await service.create(dto as any);

      expect(result).toEqual(expected);
      expect(mockPrisma.task.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ title: 'Test' }),
        include: expect.any(Object),
      });
    });
  });

  describe('findOne', () => {
    it('doit retourner une tache par ID', async () => {
      const task = { id: 1, title: 'Test', done: false };
      mockPrisma.task.findUnique.mockResolvedValue(task);

      const result = await service.findOne(1);
      expect(result).toEqual(task);
    });

    it('doit lever NotFoundException si la tache n\'existe pas', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('doit supprimer une tache', async () => {
      mockPrisma.task.delete.mockResolvedValue({ id: 1 });

      await expect(service.remove(1)).resolves.not.toThrow();
      expect(mockPrisma.task.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });
});
```

**Action** : Exécuter les tests unitaires.

```bash
npm run test -- --watch tasks.service
```

> Le `Test.createTestingModule` créé un module de test avec des providers mockes. On remplace PrismaService par un objet avec des `jest.fn()`. Chaque test vérifié le comportement du service sans toucher à la base de donnees.

### [09:00-14:00] Tests unitaires — Tester un controller

**Action** : Écrire un test pour le controller.

```typescript
// src/tasks/tasks.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

describe('TasksController', () => {
  let controller: TasksController;
  let service: TasksService;

  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [{ provide: TasksService, useValue: mockService }],
    }).compile();

    controller = module.get<TasksController>(TasksController);
    service = module.get<TasksService>(TasksService);
  });

  describe('findAll', () => {
    it('doit retourner un tableau de taches', async () => {
      const tasks = [{ id: 1, title: 'Task 1' }, { id: 2, title: 'Task 2' }];
      mockService.findAll.mockResolvedValue(tasks);

      const result = await controller.findAll();

      expect(result).toEqual(tasks);
      expect(mockService.findAll).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('doit creer et retourner une tache', async () => {
      const dto = { title: 'Nouvelle tache' };
      const created = { id: 1, ...dto, done: false };
      mockService.create.mockResolvedValue(created);

      const result = await controller.create(dto as any);

      expect(result).toEqual(created);
      expect(mockService.create).toHaveBeenCalledWith(dto);
    });
  });
});
```

> Le test du controller mocke le service. On vérifié que le controller appelle les bonnes méthodes du service avec les bons arguments. C'est la separation des responsabilites en action.

### [14:00-19:00] Tests E2E — Tester l'API de bout en bout

**Action** : Écrire un test E2E avec supertest.

```typescript
// test/tasks.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Tasks API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /tasks — doit creer une tache', () => {
    return request(app.getHttpServer())
      .post('/tasks')
      .send({ title: 'E2E Test Task', description: 'Testing' })
      .expect(201)
      .expect((res) => {
        expect(res.body.title).toBe('E2E Test Task');
        expect(res.body.id).toBeDefined();
      });
  });

  it('GET /tasks — doit retourner les taches', () => {
    return request(app.getHttpServer())
      .get('/tasks')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });

  it('GET /tasks/999 — doit retourner 404', () => {
    return request(app.getHttpServer())
      .get('/tasks/999')
      .expect(404);
  });

  it('POST /tasks — doit rejeter les donnees invalides', () => {
    return request(app.getHttpServer())
      .post('/tasks')
      .send({ title: '' })
      .expect(400);
  });
});
```

**Action** : Exécuter les tests E2E.

```bash
npm run test:e2e
```

> Les tests E2E utilisent supertest pour envoyer de vraies requêtes HTTP a l'application. Ils testent tout le pipeline : routing, validation, service, base de donnees. C'est le test le plus realiste.

### [19:00-21:00] Recap

> Les tests unitaires isolent une classe avec des mocks. Les tests E2E testent l'API de bout en bout avec supertest. NestJS fournit `Test.createTestingModule` pour configurer les modules de test. Combinez les deux pour une couverture complete.

**Action** : Afficher le slide recap.

> Le lab est dans `labs/lab-18-testing/`. Vous allez écrire des tests unitaires et E2E pour votre API. Visez au moins 80% de couverture. Au prochain screencast, l'authentification NestJS !

## Points d'attention pour l'enregistrement
- Montrer les tests en mode watch pour un feedback instantane
- Bien expliquer la différence entre mock, spy et stub
- Les tests E2E necessitent une base de test separee — le mentionner
- Montrer le rapport de couverture avec `npm run test:cov`
