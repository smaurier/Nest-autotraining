---
titre: Prisma schema et client
cours: 09-nestjs
notions: [schéma Prisma, modèles et champs, attributs et types, relations Prisma, prisma migrate, génération du client, Prisma Client typé, CRUD type-safe, intégration NestJS via un service]
outcomes: [écrire un schéma Prisma avec modèles et relations, générer et appliquer une migration, utiliser le Prisma Client typé pour du CRUD, intégrer Prisma dans un service NestJS]
prerequis: [15-typeorm-requetes-migrations]
next: 17-prisma-avance-comparaison
libs: [{ name: prisma, version: "^6" }, { name: "@prisma/client", version: "^6" }]
tribuzen: schéma Prisma de TribuZen (User, Family, Post, Invitation) et un PrismaService NestJS
last-reviewed: 2026-07
---

# Prisma schema et client

> **Outcomes — tu sauras FAIRE :** écrire un schéma Prisma avec modèles et relations, générer et appliquer une migration, utiliser le Prisma Client typé pour du CRUD, intégrer Prisma dans un service NestJS.
> **Difficulté :** :star::star::star:

## 1. Cas concret d'abord

TribuZen a besoin d'une vraie base de données. Tu viens de travailler avec TypeORM au module 15 — décorateurs sur les classes, `@Entity()`, `@Column()`, `@ManyToOne()`. La question naturelle est : existe-t-il une approche où le modèle de données est déclaré une seule fois dans un fichier central, et où TypeScript connaît exactement les types retournés par chaque requête ?

C'est le pari de Prisma : un seul fichier `schema.prisma`, une migration générée automatiquement, et un client TypeScript où chaque appel est entièrement typé à la compilation.

Concrètement, tu essaies de modéliser `User` + `Family` en TypeORM :

```ts
// ❌ TypeORM — les types sont déclarés deux fois : décorateur + propriété TypeScript
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string  // déclaré ici aussi — risque de désynchronisation avec le décorateur

  @ManyToOne(() => Family, family => family.members)
  family: Family  // findOne() ne garantit pas que family est chargée — type trompeur
}
```

Avec Prisma, une seule source de vérité :

```prisma
// schema.prisma — déclaration unique, client TypeScript généré depuis ce fichier
model User {
  id       String  @id @default(cuid())
  email    String  @unique
  family   Family? @relation(fields: [familyId], references: [id])
  familyId String?
}
```

Prisma génère un client où `prisma.user.findUnique({ where: { id } })` retourne `User | null` avec tous les champs corrects, sans décorateur supplémentaire ni interface manuelle. Si `familyId` est `String?`, TypeScript le sait automatiquement.

Ce module couvre la déclaration du schéma, les relations, les migrations, la génération du client, et l'intégration dans NestJS via `PrismaService`.

## 2. Théorie complète, concise

### 2.1 Schema-first — différence clé avec TypeORM

TypeORM est **code-first** : les classes TypeScript annotées *sont* le schéma. Prisma est **schema-first** : `schema.prisma` *est* la source de vérité, le code TypeScript en est dérivé.

| Aspect | TypeORM | Prisma 6 |
|--------|---------|----------|
| Source de vérité | Classes annotées `@Entity` | `schema.prisma` déclaratif |
| Types retournés | Partiellement inférés | 100 % inférés à la génération |
| Migrations | Générées depuis le code | Générées depuis le diff du schéma |
| Requêtes avec relations | `relations`, `leftJoinAndSelect` | `include`, `select` |

### 2.2 Anatomie de schema.prisma

Le fichier contient trois blocs :

```prisma
// 1. Source de données
datasource db {
  provider = "postgresql"       // postgresql, mysql, sqlite, sqlserver, mongodb
  url      = env("DATABASE_URL") // lit depuis .env — jamais hard-codé
}

// 2. Générateur — produit le client TypeScript
generator client {
  provider = "prisma-client-js"
}

// 3. Modèles — décrivent les tables et leurs champs
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

`prisma-client-js` génère le client dans `node_modules/@prisma/client`, importable via `import { PrismaClient } from '@prisma/client'`.

### 2.3 Types de champs et attributs courants

```prisma
model Post {
  // Scalaires courants
  id        String   @id @default(cuid())  // clé primaire string, générée par Prisma
  title     String                          // NOT NULL, type TEXT par défaut
  content   String?  @db.Text              // nullable, type TEXT natif PostgreSQL
  views     Int      @default(0)           // entier avec valeur par défaut
  published Boolean  @default(false)

  // Dates
  createdAt DateTime @default(now())  // timestamp côté serveur à l'insertion
  updatedAt DateTime @updatedAt       // mis à jour automatiquement à chaque update

  // Clé étrangère scalaire (toujours accompagnée du champ de relation)
  authorId  String   @map("author_id") // @map = nom de colonne SQL différent
}
```

**Attributs de champ fréquents :**

| Attribut | Effet |
|----------|-------|
| `@id` | Clé primaire |
| `@default(cuid())` | ID court généré côté Prisma |
| `@default(uuid())` | UUID v4 généré côté Prisma |
| `@default(now())` | Timestamp à l'insertion |
| `@updatedAt` | Mis à jour à chaque opération `update` |
| `@unique` | Contrainte d'unicité sur la colonne |
| `@map("col_name")` | Nom de colonne SQL personnalisé |
| `@db.Text` | Type natif PostgreSQL TEXT (vs VARCHAR par défaut) |

**Attributs de modèle (niveau table) :**

```prisma
model Family {
  id   String @id @default(cuid())
  name String

  @@unique([name])         // contrainte unique sur la table
  @@index([createdAt])     // index simple
  @@map("families")        // nom de table SQL personnalisé
}
```

**Enums :**

```prisma
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
  id   String @id @default(cuid())
  role Role   @default(MEMBER)  // valeur par défaut de l'enum
}
```

### 2.4 Relations Prisma

#### One-to-Many (le plus courant)

```prisma
model Family {
  id      String @id @default(cuid())
  name    String
  members User[]  // champ virtuel — aucune colonne en base
}

model User {
  id       String  @id @default(cuid())
  // Le côté "many" porte @relation + la clé étrangère scalaire
  family   Family? @relation(fields: [familyId], references: [id], onDelete: SetNull)
  familyId String?  // colonne réelle en base
}
```

- Le côté "many" (`User`) porte `@relation(fields, references)` et la FK scalaire.
- Le côté "one" (`Family`) expose un tableau virtuel — zéro colonne supplémentaire en base.
- `onDelete: SetNull` : si la famille est supprimée, `familyId` des membres passe à `null`.

#### One-to-One

```prisma
model User {
  id      String   @id @default(cuid())
  profile Profile? // virtuel — côté "one" sans FK
}

model Profile {
  id     String  @id @default(cuid())
  bio    String? @db.Text
  user   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId String  @unique  // @unique force la cardinalité 1-1 — unique différence vs 1-N
}
```

#### Many-to-Many implicite

```prisma
model Post {
  id   String @id @default(cuid())
  tags Tag[]
}

model Tag {
  id    String @id @default(cuid())
  name  String @unique
  posts Post[]
}
// Prisma crée automatiquement la table de jointure _PostToTag
```

#### Comportements onDelete

| Valeur | Comportement |
|--------|-------------|
| `Cascade` | Supprime les enfants avec le parent |
| `SetNull` | Met la FK à null (champ nullable requis) |
| `Restrict` | Bloque la suppression du parent si des enfants existent |
| `NoAction` | Similaire à Restrict (défaut) |

### 2.5 Migrations avec prisma migrate

```bash
# Développement : crée le SQL, l'applique, et regénère le client en une commande
npx prisma migrate dev --name init

# Production : applique les migrations en attente (sans en créer de nouvelles)
npx prisma migrate deploy

# Réinitialiser la base (supprime toutes les données — dev seulement)
npx prisma migrate reset

# Pousser le schéma sans créer de migration (prototypage rapide)
npx prisma db push
```

`migrate dev` crée un fichier SQL versionné dans `prisma/migrations/`. Ces fichiers sont **immuables** — ne jamais les modifier après application. Pour corriger quelque chose, créer une nouvelle migration.

Structure générée :

```
prisma/
  schema.prisma
  migrations/
    20260701000000_init/
      migration.sql
    20260702090000_add_invitation/
      migration.sql
    migration_lock.toml
```

### 2.6 prisma generate et le client typé

```bash
npx prisma generate
```

Lit `schema.prisma` et génère le client TypeScript dans `node_modules/@prisma/client`. À relancer après chaque modification du schéma. En pratique, `migrate dev` le fait automatiquement.

Le client expose un namespace `Prisma` avec tous les types inférés :

```ts
import { PrismaClient, Prisma } from '@prisma/client'

// Type inféré automatiquement — pas d'interface manuelle
type FamilyWithMembers = Prisma.FamilyGetPayload<{
  include: { members: true }
}>
// → { id: string; name: string; members: User[]; createdAt: Date; ... }

// Input types générés — utilisables directement dans les services
type CreateFamilyInput = Prisma.FamilyCreateInput
// → { name: string; members?: UserCreateNestedManyWithoutFamilyInput; ... }
```

### 2.7 PrismaService NestJS

NestJS fournit des hooks de cycle de vie. `PrismaService` les implémente pour gérer la connexion proprement :

```ts
// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
// extends PrismaClient : PrismaService hérite de toutes les méthodes du client
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    // NestJS appelle ce hook quand le module est initialisé
    await this.$connect()
  }

  async onModuleDestroy(): Promise<void> {
    // NestJS appelle ce hook à l'arrêt propre (SIGTERM, Ctrl+C)
    await this.$disconnect()
  }
}
```

```ts
// src/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common'
import { PrismaService } from './prisma.service'

@Global()  // PrismaService injectable partout sans import répété
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

```ts
// src/app.module.ts (extrait)
import { PrismaModule } from './prisma/prisma.module'

@Module({
  imports: [PrismaModule],  // un seul import — @Global() distribue PrismaService
})
export class AppModule {}
```

## 3. Worked examples

### Exemple A — Schéma TribuZen complet et première migration

```prisma
// prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ── Enums ──────────────────────────────────────────────────────

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

// ── Modèles ────────────────────────────────────────────────────

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  role      Role     @default(MEMBER)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt      @map("updated_at")

  // Clé étrangère nullable — un User peut exister sans famille
  familyId        String?      @map("family_id")
  // SetNull : si la famille est supprimée, le User reste, familyId → null
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

  // Cascade : si l'auteur ou la famille disparaît, les posts aussi
  authorId String @map("author_id")
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
  // Nom de relation explicite : User a deux relations différentes vers Invitation
  invitedBy   User   @relation("InvitedBy", fields: [invitedById], references: [id], onDelete: Cascade)

  // Contrainte composite : pas deux invitations pour le même email dans la même famille
  @@unique([email, familyId])
  @@map("invitations")
}
```

Créer et appliquer la migration initiale :

```bash
# Génère prisma/migrations/20260701000000_init/migration.sql et l'applique
npx prisma migrate dev --name init
# Regénère automatiquement @prisma/client avec tous les types TribuZen
```

**Pas-à-pas :**
1. `datasource db` lit `DATABASE_URL` depuis `.env` — jamais hard-codé dans le schéma.
2. `@id @default(cuid())` : clé primaire string courte, portable entre PostgreSQL, MySQL et SQLite.
3. `@map("created_at")` + `@@map("users")` : snake_case en base, camelCase dans TypeScript — les deux conventions respectées.
4. `@relation("FamilyMembers")` : nom explicite obligatoire car `User` a deux relations distinctes avec `Family` via `members` d'un côté et aucune autre — Prisma le demande pour lever l'ambiguïté de `sentInvitations` sur `InvitedBy`.
5. `@@unique([email, familyId])` sur `Invitation` : interdit deux invitations actives pour le même email dans la même famille — règle métier encodée dans le schéma.
6. `migrate dev` crée un fichier SQL immuable versionné — **ne jamais le modifier manuellement**.

### Exemple B — FamilyService avec CRUD type-safe via PrismaService

```ts
// src/family/family.service.ts
import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { Prisma } from '@prisma/client'

// Type inféré depuis le schéma — pas d'interface manuelle
type FamilyWithMembers = Prisma.FamilyGetPayload<{
  include: { members: true }
}>

@Injectable()
export class FamilyService {
  // PrismaService disponible via @Global() PrismaModule — pas d'import dans FamilyModule
  constructor(private readonly prisma: PrismaService) {}

  // CREATE — Prisma.FamilyCreateInput garantit les champs requis à la compilation
  async create(data: Prisma.FamilyCreateInput) {
    return this.prisma.family.create({ data })
  }

  // READ LIST — include évite le N+1 sans jointure manuelle
  async findAll(): Promise<FamilyWithMembers[]> {
    return this.prisma.family.findMany({
      include: { members: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  // READ ONE — findUnique + null check explicite → NotFoundException
  async findOne(id: string) {
    const family = await this.prisma.family.findUnique({
      where: { id },
      include: {
        // select dans include : charge uniquement les champs nécessaires
        members: { select: { id: true, name: true, role: true } },
        posts: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    })
    if (!family) throw new NotFoundException(`Famille ${id} introuvable`)
    return family
  }

  // UPDATE
  async update(id: string, data: Prisma.FamilyUpdateInput) {
    await this.findOne(id)  // valide l'existence avant update — lève NotFoundException
    return this.prisma.family.update({ where: { id }, data })
  }

  // DELETE
  async remove(id: string) {
    await this.findOne(id)
    return this.prisma.family.delete({ where: { id } })
  }

  // Règle métier TribuZen : count() en base, pas de chargement de tous les membres
  async canJoin(familyId: string, maxMembers = 12): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { familyId } })
    return count < maxMembers  // false si la famille est pleine
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
// Pas d'import de PrismaModule ici — @Global() le rend disponible automatiquement
```

**Pas-à-pas :**
1. `constructor(private readonly prisma: PrismaService)` — injection standard NestJS ; `PrismaModule @Global()` fait que NestJS trouve `PrismaService` sans import dans ce module.
2. `Prisma.FamilyCreateInput` — type généré : champs requis sont obligatoires, optionnels sont `?`. Pas d'interface DTO manuelle dans la couche service.
3. `include: { members: true }` dans `findAll` — jointure SQL automatique ; le type retourné est `Family & { members: User[] }`, inféré sans déclaration.
4. `select: { id: true, name: true, role: true }` à l'intérieur de l'`include` — ne transfère que les colonnes utiles, réduit la charge réseau.
5. `prisma.user.count({ where: { familyId } })` dans `canJoin` — agrégation en base ; pas de `findMany` suivi de `.length` en mémoire.

## 4. Pièges & misconceptions

- **Oublier `npx prisma generate` après une modification du schéma.** `@prisma/client` est un package dans `node_modules`. Si tu ajoutes un champ `avatar` à `User` dans le schéma sans relancer `generate`, TypeScript ne connaît pas `avatar` et l'IDE n'autocomplète pas. `migrate dev` le fait automatiquement. En CI : ajouter `npx prisma generate` explicitement dans le step de build, après `npm install`.

- **Modifier un fichier de migration déjà appliqué.** Prisma stocke un hash du SQL dans la table `_prisma_migrations`. Si tu modifies le fichier après application, la prochaine commande lève `P3006: migration was modified after it was applied`. Correction : créer une nouvelle migration pour tout changement additionnel. Les fichiers dans `prisma/migrations/` sont immuables par design.

- **`findUnique` vs `findUniqueOrThrow`.** `prisma.family.findUnique({ where: { id } })` retourne `Family | null`. Beaucoup de développeurs ajoutent `!` (non-null assertion) au lieu de gérer le null — TypeScript ne protège plus. Deux alternatives propres : (1) `findUniqueOrThrow` qui lève `PrismaClientKnownRequestError` (code `P2025`) automatiquement, (2) vérification explicite `if (!family) throw new NotFoundException(...)`.

- **Instance `PrismaClient` dupliquée en développement.** Le hot-reload de NestJS peut créer plusieurs instances `PrismaClient`, épuisant le pool de connexions. `PrismaService extends PrismaClient` dans un `@Global()` singleton évite ce problème : NestJS maintient une seule instance. Ne jamais écrire `new PrismaClient()` directement dans un service — toujours injecter `PrismaService`.

- **`include` sans `take` sur des listes volumineuses.** `include: { posts: true }` sans limite charge tous les posts d'une famille — 10 000 lignes si la famille est active. Toujours combiner `include` avec `take` (limite) et éventuellement `skip` (offset) pour les relations de type liste. Pour les endpoints publics, favoriser des routes dédiées (`GET /families/:id/posts`) avec pagination explicite.

- **`.env` non chargé en production.** `prisma migrate deploy` lit `DATABASE_URL` depuis l'environnement processus, pas depuis `.env`. En production (Docker, Kubernetes), la variable doit être injectée via les secrets du cluster. Ajouter `.env` à `.gitignore` immédiatement après `prisma init` — ne jamais committer de credentials.

- **Noms de relations ambiguës omis.** Si un modèle a deux relations vers le même autre modèle (ex. `User` a `posts` et `sentInvitations`, toutes deux vers des modèles qui referment sur `User`), Prisma exige un nom de relation explicite `@relation("NomDeRelation")` des deux côtés. Sans lui, Prisma lève une erreur de validation du schéma à la migration.

## 5. Ancrage TribuZen

Couche fil-rouge : **schéma Prisma de TribuZen (User, Family, Post, Invitation) et un PrismaService NestJS** (`smaurier/tribuzen`).

- Le schéma de l'Exemple A est la structure exacte de TribuZen : `User` appartient à une `Family`, publie des `Post`, envoie des `Invitation`. Les enums `Role` et `InvitationStatus` encodent les règles métier directement dans le schéma — une contrainte `@@unique([email, familyId])` remplace une validation applicative.
- `PrismaModule @Global()` est importé une seule fois dans `AppModule` — tous les modules domain (`FamilyModule`, `PostModule`, `InvitationModule`) injectent `PrismaService` sans import répété ni couplage entre modules.
- `FamilyService.canJoin()` utilise `prisma.user.count({ where: { familyId } })` — la règle métier TribuZen "famille pleine" est vérifiable sans charger 100 membres en mémoire.
- Les `@map("snake_case")` + `@@map("table_name")` assurent que PostgreSQL suit les conventions SQL standard (`created_at`, `family_id`) pendant que TypeScript utilise camelCase (`createdAt`, `familyId`) — zéro friction entre les deux mondes.
- La migration `init` est commitée avec le schéma dans `smaurier/tribuzen` — tout développeur rejoignant le projet recrée la base identique avec `npx prisma migrate dev`.

Structure cible dans `smaurier/tribuzen` :

```
apps/api/src/
  prisma/
    prisma.service.ts    ← PrismaService extends PrismaClient
    prisma.module.ts     ← @Global() module, un seul import dans AppModule
  family/
    family.service.ts    ← CRUD via PrismaService, types Prisma.FamilyCreateInput
    family.controller.ts
    family.module.ts
prisma/
  schema.prisma          ← source de vérité — User, Family, Post, Invitation
  migrations/
    20260701000000_init/
      migration.sql
```

## 6. Points clés

1. Prisma 6 est **schema-first** : `schema.prisma` est la source de vérité ; client TypeScript et migrations en sont dérivés automatiquement.
2. `datasource db` + `generator client { provider = "prisma-client-js" }` = structure minimale obligatoire dans tout schéma Prisma.
3. `@id @default(cuid())` pour une clé primaire string portable ; `@updatedAt` pour le timestamp automatique à chaque update.
4. Le côté "many" d'une relation porte `@relation(fields, references)` et la FK scalaire ; le côté "one" expose un tableau virtuel sans colonne en base.
5. `@unique` sur une FK = relation 1-1 ; sans `@unique` = relation 1-N — c'est la seule différence syntaxique.
6. `@@unique([a, b])` sur un modèle crée une contrainte composite ; `@unique` sur un champ crée une contrainte simple.
7. `npx prisma migrate dev --name <nom>` crée le SQL, l'applique, et regénère le client en une commande — ne jamais modifier un fichier de migration après application.
8. `PrismaService extends PrismaClient` avec `onModuleInit/$connect` et `onModuleDestroy/$disconnect` = pattern NestJS officiel pour la gestion du cycle de vie.
9. `Prisma.ModelCreateInput`, `Prisma.ModelUpdateInput`, `Prisma.ModelGetPayload<{...}>` = types générés à utiliser dans les services — pas d'interfaces TypeScript manuelles.
10. `include` joint des données supplémentaires — toujours combiner avec `take` et `select` pour éviter les payloads explosifs sur les relations de type liste.

## 7. Seeds Anki

```
Quelle est la différence fondamentale entre Prisma et TypeORM ?|Prisma est schema-first — schema.prisma est la source de vérité, le client TypeScript en est dérivé ; TypeORM est code-first — les classes annotées sont le schéma
Que fait npx prisma migrate dev --name init ?|Génère le SQL de migration depuis le diff avec la base, l'applique, et regénère @prisma/client — trois opérations en une seule commande
Pourquoi ne faut-il jamais modifier un fichier de migration après application ?|Prisma stocke le hash du SQL dans _prisma_migrations — une modification casse la vérification d'intégrité et bloque migrate deploy avec P3006
Quel est le pattern NestJS officiel pour intégrer PrismaClient ?|PrismaService extends PrismaClient, implémente OnModuleInit ($connect) et OnModuleDestroy ($disconnect), exposé via @Global() PrismaModule
Comment obtenir le type TypeScript d'une Family avec ses membres inclus ?|Prisma.FamilyGetPayload<{ include: { members: true } }> — type inféré automatiquement à la génération, zéro interface manuelle
Quelle propriété syntaxique distingue une relation 1-1 d'une 1-N dans Prisma ?|@unique sur la clé étrangère — c'est la seule différence, sans @unique c'est une relation 1-N
Comment éviter de charger des centaines de lignes liées dans un findMany ?|Ajouter take (limite) et select (champs choisis) dans le include — ex. include: { posts: { take: 10, select: { id: true, content: true } } }
Quand un nom de relation @relation("NomExplicite") est-il obligatoire ?|Quand un modèle a deux relations distinctes vers le même autre modèle — Prisma ne peut pas lever l'ambiguïté sans nom explicite des deux côtés
```

## Pont vers le lab

> Lab associé : `09-nestjs/labs/lab-16-prisma-setup/README.md`. Tu y définis le schéma Prisma de TribuZen (User, Family, Post, Invitation), appliques la première migration, et implémentes `PrismaService` + `FamilyService` avec CRUD type-safe — corrigé complet commenté + variante J+30 dans le README du lab.
