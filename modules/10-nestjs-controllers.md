# Module 10 — NestJS — Controllers & Routing

> **Objectif** : Maîtriser les controllers NestJS en profondeur — decorateurs HTTP, decorateurs de paramètres, DTOs, versioning d'API, sous-routes, et bonnes pratiques pour des controllers propres et maintenables.
>
> **Difficulte** : ⭐⭐ (intermédiaire)

---

## 1. Le role du Controller

### 1.1 Definition

Un **controller** dans NestJS est une classe decoree avec `@Controller()` qui recoit les requêtes HTTP entrantes et renvoie les réponses au client. Son role est d'**orchestrer** — pas de contenir la logique metier.

> **Analogie** : Le controller est un aiguilleur du ciel. Il recoit les avions (requêtes), vérifié leur identite et destination, et les dirige vers la bonne piste (service). Il ne fait pas atterrir l'avion lui-même — il coordonne.

```
  Requete HTTP
       │
       ▼
  ┌──────────────────┐
  │   Controller      │  ← Recoit la requete, extrait les donnees
  │  (orchestration)  │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │    Service        │  ← Logique metier, acces aux donnees
  │  (logique)        │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │  Reponse HTTP     │  ← Le controller renvoie le resultat
  └──────────────────┘
```

### 1.2 Ce que le controller fait et ne fait PAS

| Le controller fait | Le controller ne fait PAS |
|---|---|
| Recevoir les requêtes HTTP | Logique metier complexe |
| Extraire les paramètres (body, params, query) | Acces direct à la base de donnees |
| Appeler le(s) service(s) | Calculs, transformations de donnees |
| Renvoyer la réponse HTTP | Validation complexe (délégué aux Pipes) |
| Définir le status code | Gestion d'erreurs globale (délégué aux Filters) |

> **Bonne pratique** : Un controller devrait etre "maigre" (thin controller). Si ton controller contient plus de 5-10 lignes par méthode, tu as probablement de la logique metier qui devrait etre dans un service.

---

## 2. Le decorateur @Controller

### 2.1 Route de base

```typescript
import { Controller, Get } from '@nestjs/common';

// Route de base : /cats
@Controller('cats')
export class CatsController {
  @Get() // GET /cats
  findAll(): string {
    return 'Liste des chats';
  }
}

// Plusieurs segments
@Controller('api/v1/cats') // /api/v1/cats
export class CatsV1Controller { }

// Pas de prefixe
@Controller() // /
export class RootController { }
```

### 2.2 Combiner avec setGlobalPrefix

```typescript
// main.ts
app.setGlobalPrefix('api');

// controller
@Controller('users') // Route effective : /api/users
```

---

## 3. Decorateurs de méthodes HTTP

### 3.1 Les méthodes standard

```typescript
import {
  Controller,
  Get, Post, Put, Patch, Delete,
  Head, Options, All,
} from '@nestjs/common';

@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Get()          // GET /books
  findAll() {
    return this.booksService.findAll();
  }

  @Get(':id')     // GET /books/:id
  findOne(@Param('id') id: string) {
    return this.booksService.findOne(id);
  }

  @Post()         // POST /books
  create(@Body() dto: CreateBookDto) {
    return this.booksService.create(dto);
  }

  @Put(':id')     // PUT /books/:id (remplacement total)
  replace(@Param('id') id: string, @Body() dto: CreateBookDto) {
    return this.booksService.replace(id, dto);
  }

  @Patch(':id')   // PATCH /books/:id (modification partielle)
  update(@Param('id') id: string, @Body() dto: UpdateBookDto) {
    return this.booksService.update(id, dto);
  }

  @Delete(':id')  // DELETE /books/:id
  remove(@Param('id') id: string) {
    return this.booksService.remove(id);
  }

  @Head(':id')    // HEAD /books/:id (comme GET mais sans body)
  checkExists(@Param('id') id: string) {
    this.booksService.findOne(id); // Lance NotFoundException si absent
  }

  @All('health')  // Toutes les methodes sur /books/health
  health() {
    return { status: 'OK' };
  }
}
```

### 3.2 Routes multiples sur une méthode

```typescript
// Une methode peut repondre a plusieurs routes
@Get(['', 'list', 'all'])  // GET /books, GET /books/list, GET /books/all
findAll() {
  return this.booksService.findAll();
}
```

---

## 4. Decorateurs de paramètres

### 4.1 Liste complete

```typescript
import {
  Param, Body, Query, Headers, Ip, Req, Res,
  Session, HostParam,
} from '@nestjs/common';

@Controller('users')
export class UsersController {

  // @Param — Parametres de route
  @Get(':id')
  findOne(@Param('id') id: string) {
    // GET /users/42 → id = '42'
    return this.usersService.findOne(id);
  }

  // @Param sans argument — tous les params
  @Get(':userId/posts/:postId')
  findPost(@Param() params: { userId: string; postId: string }) {
    return { userId: params.userId, postId: params.postId };
  }

  // @Body — Corps de la requete
  @Post()
  create(@Body() body: CreateUserDto) {
    return this.usersService.create(body);
  }

  // @Body avec un champ specifique
  @Post()
  createSimple(@Body('email') email: string) {
    // Extrait uniquement le champ 'email' du body
    return { email };
  }

  // @Query — Parametres de requete
  @Get()
  findAll(
    @Query('page') page: string,     // ?page=2
    @Query('limit') limit: string,   // ?limit=10
    @Query('search') search: string, // ?search=alice
  ) {
    return this.usersService.findAll({ page, limit, search });
  }

  // @Query sans argument — tous les query params
  @Get()
  findAllAlt(@Query() query: { page: string; limit: string }) {
    return query;
  }

  // @Headers — En-tetes de la requete
  @Get('me')
  getProfile(@Headers('authorization') auth: string) {
    return { token: auth };
  }

  // @Headers sans argument — tous les headers
  @Get('debug/headers')
  debugHeaders(@Headers() headers: Record<string, string>) {
    return headers;
  }

  // @Ip — Adresse IP du client
  @Get('whoami')
  whoami(@Ip() ip: string) {
    return { ip };
  }

  // @Req — L'objet Request Express complet (echappatoire)
  @Get('raw')
  raw(@Req() req: Request) {
    return { method: req.method, url: req.url };
  }
}
```

> **Piege classique** : Les valeurs de `@Param()` et `@Query()` sont TOUJOURS des **strings**. Si tu attends un nombre, utilise un Pipe pour transformer : `@Param('id', ParseIntPipe) id: number`. NestJS fournit des pipes de transformation integres (voir section 4.3).

### 4.2 Pipes de transformation integres

```typescript
import {
  ParseIntPipe,
  ParseUUIDPipe,
  ParseBoolPipe,
  ParseFloatPipe,
  ParseEnumPipe,
  DefaultValuePipe,
  ParseArrayPipe,
} from '@nestjs/common';

@Controller('users')
export class UsersController {

  // ParseIntPipe — Convertit la string en number
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    // id est maintenant un number, pas une string
    // Si 'abc' est envoye → 400 Bad Request automatique
    return this.usersService.findOne(id);
  }

  // ParseUUIDPipe — Valide que c'est un UUID
  @Get(':uuid')
  findByUuid(@Param('uuid', ParseUUIDPipe) uuid: string) {
    // Si le format n'est pas un UUID valide → 400 Bad Request
    return this.usersService.findByUuid(uuid);
  }

  // ParseBoolPipe — Convertit 'true'/'false' en boolean
  @Get()
  findAll(@Query('active', new DefaultValuePipe(true), ParseBoolPipe) active: boolean) {
    return this.usersService.findAll({ active });
  }

  // DefaultValuePipe — Valeur par defaut si absent
  @Get()
  list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.usersService.list(page, limit);
  }

  // ParseEnumPipe — Valide que la valeur est dans un enum
  @Get()
  findByRole(
    @Query('role', new ParseEnumPipe(UserRole)) role: UserRole,
  ) {
    return this.usersService.findByRole(role);
  }
}

enum UserRole {
  Admin = 'admin',
  User = 'user',
  Moderator = 'moderator',
}
```

---

## 5. Les DTOs (Data Transfer Objects)

### 5.1 Qu'est-ce qu'un DTO

Un **DTO** est une classe qui définit la forme des donnees envoyees ou recues. C'est l'équivalent des schemas Zod du module 07, mais sous forme de classe TypeScript.

```typescript
// dto/create-user.dto.ts
export class CreateUserDto {
  email: string;
  password: string;
  nom: string;
  age?: number;
  role?: string;
}

// dto/update-user.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

// Tous les champs deviennent optionnels
export class UpdateUserDto extends PartialType(CreateUserDto) {}
```

> **Analogie** : Un DTO c'est comme un formulaire papier. Il définit quels champs existent, lesquels sont obligatoires, et quel type de donnees est attendu. Le formulaire n'est pas la donnee elle-même — c'est un contrat qui dit "voila ce que j'attends de toi".

### 5.2 Helpers de @nestjs/mapped-types

```bash
npm install @nestjs/mapped-types
```

```typescript
import { PartialType, PickType, OmitType, IntersectionType } from '@nestjs/mapped-types';

// PartialType — Tous les champs deviennent optionnels
class UpdateDto extends PartialType(CreateDto) {}

// PickType — Seulement certains champs
class LoginDto extends PickType(CreateUserDto, ['email', 'password'] as const) {}

// OmitType — Tous les champs sauf certains
class PublicUserDto extends OmitType(UserDto, ['password', 'role'] as const) {}

// IntersectionType — Combiner deux DTOs
class ExtendedDto extends IntersectionType(CreateDto, TimestampDto) {}
```

### 5.3 Validation avec class-validator (apercu)

```bash
npm install class-validator class-transformer
```

```typescript
// dto/create-user.dto.ts
import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsInt, Min, Max } from 'class-validator';

export class CreateUserDto {
  @IsEmail({}, { message: 'Email invalide' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caracteres' })
  @MaxLength(72)
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  nom: string;

  @IsOptional()
  @IsInt()
  @Min(13)
  @Max(150)
  age?: number;
}
```

```typescript
// main.ts — Activer la validation globale
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,       // Supprime les champs non declares dans le DTO
    forbidNonWhitelisted: true, // Rejette si champs non declares
    transform: true,       // Transforme les types automatiquement
  }));
  await app.listen(3000);
}
```

> **Bonne pratique** : Active TOUJOURS le `ValidationPipe` global avec `whitelist: true`. Cela empeche un client d'envoyer des champs supplementaires (comme `role: 'admin'`) qui pourraient corrompre tes donnees.

---

## 6. Decorateurs de réponse

### 6.1 @HttpCode — Status code personnalise

```typescript
import { HttpCode, HttpStatus } from '@nestjs/common';

@Controller('books')
export class BooksController {

  @Post()
  @HttpCode(HttpStatus.CREATED)  // 201 (POST retourne 201 par defaut)
  create(@Body() dto: CreateBookDto) {
    return this.booksService.create(dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT) // 204
  remove(@Param('id') id: string) {
    this.booksService.remove(id);
    // Pas de return — 204 = pas de body
  }

  @Post('import')
  @HttpCode(HttpStatus.ACCEPTED) // 202 — Traitement async
  import(@Body() dto: ImportDto) {
    this.booksService.queueImport(dto);
    return { message: 'Import en cours de traitement' };
  }
}
```

### 6.2 @Header — Ajouter des headers de réponse

```typescript
import { Header } from '@nestjs/common';

@Get('export')
@Header('Content-Type', 'text/csv')
@Header('Content-Disposition', 'attachment; filename="books.csv"')
export() {
  return this.booksService.exportCsv();
}
```

### 6.3 @Redirect — Redirection

```typescript
import { Redirect } from '@nestjs/common';

@Get('old-endpoint')
@Redirect('/api/books', 301) // 301 Moved Permanently
oldEndpoint() {
  // Pas besoin de body
}

// Redirection dynamique (retourne un objet)
@Get('docs')
@Redirect('https://docs.example.com', 302)
getDocs(@Query('version') version: string) {
  if (version === 'v2') {
    return { url: 'https://docs-v2.example.com', statusCode: 302 };
  }
  // Si pas de return, utilise la valeur par defaut du decorateur
}
```

---

## 7. Routes avancees

### 7.1 Routes imbriquees (nested routes)

```typescript
// /api/authors/:authorId/books
@Controller('authors/:authorId/books')
export class AuthorBooksController {
  constructor(private readonly booksService: BooksService) {}

  @Get()
  findAll(@Param('authorId') authorId: string) {
    return this.booksService.findByAuthor(authorId);
  }

  @Post()
  create(
    @Param('authorId') authorId: string,
    @Body() dto: CreateBookDto,
  ) {
    return this.booksService.createForAuthor(authorId, dto);
  }
}
```

### 7.2 Wildcards de route

```typescript
@Get('ab*cd')  // Correspond a : abcd, abXcd, abXYZcd, etc.
findWildcard() {
  return 'Route wildcard';
}
```

### 7.3 Versioning d'API

```typescript
// main.ts — Activer le versioning
import { VersioningType } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableVersioning({
    type: VersioningType.URI, // /v1/books, /v2/books
    // Autres options : VersioningType.HEADER, VersioningType.MEDIA_TYPE
  });
  await app.listen(3000);
}
```

```typescript
import { Controller, Get, Version } from '@nestjs/common';

// Version sur le controller entier
@Controller({ path: 'books', version: '1' })
export class BooksV1Controller {
  @Get() // GET /v1/books
  findAll() {
    return { version: 1, books: [] };
  }
}

@Controller({ path: 'books', version: '2' })
export class BooksV2Controller {
  @Get() // GET /v2/books
  findAll() {
    return { version: 2, books: [], pagination: {} };
  }
}

// Version sur une methode specifique
@Controller('books')
export class BooksController {
  @Version('1')
  @Get()
  findAllV1() {
    return { version: 1 };
  }

  @Version('2')
  @Get()
  findAllV2() {
    return { version: 2 };
  }
}
```

### 7.4 Sous-domaine routing

```typescript
// Routing base sur le sous-domaine
@Controller({ host: 'admin.example.com' })
export class AdminController {
  @Get()
  dashboard() {
    return { panel: 'admin' };
  }
}

@Controller({ host: ':tenant.example.com' })
export class TenantController {
  @Get()
  index(@HostParam('tenant') tenant: string) {
    return { tenant };
  }
}
```

---

## 8. Le cycle de vie d'une requête dans NestJS

```
  Requete HTTP entrante
       │
       ▼
  ┌──────────────────┐
  │  Middleware        │  (express middleware, cors, helmet)
  └────────┬─────────┘
           │
  ┌────────▼─────────┐
  │  Guards            │  (authentification, autorisation)
  └────────┬─────────┘
           │
  ┌────────▼─────────┐
  │  Interceptors     │  (avant le handler — logging, cache)
  │  (pre-handler)    │
  └────────┬─────────┘
           │
  ┌────────▼─────────┐
  │  Pipes             │  (validation, transformation)
  └────────┬─────────┘
           │
  ┌────────▼─────────┐
  │  Controller        │  (route handler)
  │  Handler           │
  └────────┬─────────┘
           │
  ┌────────▼─────────┐
  │  Interceptors     │  (apres le handler — transform response)
  │  (post-handler)   │
  └────────┬─────────┘
           │
  ┌────────▼─────────┐
  │  Exception        │  (si erreur — formatte la reponse)
  │  Filters          │
  └────────┬─────────┘
           │
       Reponse HTTP
```

> **A retenir** : Ce pipeline est le coeur de NestJS. Chaque couche à un role précis : les Guards decidident si la requête a le droit de passer, les Pipes valident et transforment les donnees, les Interceptors peuvent modifier la requête et la réponse, et les Exception Filters gerent les erreurs. Les controllers ne sont qu'un maillon de cette chaine.

---

## 9. Bonnes pratiques pour les controllers

| Pratique | Explication |
|---|---|
| **Controllers maigres** | Maximum 5-10 lignes par méthode, déléguer au service |
| **Un controller par ressource** | `BooksController`, `UsersController` — pas de mega-controller |
| **DTOs pour les entrees** | Toujours typer les `@Body()` avec un DTO |
| **Pipes pour la validation** | Utiliser le `ValidationPipe` global |
| **Pas de logique metier** | Le controller orchestre, le service travaille |
| **Nommage conventionnel** | `findAll`, `findOne`, `create`, `update`, `remove` |
| **Status codes explicites** | Utiliser `@HttpCode` quand le defaut n'est pas adapte |
| **Documentation** | Ajouter `@ApiTags`, `@ApiOperation` avec Swagger |

---

## 10. Exercices pratiques

### Exercice 1 — Controller avec query params avances

Cree un controller `ProductsController` avec :
- `GET /products` avec filtres : `?category=electronics&minPrice=10&maxPrice=100&inStock=true&sort=price&order=asc`
- Utilise `DefaultValuePipe`, `ParseIntPipe`, `ParseBoolPipe`
- Pagination avec `page` et `limit`

### Exercice 2 — Routes imbriquees

Cree une API avec les routes suivantes :
- `GET /api/shops/:shopId/products`
- `POST /api/shops/:shopId/products`
- `GET /api/shops/:shopId/products/:productId`

### Exercice 3 — API versionnee

Implemente deux versions d'un endpoint `/books` :
- V1 retourne un tableau simple
- V2 retourne un objet avec pagination et metadata

---

## Navigation

| | Lien |
|---|---|
| Module précédent | [Module 09 — NestJS — Introduction & Premiers pas](./09-nestjs-introduction.md) |
| Module suivant | [Module 11 — NestJS — Providers & Injection de Dependances](./11-nestjs-providers-di.md) |
| Quiz | [Quiz Module 10](../quizzes/10-nestjs-controllers.quiz.md) |
| Lab | [Lab 10 — Controllers NestJS](../labs/10-nestjs-controllers.lab.md) |

---

> **A retenir** : Les controllers NestJS sont la porte d'entree de ton API. Avec les decorateurs de méthodes HTTP, les decorateurs de paramètres et les pipes de transformation, tu as un controle total sur le routing et l'extraction des donnees. Mais rappelle-toi : le controller orchestre, le service travaille. Garde tes controllers maigres et tes services riches en logique metier.

---

<!-- parcours-recommande -->

::: tip Parcours recommandé
1. **Screencast** : [screencast 10 controllers](../screencasts/screencast-10-controllers.md)
2. **Lab** : [lab-10-controllers-dto](../labs/lab-10-controllers-dto/README)
3. **Quiz** : [quiz 10 controllers](../quizzes/quiz-10-controllers.html)
:::
