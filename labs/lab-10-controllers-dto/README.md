# Lab 10 — NestJS controllers et DTOs TribuZen

> **Outcome :** à la fin, tu sais créer un controller NestJS avec routes REST complètes, valider les bodies avec class-validator et ValidationPipe, et retourner les bons codes de statut.
> **Vrai outil :** NestJS 11 + class-validator 0.14 — pas de harnais simulé.
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

Tu construis `FamilyController` — la première brique de l'API TribuZen. Le controller gère les familles avec un DTO validé. Pas de base de données encore : un store en mémoire dans le service suffit.

Routes à implémenter :

| Méthode | Route | Status attendu | Notes |
|---------|-------|----------------|-------|
| `GET` | `/families` | 200 | Query params `?page=1&limit=10` |
| `GET` | `/families/:id` | 200 | UUID obligatoire — 400 si format invalide |
| `POST` | `/families` | 201 | Body validé par DTO |
| `PATCH` | `/families/:id` | 200 | Champs partiels — DTO optionnel |
| `DELETE` | `/families/:id` | 204 | Pas de body en réponse |

## Étapes (en friction)

1. **Installe les dépendances** dans le dossier `lab-10-controllers-dto/` :

   ```bash
   pnpm add class-validator class-transformer @nestjs/mapped-types
   ```

2. **Crée `CreateFamilyDto`** dans `src/families/dto/create-family.dto.ts` :
   - `name` : string, non vide, 2–80 caractères
   - `description` : string optionnelle, max 300 caractères
   - `tags` : tableau de strings optionnel
   - `visibility` : enum `'private' | 'public'`, optionnel

3. **Crée `UpdateFamilyDto`** dans `src/families/dto/update-family.dto.ts` avec `PartialType`.

4. **Active le `ValidationPipe` global** dans `src/main.ts` avec `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.

5. **Implémente `FamiliesService`** dans `src/families/families.service.ts` — store en mémoire (`Map<string, Family>`), méthodes `findAll`, `findOne`, `create`, `update`, `remove`. Utilise `crypto.randomUUID()` pour les IDs. Lance une `NotFoundException` si l'UUID n'existe pas.

6. **Implémente `FamiliesController`** dans `src/families/families.controller.ts` :
   - Préfixe `'families'`
   - `GET /families` — pipes `DefaultValuePipe` + `ParseIntPipe` sur `page` et `limit`
   - `GET /families/:id` — `ParseUUIDPipe`
   - `POST /families` — `@HttpCode(HttpStatus.CREATED)`
   - `PATCH /families/:id` — `ParseUUIDPipe` + `UpdateFamilyDto`
   - `DELETE /families/:id` — `@HttpCode(HttpStatus.NO_CONTENT)` + `void`

7. **Vérifie manuellement** avec `curl` ou un client HTTP (Insomnia, HTTPie) :

   ```bash
   # Créer une famille valide
   curl -X POST http://localhost:3000/families \
     -H "Content-Type: application/json" \
     -d '{"name": "Famille Martin", "visibility": "private"}'
   # → 201 + objet créé

   # Body invalide — name vide
   curl -X POST http://localhost:3000/families \
     -H "Content-Type: application/json" \
     -d '{"name": ""}'
   # → 400 avec message d'erreur class-validator

   # UUID invalide
   curl http://localhost:3000/families/not-a-uuid
   # → 400 — ParseUUIDPipe a rejeté avant le handler

   # DELETE → 204 sans body
   curl -X DELETE http://localhost:3000/families/<id-valide>
   # → 204, body vide
   ```

## Corrigé complet commenté

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
  // IsNotEmpty interdit '' et les espaces seuls
  // MinLength(2) interdit 'A' (un seul caractère)
  @IsString()
  @IsNotEmpty({ message: 'name est obligatoire' })
  @MinLength(2)
  @MaxLength(80)
  name: string

  // IsOptional() court-circuite les autres décorateurs si le champ est absent
  // — un body sans 'description' passe quand même la validation
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })   // { each: true } = valider chaque élément du tableau
  tags?: string[]

  @IsOptional()
  @IsEnum(FamilyVisibility, { message: 'visibility doit être "private" ou "public"' })
  visibility?: FamilyVisibility
}
```

```ts
// src/families/dto/update-family.dto.ts
import { PartialType } from '@nestjs/mapped-types'
// ATTENTION : importer depuis @nestjs/mapped-types, PAS @nestjs/swagger
// — les deux exportent PartialType mais @nestjs/swagger nécessite Swagger installé
import { CreateFamilyDto } from './create-family.dto'

// Tous les champs deviennent optionnels — les décorateurs class-validator sont conservés
// PATCH /families/:id avec body {} est valide (mise à jour vide = no-op)
export class UpdateFamilyDto extends PartialType(CreateFamilyDto) {}
```

```ts
// src/main.ts
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.useGlobalPipes(
    new ValidationPipe({
      // Supprime silencieusement les champs non déclarés dans le DTO
      whitelist: true,
      // Retourne 400 si le client envoie des champs non déclarés
      // — meilleure DX : le client sait qu'il a envoyé des champs inconnus
      forbidNonWhitelisted: true,
      // Convertit les types — @Query('page') string → number avec ParseIntPipe
      transform: true,
    }),
  )

  await app.listen(3000)
}
bootstrap()
```

```ts
// src/families/families.service.ts
import { Injectable, NotFoundException } from '@nestjs/common'
import { CreateFamilyDto } from './dto/create-family.dto'
import { UpdateFamilyDto } from './dto/update-family.dto'

export interface Family {
  id: string
  name: string
  description?: string
  tags?: string[]
  visibility?: string
  createdAt: string
}

@Injectable()
export class FamiliesService {
  // Store en mémoire — Prisma + PostgreSQL au module 13
  private readonly families = new Map<string, Family>()

  findAll(page: number, limit: number): { data: Family[]; total: number } {
    const all = Array.from(this.families.values())
    const start = (page - 1) * limit
    return {
      data: all.slice(start, start + limit),
      total: all.length,
    }
  }

  findOne(id: string): Family {
    const family = this.families.get(id)
    // NotFoundException → NestJS retourne 404 automatiquement via l'exception filter
    if (!family) throw new NotFoundException(`Famille ${id} introuvable`)
    return family
  }

  create(dto: CreateFamilyDto): Family {
    const id = crypto.randomUUID()
    const family: Family = {
      id,
      name: dto.name,
      description: dto.description,
      tags: dto.tags,
      visibility: dto.visibility,
      createdAt: new Date().toISOString(),
    }
    this.families.set(id, family)
    return family
  }

  update(id: string, dto: UpdateFamilyDto): Family {
    const existing = this.findOne(id)   // lève 404 si inexistant
    const updated: Family = {
      ...existing,
      // Spread + overwrite : seuls les champs présents dans dto sont modifiés
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.tags !== undefined && { tags: dto.tags }),
      ...(dto.visibility !== undefined && { visibility: dto.visibility }),
    }
    this.families.set(id, updated)
    return updated
  }

  remove(id: string): void {
    this.findOne(id)   // lève 404 si inexistant avant de tenter la suppression
    this.families.delete(id)
  }
}
```

```ts
// src/families/families.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common'
import { CreateFamilyDto } from './dto/create-family.dto'
import { UpdateFamilyDto } from './dto/update-family.dto'
import { FamiliesService } from './families.service'

@Controller('families')
export class FamiliesController {
  // Injection par le constructeur — NestJS résout FamiliesService depuis le module (DI)
  constructor(private readonly familiesService: FamiliesService) {}

  // GET /families?page=1&limit=10
  @Get()
  findAll(
    // DefaultValuePipe(1) : si ?page est absent, page = 1
    // ParseIntPipe : convertit la string '1' en number 1
    // Sans transform: true dans ValidationPipe, ParseIntPipe est indispensable ici
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.familiesService.findAll(page, limit)
  }

  // GET /families/:id
  @Get(':id')
  findOne(
    // ParseUUIDPipe valide le format UUID v4 avant d'appeler le handler
    // Si '/families/not-a-uuid', NestJS retourne 400 sans toucher le service
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.familiesService.findOne(id)
  }

  // POST /families → 201 Created
  @Post()
  @HttpCode(HttpStatus.CREATED)
  // Le ValidationPipe intercepte dto AVANT ce handler
  // Si name est vide → 400 automatique, ce code n'est jamais atteint
  create(@Body() dto: CreateFamilyDto) {
    return this.familiesService.create(dto)
  }

  // PATCH /families/:id → 200 (défaut)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFamilyDto,   // Tous les champs optionnels — body vide {} accepté
  ) {
    return this.familiesService.update(id, dto)
  }

  // DELETE /families/:id → 204 No Content
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): void {
    // void + @HttpCode(204) = NestJS envoie un body vide
    // NE PAS return d'objet ici — 204 interdit un body
    this.familiesService.remove(id)
  }
}
```

## Variante J+30 (fading)

Même controller, deux contraintes ajoutées :

1. Ajouter une route `GET /families/:id/members` qui retourne la liste des membres d'une famille (store en mémoire dans le service). Le paramètre `:id` doit passer par `ParseUUIDPipe`.
2. Ajouter un champ `maxMembers` dans `CreateFamilyDto` : entier, entre 2 et 50, optionnel. Vérifier que la validation fonctionne : body `{ "name": "Tribu", "maxMembers": 1 }` → 400.

En 20 minutes, sans regarder le corrigé.

## Application TribuZen

Porte ce controller dans `smaurier/tribuzen` — dossier `apps/api/src/families/`.

1. Copie les fichiers `families.controller.ts`, `families.service.ts`, `dto/` tels quels.
2. Crée `families.module.ts` :

   ```ts
   import { Module } from '@nestjs/common'
   import { FamiliesController } from './families.controller'
   import { FamiliesService } from './families.service'

   @Module({
     controllers: [FamiliesController],
     providers: [FamiliesService],
   })
   export class FamiliesModule {}
   ```

3. Importe `FamiliesModule` dans `AppModule`.
4. Lance `pnpm start:dev` — vérifie que `POST /families` retourne 201 et que `POST /families` avec `name: ''` retourne 400.

Ce controller est la base du fil rouge TribuZen : la validation DTO protège la base dès maintenant, avant même que Prisma soit câblé. Quand le service passera à Prisma (module 13), seul `FamiliesService` change — le controller et les DTOs restent intacts.
