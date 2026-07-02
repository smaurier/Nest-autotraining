---
titre: Projet final
cours: 09-nestjs
notions: [assembler une API complète, architecture par modules de domaine, combiner auth validation ORM tests et doc, structure de projet propre, du zéro à une API déployable, synthèse du cours]
outcomes: [assembler une API NestJS complète (modules, DI, controllers, services, ORM, auth, tests), structurer proprement le projet, livrer une API testée et documentée]
prerequis: [23-performance-deploiement]
next: 25-mongodb-mongoose
libs: [{ name: "@nestjs/core", version: "^11" }, { name: "@nestjs/testing", version: "^11" }, { name: "@nestjs/config", version: "^4" }, { name: "@nestjs/throttler", version: "^6" }, { name: "@nestjs/swagger", version: "^8" }, { name: "joi", version: "^17" }, { name: "@prisma/client", version: "^6" }]
tribuzen: construire l'API TribuZen complète (FamilyModule, PostModule, InvitationModule, AuthModule) de bout en bout — capstone
last-reviewed: 2026-07
---

# Projet final

> **Outcomes — tu sauras FAIRE :** assembler une API NestJS complète (modules, DI, controllers, services, ORM, auth, tests), structurer proprement le projet par domaines, livrer une API testée et documentée.
> **Difficulté :** :star::star::star::star::star:

## 1. Cas concret d'abord

Le module 23 a montré comment rendre une API déployable — shutdown hooks, healthchecks, variables d'environnement validées. `onModuleDestroy` vu dans `PrismaService` en 23 réapparaît ici : une API déployable doit aussi être structurée par domaines de métier, sinon les modules deviennent incontrôlables à l'échelle.

Tu as tous les blocs du cours. Tu essaies de les coller ensemble pour TribuZen :

```ts
// ❌ tentative naïve — tout dans AppModule
@Module({
  imports: [PrismaModule, JwtModule, ThrottlerModule],
  controllers: [FamilyController, PostController, InvitationController],
  providers: [FamilyService, PostService, InvitationService, JwtStrategy, JwtAuthGuard],
})
export class AppModule {}
```

Ça compile. Puis ça explose en cascade : `FamilyService` dépend de `PrismaService` mais `PrismaModule` n'exporte rien. `InvitationService` a besoin de `FamilyService` mais `FamilyController` et `InvitationController` partagent le même module — les responsabilités se mélangent. Les tests e2e ne savent pas quoi mocker. Swagger affiche tout dans un seul tas.

Le problème n'est pas NestJS. C'est l'absence de structure par domaines de métier. Chaque domaine — `Family`, `Post`, `Invitation`, `Auth` — doit vivre dans son propre module avec ses propres règles d'export.

```ts
// ✅ architecture par domaines — chaque module contrôle ses exports
@Module({
  imports: [FamilyModule, PostModule, InvitationModule, AuthModule],
  // AppModule n'a plus de controllers ni de providers métier
})
export class AppModule {}
```

Ce module t'accompagne dans l'assemblage complet : schéma, modules de domaine, wiring `AppModule`, `main.ts` de prod, et tests e2e de bout en bout.

## 2. Théorie complète, concise

### 2.1 Architecture par modules de domaine

Un module de domaine regroupe tout ce qui concerne un concept métier : le controller, le service, les DTOs, les guards spécifiques, et les exports explicites. Il est autonome et testable en isolation.

| Couche | Contenu | Exemple TribuZen |
|--------|---------|-----------------|
| Controller | Routes HTTP, décorateurs Swagger, guards | `FamilyController` |
| Service | Logique métier, appels Prisma | `FamilyService` |
| DTO | Validation `class-validator` | `CreateFamilyDto` |
| Module | Déclaration, imports, exports | `FamilyModule` |

Règle d'or : un module ne déclare dans `exports` que ce dont les autres modules ont réellement besoin. `FamilyService` est exporté parce qu'`InvitationModule` l'utilise. `FamilyController` n'est jamais exporté — c'est un consumer, pas un provider.

### 2.2 Ordre d'assemblage

L'ordre évite les dépendances circulaires et les erreurs de résolution au démarrage :

1. **Infrastructure** — `PrismaModule` (pas de dépendance métier), `ConfigModule.forRoot()` global.
2. **Auth** — `AuthModule` exporte `JwtModule` et `JwtStrategy`; les modules domaine importent `AuthModule` pour protéger leurs routes.
3. **Domaines feuilles** — modules sans dépendance sur d'autres domaines métier (`FamilyModule`).
4. **Domaines composés** — modules qui importent d'autres domaines (`InvitationModule` importe `FamilyModule`).
5. **AppModule** — assemble tout, déclare les providers globaux (guards, pipes, intercepteurs).
6. **main.ts** — applique les pipes globaux, CORS, Swagger, Helmet, écoute le port.

### 2.3 Providers globaux dans AppModule

Certains providers doivent s'appliquer à toutes les routes sans répétition dans chaque module :

```ts
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'

@Module({
  providers: [
    // Guard global : toutes les routes sont authentifiées sauf @Public()
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Guard global RBAC : @Roles('ADMIN') vérifié partout
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
```

`APP_GUARD`, `APP_PIPE`, `APP_INTERCEPTOR` sont des tokens de NestJS qui enregistrent un provider comme global sans passer par `useGlobalGuards()` dans `main.ts`. L'avantage : les providers enregistrés via `APP_GUARD` peuvent eux-mêmes recevoir des dépendances injectées (ce que `useGlobalGuards()` dans main.ts ne permet pas).

### 2.4 main.ts de production

`main.ts` ne contient pas de logique métier. Il configure l'application NestJS pour répondre en production :

```ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Validation globale — reproduire cette config dans les tests e2e
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,        // strip des propriétés non décorées
    forbidNonWhitelisted: true,
    transform: true,        // transforme string → number automatiquement
  }))

  // Swagger — désactivé en prod via variable d'environnement
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('TribuZen API')
      .addBearerAuth()
      .build()
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config))
  }

  app.enableShutdownHooks() // graceful shutdown Prisma
  await app.listen(process.env.PORT ?? 3000)
}
```

### 2.5 Checklist de livraison

Une API est livrable quand elle coche toutes ces cases :

| Critère | Signal concret |
|---------|---------------|
| Modules de domaine isolés | Chaque domaine dans son propre dossier |
| Prisma exporté depuis PrismaModule | `PrismaService` injectable partout |
| Auth globale avec porte de sortie | `@Public()` pour les routes ouvertes |
| Validation DTO sur chaque mutation | `ValidationPipe` dans main.ts + tests e2e |
| Tests unitaires services | `jest.clearAllMocks()` + mocks Prisma |
| Tests e2e flux critiques | `overrideProvider(PrismaService)` + `app.close()` |
| Swagger documenté | `@ApiTags`, `@ApiBearerAuth`, `@ApiOperation` |
| Variables d'environnement validées | Joi schema dans `ConfigModule.forRoot()` |

## 3. Worked examples

### Exemple A — Schéma Prisma TribuZen et PrismaModule

```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id           String       @id @default(cuid())
  email        String       @unique
  passwordHash String       @map("password_hash")
  createdAt    DateTime     @default(now()) @map("created_at")
  updatedAt    DateTime     @updatedAt @map("updated_at")

  families     FamilyMember[]
  posts        Post[]
  sentInvitations Invitation[] @relation("InvitationSender")

  @@map("users")
}

model Family {
  id          String         @id @default(cuid())
  name        String
  maxSize     Int            @default(12) @map("max_size")
  createdAt   DateTime       @default(now()) @map("created_at")
  updatedAt   DateTime       @updatedAt @map("updated_at")

  members     FamilyMember[]
  posts       Post[]
  invitations Invitation[]

  @@map("families")
}

model FamilyMember {
  id        String   @id @default(cuid())
  role      String   @default("MEMBER")
  joinedAt  DateTime @default(now()) @map("joined_at")

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String   @map("user_id")

  family    Family   @relation(fields: [familyId], references: [id], onDelete: Cascade)
  familyId  String   @map("family_id")

  @@unique([userId, familyId])
  @@map("family_members")
}

model Post {
  id        String   @id @default(cuid())
  content   String
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  author    User     @relation(fields: [authorId], references: [id])
  authorId  String   @map("author_id")

  family    Family   @relation(fields: [familyId], references: [id])
  familyId  String   @map("family_id")

  @@index([familyId])
  @@map("posts")
}

model Invitation {
  id        String   @id @default(cuid())
  email     String
  status    String   @default("PENDING")
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  sender    User     @relation("InvitationSender", fields: [senderId], references: [id])
  senderId  String   @map("sender_id")

  family    Family   @relation(fields: [familyId], references: [id])
  familyId  String   @map("family_id")

  @@index([familyId])
  @@index([email])
  @@map("invitations")
}
```

```ts
// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect()
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
```

```ts
// src/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common'
import { PrismaService } from './prisma.service'

// @Global() — PrismaService injectable sans import explicite dans chaque module
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

**Pas-à-pas :** (1) `@Global()` sur `PrismaModule` — `PrismaService` devient injectable dans tout module sans avoir à écrire `imports: [PrismaModule]` à chaque fois ; (2) `OnModuleInit` / `OnModuleDestroy` — NestJS appelle `$connect()` au démarrage et `$disconnect()` à l'arrêt (graceful shutdown) ; (3) `PrismaService extends PrismaClient` — on ne réinstancie pas, on hérite du client généré par Prisma.

### Exemple B — FamilyModule et InvitationModule avec dépendance croisée

```ts
// src/family/family.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateFamilyDto } from './dto/create-family.dto'

@Injectable()
export class FamilyService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateFamilyDto, creatorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const family = await tx.family.create({
        data: { name: dto.name, maxSize: dto.maxSize ?? 12 },
      })

      // Le créateur devient ADMIN de la famille dans la même transaction
      await tx.familyMember.create({
        data: { userId: creatorId, familyId: family.id, role: 'ADMIN' },
      })

      return family
    })
  }

  async findById(id: string) {
    const family = await this.prisma.family.findUnique({
      where: { id },
      include: { members: { include: { user: { select: { id: true, email: true } } } } },
    })
    if (!family) throw new NotFoundException(`Famille ${id} introuvable`)
    return family
  }

  async isMember(familyId: string, userId: string): Promise<boolean> {
    const member = await this.prisma.familyMember.findUnique({
      where: { userId_familyId: { userId, familyId } },
    })
    return member !== null
  }

  async hasCapacity(familyId: string): Promise<boolean> {
    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
      include: { _count: { select: { members: true } } },
    })
    if (!family) throw new NotFoundException(`Famille ${familyId} introuvable`)
    return family._count.members < family.maxSize
  }
}
```

```ts
// src/family/family.module.ts
import { Module } from '@nestjs/common'
import { FamilyService } from './family.service'
import { FamilyController } from './family.controller'

@Module({
  controllers: [FamilyController],
  providers: [FamilyService],
  exports: [FamilyService], // InvitationModule en a besoin
})
export class FamilyModule {}
```

```ts
// src/invitation/invitation.service.ts
import { Injectable, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { FamilyService } from '../family/family.service'

@Injectable()
export class InvitationService {
  constructor(
    private readonly prisma: PrismaService,
    // FamilyService injecté depuis FamilyModule via imports
    private readonly familyService: FamilyService,
  ) {}

  async invite(familyId: string, senderId: string, email: string) {
    // Règle 1 — vérifier la capacité via FamilyService
    const hasCapacity = await this.familyService.hasCapacity(familyId)
    if (!hasCapacity) {
      throw new BadRequestException('La famille est pleine')
    }

    // Règle 2 — pas d'invitation en attente pour cet email dans cette famille
    const existing = await this.prisma.invitation.findFirst({
      where: { familyId, email, status: 'PENDING' },
    })
    if (existing) {
      throw new BadRequestException('Une invitation est déjà en attente pour cet email')
    }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    return this.prisma.invitation.create({
      data: { familyId, senderId, email, expiresAt },
    })
  }
}
```

```ts
// src/invitation/invitation.module.ts
import { Module } from '@nestjs/common'
import { FamilyModule } from '../family/family.module'
import { InvitationService } from './invitation.service'
import { InvitationController } from './invitation.controller'

@Module({
  imports: [FamilyModule], // rend FamilyService injectable dans ce module
  controllers: [InvitationController],
  providers: [InvitationService],
})
export class InvitationModule {}
```

**Pas-à-pas :** (1) `FamilyModule` déclare `exports: [FamilyService]` — `FamilyService` devient injectable dans tout module qui importe `FamilyModule` ; (2) `InvitationModule` déclare `imports: [FamilyModule]` — les deux sont nécessaires ; (3) `InvitationService` peut maintenant injecter `FamilyService` par son constructeur, sans token ni `@Inject()` ; (4) la transaction dans `FamilyService.create()` garantit que famille + membre admin sont créés ensemble ou pas du tout.

### Exemple C — AppModule et main.ts complets

```ts
// src/app.module.ts
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
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
    // 1. Config globale validée par Joi — disponible dans tout le projet via ConfigService
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        PORT: Joi.number().default(3000),
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().min(32).required(),
      }),
    }),

    // 2. Rate limiting global
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),

    // 3. Infrastructure
    PrismaModule, // @Global() — PrismaService injectable partout

    // 4. Auth — JwtModule et stratégies exportés
    AuthModule,

    // 5. Domaines métier
    FamilyModule,
    PostModule,
    InvitationModule,
  ],
  providers: [
    // Guards globaux — s'appliquent à toutes les routes sans import dans chaque module
    { provide: APP_GUARD, useClass: JwtAuthGuard },   // toutes routes protégées sauf @Public()
    { provide: APP_GUARD, useClass: RolesGuard },     // @Roles('ADMIN') vérifié globalement
    { provide: APP_GUARD, useClass: ThrottlerGuard }, // rate limiting global
  ],
})
export class AppModule {}
```

```ts
// src/main.ts
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Validation globale — reproduire EXACTEMENT dans les tests e2e (beforeAll)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  // Swagger — désactivé en production
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('TribuZen API')
      .setDescription('API famille — capstone NestJS')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth')
      .addTag('families')
      .addTag('posts')
      .addTag('invitations')
      .build()
    const document = SwaggerModule.createDocument(app, config)
    SwaggerModule.setup('api/docs', app, document)
  }

  // Graceful shutdown — PrismaService.$disconnect() appelé à l'arrêt
  app.enableShutdownHooks()

  const port = process.env.PORT ?? 3000
  await app.listen(port)
  console.log(`TribuZen API sur le port ${port}`)
}
bootstrap()
```

**Pas-à-pas :** (1) `ConfigModule.forRoot({ isGlobal: true })` — `ConfigService` injectable partout sans import répété ; (2) l'ordre `PrismaModule → AuthModule → domaines` respecte la chaîne de dépendances — NestJS résout dans l'ordre des imports ; (3) `APP_GUARD` avec `JwtAuthGuard` rend toutes les routes privées par défaut — seul `@Public()` sur une route ou controller ouvre l'accès ; (4) `app.enableShutdownHooks()` dans main.ts déclenche `PrismaService.onModuleDestroy()` à l'arrêt, garantissant la déconnexion propre de la DB.

## 4. Pièges & misconceptions

- **Dépendance circulaire entre modules.** `FamilyModule` importe `InvitationModule` et `InvitationModule` importe `FamilyModule` — NestJS lève `Circular dependency detected`. Correction : introduire un `forwardRef(() => InvitationModule)` si la circularité est inévitable, ou mieux, extraire le service partagé dans un troisième module (`CoreModule`) que les deux importent.

- **PrismaModule sans `exports`.** `@Global()` seul ne suffit pas. Sans `exports: [PrismaService]`, `PrismaService` ne sera pas injecté même si le module est global. Correction : `@Global()` + `exports: [PrismaService]` dans `PrismaModule`.

- **`useGlobalGuards()` dans main.ts bloque l'injection.** Un guard enregistré via `app.useGlobalGuards(new JwtAuthGuard())` ne peut pas recevoir de dépendances NestJS (`ConfigService`, `JwtService`). Correction : enregistrer via `{ provide: APP_GUARD, useClass: JwtAuthGuard }` dans `AppModule.providers` — le conteneur IoC gère l'injection.

- **Oublier `@Public()` sur les routes ouvertes.** Avec `JwtAuthGuard` global, `POST /auth/register` et `POST /auth/login` sont bloquées (401) si elles ne sont pas marquées `@Public()`. Correction : créer un décorateur `@Public()` qui pose un metadata `isPublic: true` et le vérifier dans `JwtAuthGuard.canActivate()`.

- **Tests e2e sans `ValidationPipe` dans `beforeAll`.** `POST /families` avec un body vide retourne 201 en test mais 400 en prod. Correction : reproduire exactement `app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))` dans `beforeAll` du test e2e.

- **Transactions Prisma et mocks.** `prisma.$transaction(async tx => ...)` passe un client transactionnel `tx` — différent de `prisma`. Un mock `{ $transaction: jest.fn() }` sans implémenter la logique interne fait passer les tests sans valider le comportement. Correction : mocker `$transaction` en appelant la callback avec le même mock : `$transaction: jest.fn().mockImplementation(fn => fn(mockPrisma))`.

## 5. Ancrage TribuZen

Couche fil-rouge : **construire l'API TribuZen complète (FamilyModule, PostModule, InvitationModule, AuthModule) de bout en bout** (`smaurier/tribuzen`).

- `PrismaModule` avec `@Global()` fournit `PrismaService` à tous les modules domaine sans import répété. Le schéma couvre `User`, `Family`, `FamilyMember`, `Post`, `Invitation` avec les bonnes relations et index.
- `AuthModule` exporte `JwtModule` et la stratégie JWT. `JwtAuthGuard` déclaré via `APP_GUARD` dans `AppModule` protège toutes les routes — les endpoints publics (`/auth/register`, `/auth/login`) sont marqués `@Public()`.
- `FamilyModule` exporte `FamilyService` (logique de capacité, vérification de membre). `InvitationModule` l'importe pour vérifier `hasCapacity()` avant de créer une invitation — dépendance unidirectionnelle, pas de circularité.
- `PostModule` n'exporte rien (`PostService` n'est utilisé que dans `PostController`). Il accède à `PrismaService` directement via `@Global()`.
- Les tests e2e couvrent le flux complet : register → login → create family → invite → accept invitation. `overrideProvider(PrismaService)` remplace Prisma sans toucher au code métier.

Structure cible dans `smaurier/tribuzen` :

```
apps/api/src/
  prisma/
    prisma.service.ts
    prisma.module.ts      ← @Global(), exports: [PrismaService]
  auth/
    auth.module.ts        ← exports: [JwtModule]
    auth.controller.ts    ← @Public() sur register + login
    auth.service.ts       ← hashPassword, validateUser, signTokens
    guards/
      jwt-auth.guard.ts
      roles.guard.ts
    strategies/
      jwt.strategy.ts
    decorators/
      public.decorator.ts
      current-user.decorator.ts
  family/
    family.module.ts      ← exports: [FamilyService]
    family.controller.ts
    family.service.ts
    dto/
  post/
    post.module.ts
    post.controller.ts
    post.service.ts
    dto/
  invitation/
    invitation.module.ts  ← imports: [FamilyModule]
    invitation.controller.ts
    invitation.service.ts
    dto/
  app.module.ts           ← APP_GUARD globaux, ConfigModule, ThrottlerModule
  main.ts                 ← ValidationPipe, Swagger, shutdown hooks
apps/api/test/
  auth.e2e-spec.ts
  invitation.e2e-spec.ts
  family.e2e-spec.ts
prisma/
  schema.prisma
  migrations/
  seed.ts
```

## 6. Points clés

1. Chaque domaine métier vit dans son propre module — controller, service, DTOs, module. L'isolation facilite les tests et la lisibilité.
2. `exports` dans un module = frontière explicite de ce que les autres modules peuvent consommer. Par défaut, tout est privé.
3. `@Global()` + `exports` sur `PrismaModule` — `PrismaService` injectable partout sans import répété dans chaque module domaine.
4. Providers globaux (`JwtAuthGuard`, `RolesGuard`) déclarés via `APP_GUARD` dans `AppModule.providers` — les dépendances du guard sont injectées par le conteneur IoC.
5. `@Public()` décorateur de sortie pour les routes ouvertes — sans lui, tout est privé par défaut avec un guard global.
6. L'ordre d'import dans `AppModule` suit la chaîne de dépendances : infrastructure → auth → domaines feuilles → domaines composés.
7. Dans `main.ts`, `app.useGlobalPipes(new ValidationPipe(...))` doit être reproduit identiquement dans `beforeAll` des tests e2e — sinon les tests ne valident pas le comportement de production.
8. `prisma.$transaction(async tx => ...)` — toujours passer `tx` (le client transactionnel) aux opérations internes, jamais `this.prisma` directement.

## 7. Seeds Anki

```
Pourquoi déclarer PrismaModule avec @Global() ?|PrismaService devient injectable dans tous les modules sans qu'ils aient à écrire imports: [PrismaModule] — un seul enregistrement global suffit
Quelle est la différence entre APP_GUARD dans AppModule et useGlobalGuards() dans main.ts ?|APP_GUARD passe par le conteneur IoC — le guard peut recevoir des dépendances injectées (JwtService, ConfigService). useGlobalGuards(new Guard()) instancie manuellement — zéro injection
Comment rendre une route publique avec un JwtAuthGuard global ?|Créer un décorateur @Public() qui pose SetMetadata('isPublic', true) et vérifier ce metadata dans JwtAuthGuard.canActivate() avant de valider le token
Quelle est la règle des exports entre modules dans NestJS ?|Un provider déclaré dans un module est privé par défaut. Il faut l'ajouter à exports: [...] du module propriétaire ET à imports: [LeModule] dans le module consommateur
Comment mocker prisma.$transaction dans un test unitaire ?|$transaction: jest.fn().mockImplementation(fn => fn(mockPrisma)) — la callback reçoit le même mock en guise de client transactionnel
Quel est le bon ordre d'import dans AppModule pour éviter les erreurs de résolution ?|ConfigModule global → PrismaModule → AuthModule → domaines feuilles → domaines composés qui importent d'autres domaines
Pourquoi reproduire ValidationPipe dans beforeAll des tests e2e ?|Sans ValidationPipe les corps invalides passent en test mais sont rejetés en prod. Les tests valideraient un comportement qui n'existe pas en production
Comment détecter une dépendance circulaire entre modules NestJS ?|NestJS lève Circular dependency detected au démarrage. Corriger en extrayant le service partagé dans un troisième module ou en utilisant forwardRef() si la circularité est inévitable
```

## Pont vers le lab

> Lab associé : `09-nestjs/labs/lab-24-projet-final/README.md`. Tu y construis l'API TribuZen complète de bout en bout — schéma Prisma, quatre modules de domaine, wiring AppModule, tests unitaires et e2e — corrigé complet commenté inline + variante J+30 dans le README.
