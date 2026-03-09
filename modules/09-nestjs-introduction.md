# Module 09 — NestJS — Introduction & Premiers pas

> **Objectif** : Comprendre pourquoi NestJS existe, installer et explorer un projet NestJS, decouvrir les briques fondamentales (modules, controllers, services) et construire un premier CRUD avec la CLI NestJS.
>
> **Difficulte** : ⭐⭐ (intermediaire)

---

## 1. Pourquoi NestJS

### 1.1 Le probleme qu'il resout

Express est minimaliste — et c'est a la fois sa force et sa faiblesse. Il ne fournit aucune structure, aucune convention, aucune architecture. Chaque equipe organise son code differemment, ce qui rend la maintenance et l'onboarding difficiles.

| Probleme avec Express | Solution NestJS |
|---|---|
| Pas de structure imposee | Architecture modulaire avec conventions |
| Organisation libre (chaos possible) | Modules, controllers, services, providers |
| Pas d'injection de dependances | DI integre, similaire a Angular |
| Pas de TypeScript natif | TypeScript par defaut, decorateurs |
| Middleware artisanal | Guards, Pipes, Interceptors, Filters |
| Pas d'outil de generation | CLI avec `nest generate` |
| Pas de testing integre | Jest pre-configure avec mocks DI |

> **Analogie** : Express c'est comme une feuille blanche — tu peux dessiner ce que tu veux, mais rien ne te guide. NestJS c'est comme un plan d'architecte — la structure est definie, les conventions sont claires, et chaque piece a sa place. Tu es libre de personnaliser, mais le cadre est pose.

### 1.2 Inspiration Angular

NestJS est fortement inspire d'**Angular** :

| Concept Angular | Equivalent NestJS |
|---|---|
| `@Component` | `@Controller` |
| `@Injectable` service | `@Injectable` service |
| `@NgModule` | `@Module` |
| Dependency Injection | Dependency Injection |
| Pipes (transform) | Pipes (validation/transform) |
| Guards (routing) | Guards (authorization) |
| Interceptors (HTTP) | Interceptors (request/response) |
| Decorateurs TypeScript | Decorateurs TypeScript |

> **A retenir** : Si tu connais Angular, NestJS te semblera tres familier. Les patterns sont les memes — seul le contexte change (frontend → backend). Si tu ne connais pas Angular, pas d'inquietude : les concepts sont expliques de zero dans ce cours.

### 1.3 NestJS en chiffres

| Statistique | Valeur |
|---|---|
| Telechargements npm/semaine | ~4 millions |
| Stars GitHub | ~68 000 |
| Premiere release | 2017 |
| Createur | Kamil Mysliwiec |
| Runtime sous-jacent | Express (par defaut) ou Fastify |
| Langage | TypeScript (JavaScript possible mais deconseille) |

---

## 2. Installation et premier projet

### 2.1 Installer la CLI NestJS

```bash
# Installer la CLI globalement
npm install -g @nestjs/cli

# Verifier l'installation
nest --version
# 10.x.x

# Voir toutes les commandes disponibles
nest --help
```

### 2.2 Creer un nouveau projet

```bash
# Creer un projet (installation interactive)
nest new mon-api

# Choisis :
# ? Which package manager would you like to use? npm
# (pnpm et yarn sont aussi disponibles)

cd mon-api
```

### 2.3 Structure du projet genere

```
mon-api/
├── src/
│   ├── app.controller.ts       ← Controller racine
│   ├── app.controller.spec.ts  ← Tests du controller
│   ├── app.module.ts           ← Module racine
│   ├── app.service.ts          ← Service racine
│   └── main.ts                 ← Point d'entree
├── test/
│   ├── app.e2e-spec.ts         ← Tests end-to-end
│   └── jest-e2e.json
├── node_modules/
├── .eslintrc.js
├── .prettierrc
├── nest-cli.json               ← Configuration CLI NestJS
├── package.json
├── tsconfig.json               ← Configuration TypeScript
├── tsconfig.build.json
└── README.md
```

### 2.4 Demarrer le projet

```bash
# Mode developpement (avec hot reload)
npm run start:dev

# Mode production
npm run start:prod

# Mode watch (rechargement automatique)
npm run start:debug
```

---

## 3. Anatomie du projet

### 3.1 main.ts — Le point d'entree

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // Creer l'application NestJS a partir du module racine
  const app = await NestFactory.create(AppModule);

  // Configurer (CORS, prefixes, etc.)
  app.enableCors();
  app.setGlobalPrefix('api'); // Toutes les routes commencent par /api

  // Demarrer le serveur
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application demarree sur http://localhost:${port}`);
}

bootstrap();
```

> **Analogie** : `main.ts` c'est comme la fonction `main()` en C ou Java. C'est le point de depart de ton application. Il cree l'application, la configure et la lance. C'est similaire au `main.ts` d'Angular qui bootstrap le `AppModule`.

### 3.2 app.module.ts — Le module racine

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [],        // Autres modules importes
  controllers: [AppController], // Controllers de ce module
  providers: [AppService],      // Services (providers) de ce module
})
export class AppModule {}
```

### 3.3 app.controller.ts — Le controller racine

```typescript
// src/app.controller.ts
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller() // Route de base : '/'
export class AppController {
  // Injection de dependance via le constructeur
  constructor(private readonly appService: AppService) {}

  @Get() // GET /
  getHello(): string {
    return this.appService.getHello();
  }
}
```

### 3.4 app.service.ts — Le service racine

```typescript
// src/app.service.ts
import { Injectable } from '@nestjs/common';

@Injectable() // Indique que cette classe peut etre injectee
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}
```

> **A retenir** : Le trio **Module → Controller → Service** est le pattern fondamental de NestJS. Le Module declare les composants, le Controller recoit les requetes HTTP, et le Service contient la logique metier. C'est exactement le pattern MVC du module 06, mais formalise avec des decorateurs TypeScript.

---

## 4. Les decorateurs TypeScript

### 4.1 Qu'est-ce qu'un decorateur

Un **decorateur** est une fonction speciale qui modifie le comportement d'une classe, methode ou parametre. NestJS utilise massivement les decorateurs :

```typescript
// @Controller() — Marque une classe comme controller HTTP
@Controller('users')
export class UsersController { }

// @Injectable() — Marque une classe comme injectable (DI)
@Injectable()
export class UsersService { }

// @Module() — Marque une classe comme module NestJS
@Module({ imports: [], controllers: [], providers: [] })
export class UsersModule { }

// @Get(), @Post(), etc. — Definit la methode HTTP
@Get(':id')
findOne(@Param('id') id: string) { }

// @Body(), @Param(), @Query() — Extrait les donnees de la requete
create(@Body() body: CreateUserDto) { }
```

### 4.2 Les decorateurs ne sont PAS magiques

Sous le capot, un decorateur est une fonction qui ajoute des metadonnees a une classe via `Reflect.metadata`. NestJS lit ces metadonnees au demarrage pour configurer le routing, l'injection de dependances, etc.

```typescript
// Ce que tu ecris :
@Controller('users')
export class UsersController {
  @Get()
  findAll() { return []; }
}

// Ce que NestJS comprend :
// "La classe UsersController est un controller pour /users"
// "La methode findAll repond aux requetes GET /users"
```

---

## 5. La CLI NestJS — Generateurs

### 5.1 Commandes de generation

```bash
# Generer un module
nest generate module users
# ou en raccourci
nest g mo users

# Generer un controller
nest g co users

# Generer un service
nest g s users

# Generer un module + controller + service d'un coup (resource)
nest g resource books
# Choisis : REST API, puis Yes pour les operations CRUD
```

### 5.2 Ce que `nest g resource` genere

```bash
nest g resource books
# ? What transport layer do you use? REST API
# ? Would you like to generate CRUD entry points? Yes
```

Fichiers generes :

```
src/books/
├── books.controller.ts       ← Controller avec les routes CRUD
├── books.controller.spec.ts  ← Tests du controller
├── books.module.ts           ← Module
├── books.service.ts          ← Service avec les methodes CRUD
├── dto/
│   ├── create-book.dto.ts    ← DTO pour la creation
│   └── update-book.dto.ts    ← DTO pour la mise a jour
└── entities/
    └── book.entity.ts        ← Entite (modele de donnees)
```

Et le module est automatiquement importe dans `app.module.ts` :

```typescript
// app.module.ts (mis a jour automatiquement)
@Module({
  imports: [BooksModule], // ← Ajoute automatiquement
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

### 5.3 Tableau des commandes de generation

| Commande | Raccourci | Resultat |
|---|---|---|
| `nest g module <name>` | `nest g mo <name>` | Module |
| `nest g controller <name>` | `nest g co <name>` | Controller + spec |
| `nest g service <name>` | `nest g s <name>` | Service + spec |
| `nest g resource <name>` | `nest g res <name>` | Module + Controller + Service + DTOs |
| `nest g middleware <name>` | `nest g mi <name>` | Middleware |
| `nest g guard <name>` | `nest g gu <name>` | Guard |
| `nest g pipe <name>` | `nest g pi <name>` | Pipe |
| `nest g interceptor <name>` | `nest g itc <name>` | Interceptor |
| `nest g filter <name>` | `nest g f <name>` | Exception filter |

> **Bonne pratique** : Utilise TOUJOURS la CLI pour generer des fichiers NestJS. Elle cree les fichiers avec les bonnes conventions de nommage, les bons decorateurs, et met a jour automatiquement les modules parents. Generer manuellement est une source d'erreurs.

---

## 6. Premier CRUD avec NestJS

### 6.1 Generer la resource

```bash
nest g resource books --no-spec
# Choisis REST API et oui pour le CRUD
```

### 6.2 Definir l'entite

```typescript
// src/books/entities/book.entity.ts
export class Book {
  id: string;
  title: string;
  author: string;
  year: number;
  isbn?: string;
  createdAt: Date;
}
```

### 6.3 Definir les DTOs

```typescript
// src/books/dto/create-book.dto.ts
export class CreateBookDto {
  title: string;
  author: string;
  year: number;
  isbn?: string;
}
```

```typescript
// src/books/dto/update-book.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateBookDto } from './create-book.dto';

// PartialType rend tous les champs optionnels (comme .partial() de Zod)
export class UpdateBookDto extends PartialType(CreateBookDto) {}
```

### 6.4 Implementer le service

```typescript
// src/books/books.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { Book } from './entities/book.entity';
import { randomUUID } from 'crypto';

@Injectable()
export class BooksService {
  // Base de donnees en memoire
  private books: Book[] = [
    {
      id: '1',
      title: 'Clean Code',
      author: 'Robert C. Martin',
      year: 2008,
      isbn: '978-0132350884',
      createdAt: new Date(),
    },
  ];

  findAll(): Book[] {
    return this.books;
  }

  findOne(id: string): Book {
    const book = this.books.find(b => b.id === id);
    if (!book) {
      throw new NotFoundException(`Livre avec l'ID "${id}" introuvable`);
    }
    return book;
  }

  create(createBookDto: CreateBookDto): Book {
    const book: Book = {
      id: randomUUID(),
      ...createBookDto,
      createdAt: new Date(),
    };
    this.books.push(book);
    return book;
  }

  update(id: string, updateBookDto: UpdateBookDto): Book {
    const book = this.findOne(id); // Lance NotFoundException si introuvable
    Object.assign(book, updateBookDto);
    return book;
  }

  remove(id: string): void {
    const index = this.books.findIndex(b => b.id === id);
    if (index === -1) {
      throw new NotFoundException(`Livre avec l'ID "${id}" introuvable`);
    }
    this.books.splice(index, 1);
  }
}
```

### 6.5 Implementer le controller

```typescript
// src/books/books.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';

@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Get()
  findAll() {
    return this.booksService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.booksService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED) // 201
  create(@Body() createBookDto: CreateBookDto) {
    return this.booksService.create(createBookDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBookDto: UpdateBookDto) {
    return this.booksService.update(id, updateBookDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT) // 204
  remove(@Param('id') id: string) {
    this.booksService.remove(id);
  }
}
```

### 6.6 Le module

```typescript
// src/books/books.module.ts
import { Module } from '@nestjs/common';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';

@Module({
  controllers: [BooksController],
  providers: [BooksService],
})
export class BooksModule {}
```

---

## 7. Express vs NestJS — Comparaison cote a cote

### 7.1 Routing

```typescript
// === Express ===
const router = express.Router();

router.get('/', (req, res) => {
  res.json(booksService.findAll());
});

router.get('/:id', (req, res) => {
  const book = booksService.findOne(req.params.id);
  if (!book) return res.status(404).json({ error: 'Not found' });
  res.json(book);
});

router.post('/', (req, res) => {
  const book = booksService.create(req.body);
  res.status(201).json(book);
});

app.use('/api/books', router);
```

```typescript
// === NestJS ===
@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Get()
  findAll() {
    return this.booksService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.booksService.findOne(id);
  }

  @Post()
  @HttpCode(201)
  create(@Body() createBookDto: CreateBookDto) {
    return this.booksService.create(createBookDto);
  }
}
```

### 7.2 Comparaison structurelle

| Aspect | Express | NestJS |
|---|---|---|
| **Organisation** | Libre (routes/, controllers/, services/) | Imposee par modules (books/, users/) |
| **DI** | Manuelle (require/import) | Automatique (constructeur) |
| **Validation** | Middleware Zod maison | Pipes + class-validator integre |
| **Erreurs** | Error middleware maison | Exception filters integre |
| **Auth** | Middleware maison | Guards integre |
| **Logging** | morgan | Interceptors + Logger integre |
| **TypeScript** | Optionnel, configuration manuelle | Natif, pre-configure |
| **Tests** | Jest a configurer | Jest pre-configure avec DI mocking |
| **Documentation** | Swagger a configurer | @nestjs/swagger integre |

---

## 8. Lancer et debugger

### 8.1 Les scripts npm

```json
{
  "scripts": {
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "build": "nest build",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\""
  }
}
```

### 8.2 Debugger avec VS Code

Cree un fichier `.vscode/launch.json` :

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug NestJS",
      "type": "node",
      "request": "launch",
      "runtimeArgs": ["--nolazy", "-r", "ts-node/register"],
      "args": ["${workspaceFolder}/src/main.ts"],
      "sourceMaps": true,
      "envFile": "${workspaceFolder}/.env"
    }
  ]
}
```

### 8.3 Exceptions integrees de NestJS

NestJS fournit des exceptions HTTP pretes a l'emploi :

```typescript
import {
  NotFoundException,      // 404
  BadRequestException,    // 400
  UnauthorizedException,  // 401
  ForbiddenException,     // 403
  ConflictException,      // 409
  InternalServerErrorException, // 500
  HttpException,          // Custom
} from '@nestjs/common';

// Utilisation dans un service
throw new NotFoundException('Livre introuvable');
// Reponse automatique :
// { "statusCode": 404, "message": "Livre introuvable", "error": "Not Found" }

throw new BadRequestException('Le titre est requis');
// { "statusCode": 400, "message": "Le titre est requis", "error": "Bad Request" }

// Exception personnalisee
throw new HttpException('Erreur metier specifique', 422);
```

> **Bonne pratique** : NestJS gere automatiquement les exceptions — pas besoin de try/catch dans les controllers ni de error handler middleware. Lance simplement une exception et NestJS la transforme en reponse HTTP appropriee. C'est un enorme gain par rapport a Express.

---

## 9. Exercices pratiques

### Exercice 1 — Projet NestJS de zero

Cree un nouveau projet NestJS et genere une resource `tasks` (gestion de taches) avec :
- Les operations CRUD
- Les DTOs pour creation et mise a jour
- La gestion des erreurs avec `NotFoundException`

### Exercice 2 — Migration Express vers NestJS

Reprends l'API de livres Express du module 05 et migre-la vers NestJS. Compare la structure et le nombre de lignes.

### Exercice 3 — Multiple resources

Cree un projet NestJS avec trois resources liees :
- `authors` (auteurs)
- `books` (livres d'un auteur)
- `reviews` (critiques d'un livre)

Chaque resource dans son propre module avec son service et son controller.

---

## 10. Resume — Les concepts cles

| Concept | Definition |
|---|---|
| **NestJS** | Framework Node.js structure, inspire d'Angular |
| **@Module** | Decorateur qui declare un module (imports, controllers, providers) |
| **@Controller** | Decorateur qui marque une classe comme controller HTTP |
| **@Injectable** | Decorateur qui marque une classe comme injectable (service) |
| **DI** | Injection de dependances — les services sont injectes automatiquement |
| **DTO** | Data Transfer Object — classe decrivant la forme des donnees |
| **CLI** | `nest g resource` genere module + controller + service + DTOs |
| **Exceptions** | `NotFoundException`, `BadRequestException`, etc. |
| **main.ts** | Point d'entree qui bootstrap l'application |

> **A retenir** : NestJS apporte a Node.js ce qu'Angular apporte au frontend : une architecture claire, une injection de dependances puissante, et des conventions qui rendent le code previsible et maintenable. La CLI genere le boilerplate pour toi — tu te concentres sur la logique metier. Les modules suivants approfondiront les controllers, les providers et l'architecture modulaire.

---

## Navigation

| | Lien |
|---|---|
| Module precedent | [Module 08 — Express — Authentification & Securite](./08-express-auth-securite.md) |
| Module suivant | [Module 10 — NestJS — Controllers & Routing](./10-nestjs-controllers.md) |
| Quiz | [Quiz Module 09](../quizzes/09-nestjs-introduction.quiz.md) |
| Lab | [Lab 09 — Premier projet NestJS](../labs/09-nestjs-introduction.lab.md) |

---

> **A retenir** : NestJS n'est pas "mieux" qu'Express — c'est Express + structure + TypeScript + DI. Il resout les problemes d'organisation que tu rencontres des que ton API Express depasse quelques fichiers. Le trio Module → Controller → Service est le pattern fondamental que tu retrouveras dans chaque module de cette section du cours.
