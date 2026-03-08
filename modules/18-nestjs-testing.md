# Module 18 — NestJS — Testing

> **Objectif** : Apprendre a ecrire des tests unitaires, d'integration et end-to-end (E2E) pour une application NestJS, en maitrisant les techniques de mocking et l'outillage Jest.
> **Difficulte** : ⭐⭐⭐ (avance)
> **Prerequis** : Module 11 (Services), Module 13 (Pipes, Guards, Interceptors), Module 14 ou 16 (ORM au choix)
> **Duree estimee** : 6 heures

---

## 1. Introduction au testing dans NestJS

### 1.1 Pourquoi tester ?

> **Analogie** : Les tests sont comme les filets de securite d'un trapeziste. Ils ne vous empechent pas de faire des figures acrobatiques (du code complexe), mais ils vous rattrapent quand vous tombez (quand un bug est introduit). Sans filet, chaque modification devient un acte de bravoure.

### 1.2 Les trois niveaux de tests

| Niveau | Cible | Vitesse | Couverture | Dependances |
|--------|-------|---------|------------|-------------|
| **Unitaire** | Une classe/methode | Tres rapide | Etroite | Mockees |
| **Integration** | Plusieurs classes ensemble | Moyen | Moyenne | Partiellement reelles |
| **E2E** | L'application complete | Lent | Large | Reelles (DB, HTTP) |

### 1.3 Configuration de Jest dans NestJS

NestJS utilise Jest comme framework de test par defaut. La configuration est deja presente dans un projet NestJS genere avec la CLI.

```json
// package.json
{
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "collectCoverageFrom": ["**/*.(t|j)s"],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }
}
```

Ou dans un fichier separe :

```javascript
// jest.config.js
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/*.module.ts',     // Exclure les modules
    '!**/main.ts',          // Exclure le bootstrap
  ],
  coverageDirectory: '../coverage',
  coverageThresholds: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  testEnvironment: 'node',
  moduleNameMapper: {
    // Alias de chemins si vous en utilisez
    '^@app/(.*)$': '<rootDir>/$1',
    '^@common/(.*)$': '<rootDir>/common/$1',
  },
};
```

Les commandes :

```bash
# Lancer tous les tests
npm run test

# Lancer les tests en mode watch (relance automatique)
npm run test:watch

# Lancer les tests E2E
npm run test:e2e

# Generer le rapport de couverture
npm run test:cov

# Lancer un fichier de test specifique
npx jest --testPathPattern=users.service.spec.ts
```

---

## 2. Tests unitaires — Tester les services

### 2.1 Le module de test NestJS

NestJS fournit `Test.createTestingModule()` pour creer un module de test isole.

```typescript
// users/users.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';

// Typage du repository mocke
type MockRepository<T = any> = Partial<Record<keyof Repository<T>, jest.Mock>>;

// Factory pour creer un repository mocke
const createMockRepository = <T = any>(): MockRepository<T> => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  remove: jest.fn(),
  preload: jest.fn(),
  count: jest.fn(),
  exist: jest.fn(),
});

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: MockRepository<User>;

  beforeEach(async () => {
    // Creer le module de test
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          // Fournir un mock du repository au lieu du vrai
          provide: getRepositoryToken(User),
          useValue: createMockRepository(),
        },
      ],
    }).compile();

    // Recuperer les instances
    service = module.get<UsersService>(UsersService);
    userRepository = module.get<MockRepository<User>>(
      getRepositoryToken(User),
    );
  });

  // Verifier que le service est bien instancie
  it('devrait etre defini', () => {
    expect(service).toBeDefined();
  });

  // === Tests de la methode findAll ===

  describe('findAll', () => {
    it('devrait retourner un tableau d\'utilisateurs', async () => {
      // Arrange : configurer le mock
      const mockUsers = [
        { id: 1, nom: 'Alice', email: 'alice@test.com' },
        { id: 2, nom: 'Bob', email: 'bob@test.com' },
      ];
      userRepository.find.mockResolvedValue(mockUsers);

      // Act : appeler la methode
      const result = await service.findAll();

      // Assert : verifier le resultat
      expect(result).toEqual(mockUsers);
      expect(result).toHaveLength(2);
      expect(userRepository.find).toHaveBeenCalledTimes(1);
    });

    it('devrait retourner un tableau vide si aucun utilisateur', async () => {
      userRepository.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  // === Tests de la methode findOne ===

  describe('findOne', () => {
    it('devrait retourner un utilisateur par ID', async () => {
      const mockUser = { id: 1, nom: 'Alice', email: 'alice@test.com' };
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findOne(1);

      expect(result).toEqual(mockUser);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: expect.any(Object),
      });
    });

    it('devrait lancer NotFoundException si utilisateur introuvable', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(999)).rejects.toThrow(
        'Utilisateur #999 introuvable',
      );
    });
  });

  // === Tests de la methode create ===

  describe('create', () => {
    const createUserDto = {
      nom: 'Charlie',
      email: 'charlie@test.com',
      motDePasse: 'SecurePass123',
    };

    it('devrait creer un utilisateur avec succes', async () => {
      const mockCreatedUser = { id: 3, ...createUserDto };

      userRepository.findOne.mockResolvedValue(null); // Pas de doublon
      userRepository.create.mockReturnValue(mockCreatedUser);
      userRepository.save.mockResolvedValue(mockCreatedUser);

      const result = await service.create(createUserDto);

      expect(result).toEqual(mockCreatedUser);
      expect(userRepository.create).toHaveBeenCalledWith(createUserDto);
      expect(userRepository.save).toHaveBeenCalledWith(mockCreatedUser);
    });

    it('devrait lancer ConflictException si email deja utilise', async () => {
      const existingUser = { id: 1, email: 'charlie@test.com' };
      userRepository.findOne.mockResolvedValue(existingUser);

      await expect(service.create(createUserDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // === Tests de la methode update ===

  describe('update', () => {
    it('devrait mettre a jour un utilisateur', async () => {
      const updateDto = { nom: 'Alice Martin' };
      const existingUser = { id: 1, nom: 'Alice Dupont', email: 'alice@test.com' };
      const updatedUser = { ...existingUser, ...updateDto };

      userRepository.preload.mockResolvedValue(updatedUser);
      userRepository.save.mockResolvedValue(updatedUser);

      const result = await service.update(1, updateDto);

      expect(result.nom).toBe('Alice Martin');
      expect(userRepository.preload).toHaveBeenCalledWith({
        id: 1,
        ...updateDto,
      });
    });

    it('devrait lancer NotFoundException si utilisateur introuvable', async () => {
      userRepository.preload.mockResolvedValue(undefined);

      await expect(service.update(999, { nom: 'Test' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // === Tests de la methode remove ===

  describe('remove', () => {
    it('devrait supprimer un utilisateur existant', async () => {
      const mockUser = { id: 1, nom: 'Alice' };
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.remove.mockResolvedValue(mockUser);

      await service.remove(1);

      expect(userRepository.remove).toHaveBeenCalledWith(mockUser);
    });

    it('devrait lancer NotFoundException si utilisateur introuvable', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
```

### 2.2 Tester un service avec Prisma

```typescript
// articles/articles.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ArticlesService } from './articles.service';
import { PrismaService } from '../prisma/prisma.service';

// Mock complet de PrismaService
const mockPrismaService = {
  article: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
};

describe('ArticlesService', () => {
  let service: ArticlesService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    // Reinitialiser tous les mocks avant chaque test
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticlesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ArticlesService>(ArticlesService);
    prisma = module.get(PrismaService);
  });

  describe('findAll', () => {
    it('devrait retourner des articles pagines', async () => {
      const mockArticles = [
        { id: 1, titre: 'Article 1', statut: 'PUBLIE' },
        { id: 2, titre: 'Article 2', statut: 'PUBLIE' },
      ];
      prisma.article.findMany.mockResolvedValue(mockArticles);
      prisma.article.count.mockResolvedValue(2);

      const result = await service.findAll(1, 10);

      expect(result.data).toEqual(mockArticles);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(prisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
        }),
      );
    });
  });

  describe('findOne', () => {
    it('devrait retourner un article par ID', async () => {
      const mockArticle = {
        id: 1,
        titre: 'Test Article',
        auteur: { id: 1, nom: 'Alice' },
        tags: [],
      };
      prisma.article.findUnique.mockResolvedValue(mockArticle);

      const result = await service.findOne(1);

      expect(result).toEqual(mockArticle);
      expect(prisma.article.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: expect.any(Object),
      });
    });

    it('devrait lancer NotFoundException', async () => {
      prisma.article.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(
        'Article #999 introuvable',
      );
    });
  });

  describe('create', () => {
    it('devrait creer un article', async () => {
      const dto = {
        titre: 'Nouvel article',
        contenu: 'Contenu...',
      };
      const mockCreated = {
        id: 1,
        titre: 'Nouvel article',
        slug: 'nouvel-article',
        contenu: 'Contenu...',
      };
      prisma.article.create.mockResolvedValue(mockCreated);

      const result = await service.create(1, dto);

      expect(result).toEqual(mockCreated);
      expect(prisma.article.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            titre: 'Nouvel article',
            auteurId: 1,
          }),
        }),
      );
    });
  });
});
```

### 2.3 Techniques de mocking avec Jest

```typescript
// === jest.fn() — Creer une fonction mockee ===
const mockFn = jest.fn();
mockFn.mockReturnValue(42);           // Retourne 42 (synchrone)
mockFn.mockResolvedValue(42);         // Retourne Promise<42> (async)
mockFn.mockRejectedValue(new Error()); // Retourne Promise rejetee
mockFn.mockImplementation((x) => x * 2); // Implementation custom

// === jest.spyOn() — Espionner une methode existante ===
const spy = jest.spyOn(service, 'findOne');
spy.mockResolvedValue(mockUser);       // Override le comportement

// Verifier les appels
expect(spy).toHaveBeenCalled();
expect(spy).toHaveBeenCalledTimes(1);
expect(spy).toHaveBeenCalledWith(1);

spy.mockRestore(); // Restaure l'implementation originale

// === Assertions avancees ===

// Verifier la structure d'un objet
expect(result).toEqual(expect.objectContaining({
  id: expect.any(Number),
  nom: expect.any(String),
  email: expect.stringContaining('@'),
  createdAt: expect.any(Date),
}));

// Verifier un tableau
expect(result).toEqual(
  expect.arrayContaining([
    expect.objectContaining({ nom: 'Alice' }),
  ]),
);

// Verifier qu'une exception est lancee
await expect(service.remove(999)).rejects.toThrow(NotFoundException);
await expect(service.remove(999)).rejects.toThrow('introuvable');

// Verifier les appels avec des matchers
expect(mockFn).toHaveBeenCalledWith(
  expect.objectContaining({ email: 'test@test.com' }),
);
```

---

## 3. Tester les controllers

```typescript
// users/users.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { NotFoundException } from '@nestjs/common';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  // Mock du service
  const mockUsersService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  it('devrait etre defini', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('devrait retourner tous les utilisateurs', async () => {
      const mockUsers = [
        { id: 1, nom: 'Alice' },
        { id: 2, nom: 'Bob' },
      ];
      mockUsersService.findAll.mockResolvedValue(mockUsers);

      const result = await controller.findAll();

      expect(result).toEqual(mockUsers);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('devrait retourner un utilisateur', async () => {
      const mockUser = { id: 1, nom: 'Alice' };
      mockUsersService.findOne.mockResolvedValue(mockUser);

      const result = await controller.findOne(1);

      expect(result).toEqual(mockUser);
      expect(service.findOne).toHaveBeenCalledWith(1);
    });
  });

  describe('create', () => {
    it('devrait creer un utilisateur', async () => {
      const dto: CreateUserDto = {
        nom: 'Charlie',
        email: 'charlie@test.com',
        motDePasse: 'Pass123!',
      };
      const mockCreated = { id: 3, ...dto };
      mockUsersService.create.mockResolvedValue(mockCreated);

      const result = await controller.create(dto);

      expect(result).toEqual(mockCreated);
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('remove', () => {
    it('devrait supprimer un utilisateur', async () => {
      mockUsersService.remove.mockResolvedValue(undefined);

      await controller.remove(1);

      expect(service.remove).toHaveBeenCalledWith(1);
    });
  });
});
```

---

## 4. Tester les guards, pipes et interceptors

### 4.1 Tester un Guard

```typescript
// guards/roles.guard.spec.ts
import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  // Helper pour creer un ExecutionContext mock
  const createMockExecutionContext = (user?: any): ExecutionContext => ({
    switchToHttp: () => ({
      getRequest: () => ({ user }),
      getResponse: () => ({}),
      getNext: () => jest.fn(),
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn() as any,
    getType: () => 'http' as any,
    getArgs: () => [],
    getArgByIndex: () => ({}),
    switchToRpc: () => ({} as any),
    switchToWs: () => ({} as any),
  } as ExecutionContext);

  it('devrait autoriser l\'acces si aucun role requis', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const context = createMockExecutionContext({ id: 1, roles: ['user'] });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('devrait autoriser l\'acces si l\'utilisateur a le bon role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

    const context = createMockExecutionContext({
      id: 1,
      roles: ['admin'],
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('devrait refuser l\'acces si l\'utilisateur n\'a pas le bon role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

    const context = createMockExecutionContext({
      id: 1,
      roles: ['user'],
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('devrait refuser l\'acces si aucun utilisateur', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

    const context = createMockExecutionContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
```

### 4.2 Tester un Pipe

```typescript
// pipes/parse-objectid.pipe.spec.ts
import { ParseObjectIdPipe } from './parse-objectid.pipe';
import { BadRequestException } from '@nestjs/common';

describe('ParseObjectIdPipe', () => {
  let pipe: ParseObjectIdPipe;

  beforeEach(() => {
    pipe = new ParseObjectIdPipe();
  });

  it('devrait accepter un ObjectId valide', () => {
    const validId = '507f1f77bcf86cd799439011';
    expect(pipe.transform(validId, { type: 'param' } as any)).toBe(validId);
  });

  it('devrait rejeter un ObjectId invalide', () => {
    expect(() => pipe.transform('invalid-id', { type: 'param' } as any)).toThrow(
      BadRequestException,
    );
  });

  it('devrait rejeter une chaine vide', () => {
    expect(() => pipe.transform('', { type: 'param' } as any)).toThrow(
      BadRequestException,
    );
  });
});
```

### 4.3 Tester un Interceptor

```typescript
// interceptors/transform-response.interceptor.spec.ts
import { TransformResponseInterceptor } from './transform-response.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

describe('TransformResponseInterceptor', () => {
  let interceptor: TransformResponseInterceptor<any>;

  beforeEach(() => {
    interceptor = new TransformResponseInterceptor();
  });

  it('devrait envelopper la reponse dans un format standard', (done) => {
    const mockData = { id: 1, nom: 'Alice' };

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ url: '/users/1' }),
      }),
    } as ExecutionContext;

    const callHandler: CallHandler = {
      handle: () => of(mockData),
    };

    interceptor.intercept(context, callHandler).subscribe({
      next: (result) => {
        expect(result).toEqual(
          expect.objectContaining({
            success: true,
            data: mockData,
            path: '/users/1',
            timestamp: expect.any(String),
          }),
        );
        done();
      },
    });
  });
});
```

---

## 5. Tests d'integration

Les tests d'integration testent plusieurs composants ensemble, avec une vraie base de donnees.

```typescript
// users/users.integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('UsersService (Integration)', () => {
  let service: UsersService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        // Base de donnees de test (SQLite en memoire pour la rapidite)
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [User],
          synchronize: true,  // OK pour les tests
          dropSchema: true,    // Reset a chaque suite
        }),
        TypeOrmModule.forFeature([User]),
      ],
      providers: [UsersService],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterAll(async () => {
    await module.close();
  });

  // Nettoyer entre les tests
  beforeEach(async () => {
    // Vider la table users
    const repo = module.get('UserRepository');
    await repo.clear();
  });

  describe('create + findOne', () => {
    it('devrait creer et retrouver un utilisateur', async () => {
      // Creer
      const created = await service.create({
        nom: 'Alice',
        email: 'alice@test.com',
        motDePasse: 'Pass123!',
      });

      expect(created.id).toBeDefined();
      expect(created.nom).toBe('Alice');

      // Retrouver
      const found = await service.findOne(created.id);
      expect(found.email).toBe('alice@test.com');
    });

    it('devrait empecher les emails en double', async () => {
      await service.create({
        nom: 'Alice',
        email: 'alice@test.com',
        motDePasse: 'Pass123!',
      });

      await expect(
        service.create({
          nom: 'Autre Alice',
          email: 'alice@test.com',
          motDePasse: 'Pass456!',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('devrait mettre a jour le nom', async () => {
      const user = await service.create({
        nom: 'Alice',
        email: 'alice@test.com',
        motDePasse: 'Pass123!',
      });

      const updated = await service.update(user.id, { nom: 'Alice Martin' });

      expect(updated.nom).toBe('Alice Martin');
      expect(updated.email).toBe('alice@test.com'); // Inchange
    });
  });

  describe('remove', () => {
    it('devrait supprimer un utilisateur', async () => {
      const user = await service.create({
        nom: 'Alice',
        email: 'alice@test.com',
        motDePasse: 'Pass123!',
      });

      await service.remove(user.id);

      await expect(service.findOne(user.id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
```

---

## 6. Tests E2E (End-to-End)

### 6.1 Configuration E2E

```typescript
// test/app.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Application (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Appliquer la meme configuration que main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // === Tests des routes Users ===

  describe('Users (/users)', () => {
    let createdUserId: number;

    describe('POST /users', () => {
      it('devrait creer un utilisateur (201)', () => {
        return request(app.getHttpServer())
          .post('/users')
          .send({
            nom: 'Alice Dupont',
            email: 'alice@test.com',
            motDePasse: 'SecurePass123!',
          })
          .expect(201)
          .expect((res) => {
            expect(res.body).toEqual(
              expect.objectContaining({
                id: expect.any(Number),
                nom: 'Alice Dupont',
                email: 'alice@test.com',
              }),
            );
            // Sauvegarder l'ID pour les tests suivants
            createdUserId = res.body.id;
            // Le mot de passe ne devrait PAS etre retourne
            expect(res.body.motDePasse).toBeUndefined();
          });
      });

      it('devrait rejeter un email invalide (400)', () => {
        return request(app.getHttpServer())
          .post('/users')
          .send({
            nom: 'Test',
            email: 'pas-un-email',
            motDePasse: 'Pass123!',
          })
          .expect(400)
          .expect((res) => {
            expect(res.body.message).toContain('email');
          });
      });

      it('devrait rejeter un body vide (400)', () => {
        return request(app.getHttpServer())
          .post('/users')
          .send({})
          .expect(400);
      });

      it('devrait rejeter les proprietes inconnues (400)', () => {
        return request(app.getHttpServer())
          .post('/users')
          .send({
            nom: 'Test',
            email: 'test@test.com',
            motDePasse: 'Pass123!',
            isAdmin: true, // Propriete non autorisee
          })
          .expect(400);
      });
    });

    describe('GET /users', () => {
      it('devrait retourner tous les utilisateurs (200)', () => {
        return request(app.getHttpServer())
          .get('/users')
          .expect(200)
          .expect((res) => {
            expect(Array.isArray(res.body)).toBe(true);
          });
      });
    });

    describe('GET /users/:id', () => {
      it('devrait retourner un utilisateur par ID (200)', () => {
        return request(app.getHttpServer())
          .get(`/users/${createdUserId}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.id).toBe(createdUserId);
            expect(res.body.nom).toBe('Alice Dupont');
          });
      });

      it('devrait retourner 404 si introuvable', () => {
        return request(app.getHttpServer())
          .get('/users/99999')
          .expect(404);
      });

      it('devrait retourner 400 si ID invalide', () => {
        return request(app.getHttpServer())
          .get('/users/abc')
          .expect(400);
      });
    });

    describe('PATCH /users/:id', () => {
      it('devrait mettre a jour un utilisateur (200)', () => {
        return request(app.getHttpServer())
          .patch(`/users/${createdUserId}`)
          .send({ nom: 'Alice Martin' })
          .expect(200)
          .expect((res) => {
            expect(res.body.nom).toBe('Alice Martin');
          });
      });
    });

    describe('DELETE /users/:id', () => {
      it('devrait supprimer un utilisateur (200)', () => {
        return request(app.getHttpServer())
          .delete(`/users/${createdUserId}`)
          .expect(200);
      });

      it('devrait retourner 404 apres suppression', () => {
        return request(app.getHttpServer())
          .get(`/users/${createdUserId}`)
          .expect(404);
      });
    });
  });
});
```

### 6.2 E2E avec authentification

```typescript
describe('Routes protegees', () => {
  let authToken: string;

  beforeAll(async () => {
    // Creer un utilisateur de test
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nom: 'Admin Test',
        email: 'admin@test.com',
        motDePasse: 'Admin123!',
      });

    // Se connecter pour obtenir un token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@test.com',
        motDePasse: 'Admin123!',
      });

    authToken = loginResponse.body.accessToken;
  });

  it('devrait acceder a une route protegee avec un token valide', () => {
    return request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.email).toBe('admin@test.com');
      });
  });

  it('devrait refuser l\'acces sans token (401)', () => {
    return request(app.getHttpServer())
      .get('/users/me')
      .expect(401);
  });

  it('devrait refuser un token invalide (401)', () => {
    return request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', 'Bearer token-invalide')
      .expect(401);
  });
});
```

---

## 7. overrideProvider, overrideGuard, overrideInterceptor

```typescript
// Override un guard pour les tests
const module = await Test.createTestingModule({
  imports: [AppModule],
})
  .overrideGuard(AuthGuard)
  .useValue({
    canActivate: () => true, // Toujours autoriser
  })
  .overrideGuard(RolesGuard)
  .useValue({
    canActivate: () => true,
  })
  .overrideInterceptor(LoggingInterceptor)
  .useValue({
    intercept: (context, next) => next.handle(), // Ne rien faire
  })
  .overrideProvider(UsersService)
  .useValue(mockUsersService)
  .compile();
```

---

## 8. Couverture de code

```bash
# Generer le rapport de couverture
npm run test:cov

# Le rapport HTML est genere dans coverage/lcov-report/index.html
```

Configuration des seuils de couverture dans `jest.config.js` :

```javascript
coverageThresholds: {
  global: {
    branches: 80,    // 80% des branches conditionnelles couvertes
    functions: 80,   // 80% des fonctions couvertes
    lines: 80,       // 80% des lignes couvertes
    statements: 80,  // 80% des instructions couvertes
  },
},
```

---

## 9. Bonnes pratiques de test

| Pratique | Description |
|----------|-------------|
| Pattern AAA | Arrange (preparer), Act (agir), Assert (verifier) |
| Un test = une assertion | Chaque test verifie UNE chose specifique |
| Nommer clairement | `devrait retourner 404 si utilisateur introuvable` |
| Tests independants | Chaque test peut s'executer seul, dans n'importe quel ordre |
| Eviter les tests fragiles | Ne testez pas les details d'implementation, testez le comportement |
| Mocker avec parcimonie | Preferez les tests d'integration pour les cas complexes |
| Nettoyer apres | Utilisez `afterEach` / `afterAll` pour nettoyer |
| CI/CD | Lancez les tests automatiquement a chaque push |

> **Bonne pratique** : Suivez la pyramide de tests. Beaucoup de tests unitaires (rapides, isoles), quelques tests d'integration (service + DB), et peu de tests E2E (lents mais complets).

---

## 10. Exercices pratiques

### Exercice 1 : Tests unitaires

Ecrivez les tests unitaires complets pour un `ProductsService` avec les methodes : create, findAll, findOne, update, remove. Utilisez des mocks pour le repository.

### Exercice 2 : Test de Guard

Testez un `ApiKeyGuard` qui verifie le header `x-api-key`. Testez les cas : cle valide, cle invalide, cle absente.

### Exercice 3 : Test E2E

Ecrivez une suite de tests E2E pour un CRUD complet de produits, incluant la validation des DTOs et l'authentification.

---

## Liens

| Ressource | Lien |
|-----------|------|
| Quiz Module 18 | `quiz/18-quiz.md` |
| Lab Module 18 | `labs/18-lab-testing.md` |
| Screencast | `screencasts/18-screencast.md` |
| Module precedent | [Module 17 — Prisma avance & Comparaison](17-prisma-avance-comparaison.md) |
| Module suivant | [Module 19 — Authentification & Autorisation](19-nestjs-auth.md) |
| NestJS Testing | https://docs.nestjs.com/fundamentals/testing |
| Jest Documentation | https://jestjs.io/docs/getting-started |
| Supertest | https://github.com/ladjs/supertest |
