---
titre: NestJS controllers
cours: 09-nestjs
notions: [décorateur Controller, décorateurs de route Get Post Put Delete Patch, paramètres Param Query Body Headers, DTOs et class-validator, ValidationPipe, codes de statut HttpCode, gestion de la réponse, préfixe de route]
outcomes: [créer un controller avec des routes REST, extraire params/query/body, valider un DTO avec class-validator et ValidationPipe, retourner le bon code de statut]
prerequis: [09-nestjs-introduction]
next: 11-nestjs-providers-di
libs: [{ name: "@nestjs/common", version: "^11" }, { name: class-validator, version: "^0.14" }]
tribuzen: FamilyController et PostController de l'API TribuZen (routes REST + DTOs validés)
last-reviewed: 2026-07
---

# NestJS controllers

> **Outcomes — tu sauras FAIRE :** créer un controller NestJS avec des routes REST complètes, extraire params/query/body avec les bons décorateurs, valider un DTO avec class-validator et ValidationPipe, retourner le bon code de statut HTTP.
> **Difficulté :** :star::star::star:

## 1. Cas concret d'abord

L'API TribuZen doit exposer les familles. Tu viens d'écrire le module Express (module 05) — maintenant la même API passe sous NestJS. Voici ce que tu dois produire :

```
POST   /families          → créer une famille (201, body validé)
GET    /families          → lister (?page=1&limit=10)
GET    /families/:id      → une famille (UUID obligatoire)
PATCH  /families/:id      → modifier partiellement
DELETE /families/:id      → supprimer (204, pas de body)
```

Tu essaies d'écrire le controller et tu bloques sur plusieurs points : comment déclarer le préfixe de route ? comment extraire l'`:id` de l'URL ? comment valider que `name` dans le body n'est pas vide ? comment renvoyer 201 au lieu du 200 par défaut ?

Ce module répond exactement à ça.

## 2. Théorie complète, concise

### 2.1 Décorateur `@Controller` — préfixe de route

`@Controller('prefix')` déclare la classe comme point d'entrée pour les requêtes HTTP arrivant sous ce préfixe. Tous les décorateurs de route à l'intérieur sont relatifs à ce préfixe.

```ts
import { Controller, Get } from '@nestjs/common'

// Toutes les routes de cette classe commencent par /families
@Controller('families')
export class FamilyController {
  @Get()       // répond à GET /families
  findAll() {
    return []
  }

  @Get(':id')  // répond à GET /families/:id
  findOne() {
    return {}
  }
}
```

Sans argument (`@Controller()`), le controller répond à la racine `/`. Avec `setGlobalPrefix('api')` dans `main.ts`, toutes les routes deviennent `/api/families`.

```ts
// main.ts
app.setGlobalPrefix('api')
// @Controller('families') → répond à /api/families/*
```

### 2.2 Décorateurs de route — `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete`

Chaque méthode HTTP a son décorateur. L'argument optionnel est le sous-chemin relatif au préfixe du controller.

```ts
import { Controller, Get, Post, Put, Patch, Delete } from '@nestjs/common'

@Controller('families')
export class FamilyController {
  @Get()               // GET /families
  findAll() { return [] }

  @Get(':id')          // GET /families/:id
  findOne() { return {} }

  @Post()              // POST /families
  create() { return {} }

  @Put(':id')          // PUT /families/:id — remplacement complet
  replace() { return {} }

  @Patch(':id')        // PATCH /families/:id — modification partielle
  update() { return {} }

  @Delete(':id')       // DELETE /families/:id
  remove() { return }
}
```

`PUT` remplace la ressource entière (tous les champs requis). `PATCH` ne modifie que les champs présents dans le body. En pratique sur une API NestJS moderne, on préfère `PATCH` pour les mises à jour partielles.

### 2.3 Décorateurs de paramètres — `@Param`, `@Query`, `@Body`, `@Headers`

Ces décorateurs injectent des fragments de la requête HTTP dans les arguments de la méthode.

```ts
import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, Headers,
} from '@nestjs/common'

@Controller('families')
export class FamilyController {

  // @Param('id') — paramètre de route : toujours une string
  @Get(':id')
  findOne(@Param('id') id: string) {
    // GET /families/abc-123 → id = 'abc-123'
    return { id }
  }

  // @Param() sans argument — tous les params dans un objet
  @Get(':familyId/posts/:postId')
  findPost(@Param() params: { familyId: string; postId: string }) {
    return params  // { familyId: '...', postId: '...' }
  }

  // @Query — paramètres de l'URL (?page=2&limit=10) : toujours des strings
  @Get()
  findAll(
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    return { page, limit }
  }

  // @Body — corps JSON parsé
  @Post()
  create(@Body() body: CreateFamilyDto) {
    return body
  }

  // @Body('field') — extrait un seul champ
  @Post('quick')
  createQuick(@Body('name') name: string) {
    return { name }
  }

  // @Headers — headers de la requête
  @Get('me')
  getProfile(@Headers('authorization') auth: string) {
    return { auth }
  }

  // @Headers() sans argument — tous les headers
  @Get('debug')
  debug(@Headers() headers: Record<string, string>) {
    return headers
  }
}
```

**Important :** `@Param()` et `@Query()` retournent toujours des **strings**, même si la valeur ressemble à un nombre. Pour convertir, utilise les pipes intégrés (`ParseIntPipe`, `ParseUUIDPipe`) ou active `transform: true` dans `ValidationPipe`.

```ts
import { ParseUUIDPipe, ParseIntPipe, DefaultValuePipe } from '@nestjs/common'

@Get(':id')
findOne(@Param('id', ParseUUIDPipe) id: string) {
  // Valide que id est un UUID v4 — sinon 400 automatique
  return { id }
}

@Get()
list(
  @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
) {
  return { page, limit }
}
```

### 2.4 DTOs et class-validator

Un **DTO** (Data Transfer Object) est une classe TypeScript qui décrit la forme du body attendu. On y attache des décorateurs `class-validator` pour exprimer les contraintes de validation.

Installation :

```bash
pnpm add class-validator class-transformer
```

```ts
// src/families/dto/create-family.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MinLength,
  MaxLength,
  IsArray,
  IsEnum,
} from 'class-validator'

export enum FamilyVisibility {
  Private = 'private',
  Public = 'public',
}

export class CreateFamilyDto {
  // IsNotEmpty rejette les chaînes vides — IsString assure le type
  @IsString()
  @IsNotEmpty({ message: 'Le nom est obligatoire' })
  @MinLength(2, { message: 'Le nom doit contenir au moins 2 caractères' })
  @MaxLength(80, { message: 'Le nom ne peut pas dépasser 80 caractères' })
  name: string

  @IsOptional()   // Champ absent OU présent sont valides
  @IsString()
  @MaxLength(300)
  description?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })  // Valide chaque élément du tableau
  tags?: string[]

  @IsOptional()
  @IsEnum(FamilyVisibility, { message: 'visibility doit être "private" ou "public"' })
  visibility?: FamilyVisibility
}
```

```ts
// src/families/dto/update-family.dto.ts
import { PartialType } from '@nestjs/mapped-types'
import { CreateFamilyDto } from './create-family.dto'

// Tous les champs deviennent optionnels — les décorateurs class-validator sont préservés
export class UpdateFamilyDto extends PartialType(CreateFamilyDto) {}
```

Décorateurs `class-validator` courants :

| Décorateur | Ce qu'il valide |
|---|---|
| `@IsString()` | Valeur est une string |
| `@IsNotEmpty()` | String non vide (pas `''`) |
| `@MinLength(n)` / `@MaxLength(n)` | Longueur de chaîne |
| `@IsEmail()` | Format email valide |
| `@IsUUID('4')` | UUID version 4 |
| `@IsInt()` | Entier |
| `@Min(n)` / `@Max(n)` | Plage numérique |
| `@IsOptional()` | Champ absent accepté — court-circuite les autres décorateurs si absent |
| `@IsEnum(E)` | Valeur appartient à l'enum E |
| `@IsArray()` | Valeur est un tableau |
| `@IsString({ each: true })` | Chaque élément du tableau est une string |

### 2.5 ValidationPipe — activer la validation globale

`class-validator` seul ne fait rien. Il faut câbler un `ValidationPipe` qui appelle `validate()` sur chaque DTO entrant.

```ts
// main.ts
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.useGlobalPipes(new ValidationPipe({
    // Supprime automatiquement les champs non déclarés dans le DTO
    whitelist: true,

    // Retourne une erreur 400 si des champs non déclarés sont présents
    forbidNonWhitelisted: true,

    // Convertit les types : string → number pour les @Query parsés
    transform: true,
  }))

  await app.listen(3000)
}
bootstrap()
```

Quand un body ne satisfait pas un DTO, NestJS retourne automatiquement une réponse 400 :

```json
{
  "statusCode": 400,
  "message": [
    "Le nom est obligatoire",
    "Le nom doit contenir au moins 2 caractères"
  ],
  "error": "Bad Request"
}
```

### 2.6 Codes de statut — `@HttpCode` et `HttpStatus`

Par défaut, NestJS retourne 200 pour toutes les méthodes sauf `@Post()` qui retourne 201. Pour tout autre code, utilise `@HttpCode`.

```ts
import { HttpCode, HttpStatus } from '@nestjs/common'

@Controller('families')
export class FamilyController {

  @Post()
  @HttpCode(HttpStatus.CREATED)   // 201 — c'est le défaut de @Post, mais explicite = clair
  create(@Body() dto: CreateFamilyDto) {
    return dto
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)  // 204 — pas de body possible
  remove(@Param('id') id: string) {
    // Pas de return — 204 n'a pas de body
  }

  @Post('import')
  @HttpCode(HttpStatus.ACCEPTED)  // 202 — traitement asynchrone lancé
  import(@Body() dto: ImportDto) {
    return { jobId: 'queued' }
  }
}
```

`HttpStatus` est un enum qui évite les "magic numbers" : `HttpStatus.OK = 200`, `HttpStatus.CREATED = 201`, `HttpStatus.NO_CONTENT = 204`, `HttpStatus.BAD_REQUEST = 400`, `HttpStatus.NOT_FOUND = 404`.

### 2.7 Gestion de la réponse — retour implicite vs `@Res`

NestJS sérialise automatiquement ce que la méthode retourne :
- Un **objet ou tableau** → réponse JSON.
- Une **string** → réponse texte.
- `undefined` / `void` → body vide (utile avec 204).

```ts
@Get()
findAll(): FamilyDto[] {
  return []   // → JSON [] avec 200
}

@Delete(':id')
@HttpCode(HttpStatus.NO_CONTENT)
remove(): void {
  // → body vide avec 204
}
```

Évite `@Res()` (accès à l'objet réponse Express brut) sauf cas extrême — il court-circuite le cycle NestJS (interceptors, exception filters ne s'exécutent plus).

## 3. Worked examples

### Exemple A — FamilyController complet avec DTO validé

```ts
// src/families/dto/create-family.dto.ts
import { IsString, IsNotEmpty, IsOptional, MinLength, MaxLength } from 'class-validator'

export class CreateFamilyDto {
  @IsString()
  @IsNotEmpty({ message: 'name est obligatoire' })
  @MinLength(2)
  @MaxLength(80)
  name: string

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string
}
```

```ts
// src/families/families.controller.ts
import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body,
  HttpCode, HttpStatus,
  ParseUUIDPipe, DefaultValuePipe, ParseIntPipe,
} from '@nestjs/common'
import { CreateFamilyDto } from './dto/create-family.dto'
import { UpdateFamilyDto } from './dto/update-family.dto'
import { FamiliesService } from './families.service'

@Controller('families')
export class FamiliesController {
  // FamiliesService est injecté par NestJS (DI — module 11)
  constructor(private readonly familiesService: FamiliesService) {}

  // GET /families?page=1&limit=10
  @Get()
  findAll(
    // DefaultValuePipe donne la valeur par défaut si le param est absent
    // ParseIntPipe convertit la string en number — nécessaire car @Query retourne des strings
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.familiesService.findAll(page, limit)
  }

  // GET /families/:id
  @Get(':id')
  findOne(
    // ParseUUIDPipe valide le format UUID — retourne 400 si invalide
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.familiesService.findOne(id)
  }

  // POST /families → 201 Created
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateFamilyDto) {
    // Le ValidationPipe intercepte le body AVANT d'arriver ici
    // Si name est vide, NestJS retourne 400 automatiquement
    return this.familiesService.create(dto)
  }

  // PATCH /families/:id
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFamilyDto,   // Tous les champs optionnels grâce à PartialType
  ) {
    return this.familiesService.update(id, dto)
  }

  // DELETE /families/:id → 204 No Content
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    this.familiesService.remove(id)
    // Pas de return — NestJS envoie 204 sans body
  }
}
```

**Pas-à-pas :**
1. `@Controller('families')` — tout le controller répond sous `/families/*`.
2. `ParseUUIDPipe` sur chaque `@Param('id')` — si un client envoie `/families/abc`, NestJS retourne 400 avant d'atteindre le handler.
3. `DefaultValuePipe(1), ParseIntPipe` sur `@Query` — enchaînement de pipes : le premier donne la valeur par défaut, le second convertit en `number`.
4. `@HttpCode(HttpStatus.NO_CONTENT)` sur `remove` — le `void` combiné à 204 garantit qu'aucun body n'est envoyé.
5. Le `ValidationPipe` global (dans `main.ts`) valide le DTO automatiquement — le handler n'est jamais appelé si la validation échoue.

### Exemple B — DTO avec enum et tableau de tags

```ts
// src/families/dto/create-family.dto.ts
import {
  IsString, IsNotEmpty, IsOptional,
  MinLength, MaxLength,
  IsArray, IsEnum,
} from 'class-validator'

export enum FamilyVisibility {
  Private = 'private',
  Public = 'public',
}

export class CreateFamilyDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(80)
  name: string

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })   // Valide chaque élément — { each: true } = mode tableau
  tags?: string[]

  @IsOptional()
  @IsEnum(FamilyVisibility, { message: 'visibility doit être "private" ou "public"' })
  visibility?: FamilyVisibility
}
```

Body valide :

```json
{
  "name": "Famille Martin",
  "description": "Tribu du Nord",
  "tags": ["bretagne", "musique"],
  "visibility": "private"
}
```

Body invalide → 400 :

```json
{
  "name": "",
  "visibility": "secret"
}
```

Réponse NestJS :

```json
{
  "statusCode": 400,
  "message": [
    "name should not be empty",
    "visibility doit être \"private\" ou \"public\""
  ],
  "error": "Bad Request"
}
```

**Pas-à-pas :**
1. `@IsEnum(FamilyVisibility)` — NestJS vérifie que la valeur appartient à l'union `'private' | 'public'` ; toute autre valeur lève une erreur lisible.
2. `@IsString({ each: true })` combiné à `@IsArray()` — chaque élément du tableau `tags` doit être une string ; un `[1, 2]` serait rejeté.
3. `@IsOptional()` court-circuite les décorateurs suivants si le champ est absent — description et tags peuvent être omis.
4. `whitelist: true` dans `ValidationPipe` supprime silencieusement tout champ non déclaré dans le DTO — un client ne peut pas injecter un champ `role: 'admin'` non attendu.

## 4. Pièges & misconceptions

- **`@Param()` retourne toujours une string.** `@Param('id') id: string` — même si la route est `:id` et que le client envoie `/families/42`, `id` vaut `'42'` (string). Si tu utilises des IDs numériques, ajoute `ParseIntPipe`. Pour les UUID, ajoute `ParseUUIDPipe` qui valide le format et retourne 400 si invalide — évite un aller en base inutile.

- **`ValidationPipe` désactivé silencieusement.** Si tu oublies `app.useGlobalPipes(new ValidationPipe())` dans `main.ts`, les décorateurs `class-validator` ne s'exécutent jamais — le body est accepté quel que soit son contenu. *Correction :* activer `ValidationPipe` global au démarrage, ou appliquer `@UsePipes(new ValidationPipe())` au niveau du controller ou de la méthode.

- **`whitelist: true` sans `forbidNonWhitelisted`.** `whitelist: true` seul supprime silencieusement les champs inconnus. Si tu veux que le client sache qu'il envoie des champs invalides (meilleure DX), ajouter `forbidNonWhitelisted: true` : NestJS retourne alors une erreur 400 explicite.

- **`@HttpCode` sur `@Post` manquant.** `@Post()` retourne 200 par défaut en NestJS 11 (le 201 était le comportement des versions antérieures — confirmation dans la doc officielle). *Toujours* décorer la méthode `create` avec `@HttpCode(HttpStatus.CREATED)` pour être explicite et indépendant des versions.

- **Double body avec `@Res()`.** Utiliser `@Res() res: Response` et appeler `res.json()` ET `return` dans la même méthode envoie deux réponses — Express lève `Cannot set headers after they are sent`. Si tu dois utiliser `@Res()`, ajoute `{ passthrough: true }` pour que NestJS gère quand même la sérialisation : `@Res({ passthrough: true }) res: Response`.

- **`PartialType` de la mauvaise source.** `PartialType` existe dans `@nestjs/mapped-types` ET dans `@nestjs/swagger`. Importer depuis `@nestjs/swagger` sans avoir Swagger installé fait planter le démarrage. *Correction :* utiliser `@nestjs/mapped-types` pour les projets sans Swagger.

## 5. Ancrage TribuZen

Couche fil-rouge : **FamilyController et PostController de l'API TribuZen (routes REST + DTOs validés)** (`smaurier/tribuzen`).

Structure cible dans `apps/api/src/` :

```
families/
  dto/
    create-family.dto.ts   ← CreateFamilyDto avec class-validator
    update-family.dto.ts   ← UpdateFamilyDto = PartialType(CreateFamilyDto)
  families.controller.ts   ← FamilyController (GET/POST/PATCH/DELETE)
  families.service.ts      ← FamiliesService (logique + accès DB)
  families.module.ts       ← FamiliesModule (assemblage)

posts/
  dto/
    create-post.dto.ts     ← titre, contenu, tags, statut (enum Draft|Published)
  posts.controller.ts      ← PostController
```

Dans TribuZen :
- `POST /families` avec `CreateFamilyDto` — un owner crée une famille. La validation empêche un `name` vide ou un `visibility` invalide d'atteindre la base.
- `GET /families?page=&limit=` — liste paginée des familles auxquelles l'utilisateur appartient (filtre Guard en module 12).
- `PATCH /families/:id` avec `UpdateFamilyDto` — modification partielle de la fiche famille ; `PartialType` garantit que les champs non envoyés ne sont pas écrasés.
- `DELETE /families/:id` → 204 — suppression physique (soft-delete avec `deletedAt` sera ajouté quand Prisma est câblé au module 13).

## 6. Points clés

1. `@Controller('prefix')` définit le préfixe de route pour toute la classe ; combiné à `setGlobalPrefix('api')` dans `main.ts`.
2. `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete` mappent les méthodes HTTP — l'argument est le sous-chemin relatif au préfixe.
3. `@Param('id')` = paramètre de route (`:id`) ; `@Query('page')` = query string (`?page=`) ; `@Body()` = body JSON parsé — tous retournent `string` sauf si un pipe convertit.
4. `ParseUUIDPipe` et `ParseIntPipe` sur `@Param`/`@Query` convertissent et valident — retournent 400 automatiquement si le format est invalide.
5. Un DTO = une classe TypeScript avec des décorateurs `class-validator` ; `@IsOptional()` court-circuite les autres décorateurs si le champ est absent.
6. `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` dans `main.ts` active la validation globale — sans lui, `class-validator` ne s'exécute pas.
7. `@HttpCode(HttpStatus.CREATED)` pour les POST créateurs, `@HttpCode(HttpStatus.NO_CONTENT)` pour les DELETE sans body — ne pas laisser les codes implicites.
8. Éviter `@Res()` sauf cas extrême — il court-circuite interceptors et exception filters.

## 7. Seeds Anki

```
Quelle est la différence entre @Param('id') et @Query('page') ?|@Param extrait un segment de chemin de route (:id dans l'URL) ; @Query extrait un paramètre de query string (?page= dans l'URL) — les deux retournent des strings
Pourquoi class-validator ne valide-t-il rien sans configuration supplémentaire ?|Les décorateurs class-validator ne s'exécutent que si un ValidationPipe est actif — il faut app.useGlobalPipes(new ValidationPipe()) dans main.ts ou @UsePipes au niveau de la méthode
À quoi sert whitelist: true dans ValidationPipe ?|Supprime silencieusement les champs du body non déclarés dans le DTO — empêche un client d'injecter des champs inattendus comme role ou isAdmin
Comment retourner 204 No Content sur un DELETE NestJS ?|Décorer la méthode avec @HttpCode(HttpStatus.NO_CONTENT) et ne rien retourner (void) — NestJS envoie un body vide avec le bon status
Quelle pipe valide qu'un paramètre de route est un UUID v4 valide ?|ParseUUIDPipe — s'utilise dans @Param('id', ParseUUIDPipe) id: string ; retourne automatiquement 400 si le format UUID n'est pas respecté
Comment rendre tous les champs d'un DTO optionnels pour un PATCH ?|Importer PartialType de @nestjs/mapped-types et créer class UpdateDto extends PartialType(CreateDto) {} — tous les décorateurs class-validator sont préservés mais les champs deviennent optionnels
Que se passe-t-il si on utilise @Res() dans une méthode NestJS controller ?|@Res() donne accès à l'objet Express brut et court-circuite le pipeline NestJS — interceptors et exception filters ne s'exécutent plus ; utiliser @Res({ passthrough: true }) si on veut les deux
Comment enchaîner plusieurs pipes sur un @Query pour pagination ?|@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number — DefaultValuePipe donne la valeur par défaut si le paramètre est absent, ParseIntPipe convertit ensuite en number
```

## Pont vers le lab

> Lab associé : `09-nestjs/labs/lab-10-controllers-dto/README.md`. Tu construis FamilyController et son DTO TribuZen avec class-validator et ValidationPipe — pas de gap-fill, code de A à Z, corrigé complet commenté inline.
