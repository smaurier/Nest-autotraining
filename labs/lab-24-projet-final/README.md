# Lab 24 — Projet final : API TribuZen complète

> **Capstone.** Tu assembles ici les quatre modules de domaine TribuZen (Auth, Family, Post, Invitation) du schéma Prisma jusqu'aux tests e2e. Chaque étape s'appuie sur un concept du cours — aucun bloc nouveau, juste l'intégration.
>
> **Corrigé inline.** Chaque section TODO contient le corrigé commenté immédiatement après. Lis le TODO, essaie, puis compare.

---

## Prérequis

```bash
cd 09-nestjs/labs/lab-24-projet-final
npm install
cp .env.example .env  # édite DATABASE_URL et JWT_SECRET
```

---

## Étape 0 — Vérifier le schéma Prisma

Le schéma `prisma/schema.prisma` est fourni. Génère le client et applique les migrations :

```bash
npx prisma migrate dev --name init
npx prisma generate
```

**Vérifie** que les cinq tables sont créées : `users`, `families`, `family_members`, `posts`, `invitations`.

---

## Étape 1 — PrismaModule global

### TODO 1.1

Dans `src/prisma/prisma.module.ts`, rends `PrismaModule` global et exporte `PrismaService`.

```ts
// src/prisma/prisma.module.ts — à compléter
import { Module } from '@nestjs/common'
import { PrismaService } from './prisma.service'

@Module({
  providers: [PrismaService],
  // TODO : rendre global + exporter PrismaService
})
export class PrismaModule {}
```

### Corrigé 1.1

```ts
// src/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common'
import { PrismaService } from './prisma.service'

@Global() // PrismaService injectable dans tous les modules sans import répété
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // obligatoire même avec @Global()
})
export class PrismaModule {}
```

---

## Étape 2 — AuthModule

### TODO 2.1 — JwtStrategy

Dans `src/auth/strategies/jwt.strategy.ts`, implémente la stratégie JWT qui valide le token Bearer et retourne le payload.

```ts
// src/auth/strategies/jwt.strategy.ts — à compléter
import { PassportStrategy } from '@nestjs/passport'
import { Strategy, ExtractJwt } from 'passport-jwt'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      // TODO : extraire le Bearer token du header Authorization
      // TODO : utiliser la clé JWT_SECRET depuis ConfigService
    })
  }

  // TODO : validate retourne le payload — NestJS l'attache à req.user
  validate(payload: { sub: string; email: string }) {
    // ...
  }
}
```

### Corrigé 2.1

```ts
// src/auth/strategies/jwt.strategy.ts
import { PassportStrategy } from '@nestjs/passport'
import { Strategy, ExtractJwt } from 'passport-jwt'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      // Extrait le token du header Authorization: Bearer <token>
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Clé secrète depuis ConfigModule.forRoot — jamais hardcodée
      secretOrKey: config.get<string>('JWT_SECRET'),
    })
  }

  // validate est appelé après vérification de la signature — payload déjà vérifié
  validate(payload: { sub: string; email: string }) {
    // Retour attaché à req.user par Passport
    return { id: payload.sub, email: payload.email }
  }
}
```

### TODO 2.2 — Décorateur @Public()

Dans `src/auth/decorators/public.decorator.ts`, crée le décorateur `@Public()` qui pose le metadata `isPublic: true`.

```ts
// src/auth/decorators/public.decorator.ts — à compléter
import { SetMetadata } from '@nestjs/common'

// TODO : exporte IS_PUBLIC_KEY et le décorateur @Public()
```

### Corrigé 2.2

```ts
// src/auth/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common'

// Constante pour éviter les fautes de frappe sur la clé de metadata
export const IS_PUBLIC_KEY = 'isPublic'

// @Public() sur un controller ou une méthode bypass le JwtAuthGuard global
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
```

### TODO 2.3 — JwtAuthGuard avec porte de sortie @Public()

Dans `src/auth/guards/jwt-auth.guard.ts`, étends `AuthGuard('jwt')` et laisse passer les routes `@Public()`.

```ts
// src/auth/guards/jwt-auth.guard.ts — à compléter
import { ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) { super() }

  canActivate(context: ExecutionContext) {
    // TODO : si la route est marquée @Public(), retourner true directement
    // TODO : sinon déléguer à AuthGuard('jwt').canActivate()
  }
}
```

### Corrigé 2.3

```ts
// src/auth/guards/jwt-auth.guard.ts
import { ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) { super() }

  canActivate(context: ExecutionContext) {
    // Lit le metadata isPublic sur le handler ou le controller
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    // Route publique → pas de vérification JWT
    if (isPublic) return true
    // Route privée → AuthGuard('jwt') vérifie le token Bearer
    return super.canActivate(context)
  }
}
```

### TODO 2.4 — AuthModule

Configure `AuthModule` pour qu'il exporte `JwtModule` (les autres modules en auront besoin pour signer des tokens si besoin).

```ts
// src/auth/auth.module.ts — à compléter
import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { ConfigService } from '@nestjs/config'

// TODO : importer PassportModule, JwtModule.registerAsync (clé depuis ConfigService)
// TODO : déclarer JwtStrategy, JwtAuthGuard
// TODO : exporter JwtModule, JwtAuthGuard
```

### Corrigé 2.4

```ts
// src/auth/auth.module.ts
import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { JwtStrategy } from './strategies/jwt.strategy'
import { JwtAuthGuard } from './guards/jwt-auth.guard'

@Module({
  imports: [
    PassportModule,
    // registerAsync : clé lue depuis ConfigService — jamais hardcodée
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard],
  // JwtModule exporté pour que d'autres modules puissent signer des tokens
  exports: [JwtModule, JwtAuthGuard],
})
export class AuthModule {}
```

---

## Étape 3 — FamilyModule

### TODO 3.1 — FamilyService.create avec transaction

Dans `src/family/family.service.ts`, implémente `create()` qui crée la famille et ajoute le créateur comme ADMIN dans la même transaction.

```ts
// src/family/family.service.ts — extrait à compléter
async create(dto: CreateFamilyDto, creatorId: string) {
  // TODO : utiliser prisma.$transaction
  // TODO : créer la famille
  // TODO : créer le FamilyMember avec role ADMIN
  // TODO : retourner la famille créée
}
```

### Corrigé 3.1

```ts
// src/family/family.service.ts — méthode create
async create(dto: CreateFamilyDto, creatorId: string) {
  // $transaction garantit l'atomicité : si le membre n'est pas créé, la famille non plus
  return this.prisma.$transaction(async (tx) => {
    const family = await tx.family.create({
      data: { name: dto.name, maxSize: dto.maxSize ?? 12 },
    })

    // Le créateur est automatiquement ADMIN — une famille sans admin est invalide
    await tx.familyMember.create({
      data: { userId: creatorId, familyId: family.id, role: 'ADMIN' },
    })

    return family
  })
}
```

### TODO 3.2 — FamilyModule avec exports

Dans `src/family/family.module.ts`, configure le module en exportant `FamilyService` (nécessaire pour `InvitationModule`).

```ts
// src/family/family.module.ts — à compléter
```

### Corrigé 3.2

```ts
// src/family/family.module.ts
import { Module } from '@nestjs/common'
import { FamilyController } from './family.controller'
import { FamilyService } from './family.service'

@Module({
  controllers: [FamilyController],
  providers: [FamilyService],
  // FamilyService exporté — InvitationService en dépend pour vérifier la capacité
  exports: [FamilyService],
})
export class FamilyModule {}
```

---

## Étape 4 — InvitationModule

### TODO 4.1 — InvitationService avec logique de garde

Dans `src/invitation/invitation.service.ts`, implémente `invite()` qui vérifie la capacité via `FamilyService` avant de créer l'invitation.

```ts
// src/invitation/invitation.service.ts — à compléter
async invite(familyId: string, senderId: string, email: string) {
  // TODO : vérifier hasCapacity via this.familyService
  // TODO : vérifier absence d'invitation PENDING pour cet email
  // TODO : créer l'invitation avec expiresAt = maintenant + 7 jours
}
```

### Corrigé 4.1

```ts
// src/invitation/invitation.service.ts
import { Injectable, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { FamilyService } from '../family/family.service'

@Injectable()
export class InvitationService {
  constructor(
    private readonly prisma: PrismaService,
    // FamilyService injecté via FamilyModule importé dans InvitationModule
    private readonly familyService: FamilyService,
  ) {}

  async invite(familyId: string, senderId: string, email: string) {
    // Règle 1 — capacité maximale de la famille
    const hasCapacity = await this.familyService.hasCapacity(familyId)
    if (!hasCapacity) throw new BadRequestException('La famille est pleine')

    // Règle 2 — pas de doublon en attente
    const existing = await this.prisma.invitation.findFirst({
      where: { familyId, email, status: 'PENDING' },
    })
    if (existing) throw new BadRequestException('Invitation déjà en attente pour cet email')

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    return this.prisma.invitation.create({
      data: { familyId, senderId, email, expiresAt },
    })
  }
}
```

### TODO 4.2 — InvitationModule

Configure `InvitationModule` en important `FamilyModule` pour rendre `FamilyService` injectable.

```ts
// src/invitation/invitation.module.ts — à compléter
```

### Corrigé 4.2

```ts
// src/invitation/invitation.module.ts
import { Module } from '@nestjs/common'
import { FamilyModule } from '../family/family.module'
import { InvitationController } from './invitation.controller'
import { InvitationService } from './invitation.service'

@Module({
  // FamilyModule importé → FamilyService devient injectable dans ce module
  imports: [FamilyModule],
  controllers: [InvitationController],
  providers: [InvitationService],
  // InvitationService non exporté — personne d'autre ne l'utilise
})
export class InvitationModule {}
```

---

## Étape 5 — AppModule et main.ts

### TODO 5.1 — AppModule avec guards globaux

Dans `src/app.module.ts`, assemble tous les modules et déclare `JwtAuthGuard` et `RolesGuard` via `APP_GUARD`.

```ts
// src/app.module.ts — à compléter
@Module({
  imports: [
    // TODO : ConfigModule global avec Joi
    // TODO : PrismaModule, AuthModule, FamilyModule, PostModule, InvitationModule
  ],
  providers: [
    // TODO : APP_GUARD pour JwtAuthGuard et RolesGuard
  ],
})
export class AppModule {}
```

### Corrigé 5.1

```ts
// src/app.module.ts
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import * as Joi from 'joi'

import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { FamilyModule } from './family/family.module'
import { PostModule } from './post/post.module'
import { InvitationModule } from './invitation/invitation.module'
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard'
import { RolesGuard } from './auth/guards/roles.guard'

@Module({
  imports: [
    // ConfigModule global — ConfigService injectable partout, validé par Joi
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        PORT: Joi.number().default(3000),
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().min(32).required(),
      }),
    }),
    // Infrastructure
    PrismaModule,
    // Auth — exporte JwtModule pour les modules qui signent des tokens
    AuthModule,
    // Domaines
    FamilyModule,
    PostModule,
    // InvitationModule importé après FamilyModule dont il dépend
    InvitationModule,
  ],
  providers: [
    // APP_GUARD = guard global avec injection de dépendances active
    // Toutes les routes sont privées sauf celles marquées @Public()
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
```

### TODO 5.2 — main.ts

Dans `src/main.ts`, applique `ValidationPipe` global, configure Swagger (dev uniquement) et active les shutdown hooks.

```ts
// src/main.ts — à compléter
async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  // TODO : ValidationPipe whitelist + transform
  // TODO : Swagger si NODE_ENV !== production
  // TODO : shutdown hooks
  // TODO : écoute PORT
}
```

### Corrigé 5.2

```ts
// src/main.ts
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // ValidationPipe global — reproduire IDENTIQUEMENT dans beforeAll des tests e2e
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,           // strip des clés non décorées
    forbidNonWhitelisted: true, // 400 si clé inconnue reçue
    transform: true,           // '42' → 42, 'true' → true automatiquement
  }))

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('TribuZen API')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth')
      .addTag('families')
      .addTag('posts')
      .addTag('invitations')
      .build()
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config))
  }

  // Déclenche PrismaService.onModuleDestroy() à l'arrêt (SIGTERM / SIGINT)
  app.enableShutdownHooks()

  const port = process.env.PORT ?? 3000
  await app.listen(port)
  console.log(`TribuZen API : http://localhost:${port}`)
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Swagger : http://localhost:${port}/api/docs`)
  }
}
bootstrap()
```

---

## Étape 6 — Tests unitaires

### TODO 6.1 — Test unitaire InvitationService

Dans `src/invitation/invitation.service.spec.ts`, écris les tests pour `invite()` : famille pleine, doublon, succès.

```ts
// src/invitation/invitation.service.spec.ts — à compléter
describe('InvitationService', () => {
  // TODO : mockPrisma avec invitation.findFirst et invitation.create
  // TODO : mockFamilyService avec hasCapacity
  // TODO : cas famille pleine → BadRequestException
  // TODO : cas doublon → BadRequestException
  // TODO : cas succès → invitation créée
})
```

### Corrigé 6.1

```ts
// src/invitation/invitation.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { InvitationService } from './invitation.service'
import { PrismaService } from '../prisma/prisma.service'
import { FamilyService } from '../family/family.service'
import { BadRequestException } from '@nestjs/common'

const mockPrisma = {
  invitation: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
}

const mockFamilyService = {
  hasCapacity: jest.fn(),
}

describe('InvitationService', () => {
  let service: InvitationService

  beforeEach(async () => {
    jest.clearAllMocks() // reset entre chaque test

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FamilyService, useValue: mockFamilyService },
      ],
    }).compile()

    service = module.get<InvitationService>(InvitationService)
  })

  describe('invite', () => {
    it('lève BadRequestException si la famille est pleine', async () => {
      // Arrange
      mockFamilyService.hasCapacity.mockResolvedValue(false)

      // Act + Assert
      await expect(service.invite('fam-1', 'user-1', 'bob@tribu.fr'))
        .rejects.toThrow(BadRequestException)

      // Prisma ne doit pas être appelé si la famille est pleine
      expect(mockPrisma.invitation.create).not.toHaveBeenCalled()
    })

    it('lève BadRequestException si une invitation est déjà en attente', async () => {
      mockFamilyService.hasCapacity.mockResolvedValue(true)
      mockPrisma.invitation.findFirst.mockResolvedValue({
        id: 'inv-0', status: 'PENDING',
      })

      await expect(service.invite('fam-1', 'user-1', 'bob@tribu.fr'))
        .rejects.toThrow(BadRequestException)

      expect(mockPrisma.invitation.create).not.toHaveBeenCalled()
    })

    it('crée l\'invitation si la famille a de la place et pas de doublon', async () => {
      mockFamilyService.hasCapacity.mockResolvedValue(true)
      mockPrisma.invitation.findFirst.mockResolvedValue(null)
      mockPrisma.invitation.create.mockResolvedValue({
        id: 'inv-1',
        familyId: 'fam-1',
        senderId: 'user-1',
        email: 'bob@tribu.fr',
        status: 'PENDING',
      })

      const result = await service.invite('fam-1', 'user-1', 'bob@tribu.fr')

      expect(result).toMatchObject({ familyId: 'fam-1', email: 'bob@tribu.fr' })
      expect(mockPrisma.invitation.create).toHaveBeenCalledTimes(1)
    })
  })
})
```

---

## Étape 7 — Test e2e du flux complet

### TODO 7.1 — Test e2e invitation

Dans `test/invitation.e2e-spec.ts`, écris le test e2e qui couvre : famille pleine → 400, doublon → 400, succès → 201.

```ts
// test/invitation.e2e-spec.ts — à compléter
describe('Flux invitation TribuZen (E2E)', () => {
  // TODO : créer l'app avec overrideProvider(PrismaService)
  // TODO : reproduire ValidationPipe de main.ts dans beforeAll
  // TODO : tester POST /families/:id/invitations → 201, 400 famille pleine, 400 doublon
  // TODO : await app.close() dans afterAll
})
```

### Corrigé 7.1

```ts
// test/invitation.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import * as request from 'supertest'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma/prisma.service'

const mockPrisma = {
  family: {
    findUnique: jest.fn(),
  },
  familyMember: {
    findUnique: jest.fn(),
  },
  invitation: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn(),
}

// Token JWT valide pour les tests — généré avec le même JWT_SECRET que .env.test
const TEST_TOKEN = 'Bearer test-jwt-token'

describe('Flux invitation TribuZen (E2E)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // overrideProvider remplace PrismaService dans tout l'arbre AppModule
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile()

    app = moduleRef.createNestApplication()

    // Reproduire IDENTIQUEMENT main.ts — sinon les tests ne valident pas la prod
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }))

    await app.init()
  })

  afterAll(async () => {
    // Obligatoire : libère le serveur HTTP sinon Jest attend le timeout
    await app.close()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /families/:familyId/invitations', () => {
    it('retourne 201 et l\'invitation créée', async () => {
      // Arrange — famille avec de la place, pas de doublon
      mockPrisma.family.findUnique.mockResolvedValue({
        id: 'fam-1', maxSize: 12,
        _count: { members: 3 },
      })
      mockPrisma.invitation.findFirst.mockResolvedValue(null)
      mockPrisma.invitation.create.mockResolvedValue({
        id: 'inv-1',
        familyId: 'fam-1',
        email: 'bob@tribu.fr',
        status: 'PENDING',
      })

      const res = await request(app.getHttpServer())
        .post('/families/fam-1/invitations')
        .set('Authorization', TEST_TOKEN)
        .send({ email: 'bob@tribu.fr' })
        .expect(201)

      expect(res.body).toMatchObject({ familyId: 'fam-1', status: 'PENDING' })
    })

    it('retourne 400 si email manquant (ValidationPipe)', () => {
      return request(app.getHttpServer())
        .post('/families/fam-1/invitations')
        .set('Authorization', TEST_TOKEN)
        .send({}) // body vide → ValidationPipe rejette
        .expect(400)
    })

    it('retourne 400 si la famille est pleine', async () => {
      mockPrisma.family.findUnique.mockResolvedValue({
        id: 'fam-1', maxSize: 12,
        _count: { members: 12 }, // pleine
      })

      await request(app.getHttpServer())
        .post('/families/fam-1/invitations')
        .set('Authorization', TEST_TOKEN)
        .send({ email: 'bob@tribu.fr' })
        .expect(400)
    })

    it('retourne 400 si une invitation est déjà en attente', async () => {
      mockPrisma.family.findUnique.mockResolvedValue({
        id: 'fam-1', maxSize: 12,
        _count: { members: 3 },
      })
      mockPrisma.invitation.findFirst.mockResolvedValue({
        id: 'inv-0', status: 'PENDING',
      })

      await request(app.getHttpServer())
        .post('/families/fam-1/invitations')
        .set('Authorization', TEST_TOKEN)
        .send({ email: 'bob@tribu.fr' })
        .expect(400)
    })

    it('retourne 401 sans token JWT', () => {
      return request(app.getHttpServer())
        .post('/families/fam-1/invitations')
        .send({ email: 'bob@tribu.fr' })
        .expect(401) // JwtAuthGuard global bloque
    })
  })
})
```

---

## Lancer les tests

```bash
# Tests unitaires
npm test

# Tests e2e
npm run test:e2e

# Couverture (objectif > 70%)
npm run test:cov
```

---

## Lancer l'application

```bash
# Développement
npm run start:dev
# API : http://localhost:3000
# Swagger : http://localhost:3000/api/docs

# Docker (PostgreSQL + app)
docker compose up --build
```

---

## Variante J+30 — sans regarder le corrigé

Refais ce capstone from scratch dans un nouveau dossier. Contraintes :

1. **Schéma** : ajoute un modèle `Comment` lié à `Post` (un post peut avoir plusieurs commentaires). Crée la migration.
2. **CommentModule** : `CommentService.create()` vérifie que l'auteur est membre de la famille du post avant de créer le commentaire. Injecte `FamilyService` via `FamilyModule`.
3. **Tests** : teste `CommentService.create()` avec trois cas — auteur non membre → 403, post introuvable → 404, succès → 201. Écris le test e2e pour `POST /posts/:postId/comments`.
4. **Guard** : ajoute un guard `FamilyMemberGuard` qui vérifie l'appartenance à la famille et applique-le sur les routes qui créent des posts et des commentaires.

Durée estimée : 3-4 h.

---

## Checklist finale avant livraison

- [ ] `PrismaModule` avec `@Global()` et `exports: [PrismaService]`
- [ ] `JwtStrategy` extrait le Bearer token et valide via `JWT_SECRET`
- [ ] `JwtAuthGuard` bypass les routes `@Public()`
- [ ] `AuthController` : `/auth/register` et `/auth/login` marqués `@Public()`
- [ ] `FamilyModule` exporte `FamilyService`
- [ ] `InvitationModule` importe `FamilyModule`
- [ ] `AppModule` : `APP_GUARD` pour `JwtAuthGuard` et `RolesGuard`
- [ ] `main.ts` : `ValidationPipe`, Swagger (dev), shutdown hooks
- [ ] Tests unitaires `InvitationService` : 3 cas couverts
- [ ] Tests e2e : 5 cas HTTP couverts, `app.close()` dans `afterAll`
- [ ] `npx prisma migrate dev` s'exécute sans erreur
- [ ] `npm run start:dev` démarre, Swagger accessible
