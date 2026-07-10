---
titre: Prisma avancé et comparaison
cours: 09-nestjs
notions: [requêtes de relations et nested writes, transactions interactives et batch, requêtes brutes, extensions et middleware Prisma, pagination, connection pooling, Prisma vs TypeORM, quand choisir chaque ORM]
outcomes: [écrire des requêtes de relations et des nested writes, exécuter une transaction Prisma, paginer, comparer Prisma et TypeORM pour choisir]
prerequis: [16-prisma-schema-client]
next: 18-nestjs-testing
libs: [{ name: prisma, version: "^6" }]
tribuzen: transaction Prisma atomique de l'invitation TribuZen (créer invitation + notifier)
last-reviewed: 2026-07
---

# Prisma avancé et comparaison

> **Outcomes — tu sauras FAIRE :** écrire des requêtes de relations et des nested writes, exécuter une transaction Prisma interactive, paginer avec offset et curseur, comparer Prisma et TypeORM pour choisir le bon outil.
> **Difficulté :** :star::star::star::star:

## 1. Cas concret d'abord

Dans TribuZen, quand un admin invite quelqu'un dans une famille, deux choses doivent se passer **ensemble** : créer une ligne dans `Invitation` et créer une ligne dans `Notification`. Si la notification échoue, l'invitation ne doit pas être persistée — c'est une opération atomique.

Tu essaies de l'écrire naïvement :

```ts
// ❌ non atomique — si notifier() plante, l'invitation est déjà en base
async createInvitation(familyId: string, email: string) {
  const inv = await this.prisma.invitation.create({
    data: { familyId, email, status: 'PENDING' },
  })
  // si cette ligne plante → invitation orpheline persistée
  await this.prisma.notification.create({ data: { type: 'INVITE', refId: inv.id } })
  return inv
}
```

Avec une transaction interactive Prisma 6, les deux opérations sont atomiques :

```ts
// ✅ atomique — si notification.create échoue, invitation est rollbackée
async createInvitation(familyId: string, email: string) {
  return this.prisma.$transaction(async (tx) => {
    const inv = await tx.invitation.create({
      data: {
        familyId,
        email,
        status: 'PENDING',
        notifications: { create: { type: 'INVITE', read: false } }, // nested write
      },
    })
    return inv
  })
}
```

Ce module explique comment ça marche et couvre l'ensemble de l'API Prisma avancée : nested writes, transactions, raw SQL, extensions, pagination, connection pooling, et la comparaison honnête avec TypeORM.

## 2. Théorie complète, concise

### 2.1 Requêtes de relations et nested writes

Un **nested write** crée ou modifie un enregistrement et ses relations en une seule opération.

**create imbriqué — créer avec relations**

```ts
// Créer une invitation avec sa notification en une seule requête
const invitation = await prisma.invitation.create({
  data: {
    email: 'bob@tribu.fr',
    status: 'PENDING',
    family: {
      connect: { id: familyId },         // lier à une famille existante par id
    },
    notifications: {
      create: { type: 'INVITE', read: false }, // créer la notification en même temps
    },
  },
  include: { notifications: true },      // retourner avec les notifications créées
})
```

**Opérations disponibles dans un nested write**

| Opération | Sens | Exemple |
|-----------|------|---------|
| `create` | Créer l'enregistrement lié | `profile: { create: { bio: '...' } }` |
| `connect` | Lier à un existant par clé unique | `family: { connect: { id: 1 } }` |
| `connectOrCreate` | Lier ou créer s'il n'existe pas | Tags, catégories |
| `set` | Remplacer toute la liste de liens M-M | `tags: { set: [{ id: 2 }] }` |
| `disconnect` | Retirer un lien M-M | `tags: { disconnect: { id: 3 } }` |
| `update` | Mettre à jour l'enregistrement lié | `profile: { update: { bio: 'nouveau' } }` |
| `upsert` | Update si existe, create sinon | `profile: { upsert: { create: {...}, update: {...} } }` |
| `delete` | Supprimer l'enregistrement lié One-to-One | `profile: { delete: true }` |

> **Piège** : `set` sur une relation Many-to-Many **remplace toute la liste**. Pour ajouter un lien, utiliser `connect`. Pour retirer un lien, utiliser `disconnect`.

**select vs include**

`include` charge les relations en plus de tous les champs. `select` ne charge que les champs explicitement listés. Les deux sont **mutuellement exclusifs** au même niveau.

```ts
// include : tous les champs du modèle + les relations demandées
const user = await prisma.user.findUnique({
  where: { id: 1 },
  include: { invitations: true }, // user.email ✓, user.invitations ✓
})

// select : uniquement les champs listés — le reste est absent du type retourné
const user = await prisma.user.findUnique({
  where: { id: 1 },
  select: {
    id: true,
    email: true,
    invitations: { select: { status: true } },
    // user.passwordHash → absent du type (pas listé)
  },
})
```

### 2.2 Transactions interactives et batch

**Batch (tableau) — requêtes indépendantes**

```ts
// Les deux requêtes s'exécutent dans la même transaction, dans l'ordre
const [invitation, count] = await prisma.$transaction([
  prisma.invitation.create({
    data: { email: 'bob@tribu.fr', familyId: 'fam-1', status: 'PENDING' },
  }),
  prisma.invitation.count({ where: { familyId: 'fam-1' } }),
])
```

**Interactive (callback) — requêtes interdépendantes**

```ts
// tx est un PrismaClient transactionnel — tout passe via tx, atomique
const result = await prisma.$transaction(
  async (tx) => {
    // 1. Vérifier la capacité de la famille (lecture cohérente dans la transaction)
    const family = await tx.family.findUniqueOrThrow({
      where: { id: familyId },
      select: { memberCount: true, maxSize: true },
    })
    if (family.memberCount >= family.maxSize) {
      throw new Error('FAMILY_FULL') // ROLLBACK automatique — rien n'est écrit
    }

    // 2. Créer l'invitation (nested write avec notification)
    const invitation = await tx.invitation.create({
      data: {
        email,
        familyId,
        status: 'PENDING',
        notifications: { create: { type: 'INVITE', read: false } },
      },
    })

    return invitation // COMMIT si aucune exception levée
  },
  {
    maxWait: 5000,               // ms max pour obtenir une connexion disponible
    timeout: 10000,              // ms max pour exécuter toute la transaction
    isolationLevel: 'ReadCommitted', // niveau d'isolation PostgreSQL
  },
)
```

Si une exception est levée dans le callback, Prisma émet un `ROLLBACK`. Sans exception → `COMMIT`.

**Niveaux d'isolation**

| Niveau | Cas d'usage |
|--------|-------------|
| `ReadCommitted` | Défaut PostgreSQL — convient à la majorité des cas |
| `RepeatableRead` | Rapports qui lisent plusieurs fois les mêmes données |
| `Serializable` | Opérations financières critiques — risque de deadlock élevé |

### 2.3 Requêtes brutes

À utiliser quand l'API Prisma ne couvre pas un besoin SQL (fonctions agrégées avancées, `ON CONFLICT`, `RETURNING`, `FILTER`, etc.).

```ts
import { Prisma } from '@prisma/client'

// $queryRaw — SELECT, retourne un tableau avec le type générique
const stats = await prisma.$queryRaw<
  { family_id: string; invite_count: number }[]
>(Prisma.sql`
  SELECT family_id, COUNT(*)::int AS invite_count
  FROM "Invitation"
  WHERE status = ${InvitationStatus.PENDING}
  GROUP BY family_id
  HAVING COUNT(*) > ${5}
  ORDER BY invite_count DESC
`)
// Les paramètres ${...} sont automatiquement paramétrés → protection SQL injection

// $executeRaw — INSERT/UPDATE/DELETE, retourne le nombre de lignes affectées
const affected = await prisma.$executeRaw(Prisma.sql`
  UPDATE "Invitation"
  SET status = 'EXPIRED'
  WHERE status = 'PENDING'
  AND created_at < NOW() - INTERVAL '7 days'
`)
// affected = nombre de lignes modifiées
```

> **Règle absolue** : toujours `Prisma.sql` (tagged template). Jamais de concaténation de chaînes — c'est une faille d'injection SQL.

Les requêtes brutes fonctionnent aussi dans une transaction interactive via `tx.$queryRaw` et `tx.$executeRaw`.

### 2.4 Extensions et middleware Prisma

**Middleware `$use` (Prisma 6 — compatible, marqué déprécié depuis Prisma 4.16 (au profit de `$extends`, encore fonctionnel en v6))**

`$use` intercepte toutes les requêtes Prisma avant et après exécution — logique transversale (logging, soft delete).

```ts
// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('PrismaService')

  constructor() {
    super()

    // Middleware de logging des requêtes lentes
    this.$use(async (params, next) => {
      const start = Date.now()
      const result = await next(params)
      const ms = Date.now() - start
      if (ms > 200) {
        this.logger.warn(`Lent: ${params.model}.${params.action} — ${ms}ms`)
      }
      return result
    })

    // Middleware de soft delete sur Invitation
    this.$use(async (params, next) => {
      if (params.model === 'Invitation') {
        if (params.action === 'delete') {
          // Transformer delete en update (soft delete)
          params.action = 'update'
          params.args['data'] = { deletedAt: new Date() }
        }
        if (params.action === 'findMany' || params.action === 'findFirst') {
          params.args ??= {}
          // Filtrer automatiquement les enregistrements soft-deleted
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

**Extensions `$extends` (Prisma 5+ / 6 — approche recommandée pour méthodes custom)**

```ts
// Ajouter une méthode softDelete directement sur le modèle invitation
const extendedPrisma = prisma.$extends({
  model: {
    invitation: {
      async softDelete(id: string) {
        return prisma.invitation.update({
          where: { id },
          data: { deletedAt: new Date() },
        })
      },
    },
  },
})

// Utilisation
await extendedPrisma.invitation.softDelete('inv-123')
```

### 2.5 Pagination

**Offset — pages numérotées**

```ts
async findPaginated(page = 1, limit = 10) {
  const skip = (page - 1) * limit
  const [invitations, total] = await Promise.all([
    prisma.invitation.findMany({
      where: { status: 'PENDING', deletedAt: null },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.invitation.count({ where: { status: 'PENDING', deletedAt: null } }),
  ])
  return {
    data: invitations,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  }
}
```

**Curseur — scroll infini ou grandes tables**

```ts
async findWithCursor(familyId: string, cursor?: string, limit = 10) {
  const items = await prisma.invitation.findMany({
    where: { familyId, status: 'PENDING', deletedAt: null },
    orderBy: { id: 'asc' },
    take: limit + 1,                         // prend un de plus pour détecter la suite
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, email: true, createdAt: true },
  })

  const hasNext = items.length > limit
  const data = hasNext ? items.slice(0, limit) : items
  return { data, nextCursor: hasNext ? data.at(-1)!.id : null }
}
```

| Critère | Offset | Curseur |
|---------|--------|---------|
| Grandes tables | Lent — `OFFSET N` parcourt N lignes | Performant — index sur l'id |
| Pages numérotées | Oui | Non |
| Scroll infini / API mobile | Déconseillé | Idéal |
| Insertions pendant la pagination | Doublons ou lignes sautées possibles | Stable |

### 2.6 Connection pooling

Par défaut, Prisma ouvre un pool de connexions vers PostgreSQL configurable via la `DATABASE_URL`.

```ts
// connection_limit dans la chaîne de connexion
// DATABASE_URL="postgresql://user:pwd@host/db?connection_limit=5&pool_timeout=10"
```

En production serverless (Vercel, AWS Lambda), chaque instance ouvre son propre pool → saturation PostgreSQL rapide. Solution : **Prisma Accelerate** (proxy managé côté Prisma) ou `pgBouncer` (proxy indépendant).

### 2.7 Prisma vs TypeORM — comparaison honnête

**Approche et philosophie**

| Aspect | TypeORM | Prisma |
|--------|---------|--------|
| Définition du schéma | Décorateurs dans les classes TS | Fichier `schema.prisma` déclaratif |
| Pattern | Active Record + Data Mapper | Client généré unique |
| Lazy loading | Oui (via Promises) | Non — eager via `include` uniquement |
| Bases supportées | PostgreSQL, MySQL, SQLite, MSSQL, Oracle... | PostgreSQL, MySQL, SQLite, MongoDB |

**Type safety — Prisma gagne**

```ts
// TypeORM — type retourné = toujours l'entité complète, même si join non chargé
const user = await userRepo.findOne({ where: { id: 1 } })
user.invitations // TypeScript le permet → mais erreur à l'exécution si relation non chargée

// Prisma — type retourné = exactement ce qui est demandé
const user = await prisma.user.findUnique({ where: { id: 1 } })
// user.invitations → n'existe pas dans le type → erreur de compilation

const userWithInv = await prisma.user.findUnique({
  where: { id: 1 },
  include: { invitations: true },
})
// userWithInv.invitations → Invitation[] dans le type
```

**Migrations**

| Aspect | TypeORM | Prisma |
|--------|---------|--------|
| Format | TypeScript (QueryRunner up/down) | SQL pur |
| Génération | `migration:generate` | `prisma migrate dev` |
| Prototypage | `synchronize: true` | `prisma db push` |
| Seed intégré | Non | `prisma db seed` |

**Requêtes complexes**

TypeORM QueryBuilder est plus expressif pour les jointures complexes, requêtes récursives, et les bases legacy. Prisma est plus intuitif pour les cas courants mais impose le raw SQL pour les cas extrêmes.

**Quand choisir**

| Choisir TypeORM si... | Choisir Prisma si... |
|----------------------|---------------------|
| Base existante complexe | Nouveau projet |
| Besoin de lazy loading | Type safety prioritaire |
| Équipe avec background Java/C# (Active Record) | Expérience développeur optimale |
| Requêtes SQL très complexes | Approche schema-first préférée |
| MSSQL, Oracle | PostgreSQL, MySQL, SQLite, MongoDB, CockroachDB |

> **Avis honnête** : Prisma gagne sur type safety et DX. TypeORM gagne sur expressivité SQL et support de bases. Pour TribuZen (PostgreSQL, nouveau projet) → Prisma est le meilleur choix.

## 3. Worked examples

### Exemple A — Transaction atomique invitation + notification (TribuZen)

```ts
// src/invitation/invitation.service.ts
import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class InvitationService {
  constructor(private readonly prisma: PrismaService) {}

  async createInvitation(
    familyId: string,
    email: string,
  ): Promise<{ id: string; status: string }> {
    return this.prisma.$transaction(
      async (tx) => {
        // Étape 1 — vérifier la capacité dans la transaction (lecture cohérente)
        const family = await tx.family.findUniqueOrThrow({
          where: { id: familyId },
          select: { memberCount: true, maxSize: true },
        })
        if (family.memberCount >= family.maxSize) {
          throw new Error('FAMILY_FULL') // ROLLBACK — rien n'est écrit
        }

        // Étape 2 — nested write : invitation + notification en une seule opération
        const invitation = await tx.invitation.create({
          data: {
            email,
            status: 'PENDING',
            family: { connect: { id: familyId } },
            notifications: {
              create: { type: 'INVITE', read: false },
              // si la contrainte de clé ici échoue → ROLLBACK sur l'invitation aussi
            },
          },
          select: { id: true, status: true },
        })

        return invitation // COMMIT si aucune exception
      },
      { maxWait: 5000, timeout: 10000 },
    )
  }

  async cancelExpiredInvitations(): Promise<number> {
    // $executeRaw : une seule requête SQL au lieu de findMany + N update
    return this.prisma.$executeRaw(Prisma.sql`
      UPDATE "Invitation"
      SET status = 'EXPIRED'
      WHERE status = 'PENDING'
      AND created_at < NOW() - INTERVAL '7 days'
    `)
  }
}
```

Pas-à-pas : (1) `$transaction(async (tx) => {...})` — Prisma émet `BEGIN` à l'entrée du callback ; toutes les requêtes via `tx` sont dans la même transaction ; (2) `tx.family.findUniqueOrThrow` dans la transaction — la lecture est cohérente avec les écritures suivantes, pas de race condition entre la vérification et l'insertion ; (3) `throw new Error('FAMILY_FULL')` — Prisma émet `ROLLBACK`, aucune ligne n'est persistée ; (4) nested write `notifications: { create: {...} }` — invitation et notification dans une seule opération, si la contrainte sur notification échoue le `ROLLBACK` couvre aussi l'invitation ; (5) `$executeRaw` avec `Prisma.sql` tagged template — met à jour toutes les invitations expirées en une seule requête SQL, sans charger chaque ligne en mémoire.

### Exemple B — Pagination curseur + stats SQL brutes

```ts
// src/family/family.service.ts (extrait)
import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class FamilyService {
  constructor(private readonly prisma: PrismaService) {}

  // Pagination par curseur — performante sur de grandes tables
  async findInvitationsCursor(familyId: string, cursor?: string, limit = 10) {
    const items = await this.prisma.invitation.findMany({
      where: {
        familyId,
        status: 'PENDING',
        deletedAt: null, // explicite pour lisibilité — le middleware $use l'ajoute déjà sur findMany
      },
      orderBy: { id: 'asc' },
      take: limit + 1,                             // prend un de plus pour savoir s'il y a la suite
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, email: true, createdAt: true },
    })

    const hasNext = items.length > limit
    const data = hasNext ? items.slice(0, limit) : items
    return { data, nextCursor: hasNext ? data.at(-1)!.id : null }
  }

  // Stats SQL brutes — agrégation FILTER non disponible via l'API Prisma standard
  async getInviteStats(): Promise<
    { familyId: string; pending: number; total: number }[]
  > {
    return this.prisma.$queryRaw<
      { familyId: string; pending: number; total: number }[]
    >(Prisma.sql`
      SELECT
        family_id                                             AS "familyId",
        COUNT(*) FILTER (WHERE status = 'PENDING')::int      AS pending,
        COUNT(*)::int                                         AS total
      FROM "Invitation"
      WHERE deleted_at IS NULL
      GROUP BY family_id
      ORDER BY pending DESC
    `)
  }
}
```

Pas-à-pas : (1) `take: limit + 1` — Prisma récupère un élément supplémentaire pour détecter la page suivante sans faire un `COUNT(*)` ; (2) `cursor: { id: cursor }, skip: 1` — Prisma génère `WHERE id > cursor` via un index, pas de `OFFSET` coûteux ; (3) `data.at(-1)!.id` — dernier élément de la page courante = curseur de la page suivante ; (4) `$queryRaw<T[]>(Prisma.sql\`...\`)` — le type générique `T[]` est fourni car Prisma ne peut pas inférer le type d'une requête brute ; (5) `COUNT(*)::int` cast PostgreSQL — `COUNT(*)` retourne `bigint` en PostgreSQL, TypeScript attend `number`, le cast `::int` est nécessaire pour la concordance de types.

## 4. Pièges & misconceptions

- **`set` remplace toute la liste M-M.** `tags: { set: [{ id: 1 }] }` sur une relation Many-to-Many efface tous les liens existants et ne garde que le tag `id: 1`. Pour ajouter un lien sans toucher les autres, utiliser `connect`. Pour retirer un lien précis, utiliser `disconnect`. Confondre `set` et `connect` entraîne une perte silencieuse de données.

- **Await manquant dans `$transaction` interactive.** Si une opération asynchrone dans le callback n'est pas `await`ée, Prisma peut émettre `COMMIT` avant que l'opération ait eu le temps d'échouer. Toujours `await` chaque opération dans le callback.

- **Concaténation de chaîne avec `$queryRaw`.** Construire une requête par concaténation `` `SELECT * FROM users WHERE id = ${userId}` `` sans `Prisma.sql` est une faille SQL injection si `userId` vient de l'utilisateur. Toujours utiliser le tagged template `Prisma.sql` qui paramètre automatiquement les interpolations.

- **`include` et `select` simultanés au même niveau.** Utiliser les deux au même niveau lève une erreur TypeScript au compile-time. `include` est un raccourci pour sélectionner tous les champs scalaires et ajouter des relations. Choisir l'un ou l'autre.

- **Timeout trop court sur `$transaction` interactive.** Le timeout par défaut est 5 000 ms. Une transaction qui fait plusieurs appels réseau ou plusieurs opérations en boucle dépasse facilement ce délai. Augmenter via l'option `timeout` ou déplacer les appels réseau hors de la transaction.

- **Pagination offset sur grandes tables.** `skip: 10_000` force PostgreSQL à parcourir 10 000 lignes pour n'en retourner que 10. Sur une table de millions de lignes, la page 1 000 peut prendre plusieurs secondes. Migrer vers la pagination curseur dès que la table dépasse ~100 000 lignes.

- **Ordre des middlewares `$use`.** Les middlewares s'exécutent dans l'ordre d'enregistrement. Un middleware de soft delete qui modifie `findMany` enregistré après un middleware de logging verra la requête déjà filtrée par le soft delete. Si l'ordre est inversé, le log verra une requête différente de celle réellement exécutée. Toujours documenter et tester l'ordre d'enregistrement.

## 5. Ancrage TribuZen

Couche fil-rouge : **transaction Prisma atomique de l'invitation TribuZen (créer invitation + notifier)** (`smaurier/tribuzen`).

- `InvitationService.createInvitation()` utilise `$transaction` interactive — si la création de `Notification` échoue (contrainte de clé étrangère, bug de logique), l'invitation est rollbackée. Aucune invitation orpheline en base de production.
- Nested write `notifications: { create: {...} }` dans `invitation.create` — une seule requête SQL plutôt que deux `INSERT` séquentiels, réduction de latence réseau et atomicité garantie sans transaction explicite sur ce chemin simple.
- `$executeRaw(Prisma.sql...)` pour `cancelExpiredInvitations()` — une seule requête SQL au lieu d'un `findMany` + N `update`. Critique si TribuZen accumule des milliers d'invitations expirées à purger périodiquement.
- Pagination curseur sur `GET /families/:id/invitations` — les familles actives peuvent avoir des centaines d'invitations, la pagination offset deviendrait lente au-delà de la page 10.
- Soft delete via `$use` middleware sur `Invitation` — `DELETE /invitations/:id` en API ne supprime pas réellement la ligne, permettant l'audit et la restauration en cas d'erreur utilisateur.

Structure cible dans `smaurier/tribuzen` :

```
apps/api/src/
  invitation/
    invitation.service.ts     ← $transaction + nested write + $executeRaw
    invitation.controller.ts  ← GET /invitations?cursor=&take=
    invitation.module.ts
  family/
    family.service.ts         ← findInvitationsCursor, getInviteStats
  prisma/
    prisma.service.ts         ← PrismaService avec $use soft delete + logging
```

## 6. Points clés

1. **Nested write** : créer ou modifier des relations imbriquées en une seule opération — `create`, `connect`, `connectOrCreate`, `set`, `disconnect`, `update`, `upsert`, `delete`. `set` sur M-M remplace toute la liste.
2. `$transaction([...])` **batch** : N requêtes indépendantes dans la même transaction, retourne un tableau dans l'ordre.
3. `$transaction(async (tx) => {...}, opts)` **interactive** : requêtes interdépendantes, `throw` = `ROLLBACK` automatique, options `maxWait`, `timeout`, `isolationLevel`.
4. `$queryRaw<T[]>(Prisma.sql...)` pour les SELECT bruts typés ; `$executeRaw(Prisma.sql...)` pour les INSERT/UPDATE/DELETE bruts — toujours `Prisma.sql` tagged template, jamais de concaténation.
5. `$use(async (params, next) => {...})` middleware (Prisma 6) pour la logique transversale (soft delete, logging) ; `$extends` pour les méthodes custom sur les modèles.
6. **Pagination offset** : `skip` + `take` + `count` en parallèle — lisible mais lent sur grandes tables. **Pagination curseur** : `cursor` + `skip: 1` + `take: n+1` — performant, basé sur un index.
7. **Prisma vs TypeORM** : Prisma gagne sur type safety (type du retour = exactement ce qui est sélectionné) et DX. TypeORM gagne sur expressivité SQL complexe et support de bases (MSSQL, Oracle).
8. En production serverless, gérer le connection pooling via **Prisma Accelerate** ou `pgBouncer` pour éviter la saturation de PostgreSQL.

## 7. Seeds Anki

```
Différence $transaction batch vs $transaction interactive en Prisma ?|Batch = tableau de requêtes indépendantes exécutées dans une transaction, retourne un tableau. Interactive = callback async (tx) avec logique conditionnelle, throw déclenche ROLLBACK automatique
Que fait set sur une relation Many-to-Many dans un nested write Prisma ?|set remplace TOUTE la liste de liens existants par la nouvelle liste — les liens non inclus sont supprimés silencieusement. Utiliser connect pour ajouter sans effacer, disconnect pour retirer un lien précis
Comment protéger une requête brute $queryRaw contre l'injection SQL en Prisma 6 ?|Toujours utiliser le tagged template Prisma.sql`...` qui paramètre automatiquement les interpolations ${...} — jamais de concaténation de chaîne
Différence include et select en Prisma et pourquoi ne peut-on pas combiner les deux au même niveau ?|include = tous les champs scalaires + relations demandées. select = uniquement les champs listés. Les deux sont mutuellement exclusifs car include est un raccourci de select avec tous les champs scalaires activés
Pourquoi la pagination curseur est plus performante que l'offset sur une grande table ?|OFFSET N force le moteur SQL à parcourir N lignes pour les ignorer. Le curseur génère WHERE id > cursor qui s'appuie sur l'index B-tree — temps constant quel que soit le numéro de page
Quelle est la différence entre $use middleware et $extends en Prisma ?|$use intercepte toutes les requêtes Prisma globalement (soft delete, logging). $extends ajoute des méthodes custom sur les modèles sans intercepter les requêtes existantes — recommandé pour des ajouts ciblés
Pourquoi COUNT(*) PostgreSQL nécessite-t-il un cast ::int dans $queryRaw Prisma ?|COUNT(*) retourne bigint en PostgreSQL. Le type générique TypeScript attendu est number. Sans le cast ::int, Prisma reçoit un BigInt que TypeScript ne peut pas assigner à number
Comment gérer le connection pooling en production serverless avec Prisma ?|Utiliser Prisma Accelerate (proxy managé) ou pgBouncer (proxy indépendant) — sans pooler externe, chaque instance Lambda ouvre son propre pool et sature les connexions PostgreSQL autorisées
```

## Pont vers le lab

> Lab associé : `09-nestjs/labs/lab-17-prisma-avance/README.md`. Tu y implémentes `InvitationService` avec transaction interactive et nested write, une pagination curseur sur les invitations de famille, un middleware soft delete dans `PrismaService`, et une requête brute de stats — corrigé complet commenté + variante J+30 dans le README.

← [Module 16 — Prisma Schema et Client](16-prisma-schema-client.md) · [Module 18 — NestJS Testing](18-nestjs-testing.md) →
