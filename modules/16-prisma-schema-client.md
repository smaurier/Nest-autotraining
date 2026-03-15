# Module 16 — Prisma — Schema, Client & Migrations

> **Objectif** : Decouvrir Prisma, l'ORM moderne pour TypeScript, et apprendre a définir un schema, générer le client, effectuer des operations CRUD et gérer les migrations dans un projet NestJS.
> **Difficulte** : ⭐⭐⭐ (avance)
> **Prérequis** : Module 11 (Services & Providers), Module 12 (Modules), notions SQL de base
> **Duree estimee** : 5 heures

---

## 1. Introduction a Prisma

### 1.1 Qu'est-ce que Prisma ?

Prisma est un ORM de nouvelle génération pour Node.js et TypeScript. Contrairement a TypeORM qui utilise des decorateurs et le pattern Active Record/Data Mapper, Prisma adopte une approche **schema-first** : vous definissez votre schema dans un fichier declaratif, puis Prisma généré un client TypeScript entièrement type.

> **Analogie** : Si TypeORM est comme un architecte qui dessine les plans au fur et à mesure de la construction (decorateurs dans le code), Prisma est comme un architecte qui fait d'abord un plan complet (schema.prisma), puis généré automatiquement les outils de construction (PrismaClient).

### 1.2 L'ecosysteme Prisma

| Composant | Role |
|-----------|------|
| **Prisma Schema** | Fichier declaratif pour définir le modèle de donnees |
| **Prisma Client** | Client auto-généré avec types TypeScript complets |
| **Prisma Migrate** | Système de migration declaratif |
| **Prisma Studio** | Interface graphique pour explorer les donnees |
| **Prisma CLI** | Outil en ligne de commande |

### 1.3 Installation

```bash
# Installation des dependances
npm install prisma --save-dev
npm install @prisma/client

# Initialisation de Prisma (cree le dossier prisma/ et le schema)
npx prisma init

# Avec PostgreSQL specifiquement
npx prisma init --datasource-provider postgresql
```

Cette commande créé :

```
projet/
├── prisma/
│   └── schema.prisma    ← Le fichier de schema
├── .env                  ← Variables d'environnement (DATABASE_URL)
```

---

## 2. Le fichier schema.prisma

### 2.1 Anatomie du schema

Le fichier `schema.prisma` contient trois sections principales :

```prisma
// === 1. Configuration de la source de donnees ===
datasource db {
  provider = "postgresql"  // postgresql, mysql, sqlite, sqlserver, mongodb
  url      = env("DATABASE_URL")  // Lit la variable d'environnement
}

// === 2. Configuration du generateur ===
generator client {
  provider = "prisma-client-js"  // Genere le PrismaClient JavaScript/TypeScript
  // Options supplementaires :
  // binaryTargets = ["native", "linux-musl"]  // Pour Docker
  // previewFeatures = ["fullTextSearch"]       // Fonctionnalites en preview
}

// === 3. Definition des modeles (vos tables) ===
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  nom       String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Le fichier `.env` :

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nest_course?schema=public"
```

### 2.2 Les types de champs

```prisma
model ExempleTypes {
  // --- Types de base ---
  id          Int       @id @default(autoincrement())
  nom         String    // VARCHAR(191) par defaut
  description String?   // Le ? rend le champ optionnel (nullable)
  contenu     String    @db.Text  // Type TEXT en base
  resume      String    @db.VarChar(500)  // VARCHAR(500)

  // --- Nombres ---
  age         Int       // INTEGER
  stock       Int       @default(0)  // Valeur par defaut
  prix        Float     // DOUBLE PRECISION
  prixExact   Decimal   @db.Decimal(10, 2)  // DECIMAL(10,2) pour les prix
  grandeVal   BigInt    // BIGINT

  // --- Booleens ---
  actif       Boolean   @default(true)

  // --- Dates ---
  createdAt   DateTime  @default(now())    // TIMESTAMP + valeur par defaut
  updatedAt   DateTime  @updatedAt         // Mis a jour automatiquement
  dateDebut   DateTime  @db.Date           // DATE sans heure
  heureRdv    DateTime  @db.Time           // HEURE sans date

  // --- JSON ---
  metadata    Json?     // Stocke du JSON directement
  tags        Json      @default("[]")

  // --- Bytes ---
  avatar      Bytes?    // Pour les fichiers binaires (rarement utilise)
}
```

### 2.3 Les attributs de champs

| Attribut | Description | Exemple |
|----------|-------------|---------|
| `@id` | Cle primaire | `id Int @id` |
| `@default()` | Valeur par defaut | `@default(0)`, `@default(now())`, `@default(uuid())` |
| `@unique` | Contrainte d'unicite | `email String @unique` |
| `@map("nom_colonne")` | Renomme la colonne en base | `@map("nom_complet")` |
| `@relation` | Definit une relation | `@relation(fields: [userId], references: [id])` |
| `@updatedAt` | Mise a jour automatique | `updatedAt DateTime @updatedAt` |
| `@db.xxx` | Type natif de la base | `@db.Text`, `@db.VarChar(100)` |
| `@ignore` | Ignore le champ dans Prisma | Pour les colonnes legacy |

### 2.4 Les attributs de modèle

```prisma
model Article {
  id        Int    @id @default(autoincrement())
  titre     String
  slug      String
  auteurId  Int    @map("auteur_id")  // Renomme la colonne

  auteur    User   @relation(fields: [auteurId], references: [id])

  // Index composites
  @@unique([auteurId, slug])           // Contrainte unique composite
  @@index([titre])                     // Index simple
  @@index([auteurId, createdAt])       // Index composite
  @@map("articles")                    // Renomme la table en base
}
```

| Attribut | Description | Exemple |
|----------|-------------|---------|
| `@@id([...])` | Cle primaire composite | `@@id([postId, tagId])` |
| `@@unique([...])` | Contrainte unique composite | `@@unique([email, tenant])` |
| `@@index([...])` | Index composite | `@@index([auteurId, createdAt])` |
| `@@map("nom_table")` | Renomme la table en base | `@@map("mes_articles")` |

### 2.5 Les enums

```prisma
enum Role {
  ADMIN
  MODERATEUR
  UTILISATEUR
}

enum ArticleStatut {
  BROUILLON
  PUBLIE
  ARCHIVE
}

model User {
  id   Int    @id @default(autoincrement())
  nom  String
  role Role   @default(UTILISATEUR)
}

model Article {
  id     Int            @id @default(autoincrement())
  titre  String
  statut ArticleStatut  @default(BROUILLON)
}
```

---

## 3. Les Relations dans Prisma

### 3.1 Relation One-to-Many (la plus courante)

```prisma
model User {
  id       Int       @id @default(autoincrement())
  email    String    @unique
  nom      String

  // Un utilisateur a plusieurs articles (cote "Many")
  articles Article[]
}

model Article {
  id       Int    @id @default(autoincrement())
  titre    String
  contenu  String @db.Text

  // Chaque article appartient a un utilisateur (cote "One")
  auteur   User   @relation(fields: [auteurId], references: [id], onDelete: Cascade)
  auteurId Int    @map("auteur_id")
}
```

Regles :
- Le cote "One" (`Article.auteur`) a le `@relation` avec `fields` et `references`
- Le cote "Many" (`User.articles`) est un simple tableau `Article[]`
- `auteurId` est la clé etrangere stockee en base

### 3.2 Relation One-to-One

```prisma
model User {
  id      Int      @id @default(autoincrement())
  email   String   @unique
  nom     String

  // Un utilisateur a un seul profil
  profile Profile?  // Le ? signifie que le profil est optionnel
}

model Profile {
  id       Int     @id @default(autoincrement())
  bio      String? @db.Text
  avatar   String?
  siteWeb  String?

  // Le profil appartient a un utilisateur
  user     User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId   Int     @unique  // @unique force la relation 1-1
}
```

> **A retenir** : La différence entre One-to-One et One-to-Many dans Prisma est le `@unique` sur la clé etrangere. Avec `@unique`, c'est une relation 1-1. Sans, c'est une relation 1-N.

### 3.3 Relation Many-to-Many

#### Implicite (Prisma géré la table de liaison)

```prisma
model Article {
  id    Int    @id @default(autoincrement())
  titre String

  // Relation Many-to-Many implicite
  tags  Tag[]
}

model Tag {
  id       Int       @id @default(autoincrement())
  nom      String    @unique

  // Cote inverse
  articles Article[]
}
// Prisma cree automatiquement une table _ArticleToTag
```

#### Explicite (vous controlez la table de liaison)

```prisma
model Article {
  id    Int    @id @default(autoincrement())
  titre String

  articleTags ArticleTag[]
}

model Tag {
  id  Int    @id @default(autoincrement())
  nom String @unique

  articleTags ArticleTag[]
}

// Table de liaison explicite — permet d'ajouter des champs
model ArticleTag {
  article   Article  @relation(fields: [articleId], references: [id], onDelete: Cascade)
  articleId Int
  tag       Tag      @relation(fields: [tagId], references: [id], onDelete: Cascade)
  tagId     Int
  ajouteLe  DateTime @default(now())  // Champ supplementaire sur la relation

  @@id([articleId, tagId])  // Cle primaire composite
}
```

> **Bonne pratique** : Utilisez la relation Many-to-Many explicite si vous avez besoin de stocker des donnees supplementaires sur la relation (date d'ajout, ordre, metadata). Sinon, la forme implicite est plus simple.

### 3.4 Relations auto-referencantes

```prisma
model Comment {
  id       Int       @id @default(autoincrement())
  contenu  String    @db.Text

  // Relation auto-referencante pour les reponses
  parent   Comment?  @relation("CommentReplies", fields: [parentId], references: [id])
  parentId Int?

  reponses Comment[] @relation("CommentReplies")
}

model Employee {
  id          Int        @id @default(autoincrement())
  nom         String

  // Un manager est aussi un employe
  manager     Employee?  @relation("ManagerSubordinates", fields: [managerId], references: [id])
  managerId   Int?

  subordonnes Employee[] @relation("ManagerSubordinates")
}
```

### 3.5 Comportement onDelete

```prisma
model Article {
  auteur   User @relation(fields: [auteurId], references: [id], onDelete: Cascade)
  auteurId Int
}
```

| Valeur | Description |
|--------|-------------|
| `Cascade` | Supprime les enfants avec le parent |
| `SetNull` | Met la FK a null (le champ doit etre nullable) |
| `Restrict` | Empeche la suppression du parent |
| `NoAction` | Similaire a Restrict (defaut) |
| `SetDefault` | Met la FK a sa valeur par defaut |

---

## 4. Schema complet — Exemple de blog

```prisma
// schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// === Enums ===

enum Role {
  ADMIN
  AUTEUR
  LECTEUR
}

enum ArticleStatut {
  BROUILLON
  PUBLIE
  ARCHIVE
}

// === Modeles ===

model User {
  id           Int       @id @default(autoincrement())
  email        String    @unique
  nom          String
  motDePasse   String    @map("mot_de_passe")
  role         Role      @default(LECTEUR)
  actif        Boolean   @default(true)
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  profile      Profile?
  articles     Article[]
  commentaires Comment[]

  @@map("users")
}

model Profile {
  id       Int     @id @default(autoincrement())
  bio      String? @db.Text
  avatar   String?
  siteWeb  String? @map("site_web")
  twitter  String?
  github   String?

  user     User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId   Int     @unique @map("user_id")

  @@map("profiles")
}

model Article {
  id          Int            @id @default(autoincrement())
  titre       String         @db.VarChar(200)
  slug        String         @unique
  resume      String?        @db.Text
  contenu     String         @db.Text
  statut      ArticleStatut  @default(BROUILLON)
  nombreVues  Int            @default(0) @map("nombre_vues")
  createdAt   DateTime       @default(now()) @map("created_at")
  updatedAt   DateTime       @updatedAt @map("updated_at")

  auteur      User           @relation(fields: [auteurId], references: [id], onDelete: Cascade)
  auteurId    Int            @map("auteur_id")

  commentaires Comment[]
  tags         Tag[]

  @@index([slug])
  @@index([auteurId, createdAt])
  @@map("articles")
}

model Comment {
  id        Int      @id @default(autoincrement())
  contenu   String   @db.Text
  createdAt DateTime @default(now()) @map("created_at")

  auteur    User     @relation(fields: [auteurId], references: [id], onDelete: Cascade)
  auteurId  Int      @map("auteur_id")

  article   Article  @relation(fields: [articleId], references: [id], onDelete: Cascade)
  articleId Int      @map("article_id")

  // Reponses (relation auto-referencante)
  parent    Comment? @relation("CommentReplies", fields: [parentId], references: [id])
  parentId  Int?     @map("parent_id")
  reponses  Comment[] @relation("CommentReplies")

  @@map("comments")
}

model Tag {
  id          Int       @id @default(autoincrement())
  nom         String    @unique @db.VarChar(50)
  description String?
  couleur     String?   @db.VarChar(7)  // Code couleur hex

  articles    Article[]

  @@map("tags")
}
```

---

## 5. Prisma Generate et PrismaClient

### 5.1 Générer le client

```bash
# Genere le PrismaClient a partir du schema
npx prisma generate
```

Cette commande lit `schema.prisma` et généré le code TypeScript dans `node_modules/@prisma/client/`. Le client est entièrement type : chaque modèle, chaque champ, chaque relation a ses types corrects.

### 5.2 PrismaClient — Operations CRUD

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// === CREATE ===

// Creer un utilisateur
const user = await prisma.user.create({
  data: {
    email: 'alice@example.com',
    nom: 'Alice Dupont',
    motDePasse: 'hashDuMotDePasse',
    role: 'AUTEUR',
  },
});

// Creer avec des relations imbriquees
const userAvecProfil = await prisma.user.create({
  data: {
    email: 'bob@example.com',
    nom: 'Bob Martin',
    motDePasse: 'hashDuMotDePasse',
    profile: {
      create: {  // Cree le profil en meme temps
        bio: 'Developpeur passione',
        twitter: '@bob_martin',
      },
    },
  },
  include: {
    profile: true,  // Inclut le profil dans la reponse
  },
});

// Creer plusieurs enregistrements
const result = await prisma.user.createMany({
  data: [
    { email: 'user1@example.com', nom: 'User 1', motDePasse: 'hash1' },
    { email: 'user2@example.com', nom: 'User 2', motDePasse: 'hash2' },
    { email: 'user3@example.com', nom: 'User 3', motDePasse: 'hash3' },
  ],
  skipDuplicates: true,  // Ignore les doublons (email unique)
});
// result.count = 3

// === READ ===

// Trouver un par ID
const user = await prisma.user.findUnique({
  where: { id: 1 },
});

// Trouver un par champ unique
const user = await prisma.user.findUnique({
  where: { email: 'alice@example.com' },
});

// Trouver le premier qui matche
const article = await prisma.article.findFirst({
  where: { statut: 'PUBLIE' },
  orderBy: { createdAt: 'desc' },
});

// Trouver tous
const articles = await prisma.article.findMany({
  where: { statut: 'PUBLIE' },
  orderBy: { createdAt: 'desc' },
  skip: 0,   // Pagination : offset
  take: 10,  // Pagination : limit
});

// findUniqueOrThrow — lance une erreur si pas trouve
const user = await prisma.user.findUniqueOrThrow({
  where: { id: 999 },
});
// Lance PrismaClientKnownRequestError si pas trouve

// === UPDATE ===

// Mettre a jour un enregistrement
const updatedUser = await prisma.user.update({
  where: { id: 1 },
  data: {
    nom: 'Alice Martin',
    actif: false,
  },
});

// Mettre a jour plusieurs
const result = await prisma.article.updateMany({
  where: { statut: 'BROUILLON', auteurId: 1 },
  data: { statut: 'ARCHIVE' },
});
// result.count = nombre de lignes modifiees

// === DELETE ===

// Supprimer un enregistrement
const deletedUser = await prisma.user.delete({
  where: { id: 1 },
});

// Supprimer plusieurs
const result = await prisma.article.deleteMany({
  where: { statut: 'ARCHIVE' },
});

// === UPSERT ===
// Creer si n'existe pas, mettre a jour sinon

const user = await prisma.user.upsert({
  where: { email: 'alice@example.com' },
  create: {
    email: 'alice@example.com',
    nom: 'Alice',
    motDePasse: 'hash',
  },
  update: {
    nom: 'Alice (mis a jour)',
  },
});

// === COMPTAGE ===

const count = await prisma.article.count({
  where: { statut: 'PUBLIE' },
});

// === AGREGATION ===

const stats = await prisma.article.aggregate({
  _avg: { nombreVues: true },
  _sum: { nombreVues: true },
  _min: { nombreVues: true },
  _max: { nombreVues: true },
  _count: true,
  where: { statut: 'PUBLIE' },
});
// { _avg: { nombreVues: 150.5 }, _sum: { nombreVues: 3010 }, ... }

// === GROUP BY ===

const statsByStatut = await prisma.article.groupBy({
  by: ['statut'],
  _count: { id: true },
  _avg: { nombreVues: true },
  orderBy: { _count: { id: 'desc' } },
});
// [{ statut: 'PUBLIE', _count: { id: 15 }, _avg: { nombreVues: 200 } }, ...]
```

---

## 6. Prisma Migrate — Gestion du schema

### 6.1 Les commandes de migration

```bash
# Creer et appliquer une migration (developpement)
npx prisma migrate dev --name init
# 1. Compare le schema actuel avec la base
# 2. Genere le fichier SQL de migration
# 3. Applique la migration
# 4. Regenere le PrismaClient

# Appliquer les migrations en production
npx prisma migrate deploy
# Applique toutes les migrations en attente (sans generer de nouvelles)

# Reinitialiser la base (ATTENTION : supprime toutes les donnees !)
npx prisma migrate reset
# 1. Supprime la base
# 2. Recree la base
# 3. Applique toutes les migrations
# 4. Execute le seed si configure

# Pousser le schema sans migration (prototypage rapide)
npx prisma db push
# Synchronise le schema avec la base sans creer de fichier de migration
# Utile en phase de prototypage, pas en production

# Tirer le schema de la base existante
npx prisma db pull
# Genere le schema.prisma a partir de la base de donnees existante
# Utile pour les projets existants

# Ouvrir Prisma Studio (interface graphique)
npx prisma studio
# Ouvre un navigateur web pour explorer et modifier les donnees
```

### 6.2 Structure des migrations

```
prisma/
├── schema.prisma
├── migrations/
│   ├── 20240115100000_init/
│   │   └── migration.sql
│   ├── 20240120150000_add_tags/
│   │   └── migration.sql
│   └── migration_lock.toml
```

Exemple de fichier de migration généré :

```sql
-- prisma/migrations/20240115100000_init/migration.sql

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'AUTEUR', 'LECTEUR');
CREATE TYPE "ArticleStatut" AS ENUM ('BROUILLON', 'PUBLIE', 'ARCHIVE');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "mot_de_passe" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'LECTEUR',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" SERIAL NOT NULL,
    "titre" VARCHAR(200) NOT NULL,
    "slug" TEXT NOT NULL,
    "resume" TEXT,
    "contenu" TEXT NOT NULL,
    "statut" "ArticleStatut" NOT NULL DEFAULT 'BROUILLON',
    "nombre_vues" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "auteur_id" INTEGER NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "articles_slug_key" ON "articles"("slug");
CREATE INDEX "articles_slug_idx" ON "articles"("slug");
CREATE INDEX "articles_auteur_id_created_at_idx" ON "articles"("auteur_id", "created_at");

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_auteur_id_fkey"
    FOREIGN KEY ("auteur_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

> **Piege classique** : Ne modifiez **jamais** un fichier de migration déjà applique. Si vous avez besoin de corriger quelque chose, creez une nouvelle migration. Les migrations appliquees sont immuables.

### 6.3 Seeding (donnees initiales)

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Debut du seeding...');

  // Creer des utilisateurs
  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      email: 'alice@example.com',
      nom: 'Alice Dupont',
      motDePasse: '$2b$10$hashDuMotDePasse',
      role: 'ADMIN',
      profile: {
        create: {
          bio: 'Administratrice du site',
          twitter: '@alice_dupont',
        },
      },
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      email: 'bob@example.com',
      nom: 'Bob Martin',
      motDePasse: '$2b$10$hashDuMotDePasse',
      role: 'AUTEUR',
    },
  });

  // Creer des tags
  const tagTS = await prisma.tag.upsert({
    where: { nom: 'TypeScript' },
    update: {},
    create: { nom: 'TypeScript', couleur: '#3178C6' },
  });

  const tagNest = await prisma.tag.upsert({
    where: { nom: 'NestJS' },
    update: {},
    create: { nom: 'NestJS', couleur: '#E0234E' },
  });

  // Creer des articles
  await prisma.article.create({
    data: {
      titre: 'Introduction a NestJS',
      slug: 'introduction-nestjs',
      contenu: 'NestJS est un framework Node.js progressif...',
      statut: 'PUBLIE',
      auteurId: alice.id,
      tags: {
        connect: [{ id: tagTS.id }, { id: tagNest.id }],
      },
    },
  });

  console.log('Seeding termine !');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Configuration dans `package.json` :

```json
{
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```

```bash
# Executer le seed manuellement
npx prisma db seed

# Le seed est aussi execute automatiquement avec :
npx prisma migrate reset
```

---

## 7. Intégration avec NestJS

### 7.1 Créer le PrismaService

```typescript
// prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      // Options de logging
      log: [
        { emit: 'stdout', level: 'query' },   // Log toutes les requetes
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });
  }

  // Connexion automatique au demarrage du module
  async onModuleInit() {
    await this.$connect();
  }

  // Deconnexion propre a l'arret de l'application
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

### 7.2 Créer le PrismaModule global

```typescript
// prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Rend le module disponible partout sans import
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

### 7.3 Importer dans AppModule

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ArticlesModule } from './articles/articles.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    PrismaModule, // Disponible globalement grace a @Global()
    ArticlesModule,
    UsersModule,
  ],
})
export class AppModule {}
```

### 7.4 Utiliser PrismaService dans un service

```typescript
// articles/articles.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(auteurId: number, dto: CreateArticleDto) {
    return this.prisma.article.create({
      data: {
        titre: dto.titre,
        slug: this.generateSlug(dto.titre),
        contenu: dto.contenu,
        resume: dto.resume,
        auteurId,
        tags: dto.tagIds
          ? { connect: dto.tagIds.map((id) => ({ id })) }
          : undefined,
      },
      include: {
        auteur: { select: { id: true, nom: true, email: true } },
        tags: true,
      },
    });
  }

  async findAll(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [articles, total] = await Promise.all([
      this.prisma.article.findMany({
        where: { statut: 'PUBLIE' },
        include: {
          auteur: { select: { id: true, nom: true } },
          tags: true,
          _count: { select: { commentaires: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.article.count({ where: { statut: 'PUBLIE' } }),
    ]);

    return {
      data: articles,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const article = await this.prisma.article.findUnique({
      where: { id },
      include: {
        auteur: {
          select: { id: true, nom: true, email: true },
        },
        tags: true,
        commentaires: {
          include: {
            auteur: { select: { id: true, nom: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!article) {
      throw new NotFoundException(`Article #${id} introuvable`);
    }

    return article;
  }

  async findBySlug(slug: string) {
    const article = await this.prisma.article.findUnique({
      where: { slug },
      include: {
        auteur: { select: { id: true, nom: true } },
        tags: true,
      },
    });

    if (!article) {
      throw new NotFoundException(`Article avec le slug "${slug}" introuvable`);
    }

    // Incrementer les vues
    await this.prisma.article.update({
      where: { id: article.id },
      data: { nombreVues: { increment: 1 } },
    });

    return article;
  }

  async update(id: number, dto: UpdateArticleDto) {
    // Verifier que l'article existe
    await this.findOne(id);

    return this.prisma.article.update({
      where: { id },
      data: {
        titre: dto.titre,
        contenu: dto.contenu,
        resume: dto.resume,
        statut: dto.statut,
        tags: dto.tagIds
          ? { set: dto.tagIds.map((id) => ({ id })) } // set remplace tous les tags
          : undefined,
      },
      include: {
        auteur: { select: { id: true, nom: true } },
        tags: true,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id); // Verifie l'existence
    return this.prisma.article.delete({ where: { id } });
  }

  private generateSlug(titre: string): string {
    return titre
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
```

> **Bonne pratique** : Utilisez `include` pour charger les relations dont vous avez besoin, et `select` pour limiter les champs retournes. Ne chargez jamais plus de donnees que nécessaire.

---

## 8. Comparaison rapide Prisma vs TypeORM (CRUD)

| Operation | TypeORM | Prisma |
|-----------|---------|--------|
| Trouver par ID | `repo.findOne({ where: { id } })` | `prisma.user.findUnique({ where: { id } })` |
| Trouver tous | `repo.find()` | `prisma.user.findMany()` |
| Créer | `repo.save(repo.create(data))` | `prisma.user.create({ data })` |
| Mettre a jour | `repo.save({ id, ...data })` | `prisma.user.update({ where: { id }, data })` |
| Supprimer | `repo.delete(id)` | `prisma.user.delete({ where: { id } })` |
| Compter | `repo.count()` | `prisma.user.count()` |
| Relations | `relations: { profile: true }` | `include: { profile: true }` |

---

## 9. Exercices pratiques

### Exercice 1 : Schema e-commerce

Creez un schema Prisma avec les modèles : `Category`, `Product`, `ProductImage`. Relations : une categorie a plusieurs produits, un produit a plusieurs images. Ajoutez les enums nécessaires et les index pertinents.

### Exercice 2 : CRUD complet

Implementez un `ProductsService` complet avec : create (avec images imbriquees), findAll (avec pagination et filtre par categorie), findOne (avec relations), update (avec gestion des tags), remove.

### Exercice 3 : Seed

Creez un fichier seed qui insere 3 categories, 10 produits et 20 images de produits.

---

## Liens

| Ressource | Lien |
|-----------|------|
| Quiz Module 16 | `quiz/16-quiz.md` |
| Lab Module 16 | `labs/16-lab-prisma-crud.md` |
| Screencast | `screencasts/16-screencast.md` |
| Module précédent | [Module 15 — TypeORM Requetes & Migrations](15-typeorm-requetes-migrations.md) |
| Module suivant | [Module 17 — Prisma Requetes avancees & Comparaison](17-prisma-avance-comparaison.md) |
| Documentation Prisma | https://www.prisma.io/docs |
| Prisma Schema Référence | https://www.prisma.io/docs/référence/api-référence/prisma-schema-référence |
| Prisma Client API | https://www.prisma.io/docs/référence/api-référence/prisma-client-référence |

---

<!-- parcours-recommande -->

::: tip Parcours recommandé
1. **Screencast** : [screencast 16 prisma setup](../screencasts/screencast-16-prisma-setup.md)
2. **Lab** : [lab-16-prisma-setup](../labs/lab-16-prisma-setup/README)
3. **Visualisation** : [ORM Query Flow](../visualizations/orm-query-flow.html)
4. **Quiz** : [quiz 16 prisma schema](../quizzes/quiz-16-prisma-schema.html)
:::
