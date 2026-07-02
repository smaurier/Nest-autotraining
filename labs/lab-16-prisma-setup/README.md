# Lab 16 — Prisma schema et client

> **Outcome :** à la fin, tu sais écrire un schéma Prisma avec modèles et relations, appliquer une migration, et implémenter un `PrismaService` NestJS avec CRUD type-safe.
> **Vrai outil :** Prisma 6 (`prisma ^6`, `@prisma/client ^6`), NestJS 11.
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

Tu poses la couche persistance de TribuZen dans un projet NestJS existant. L'objectif n'est pas de copier-coller un schéma — c'est de **le dériver des règles métier** : un utilisateur appartient à une famille, publie des posts, reçoit ou envoie des invitations. Chaque choix (nullable ou pas, enum ou string, `onDelete: Cascade` ou `SetNull`) est une décision à justifier avant de l'écrire.

Pas de gap-fill. Tu pars du projet vide `nest new tribuzen-prisma` et tu construis de A à Z.

## Étapes (en friction)

1. Installer Prisma 6 et initialiser le schéma.

   ```bash
   pnpm add -D prisma
   pnpm add @prisma/client
   npx prisma init --datasource-provider postgresql
   ```

   Configurer `DATABASE_URL` dans `.env` (PostgreSQL local ou Docker). Vérifier que `.env` est dans `.gitignore` avant tout commit.

2. Écrire le schéma TribuZen dans `prisma/schema.prisma`. Quatre modèles : `User`, `Family`, `Post`, `Invitation`. Deux enums : `Role` (OWNER, ADMIN, MEMBER, GUEST) et `InvitationStatus` (PENDING, ACCEPTED, DECLINED, EXPIRED). Contraintes à respecter avant d'écrire le premier caractère :

   - `User` peut exister sans famille → `familyId` nullable, `onDelete: SetNull`
   - `Post` et `Invitation` requièrent une famille → `onDelete: Cascade`
   - Impossible d'inviter deux fois le même email dans la même famille → contrainte `@@unique([email, familyId])`
   - Colonnes en snake_case en base, champs camelCase en TypeScript → `@map` sur les champs, `@@map` sur les modèles

3. Appliquer la migration initiale et lire le SQL généré.

   ```bash
   npx prisma migrate dev --name init
   ```

   Ouvrir `prisma/migrations/*/migration.sql`. Repérer les `CREATE TABLE`, les `CREATE INDEX`, les `ADD CONSTRAINT FOREIGN KEY` et les `ON DELETE` — vérifier qu'ils correspondent aux décisions de l'étape 2.

4. Créer `src/prisma/prisma.service.ts` : `PrismaService extends PrismaClient`, `onModuleInit` → `$connect`, `onModuleDestroy` → `$disconnect`. Créer `src/prisma/prisma.module.ts` avec `@Global()`, `providers: [PrismaService]`, `exports: [PrismaService]`. Importer `PrismaModule` dans `AppModule` — un seul import suffit.

5. Créer `FamilyModule` avec `FamilyService` qui injecte `PrismaService`. Implémenter : `create`, `findAll` (avec membres), `findOne` (avec membres et 10 posts récents), `update`, `remove`, et `canJoin(familyId, maxMembers)`. Utiliser les types générés `Prisma.FamilyCreateInput` et `Prisma.FamilyUpdateInput` — pas d'interface DTO manuelle dans le service.

## Corrigé complet commenté

```prisma
// prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  OWNER
  ADMIN
  MEMBER
  GUEST
}

enum InvitationStatus {
  PENDING
  ACCEPTED
  DECLINED
  EXPIRED
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  role      Role     @default(MEMBER)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt      @map("updated_at")

  familyId        String?      @map("family_id")
  // SetNull : si la famille est supprimée, le User reste, son familyId devient null
  family          Family?      @relation("FamilyMembers", fields: [familyId], references: [id], onDelete: SetNull)
  posts           Post[]
  sentInvitations Invitation[] @relation("InvitedBy")

  @@map("users")
}

model Family {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt      @map("updated_at")

  // Champs virtuels — zéro colonne en base
  members     User[]       @relation("FamilyMembers")
  posts       Post[]
  invitations Invitation[]

  @@map("families")
}

model Post {
  id        String   @id @default(cuid())
  content   String   @db.Text
  createdAt DateTime @default(now()) @map("created_at")

  authorId String @map("author_id")
  // Cascade : si l'auteur ou la famille est supprimé, les posts disparaissent aussi
  author   User   @relation(fields: [authorId], references: [id], onDelete: Cascade)
  familyId String @map("family_id")
  family   Family @relation(fields: [familyId], references: [id], onDelete: Cascade)

  @@index([familyId, createdAt])  // index composite pour le feed chronologique
  @@map("posts")
}

model Invitation {
  id        String           @id @default(cuid())
  email     String
  status    InvitationStatus @default(PENDING)
  expiresAt DateTime         @map("expires_at")
  createdAt DateTime         @default(now()) @map("created_at")

  familyId    String @map("family_id")
  family      Family @relation(fields: [familyId], references: [id], onDelete: Cascade)
  invitedById String @map("invited_by_id")
  // Nom de relation explicite : User a deux relations distinctes liées à Invitation
  invitedBy   User   @relation("InvitedBy", fields: [invitedById], references: [id], onDelete: Cascade)

  // Contrainte composite : pas deux invitations actives pour le même email dans la même famille
  @@unique([email, familyId])
  @@map("invitations")
}
```

```ts
// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
// extends PrismaClient : PrismaService hérite de toutes les méthodes (prisma.user, prisma.family, etc.)
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    // NestJS appelle ce hook quand le module est initialisé — connexion explicite
    await this.$connect()
  }

  async onModuleDestroy(): Promise<void> {
    // NestJS appelle ce hook à l'arrêt propre (Ctrl+C, SIGTERM) — libère le pool de connexions
    await this.$disconnect()
  }
}
```

```ts
// src/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common'
import { PrismaService } from './prisma.service'

@Global()
// @Global() : PrismaService est injectable dans tout module sans import explicite répété
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

```ts
// src/app.module.ts
import { Module } from '@nestjs/common'
import { PrismaModule } from './prisma/prisma.module'
import { FamilyModule } from './family/family.module'

@Module({
  imports: [
    PrismaModule,  // un seul import — @Global() distribue PrismaService dans toute l'app
    FamilyModule,
  ],
})
export class AppModule {}
```

```ts
// src/family/family.service.ts
import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { Prisma } from '@prisma/client'

@Injectable()
export class FamilyService {
  // PrismaService disponible via @Global() PrismaModule — pas d'import dans FamilyModule
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.FamilyCreateInput) {
    // Prisma.FamilyCreateInput : type généré, champs requis obligatoires à la compilation
    return this.prisma.family.create({ data })
  }

  async findAll() {
    return this.prisma.family.findMany({
      include: { members: true },  // jointure SQL automatique — type retourné inclut members: User[]
      orderBy: { createdAt: 'desc' },
    })
  }

  async findOne(id: string) {
    const family = await this.prisma.family.findUnique({
      where: { id },
      include: {
        // select dans include : ne charge que les champs nécessaires — moins de données réseau
        members: { select: { id: true, name: true, role: true } },
        posts: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    })
    if (!family) throw new NotFoundException(`Famille ${id} introuvable`)
    return family
  }

  async update(id: string, data: Prisma.FamilyUpdateInput) {
    await this.findOne(id)  // valide l'existence — lève NotFoundException si absent
    return this.prisma.family.update({ where: { id }, data })
  }

  async remove(id: string) {
    await this.findOne(id)  // valide l'existence avant suppression
    return this.prisma.family.delete({ where: { id } })
  }

  // Règle métier TribuZen : count() en base, jamais findMany().length en mémoire
  async canJoin(familyId: string, maxMembers = 12): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { familyId } })
    return count < maxMembers
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
  exports: [FamilyService],
})
export class FamilyModule {}
// Pas d'import de PrismaModule — @Global() le rend disponible automatiquement
```

## Variante J+30 (fading)

Même exercice, sans consulter le corrigé. Contraintes supplémentaires :

1. Ajouter un modèle `Comment` lié à `Post` (relation 1-N) avec une relation auto-référençante pour les réponses imbriquées (`parent Comment?` + `replies Comment[]`). Appliquer `npx prisma migrate dev --name add_comment`. Lire le SQL généré — repérer la self-join et le comportement `onDelete`.

2. Dans `FamilyService.findAll()`, ajouter `_count: { select: { members: true } }` pour exposer le nombre de membres sans les charger. Retourner `{ families, total }` via `Promise.all([prisma.family.findMany(...), prisma.family.count()])`.

3. Créer `InvitationService.create(dto)` qui appelle `canJoin()` avant d'insérer — si la famille est pleine, lancer `ForbiddenException`. Réécrire `PrismaModule` sans `@Global()` et importer manuellement dans chaque module consommateur — constater et documenter la différence avec la version `@Global()`.

Temps cible : 45 minutes sans consulter le corrigé.

## Application TribuZen

Commit cible dans `smaurier/tribuzen` :

```
feat(prisma): schéma TribuZen initial (User, Family, Post, Invitation) + PrismaService
```

Fichiers à créer :

- `prisma/schema.prisma`
- `prisma/migrations/20260701000000_init/migration.sql`
- `apps/api/src/prisma/prisma.service.ts`
- `apps/api/src/prisma/prisma.module.ts`
- `apps/api/src/family/family.service.ts`
- `apps/api/src/family/family.module.ts`

Critère de done : `npx prisma migrate dev` se termine sans erreur, `prisma.family.create({ data: { name: 'Famille Test' } })` insère une ligne, `GET /families` répond 200 avec un tableau JSON.
