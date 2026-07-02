# Lab 20 — NestJS config et Swagger

> **Outcome :** à la fin, tu sais configurer `ConfigModule` avec validation Joi, injecter `ConfigService` de façon typée via `registerAs`/`ConfigType`, et documenter une API NestJS 11 complète avec `@nestjs/swagger`.
> **Vrai outil :** NestJS 11 (`@nestjs/config ^11`, `@nestjs/swagger ^11`, `joi`).
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

Tu construis la couche configuration et documentation Swagger du module `GroupModule` de TribuZen dans un projet NestJS 11 neuf. Pas de gap-fill — tu écris tout de A à Z à partir d'un projet vierge (`nest new tribuzen-config`).

Objectif fonctionnel :

- L'app refuse de démarrer si `DATABASE_URL` ou `JWT_SECRET` sont absents ou invalides
- `GET /groups/:id` et `POST /groups` fonctionnent et lisent leur config via `ConfigService`
- `http://localhost:3000/api/docs` expose Swagger UI avec les schémas de réponse complets
- Swagger est désactivé quand `NODE_ENV=production`

## Étapes (en friction)

1. **Créer le projet et installer les dépendances**

   ```bash
   nest new tribuzen-config
   cd tribuzen-config
   npm install @nestjs/config @nestjs/swagger joi class-validator class-transformer
   ```

   Créer le fichier `.env` à la racine :

   ```
   NODE_ENV=development
   PORT=3000
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tribuzen
   JWT_SECRET=super-secret-jwt-key-au-moins-32-caracteres
   JWT_EXPIRY=15m
   JWT_REFRESH_EXPIRY=7d
   ```

2. **Namespace `jwtConfig`** (`src/config/jwt.config.ts`)

   Utiliser `registerAs('jwt', () => ({ ... }))` pour encapsuler `JWT_SECRET`, `JWT_EXPIRY`, `JWT_REFRESH_EXPIRY`. Exporter le résultat par défaut.

3. **ConfigModule avec validation Joi** (`src/app.module.ts`)

   Ajouter `ConfigModule.forRoot({ isGlobal: true, load: [jwtConfig], validationSchema: Joi.object({...}) })`. Valider `DATABASE_URL` (string required), `JWT_SECRET` (string, min 32, required), `PORT` (number, default 3000), `NODE_ENV` (valid values, default development). Utiliser `abortEarly: false`.

4. **GroupModule avec injection typée** (`src/group/`)

   Créer `GroupModule`, `GroupController`, `GroupService`. Dans `GroupModule`, ajouter `imports: [ConfigModule.forFeature(jwtConfig)]`. Dans `GroupService`, injecter `@Inject(jwtConfig.KEY) private readonly jwt: ConfigType<typeof jwtConfig>`. Implémenter `create(dto)` (retour en mémoire) et `findOne(id)`.

5. **DTOs avec `@ApiProperty`** (`src/group/dto/`)

   Créer `CreateGroupDto` avec les champs `name` (string required), `description` (string optional), `visibility` (enum optional). Décorer chaque champ avec `@ApiProperty`/`@ApiPropertyOptional` et les décorateurs `class-validator` correspondants. Créer `GroupResponseDto` avec les mêmes champs plus `id` et `createdAt`.

6. **GroupController documenté** (`src/group/group.controller.ts`)

   Ajouter `@ApiTags('groups')` et `@ApiBearerAuth('JWT-auth')` sur la classe. Ajouter `@ApiOperation`, `@ApiCreatedResponse({ type: GroupResponseDto })` sur `POST /groups`. Ajouter `@ApiParam`, `@ApiOkResponse`, `@ApiNotFoundResponse` sur `GET /groups/:id`.

7. **DocumentBuilder dans `main.ts`** avec `addBearerAuth({...}, 'JWT-auth')`, `addTag('groups', ...)`, guard `if (nodeEnv !== 'production')`. Utiliser `app.get(ConfigService)` pour lire `PORT` et `NODE_ENV`. Vérifier que `http://localhost:3000/api/docs` affiche le schéma de `CreateGroupDto` et les réponses documentées.

## Corrigé complet commenté

```ts
// src/config/jwt.config.ts
import { registerAs } from '@nestjs/config'

// registerAs génère un token jwtConfig.KEY utilisable avec @Inject
export default registerAs('jwt', () => ({
  secret:        process.env.JWT_SECRET,
  expiry:        process.env.JWT_EXPIRY        ?? '15m',
  refreshExpiry: process.env.JWT_REFRESH_EXPIRY ?? '7d',
}))
```

```ts
// src/app.module.ts
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import * as Joi from 'joi'
import jwtConfig from './config/jwt.config'
import { GroupModule } from './group/group.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,        // ConfigService injectable partout sans re-import
      load: [jwtConfig],     // enregistre la factory namespace dans le conteneur
      validationSchema: Joi.object({
        NODE_ENV:          Joi.string().valid('development', 'staging', 'production', 'test').default('development'),
        PORT:              Joi.number().port().default(3000),
        DATABASE_URL:      Joi.string().required(),
        JWT_SECRET:        Joi.string().min(32).required(),
        JWT_EXPIRY:        Joi.string().default('15m'),
        JWT_REFRESH_EXPIRY: Joi.string().default('7d'),
      }),
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
    GroupModule,
  ],
})
export class AppModule {}
```

```ts
// src/group/dto/create-group.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, MinLength, MaxLength, IsOptional, IsEnum } from 'class-validator'

export class CreateGroupDto {
  // Sans @ApiProperty, Swagger voit un body {} — aucun champ documenté
  @ApiProperty({ description: 'Nom du groupe', example: 'Famille Martin', minLength: 2, maxLength: 60 })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name: string

  @ApiPropertyOptional({ description: 'Description courte', example: 'Réunions mensuelles' })
  @IsString()
  @IsOptional()
  description?: string

  @ApiPropertyOptional({ enum: ['public', 'private'], default: 'private' })
  @IsEnum(['public', 'private'])
  @IsOptional()
  visibility?: 'public' | 'private'
}
```

```ts
// src/group/dto/group-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class GroupResponseDto {
  @ApiProperty({ example: 'group-abc123' })
  id: string

  @ApiProperty({ example: 'Famille Martin' })
  name: string

  @ApiPropertyOptional({ example: 'Réunions mensuelles' })
  description?: string

  @ApiProperty({ enum: ['public', 'private'], example: 'private' })
  visibility: 'public' | 'private'

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  createdAt: Date
}
```

```ts
// src/group/group.service.ts
import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { ConfigType } from '@nestjs/config'
import jwtConfig from '../config/jwt.config'
import { CreateGroupDto } from './dto/create-group.dto'
import { GroupResponseDto } from './dto/group-response.dto'

@Injectable()
export class GroupService {
  // Store en mémoire — sera remplacé par Prisma au module 14
  private groups: GroupResponseDto[] = [
    { id: 'group-1', name: 'Famille Martin', visibility: 'private', createdAt: new Date() },
  ]

  constructor(
    // Injection typée — TypeScript connaît .secret, .expiry, .refreshExpiry
    @Inject(jwtConfig.KEY)
    private readonly jwt: ConfigType<typeof jwtConfig>,
  ) {}

  create(dto: CreateGroupDto): GroupResponseDto {
    const group: GroupResponseDto = {
      id: `group-${Date.now()}`,
      name: dto.name,
      description: dto.description,
      visibility: dto.visibility ?? 'private',
      createdAt: new Date(),
    }
    this.groups.push(group)
    return group
  }

  findOne(id: string): GroupResponseDto {
    const group = this.groups.find(g => g.id === id)
    // NotFoundException = 404 traduit automatiquement par NestJS
    if (!group) throw new NotFoundException(`Groupe ${id} introuvable`)
    return group
  }

  // Exemple d'utilisation de la config typée — accès direct sans get<string>()
  getJwtMeta() {
    return { expiry: this.jwt.expiry, refreshExpiry: this.jwt.refreshExpiry }
  }
}
```

```ts
// src/group/group.controller.ts
import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import {
  ApiTags, ApiBearerAuth, ApiOperation,
  ApiCreatedResponse, ApiOkResponse,
  ApiNotFoundResponse, ApiUnauthorizedResponse,
  ApiParam,
} from '@nestjs/swagger'
import { GroupService } from './group.service'
import { CreateGroupDto } from './dto/create-group.dto'
import { GroupResponseDto } from './dto/group-response.dto'

@ApiTags('groups')           // onglet "groups" dans Swagger UI
@ApiBearerAuth('JWT-auth')  // doit correspondre à addBearerAuth({...}, 'JWT-auth') dans DocumentBuilder
@Controller('groups')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un groupe TribuZen' })
  @ApiCreatedResponse({ description: 'Groupe créé avec succès', type: GroupResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token JWT absent ou invalide' })
  create(@Body() dto: CreateGroupDto): GroupResponseDto {
    return this.groupService.create(dto)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un groupe par son ID' })
  @ApiParam({ name: 'id', type: String, example: 'group-1' })
  @ApiOkResponse({ description: 'Groupe trouvé', type: GroupResponseDto })
  @ApiNotFoundResponse({ description: 'Groupe introuvable' })
  findOne(@Param('id') id: string): GroupResponseDto {
    return this.groupService.findOne(id)
  }
}
```

```ts
// src/group/group.module.ts
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import jwtConfig from '../config/jwt.config'
import { GroupService } from './group.service'
import { GroupController } from './group.controller'

@Module({
  // ConfigModule.forFeature requis pour résoudre jwtConfig.KEY dans ce module
  // isGlobal ne suffit pas pour les tokens registerAs
  imports: [ConfigModule.forFeature(jwtConfig)],
  controllers: [GroupController],
  providers: [GroupService],
})
export class GroupModule {}
```

```ts
// main.ts
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { ConfigService } from '@nestjs/config'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))

  // app.get() = accès au conteneur DI hors constructeur — valide uniquement dans main.ts
  const configService = app.get(ConfigService)
  const nodeEnv = configService.get<string>('NODE_ENV', 'development')

  // Swagger désactivé en production — ne pas exposer la structure de l'API
  if (nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('TribuZen API')
      .setDescription('API de gestion des groupes et membres TribuZen')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'JWT-auth', // référence utilisée dans @ApiBearerAuth('JWT-auth')
      )
      .addTag('groups', 'Gestion des groupes TribuZen')
      .build()

    const document = SwaggerModule.createDocument(app, config)
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    })
    console.log(`Swagger UI → http://localhost:${configService.get('PORT', 3000)}/api/docs`)
  }

  await app.listen(configService.get<number>('PORT', 3000))
}
bootstrap()
```

**Critères de validation :** (1) supprimer `JWT_SECRET` du `.env` → l'app refuse de démarrer avec le message d'erreur Joi ; (2) `GET /groups/group-1` → `200` avec `GroupResponseDto` ; (3) `POST /groups` avec body `{ "name": "Famille Dupont" }` → `201` avec le nouveau groupe ; (4) `http://localhost:3000/api/docs` affiche l'onglet "groups" avec les deux endpoints, les schémas de `CreateGroupDto` et `GroupResponseDto`, et le slot "Authorize" ; (5) `NODE_ENV=production npm start` → Swagger inaccessible (404 sur `/api/docs`).

## Variante J+30 (fading)

Même exercice, sans consulter le corrigé. Contraintes supplémentaires :

1. Ajouter un deuxième namespace `databaseConfig` avec `registerAs('database', () => ({ url: process.env.DATABASE_URL, poolSize: parseInt(process.env.DB_POOL_SIZE ?? '10', 10) }))`. Injecter `ConfigType<typeof databaseConfig>` dans `GroupService` à côté du namespace jwt. Utiliser `dbConfig.url` dans une méthode `getConnectionInfo()` pour retourner l'URL sans le mot de passe.

2. Ajouter un DTO de réponse paginée `PaginatedGroupDto` avec `items: GroupResponseDto[]` et `total: number`. Documenter `GET /groups` (liste) avec `@ApiOkResponse({ type: PaginatedGroupDto })`. Ajouter `@ApiQuery({ name: 'page', required: false, type: Number })` et `@ApiQuery({ name: 'limit', required: false, type: Number })`.

3. Activer le plugin CLI Swagger dans `nest-cli.json` (`"plugins": [{ "name": "@nestjs/swagger", "options": { "classValidatorShim": true } }]`). Retirer les `@ApiProperty` manuels de `CreateGroupDto` et vérifier que Swagger UI affiche toujours les champs correctement. Quels champs nécessitent encore `@ApiProperty` manuel ?

Temps cible : 35 minutes sans le corrigé.

## Application TribuZen

Commit cible dans `smaurier/tribuzen` :

```
feat(group): ConfigModule Joi + Swagger OpenAPI sur GroupController
```

Fichiers à créer :

- `apps/api/src/config/jwt.config.ts`
- `apps/api/src/config/database.config.ts`
- `apps/api/src/group/dto/create-group.dto.ts`
- `apps/api/src/group/dto/group-response.dto.ts`
- `apps/api/src/group/group.controller.ts`
- `apps/api/src/group/group.service.ts`
- `apps/api/src/group/group.module.ts`
- `apps/api/src/app.module.ts` (mise à jour avec ConfigModule + Joi)
- `apps/api/src/main.ts` (mise à jour avec DocumentBuilder + guard prod)

Critère de done : démarrage refusé si `JWT_SECRET` absent, `GET /groups/group-1` répond 200, `/api/docs` affiche les schémas complets avec le slot Authorize, `NODE_ENV=production` désactive Swagger.
