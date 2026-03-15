# Screencast 16 — Prisma Schema & Client

## Informations
- **Duree estimee** : 15-20 min
- **Module** : `modules/16-prisma-schema-client.md`
- **Lab associe** : `labs/lab-16-prisma-setup/`
- **Prérequis** : Screencast 15 (TypeORM Requetes & Migrations)

## Setup
- [ ] Node.js 20+ installe
- [ ] Terminal ouvert dans `nest-course/`
- [ ] PostgreSQL demarre et accessible
- [ ] Editeur de code ouvert
- [ ] Port 3000 disponible

## Script

### [00:00-03:00] Introduction — Pourquoi Prisma ?

> Salut ! On a vu TypeORM en detail. Maintenant, decouvrons Prisma — une alternative moderne qui prend une approche complètement différente. TypeORM utilise des decorateurs sur des classes. Prisma utilise un fichier de schema declaratif.

**Action** : Afficher le slide de titre "Module 16 — Prisma Schema & Client".

> Prisma a trois composants : le schema (qui decrit le modèle de donnees), le client (généré automatiquement pour interagir avec la base), et Prisma Migrate (pour les migrations).

**Action** : Initialiser Prisma dans un projet NestJS.

```bash
npm install prisma @prisma/client
npx prisma init
```

> Prisma a créé un dossier `prisma/` avec un fichier `schema.prisma` et un fichier `.env` pour l'URL de connexion.

### [03:00-08:00] Le schema Prisma — Définir le modèle

**Action** : Écrire le schema Prisma.

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String
  password  String
  role      String   @default("user")
  tasks     Task[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}

model Task {
  id          Int      @id @default(autoincrement())
  title       String
  description String?
  done        Boolean  @default(false)
  priority    String   @default("medium")
  author      User     @relation(fields: [authorId], references: [id])
  authorId    Int
  tags        Tag[]
  createdAt   DateTime @default(now())

  @@map("tasks")
}

model Tag {
  id    Int    @id @default(autoincrement())
  name  String @unique
  tasks Task[]

  @@map("tags")
}
```

> Comparez avec les entites TypeORM : pas de decorateurs, pas de classes. C'est un DSL (Domain Specific Language) dedie à la description du schema. C'est plus lisible et plus concis.

**Action** : Configurer l'URL de connexion.

```bash
# .env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nestcourse_prisma"
```

**Action** : Appliquer le schema et générer le client.

```bash
# Creer la base et appliquer le schema
npx prisma migrate dev --name init

# Le client est genere automatiquement
```

> `prisma migrate dev` créé la migration SQL et l'applique à la base. Le client Prisma est regenere automatiquement. On va voir ce client.

### [08:00-13:00] PrismaService et CRUD dans NestJS

**Action** : Créer le PrismaService.

```typescript
// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

```typescript
// src/prisma/prisma.module.ts
import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

**Action** : Utiliser Prisma dans le TasksService.

```typescript
// src/tasks/tasks.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTaskDto) {
    return this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        author: { connect: { id: dto.authorId } },
      },
      include: { author: true },
    });
  }

  async findAll() {
    return this.prisma.task.findMany({
      include: {
        author: { select: { id: true, name: true, email: true } },
        tags: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { author: true, tags: true },
    });
    if (!task) throw new NotFoundException(`Task #${id} non trouvee`);
    return task;
  }

  async update(id: number, dto: UpdateTaskDto) {
    try {
      return await this.prisma.task.update({
        where: { id },
        data: dto,
        include: { author: true },
      });
    } catch {
      throw new NotFoundException(`Task #${id} non trouvee`);
    }
  }

  async remove(id: number) {
    try {
      await this.prisma.task.delete({ where: { id } });
    } catch {
      throw new NotFoundException(`Task #${id} non trouvee`);
    }
  }
}
```

> Remarquez l'autocompletion : Prisma généré un client type-safe. Chaque modèle a ses méthodes `create`, `findMany`, `findUnique`, `update`, `delete`. Les relations sont incluses avec `include`, et on peut selectionner des champs spécifiques avec `select`.

**Action** : Tester les operations CRUD.

```bash
# Creer un utilisateur
curl -X POST -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@prisma.com","password":"secret"}' \
  http://localhost:3000/users

# Creer une tache
curl -X POST -H "Content-Type: application/json" \
  -d '{"title":"Decouvrir Prisma","authorId":1}' \
  http://localhost:3000/tasks

# Lister avec relations
curl http://localhost:3000/tasks
```

### [13:00-16:00] Prisma Studio et introspection

> Prisma Studio est une interface graphique pour explorer et modifier les donnees.

**Action** : Lancer Prisma Studio.

```bash
npx prisma studio
```

> Prisma Studio s'ouvre dans le navigateur sur le port 5555. On peut voir les tables, les donnees, ajouter des enregistrements, modifier, supprimer. C'est un outil de développement très pratique.

**Action** : Montrer Prisma Studio dans le navigateur.

> On peut aussi introspecter une base existante pour générer le schema Prisma.

```bash
# A partir d'une base existante
npx prisma db pull
```

> Cette commande généré le fichier schema.prisma à partir des tables existantes. C'est utile quand on migre un projet existant vers Prisma.

### [16:00-18:30] Recap

> Prisma propose une approche schema-first avec un client type-safe généré automatiquement. Le PrismaService s'intégré parfaitement dans NestJS. Les migrations sont gerees par `prisma migrate dev`. Et Prisma Studio offre une interface graphique pour explorer les donnees.

**Action** : Afficher le slide recap.

> Le lab est dans `labs/lab-16-prisma-setup/`. Vous allez configurer Prisma, définir votre schema, générer le client et construire un CRUD complet. Au prochain screencast, on va approfondir Prisma et le comparer a TypeORM.

## Points d'attention pour l'enregistrement
- Créer la base PostgreSQL avant de commencer (CREATE DATABASE nestcourse_prisma)
- Montrer l'autocompletion du client Prisma dans VS Code — c'est le point fort
- Prisma Studio doit etre impressionnant visuellement
- Bien montrer le fichier de migration SQL généré dans prisma/migrations/
