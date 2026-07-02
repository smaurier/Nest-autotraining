# Lab 17 — Prisma avancé et comparaison

> **Outcome :** à la fin, tu sais écrire une transaction interactive Prisma 6, un nested write, une pagination curseur, un middleware soft delete, et une requête SQL brute — tout en construisant le module `InvitationService` de TribuZen.
> **Vrai outil :** Prisma ^6 (`@prisma/client`, `prisma`).
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

Tu construis le module `invitation` de TribuZen dans un projet NestJS + Prisma existant. Pas de gap-fill — tu lis les fichiers en place, tu comprends le schéma, et tu écris le code de A à Z.

Objectif fonctionnel :

- `POST /invitations` → créer une invitation **et** une notification de façon atomique (transaction interactive)
- `GET /invitations?familyId=X&cursor=Y&take=10` → lister les invitations d'une famille avec pagination curseur
- `DELETE /invitations/:id` → soft delete (marque `deletedAt`, ne supprime pas la ligne)
- `GET /invitations/stats` → stats SQL brutes (`pending` et `total` par famille)
- Middleware `PrismaService` : logging des requêtes > 200 ms + soft delete automatique sur `Invitation`

## Étapes (en friction)

1. **Lire le schéma Prisma existant** (`prisma/schema.prisma`). Identifier les modèles `Invitation`, `Notification`, `Family`. Vérifier que les champs `deletedAt`, `status`, `familyId` sont présents. Lancer `npx prisma generate` si besoin.

2. **`src/prisma/prisma.service.ts`** — Étendre `PrismaClient` avec `OnModuleInit`. Dans le constructeur, enregistrer deux middlewares via `$use` dans l'ordre : (a) logging des requêtes > 200 ms avec `Logger`, (b) soft delete sur le modèle `Invitation` (transformer `delete` en `update { deletedAt: new Date() }`, filtrer `deletedAt: null` sur `findMany` et `findFirst`).

3. **`src/invitation/invitation.service.ts`** — Injectable. Implémenter :
   - `createInvitation(familyId, email)` : transaction interactive qui vérifie la capacité de la famille (`findUniqueOrThrow`), lève `FAMILY_FULL` si pleine, crée l'invitation avec nested write `notifications: { create: { type: 'INVITE', read: false } }`.
   - `findWithCursor(familyId, cursor?, limit)` : pagination curseur (`take: limit + 1`, `cursor: { id }`, `skip: 1`), retourne `{ data, nextCursor }`.
   - `softDelete(id)` : appel simple à `prisma.invitation.delete({ where: { id } })` — le middleware `$use` intercepte et transforme en soft delete.
   - `getStats()` : `$queryRaw<...>` avec `Prisma.sql` pour retourner `{ familyId, pending, total }[]` via `COUNT(*) FILTER`.

4. **`src/invitation/invitation.controller.ts`** — Controller `@Controller('invitations')`. Brancher `POST /`, `GET /`, `DELETE /:id`, `GET /stats` sur les méthodes du service. Valider `familyId` et `email` dans le body (DTO minimal).

5. **Vérification manuelle** : démarrer l'app (`npm run start:dev`), créer une invitation via `POST /invitations`, vérifier en base que l'invitation ET la notification existent. Supprimer via `DELETE /invitations/:id`, vérifier que `deletedAt` est rempli et que `GET /invitations` ne la retourne plus.

## Corrigé complet commenté

```ts
// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('PrismaService')

  constructor() {
    super()

    // Middleware 1 : logging des requêtes lentes (enregistré en premier)
    this.$use(async (params, next) => {
      const start = Date.now()
      const result = await next(params)
      const ms = Date.now() - start
      if (ms > 200) {
        this.logger.warn(`Lent: ${params.model}.${params.action} — ${ms}ms`)
      }
      return result
    })

    // Middleware 2 : soft delete sur Invitation (enregistré après le logging)
    this.$use(async (params, next) => {
      if (params.model === 'Invitation') {
        if (params.action === 'delete') {
          // Intercepter delete → transformer en update soft
          params.action = 'update'
          params.args['data'] = { deletedAt: new Date() }
        }
        if (params.action === 'findMany' || params.action === 'findFirst') {
          // Filtrer automatiquement les soft-deleted — transparent pour les appelants
          params.args ??= {}
          params.args.where = { ...params.args.where, deletedAt: null }
        }
      }
      return next(params)
    })
  }

  async onModuleInit() {
    await this.$connect()
  }
}
```

```ts
// src/invitation/invitation.service.ts
import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class InvitationService {
  constructor(private readonly prisma: PrismaService) {}

  // Transaction interactive — atomique : invitation + notification ou rien
  async createInvitation(familyId: string, email: string) {
    return this.prisma.$transaction(
      async (tx) => {
        // Vérification dans la transaction = lecture cohérente avec l'écriture
        const family = await tx.family.findUniqueOrThrow({
          where: { id: familyId },
          select: { memberCount: true, maxSize: true },
        })
        if (family.memberCount >= family.maxSize) {
          throw new Error('FAMILY_FULL') // ROLLBACK automatique
        }

        // Nested write : invitation + notification en une seule opération SQL
        return tx.invitation.create({
          data: {
            email,
            status: 'PENDING',
            family: { connect: { id: familyId } },
            notifications: {
              create: { type: 'INVITE', read: false },
              // si contrainte sur notification échoue → ROLLBACK de l'invitation aussi
            },
          },
          select: { id: true, email: true, status: true, createdAt: true },
        })
      },
      { maxWait: 5000, timeout: 10000 },
    )
  }

  // Pagination curseur — performante sur grandes tables
  async findWithCursor(familyId: string, cursor?: string, limit = 10) {
    const items = await this.prisma.invitation.findMany({
      where: { familyId, status: 'PENDING' }, // deletedAt: null filtré par le middleware
      orderBy: { id: 'asc' },
      take: limit + 1,                         // +1 pour détecter la page suivante
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, email: true, createdAt: true },
    })

    const hasNext = items.length > limit
    const data = hasNext ? items.slice(0, limit) : items
    return { data, nextCursor: hasNext ? data.at(-1)!.id : null }
  }

  // Soft delete — le middleware $use transforme delete en update{ deletedAt }
  async softDelete(id: string) {
    return this.prisma.invitation.delete({ where: { id } })
    // PrismaService.$use intercepte → update { deletedAt: new Date() }
  }

  // Stats SQL brutes — FILTER et COUNT non disponibles via l'API Prisma standard
  async getStats(): Promise<{ familyId: string; pending: number; total: number }[]> {
    return this.prisma.$queryRaw<
      { familyId: string; pending: number; total: number }[]
    >(Prisma.sql`
      SELECT
        family_id                                              AS "familyId",
        COUNT(*) FILTER (WHERE status = 'PENDING')::int       AS pending,
        COUNT(*)::int                                          AS total
      FROM "Invitation"
      WHERE deleted_at IS NULL
      GROUP BY family_id
      ORDER BY pending DESC
    `)
    // ::int obligatoire : COUNT retourne bigint PostgreSQL, TypeScript attend number
  }
}
```

```ts
// src/invitation/invitation.controller.ts
import {
  Controller, Post, Get, Delete,
  Param, Body, Query,
} from '@nestjs/common'
import { InvitationService } from './invitation.service'

class CreateInvitationDto {
  familyId: string
  email: string
}

@Controller('invitations')
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Post()
  create(@Body() dto: CreateInvitationDto) {
    return this.invitationService.createInvitation(dto.familyId, dto.email)
  }

  @Get()
  findAll(
    @Query('familyId') familyId: string,
    @Query('cursor') cursor?: string,
    @Query('take') take?: string,
  ) {
    return this.invitationService.findWithCursor(familyId, cursor, take ? +take : 10)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.invitationService.softDelete(id)
  }

  @Get('stats')
  stats() {
    return this.invitationService.getStats()
  }
}
```

```ts
// src/invitation/invitation.module.ts
import { Module } from '@nestjs/common'
import { InvitationService } from './invitation.service'
import { InvitationController } from './invitation.controller'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [PrismaModule],            // PrismaService injectable via PrismaModule.exports
  controllers: [InvitationController],
  providers: [InvitationService],
  exports: [InvitationService],       // injectable dans NotificationModule si besoin
})
export class InvitationModule {}
```

## Variante J+30 (fading)

Même exercice, sans consulter le corrigé. Contraintes supplémentaires :

1. Remplacer le middleware `$use` soft delete par une extension `$extends` avec une méthode `invitation.softDelete(id)`. Comparer : quand préférer `$use` (filtrage global, transformation transparente) vs `$extends` (méthode explicite, pas d'interception) ?

2. Ajouter `cancelExpiredInvitations()` dans `InvitationService` avec `$executeRaw(Prisma.sql...)` qui met à jour en une seule requête toutes les invitations `PENDING` créées il y a plus de 7 jours. Ne pas utiliser `findMany` + boucle.

3. Modifier `createInvitation` pour passer l'`isolationLevel` en paramètre optionnel (défaut `ReadCommitted`). Tester avec `Serializable` et observer si des deadlocks apparaissent quand deux invitations sont créées en parallèle pour la même famille.

Temps cible : 45 minutes sans le corrigé.

## Application TribuZen

Commit cible dans `smaurier/tribuzen` :

```
feat(invitation): transaction atomique invite + notify + pagination curseur
```

Fichiers à créer :

- `apps/api/src/invitation/invitation.service.ts`
- `apps/api/src/invitation/invitation.controller.ts`
- `apps/api/src/invitation/invitation.module.ts`
- `apps/api/src/prisma/prisma.service.ts` (mise à jour avec middlewares)

Critère de done : `POST /invitations` avec un `familyId` valide crée une ligne dans `Invitation` ET une ligne dans `Notification` en base, atomiquement. `DELETE /invitations/:id` remplit `deletedAt` sans supprimer la ligne. `GET /invitations?familyId=X&cursor=Y` retourne la page suivante.
