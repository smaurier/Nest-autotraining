---
titre: NestJS config et Swagger
cours: 09-nestjs
notions: [ConfigModule et variables d'environnement, validation du schéma de config, injection de ConfigService, Swagger et OpenAPI, décorateurs ApiTags ApiProperty ApiResponse, génération auto de la doc, DocumentBuilder, sécurité de la doc]
outcomes: [charger et valider la configuration via ConfigModule, injecter ConfigService, générer une doc OpenAPI avec @nestjs/swagger, documenter DTOs et endpoints]
prerequis: [19-nestjs-auth]
next: 21-nestjs-websockets-fichiers
libs: [{ name: "@nestjs/config", version: "^4" }, { name: "@nestjs/swagger", version: "^11" }]
tribuzen: configuration typée + documentation OpenAPI de l'API TribuZen
last-reviewed: 2026-07
---

# NestJS config et Swagger

> **Outcomes — tu sauras FAIRE :** charger et valider la configuration via `ConfigModule`, injecter `ConfigService` dans n'importe quel service, générer une doc OpenAPI avec `@nestjs/swagger`, documenter DTOs et endpoints avec les décorateurs `Api*`.
> **Difficulté :** :star::star::star:

## 1. Cas concret d'abord

L'API TribuZen vient d'être déployée en staging. Deux problèmes arrivent le même jour.

**Problème 1 — config éparpillée sans validation.** `process.env.DATABASE_URL` apparaît à sept endroits différents. `GroupService` le lit directement, `AuthService` aussi, `main.ts` aussi. L'app démarre en staging sans erreur — mais `JWT_SECRET` n'est pas défini et la première requête `/auth/login` renvoie un 500 opaque. Aucune validation au démarrage.

```ts
// ❌ anti-pattern — process.env brut, sans validation, sans type
@Injectable()
export class GroupService {
  async create(dto: CreateGroupDto) {
    // Si DATABASE_URL est undefined → crash à l'exécution, pas au démarrage
    const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })
  }
}
```

**Problème 2 — zéro doc API.** Le dev frontend ouvre `POST /groups` et demande : « il attend quoi en body exactement ? il retourne quoi ? il peut renvoyer 401 ? ». Tu réponds dans Slack. Le lendemain, un autre dev pose la même question.

`@nestjs/config` et `@nestjs/swagger` résolvent les deux.

```ts
// ✅ après ce module — config validée, doc générée
@Injectable()
export class GroupService {
  constructor(private readonly configService: ConfigService) {}

  // ConfigService est injecté — validé au démarrage, typé, testable
  getDatabaseUrl(): string {
    return this.configService.getOrThrow<string>('DATABASE_URL')
  }
}
```

Et la documentation Swagger est générée automatiquement à partir des décorateurs placés sur controllers et DTOs.

## 2. Théorie complète, concise

### 2.1 ConfigModule — chargement du `.env`

`ConfigModule` (de `@nestjs/config`) encapsule `dotenv` et expose les variables d'environnement via `ConfigService`.

```ts
// app.module.ts
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,    // ConfigService injectable partout, sans re-import dans chaque module
      envFilePath: '.env',
    }),
  ],
})
export class AppModule {}
```

Sans `isGlobal: true`, chaque module qui veut utiliser `ConfigService` doit importer `ConfigModule` explicitement — bruit dans chaque `@Module()`. Avec `isGlobal: true`, un seul import dans `AppModule` suffit.

### 2.2 Validation du schéma avec Joi

La validation au démarrage est non négociable : l'app doit refuser de démarrer plutôt que de crasher en production à 3h du matin sur une variable manquante.

```ts
import * as Joi from 'joi'

ConfigModule.forRoot({
  isGlobal: true,
  validationSchema: Joi.object({
    NODE_ENV: Joi.string()
      .valid('development', 'staging', 'production', 'test')
      .default('development'),
    PORT: Joi.number().port().default(3000),
    DATABASE_URL: Joi.string().required(),
    JWT_SECRET:   Joi.string().min(32).required(),
    JWT_EXPIRY:   Joi.string().default('15m'),
  }),
  validationOptions: {
    allowUnknown: true,  // tolère les variables non déclarées dans le schéma
    abortEarly:   false, // affiche toutes les erreurs, pas seulement la première
  },
})
```

Si `DATABASE_URL` ou `JWT_SECRET` manquent, NestJS refuse de démarrer avec un message lisible :

```
Config validation error: "DATABASE_URL" is required. "JWT_SECRET" is required.
```

### 2.3 ConfigService — `get` et `getOrThrow`

```ts
@Injectable()
export class GroupService {
  constructor(private readonly configService: ConfigService) {}

  // get<T>(key, valeurParDéfaut?) — retourne undefined si absent
  getAppName(): string {
    return this.configService.get<string>('APP_NAME', 'TribuZen')
  }

  // getOrThrow<T>(key) — lève une erreur si absent
  // À préférer pour les variables critiques déjà validées par Joi
  getDatabaseUrl(): string {
    return this.configService.getOrThrow<string>('DATABASE_URL')
  }

  isProduction(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'production'
  }
}
```

| Méthode | Comportement si absent | Cas d'usage |
|---------|----------------------|-------------|
| `get<T>(key)` | retourne `undefined` | variables optionnelles avec logique de fallback |
| `get<T>(key, default)` | retourne la valeur par défaut | variables avec valeur défaut connue |
| `getOrThrow<T>(key)` | lève `InternalServerErrorException` | variables critiques déjà validées par Joi |

### 2.4 `registerAs` — namespaces typés

Pour organiser la configuration en groupes cohérents et éviter la prolifération de clés plates :

```ts
// src/config/jwt.config.ts
import { registerAs } from '@nestjs/config'

export default registerAs('jwt', () => ({
  secret:        process.env.JWT_SECRET,
  expiry:        process.env.JWT_EXPIRY        ?? '15m',
  refreshExpiry: process.env.JWT_REFRESH_EXPIRY ?? '7d',
}))
```

```ts
// src/config/database.config.ts
import { registerAs } from '@nestjs/config'

export default registerAs('database', () => ({
  url:      process.env.DATABASE_URL,
  poolSize: parseInt(process.env.DB_POOL_SIZE ?? '10', 10),
}))
```

```ts
// app.module.ts — charger les namespaces
import databaseConfig from './config/database.config'
import jwtConfig from './config/jwt.config'

ConfigModule.forRoot({
  isGlobal: true,
  load: [databaseConfig, jwtConfig], // factories enregistrées dans le conteneur
})
```

Accès par clé pointée avec `ConfigService` (retour non typé) :

```ts
this.configService.get<string>('database.url')
this.configService.get<string>('jwt.secret')
```

### 2.5 Injection typée avec `ConfigType`

Pour un accès pleinement typé, injecter le namespace directement via `@Inject` et `ConfigType` :

```ts
import { Inject, Injectable } from '@nestjs/common'
import { ConfigType } from '@nestjs/config'
import jwtConfig from '../config/jwt.config'

@Injectable()
export class AuthService {
  constructor(
    // jwtConfig.KEY = token généré automatiquement par registerAs
    @Inject(jwtConfig.KEY)
    private readonly jwt: ConfigType<typeof jwtConfig>,
  ) {}

  getSignOptions() {
    // Accès entièrement typé — TypeScript connaît .secret, .expiry, .refreshExpiry
    return { secret: this.jwt.secret, expiresIn: this.jwt.expiry }
  }
}
```

`ConfigType<typeof jwtConfig>` infère le type de retour de la factory — TypeScript connaît `.secret`, `.expiry`, `.refreshExpiry` sans casting. Pas de `get<string>('jwt.secret')` qui peut silencieusement retourner `undefined`.

### 2.6 DocumentBuilder et SwaggerModule

`@nestjs/swagger` génère une spec OpenAPI 3 à partir des décorateurs placés sur les controllers et DTOs.

```ts
// main.ts
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { ConfigService } from '@nestjs/config'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  const configService = app.get(ConfigService) // accès hors DI — uniquement valide dans main.ts

  const swaggerConfig = new DocumentBuilder()
    .setTitle('TribuZen API')
    .setDescription('API de gestion des groupes et membres TribuZen')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT-auth', // référence réutilisée dans @ApiBearerAuth('JWT-auth')
    )
    .addTag('groups', 'Gestion des groupes TribuZen')
    .addTag('members', 'Gestion des membres')
    .build()

  // createDocument inspecte tous les controllers et lit leurs décorateurs Api*
  const document = SwaggerModule.createDocument(app, swaggerConfig)

  // setup monte l'interface Swagger UI à /api/docs
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  })

  await app.listen(configService.get<number>('PORT', 3000))
}
bootstrap()
```

`SwaggerModule.createDocument` inspecte tous les controllers enregistrés, lit leurs décorateurs, et produit un objet JSON conforme à la spec OpenAPI 3. `SwaggerModule.setup` monte l'interface Swagger UI à l'URL fournie.

### 2.7 Décorateurs `Api*` sur les controllers

```ts
import {
  ApiTags, ApiBearerAuth, ApiOperation,
  ApiCreatedResponse, ApiOkResponse,
  ApiNotFoundResponse, ApiUnauthorizedResponse,
  ApiParam,
} from '@nestjs/swagger'

@ApiTags('groups')           // groupe dans Swagger UI sous l'onglet "groups"
@ApiBearerAuth('JWT-auth')  // toutes les routes de ce controller requièrent un JWT
@Controller('groups')
export class GroupController {
  @Post()
  @ApiOperation({ summary: 'Créer un groupe TribuZen' })
  @ApiCreatedResponse({ description: 'Groupe créé', type: GroupResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token JWT absent ou invalide' })
  create(@Body() dto: CreateGroupDto) { /* ... */ }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un groupe par ID' })
  @ApiParam({ name: 'id', type: String, example: 'group-abc' })
  @ApiOkResponse({ description: 'Groupe trouvé', type: GroupResponseDto })
  @ApiNotFoundResponse({ description: 'Groupe introuvable' })
  findOne(@Param('id') id: string) { /* ... */ }
}
```

| Décorateur | Cible | Effet |
|------------|-------|-------|
| `@ApiTags('nom')` | controller | groupe les routes sous un tag dans Swagger UI |
| `@ApiBearerAuth('ref')` | controller ou méthode | indique qu'un JWT est requis |
| `@ApiOperation({ summary })` | méthode | description courte de l'opération |
| `@ApiCreatedResponse({ type })` | méthode | documente la réponse 201 avec schéma |
| `@ApiOkResponse({ type })` | méthode | documente la réponse 200 avec schéma |
| `@ApiNotFoundResponse()` | méthode | documente la réponse 404 |
| `@ApiUnauthorizedResponse()` | méthode | documente la réponse 401 |
| `@ApiParam({ name })` | méthode | documente un paramètre de route |
| `@ApiBody({ type })` | méthode | documente le corps de la requête |

### 2.8 `@ApiProperty` sur les DTOs

TypeScript n'est pas disponible à l'exécution — Swagger ne voit pas les types. Chaque propriété doit être déclarée explicitement.

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, MinLength, MaxLength, IsOptional, IsEnum } from 'class-validator'

export class CreateGroupDto {
  @ApiProperty({
    description: 'Nom du groupe TribuZen',
    example: 'Famille Martin',
    minLength: 2,
    maxLength: 60,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name: string

  @ApiPropertyOptional({
    description: 'Description courte du groupe',
    example: 'Groupe de la famille Martin — réunions mensuelles',
  })
  @IsString()
  @IsOptional()
  description?: string

  @ApiPropertyOptional({
    description: 'Visibilité du groupe',
    enum: ['public', 'private'],
    default: 'private',
  })
  @IsEnum(['public', 'private'])
  @IsOptional()
  visibility?: 'public' | 'private'
}
```

`@ApiProperty` = champ requis dans la doc. `@ApiPropertyOptional` = champ optionnel (Swagger UI l'affiche avec un `?`). Sans ces décorateurs, le body est documenté comme `{}` — le consommateur de la doc ne voit rien.

### 2.9 Désactiver Swagger en production

L'interface Swagger ne doit jamais être exposée en production : elle révèle la structure complète de l'API et consomme des ressources inutilement.

```ts
// main.ts — guard NODE_ENV
async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const configService = app.get(ConfigService)
  const nodeEnv = configService.get<string>('NODE_ENV', 'development')

  if (nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('TribuZen API')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT-auth')
      .build()
    const document = SwaggerModule.createDocument(app, config)
    SwaggerModule.setup('api/docs', app, document)
    console.log(`Swagger → http://localhost:${configService.get('PORT', 3000)}/api/docs`)
  }

  await app.listen(configService.get<number>('PORT', 3000))
}
```

## 3. Worked examples

### Exemple A — Configuration TribuZen avec Joi et namespace jwt

```ts
// src/config/jwt.config.ts
import { registerAs } from '@nestjs/config'

// registerAs crée un namespace 'jwt' — les clés sont isolées, la factory est typée
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
      isGlobal: true,
      load: [jwtConfig],
      validationSchema: Joi.object({
        NODE_ENV:         Joi.string().valid('development', 'staging', 'production', 'test').default('development'),
        PORT:             Joi.number().port().default(3000),
        DATABASE_URL:     Joi.string().required(),
        JWT_SECRET:       Joi.string().min(32).required(),
        JWT_EXPIRY:       Joi.string().default('15m'),
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
// src/group/group.service.ts
import { Inject, Injectable } from '@nestjs/common'
import { ConfigType } from '@nestjs/config'
import jwtConfig from '../config/jwt.config'

@Injectable()
export class GroupService {
  constructor(
    // Injection typée — jwtConfig.KEY est le token généré par registerAs
    @Inject(jwtConfig.KEY)
    private readonly jwt: ConfigType<typeof jwtConfig>,
  ) {}

  getJwtMeta(): { expiry: string; refreshExpiry: string } {
    // TypeScript connaît .expiry et .refreshExpiry — pas de get<string>('jwt.expiry')
    return { expiry: this.jwt.expiry, refreshExpiry: this.jwt.refreshExpiry }
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
  // Le namespace doit être importé dans le module consommateur même avec isGlobal: true
  imports: [ConfigModule.forFeature(jwtConfig)],
  controllers: [GroupController],
  providers: [GroupService],
})
export class GroupModule {}
```

**Pas-à-pas :** (1) `registerAs('jwt', ...)` crée un namespace — les variables env sont encapsulées dans une factory qui retourne un objet typé ; (2) `load: [jwtConfig]` dans `ConfigModule.forRoot` enregistre la factory dans le conteneur global ; (3) `validationSchema: Joi.object(...)` valide au démarrage — `JWT_SECRET` requis et `>= 32 chars`, refus de démarrer sinon ; (4) `ConfigModule.forFeature(jwtConfig)` dans `GroupModule` — nécessaire pour que NestJS résolve le token `jwtConfig.KEY` dans le module consommateur ; (5) `@Inject(jwtConfig.KEY)` + `ConfigType<typeof jwtConfig>` — accès typé sans `get<string>()` qui peut retourner `undefined`.

### Exemple B — GroupController documenté avec @nestjs/swagger

```ts
// src/group/dto/create-group.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, MinLength, MaxLength, IsOptional, IsEnum } from 'class-validator'

export class CreateGroupDto {
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

@ApiTags('groups')
@ApiBearerAuth('JWT-auth')   // référence définie dans DocumentBuilder.addBearerAuth(...)
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
  @ApiParam({ name: 'id', type: String, example: 'group-abc123' })
  @ApiOkResponse({ description: 'Groupe trouvé', type: GroupResponseDto })
  @ApiNotFoundResponse({ description: 'Groupe introuvable' })
  findOne(@Param('id') id: string): GroupResponseDto {
    return this.groupService.findOne(id)
  }
}
```

```ts
// main.ts — Swagger conditionnel + ConfigService pour le PORT
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { ConfigService } from '@nestjs/config'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))

  const configService = app.get(ConfigService) // hors DI — valide uniquement dans main.ts
  const nodeEnv = configService.get<string>('NODE_ENV', 'development')

  if (nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('TribuZen API')
      .setDescription('API de gestion des groupes et membres TribuZen')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'JWT-auth', // doit correspondre exactement à @ApiBearerAuth('JWT-auth')
      )
      .addTag('groups', 'Gestion des groupes TribuZen')
      .addTag('members', 'Gestion des membres')
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

**Pas-à-pas :** (1) `@ApiTags('groups')` sur le controller — toutes les routes apparaissent sous l'onglet "groups" dans Swagger UI ; (2) `@ApiBearerAuth('JWT-auth')` correspond à la référence déclarée dans `addBearerAuth(...)` du `DocumentBuilder` — le slot "Authorize" est activé pour ce controller, le token JWT est inclus dans tous les appels test ; (3) `@ApiCreatedResponse({ type: GroupResponseDto })` — Swagger génère le schéma de réponse 201 à partir des `@ApiProperty` de `GroupResponseDto` ; (4) `@ApiParam({ name: 'id' })` documente le paramètre de route `:id` dans Swagger UI ; (5) `app.get(ConfigService)` dans `main.ts` est la seule façon d'accéder au conteneur DI avant `app.listen()` — dans les services, le constructeur reste la bonne approche.

## 4. Pièges & misconceptions

- **`isGlobal: true` oublié.** Sans lui, chaque module qui injecte `ConfigService` doit importer `ConfigModule`. NestJS lève `Nest can't resolve dependencies of GroupService (?). Please make sure that the argument ConfigService at index [0] is available in the GroupModule context`. Correction : `ConfigModule.forRoot({ isGlobal: true })` dans `AppModule` — une seule fois, partout disponible.

- **Validation Joi absente.** Sans `validationSchema`, un `.env` incomplet laisse l'app démarrer avec des variables `undefined`. Le crash arrive sur la première requête qui utilise la variable manquante — message d'erreur opaque en prod. Correction : toujours définir un `validationSchema` avec `required()` sur les variables critiques et `abortEarly: false` pour voir toutes les erreurs d'un coup.

- **`get<T>()` pour les variables critiques.** `configService.get<string>('JWT_SECRET')` retourne `string | undefined`. Une variable validée par Joi est garantie présente — utiliser `getOrThrow` qui documente l'intention et évite de propager un `| undefined` dans le typage.

- **`ConfigModule.forFeature` oublié avec `registerAs`.** `isGlobal: true` ne suffit pas pour les namespaces chargés avec `registerAs` — le module consommateur doit importer `ConfigModule.forFeature(jwtConfig)` pour que NestJS résolve le token `jwtConfig.KEY`. Correction : ajouter `imports: [ConfigModule.forFeature(jwtConfig)]` dans chaque module qui utilise ce namespace.

- **`@ApiProperty` absent d'un champ DTO.** Swagger UI affiche un body vide `{}` pour l'endpoint concerné. Les consommateurs de la doc ne voient pas les champs attendus. Correction : décorer chaque propriété publique d'un DTO avec `@ApiProperty` (requis) ou `@ApiPropertyOptional` (optionnel).

- **Référence `@ApiBearerAuth` incorrecte.** `@ApiBearerAuth('wrong-ref')` sans correspondance dans `addBearerAuth('JWT-auth', ...)` affiche un cadenas dans Swagger UI mais le champ "Authorize" n'est pas connecté — les appels test n'incluent pas le token. Correction : la string dans `@ApiBearerAuth(...)` doit être identique au deuxième argument de `addBearerAuth(...)`.

- **Swagger activé en production.** L'interface expose la structure complète de l'API (routes, schémas, DTOs) — surface d'attaque non négligeable. Entourer `SwaggerModule.setup` d'un `if (nodeEnv !== 'production')`. En CI/CD, la variable `NODE_ENV=production` garantit que la doc n'est jamais montée en prod.

## 5. Ancrage TribuZen

Couche fil-rouge : **configuration typée + documentation OpenAPI de l'API TribuZen** (`smaurier/tribuzen`).

- `ConfigModule.forRoot({ isGlobal: true, validationSchema: Joi.object({...}) })` dans `AppModule` — `DATABASE_URL`, `JWT_SECRET`, `PORT` validés au démarrage. L'app refuse de démarrer avec une config incomplète en staging ou prod.
- Namespace `jwtConfig` via `registerAs` — `AuthService` et `GroupService` injectent `ConfigType<typeof jwtConfig>` avec un typage complet de `.secret`, `.expiry`, `.refreshExpiry`. Pas de magic strings `'jwt.secret'` dispersés dans la codebase.
- `GroupController` documenté avec `@ApiTags('groups')`, `@ApiBearerAuth('JWT-auth')`, `@ApiCreatedResponse({ type: GroupResponseDto })` — le dev frontend ouvre `/api/docs` et voit le contrat exact sans Slack.
- `CreateGroupDto` et `GroupResponseDto` avec `@ApiProperty` complets — Swagger UI génère un formulaire interactif pour tester `POST /groups` directement depuis le navigateur.
- Swagger désactivé via `if (nodeEnv !== 'production')` — la doc n'est visible qu'en dev et staging.
- `app.get(ConfigService)` dans `main.ts` pour lire `PORT` avant `listen()` — seul endroit où ce pattern est légitime.

Structure cible dans `smaurier/tribuzen` :

```
apps/api/src/
  config/
    jwt.config.ts          ← registerAs('jwt', ...) — secret + expiry
    database.config.ts     ← registerAs('database', ...) — url + poolSize
  group/
    dto/
      create-group.dto.ts  ← @ApiProperty sur chaque champ + class-validator
      group-response.dto.ts
    group.controller.ts    ← @ApiTags + @ApiBearerAuth + @ApiOperation + @ApiOkResponse
    group.service.ts       ← @Inject(jwtConfig.KEY) ConfigType typé
    group.module.ts        ← ConfigModule.forFeature(jwtConfig)
  app.module.ts            ← ConfigModule.forRoot + Joi validationSchema
  main.ts                  ← DocumentBuilder + SwaggerModule + guard NODE_ENV
```

## 6. Points clés

1. `ConfigModule.forRoot({ isGlobal: true })` dans `AppModule` — une fois, partout disponible sans re-import.
2. `validationSchema: Joi.object({...})` avec `required()` sur les variables critiques — l'app refuse de démarrer avec une config invalide, jamais en silence.
3. `get<T>(key, default?)` pour les variables optionnelles ; `getOrThrow<T>(key)` pour les critiques déjà validées par Joi.
4. `registerAs('namespace', factory)` + `load: [config]` — encapsule les variables en objet typé par domaine (jwt, database, mail…).
5. `@Inject(config.KEY)` + `ConfigType<typeof config>` — injection typée inférant le type de retour de la factory, sans `get<string>()` qui peut retourner `undefined`.
6. `ConfigModule.forFeature(config)` dans le module consommateur — obligatoire pour résoudre le token d'un namespace même avec `isGlobal: true`.
7. `new DocumentBuilder().setTitle(...).addBearerAuth(...).addTag(...).build()` — construit la spec de base ; `SwaggerModule.createDocument` + `SwaggerModule.setup` la montent.
8. `@ApiTags` et `@ApiBearerAuth` sur le controller, `@ApiOperation` + `@ApiCreatedResponse`/`@ApiOkResponse` sur chaque méthode — chaîne de décorateurs complète pour documenter un endpoint.
9. `@ApiProperty` sur chaque propriété de DTO — sans lui, Swagger UI voit un body `{}` et ne génère aucun schéma.

## 7. Seeds Anki

```
Que fait isGlobal dans ConfigModule.forRoot ?|Rend ConfigService injectable dans toute l'app sans importer ConfigModule dans chaque module — un seul import dans AppModule suffit
Différence get vs getOrThrow dans ConfigService ?|get retourne T | undefined (avec ou sans valeur par défaut) ; getOrThrow lève une erreur si la clé est absente — à utiliser pour les variables critiques déjà validées par Joi
Comment valider les variables env au démarrage avec ConfigModule ?|validationSchema: Joi.object({ CLE: Joi.string().required() }) dans ConfigModule.forRoot — l'app refuse de démarrer si la validation échoue avec un message lisible
Pourquoi utiliser registerAs et ConfigType plutôt que ConfigService.get ?|registerAs encapsule les variables en objet typé par namespace ; ConfigType infère le type de retour de la factory — accès typé sans get<string>() qui peut retourner undefined
Quel import supplémentaire faut-il dans le module qui consomme un namespace registerAs ?|ConfigModule.forFeature(maConfig) dans imports du module consommateur — isGlobal ne suffit pas pour résoudre le token du namespace
Comment accéder à ConfigService dans main.ts avant app.listen() ?|app.get(ConfigService) — seul contexte où ce pattern est valide, hors du système DI classique par constructeur
Que produit SwaggerModule.createDocument(app, config) ?|Un objet JSON conforme à la spec OpenAPI 3 construit à partir des décorateurs Api* des controllers et DTOs enregistrés dans l'app
Pourquoi @ApiProperty est-il obligatoire sur les propriétés de DTO ?|TypeScript n'est pas disponible à l'exécution — Swagger ne peut pas inférer les types sans les métadonnées des décorateurs @ApiProperty ; sans eux le body est documenté comme {}
Comment s'assure-t-on que @ApiBearerAuth fonctionne dans Swagger UI ?|La string passée à @ApiBearerAuth('ref') doit être identique au deuxième argument de addBearerAuth({...}, 'ref') dans DocumentBuilder
Pourquoi désactiver Swagger en production ?|La doc expose la structure complète de l'API (routes, schémas, DTOs) — surface d'attaque et consommation de ressources inutiles ; guard if (nodeEnv !== 'production') autour de SwaggerModule.setup
```

## Pont vers le lab

> Lab associé : `09-nestjs/labs/lab-20-config-swagger/README.md`. Tu y configures `ConfigModule` avec validation Joi et namespace `jwtConfig`, injectes `ConfigService` de façon typée dans `GroupService`, et documentes `GroupController` complet avec `@nestjs/swagger` — corrigé complet commenté + variante J+30 dans le README.
