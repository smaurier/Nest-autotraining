# Module 20 — NestJS — Configuration & Swagger

> **Objectif** : Maîtriser la gestion de configuration par environnement avec @nestjs/config et documenter automatiquement votre API REST avec Swagger/OpenAPI dans NestJS.
> **Difficulte** : ⭐⭐⭐ (avance)
> **Prérequis** : Module 10 (Controllers), Module 11 (Services), Module 12 (Modules)
> **Duree estimee** : 4 heures

---

## 1. Gestion de la configuration

### 1.1 Le problème

Une application a des paramètres qui changent selon l'environnement : base de donnees, secrets, ports, URLs d'API tierces, etc. Il ne faut **jamais** coder ces valeurs en dur dans le code.

> **Analogie** : Imaginez que votre application est un formulaire papier a remplir. La configuration est le crayon avec lequel vous remplissez les cases. En développement, vous utilisez un crayon (valeurs de dev). En production, vous utilisez un stylo (valeurs de prod). Le formulaire est le même, seules les réponses changent.

### 1.2 Installation

```bash
npm install @nestjs/config
# @nestjs/config utilise dotenv en interne
```

### 1.3 Configuration basique

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,  // Disponible dans tous les modules sans reimport
    }),
  ],
})
export class AppModule {}
```

Fichier `.env` :

```env
# .env
NODE_ENV=development
PORT=3000

# Base de donnees
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=monMotDePasse
DB_DATABASE=nest_course

# JWT
JWT_ACCESS_SECRET=superSecretAccess123!longEnough
JWT_REFRESH_SECRET=superSecretRefresh456!longEnough
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# API externes
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USER=noreply@example.com
MAIL_PASS=motDePasseMail
```

> **Piege classique** : Ajoutez toujours `.env` dans votre `.gitignore`. Ne commitez **jamais** vos secrets. Fournissez un fichier `.env.example` avec des valeurs vides comme référence.

```env
# .env.example (a commiter dans Git)
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=
DB_PASSWORD=
DB_DATABASE=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
```

### 1.4 Utilisation du ConfigService

```typescript
// users/users.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UsersService {
  constructor(private readonly configService: ConfigService) {}

  getDbHost(): string {
    // get<Type>(cle, valeurParDefaut?)
    return this.configService.get<string>('DB_HOST', 'localhost');
  }

  getPort(): number {
    return this.configService.get<number>('PORT', 3000);
  }

  isDevelopment(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'development';
  }

  // getOrThrow lance une erreur si la variable n'existe pas
  getJwtSecret(): string {
    return this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    // Lance une erreur si JWT_ACCESS_SECRET n'est pas defini
  }
}
```

### 1.5 Options avancees de ConfigModule

```typescript
ConfigModule.forRoot({
  isGlobal: true,

  // Specifier le chemin du fichier .env
  envFilePath: '.env',
  // Ou plusieurs fichiers (le premier trouve gagne)
  envFilePath: ['.env.local', '.env'],

  // Ignorer si le fichier .env n'existe pas (utile en production)
  ignoreEnvFile: process.env.NODE_ENV === 'production',

  // Expansion des variables (utiliser des variables dans les variables)
  expandVariables: true,
  // Permet dans .env :
  // BASE_URL=http://localhost
  // API_URL=${BASE_URL}:${PORT}/api

  // Cache (ameliore les performances)
  cache: true,
})
```

### 1.6 Validation du schema avec Joi

Il est crucial de valider que toutes les variables d'environnement requises sont presentes et valides au démarrage de l'application.

```bash
npm install joi
```

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        // Environnement
        NODE_ENV: Joi.string()
          .valid('development', 'staging', 'production', 'test')
          .default('development'),
        PORT: Joi.number().default(3000),

        // Base de donnees
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().default(5432),
        DB_USERNAME: Joi.string().required(),
        DB_PASSWORD: Joi.string().required(),
        DB_DATABASE: Joi.string().required(),

        // JWT
        JWT_ACCESS_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        JWT_ACCESS_EXPIRATION: Joi.string().default('15m'),
        JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),

        // Redis (optionnel)
        REDIS_HOST: Joi.string().default('localhost'),
        REDIS_PORT: Joi.number().default(6379),
      }),
      validationOptions: {
        allowUnknown: true,   // Permet les variables non declarees dans le schema
        abortEarly: false,     // Affiche TOUTES les erreurs, pas seulement la premiere
      },
    }),
  ],
})
export class AppModule {}
```

Si une variable requise manque, l'application refuse de démarrer :

```
Error: Config validation error:
"DB_USERNAME" is required
"DB_PASSWORD" is required
"JWT_ACCESS_SECRET" length must be at least 32 characters long
```

> **Bonne pratique** : Validez toujours votre configuration au démarrage. Il vaut mieux une erreur claire au lancement qu'un bug mystérieux en production a 3h du matin.

### 1.7 Configuration par namespace (registerAs)

Pour organiser la configuration en groupes logiques :

```typescript
// config/database.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  name: process.env.DB_DATABASE || 'nest_course',
  synchronize: process.env.NODE_ENV !== 'production',
}));
```

```typescript
// config/jwt.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  accessExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
  refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
}));
```

```typescript
// config/mail.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => ({
  host: process.env.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT, 10) || 587,
  user: process.env.MAIL_USER,
  password: process.env.MAIL_PASS,
  from: process.env.MAIL_FROM || 'noreply@example.com',
}));
```

Charger les configurations :

```typescript
// app.module.ts
import { ConfigModule } from '@nestjs/config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import mailConfig from './config/mail.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig, mailConfig],
    }),
  ],
})
export class AppModule {}
```

Utilisation avec les namespaces :

```typescript
@Injectable()
export class SomeService {
  constructor(private configService: ConfigService) {}

  getDatabaseHost(): string {
    // Acces avec le prefix du namespace
    return this.configService.get<string>('database.host');
  }

  getJwtAccessSecret(): string {
    return this.configService.get<string>('jwt.accessSecret');
  }

  // Ou recuperer tout le namespace d'un coup
  getMailConfig() {
    return this.configService.get('mail');
    // { host: '...', port: 587, user: '...', password: '...', from: '...' }
  }
}
```

### 1.8 Injection typee avec @Inject

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import databaseConfig from '../config/database.config';

@Injectable()
export class DatabaseService {
  constructor(
    @Inject(databaseConfig.KEY)
    private dbConfig: ConfigType<typeof databaseConfig>,
  ) {}

  getConnectionString(): string {
    // Acces entierement type !
    return `postgresql://${this.dbConfig.username}:${this.dbConfig.password}@${this.dbConfig.host}:${this.dbConfig.port}/${this.dbConfig.name}`;
  }
}
```

---

## 2. Swagger / OpenAPI

### 2.1 Qu'est-ce que Swagger ?

Swagger (maintenant OpenAPI) est un standard pour documenter les API REST. Il généré automatiquement une interface web interactive pour explorer et tester votre API.

> **Analogie** : Swagger est comme le menu d'un restaurant avec photos. Au lieu de deviner ce que l'API propose, vous avez une belle interface avec tous les plats (endpoints), les ingredients (paramètres), et vous pouvez même gouter (tester) directement.

### 2.2 Installation

```bash
npm install @nestjs/swagger
```

### 2.3 Configuration de base

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configuration de Swagger
  const config = new DocumentBuilder()
    .setTitle('NestJS Course API')
    .setDescription('API REST du cours NestJS — Modules 13 a 24')
    .setVersion('1.0')
    .setContact(
      'Equipe Pedagogique',
      'https://example.com',
      'contact@example.com',
    )
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Entrez votre token JWT',
      },
      'JWT-auth', // Nom de reference pour le schema de securite
    )
    .addTag('auth', 'Authentification et autorisation')
    .addTag('users', 'Gestion des utilisateurs')
    .addTag('articles', 'Gestion des articles')
    .addTag('products', 'Gestion des produits')
    .addServer('http://localhost:3000', 'Developpement local')
    .addServer('https://api.staging.example.com', 'Staging')
    .build();

  // Creer le document OpenAPI
  const document = SwaggerModule.createDocument(app, config);

  // Monter l'interface Swagger sur /api/docs
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // Garde le token entre les recharges
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'NestJS Course — API Documentation',
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  await app.listen(3000);
  console.log('Swagger disponible sur http://localhost:3000/api/docs');
}
bootstrap();
```

### 2.4 Les decorateurs Swagger pour les controllers

```typescript
// articles/articles.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { ArticleResponseDto } from './dto/article-response.dto';

@ApiTags('articles')                // Groupe dans l'interface Swagger
@ApiBearerAuth('JWT-auth')         // Indique que ce controller necessite un JWT
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Get()
  @ApiOperation({
    summary: 'Lister tous les articles',
    description: 'Retourne une liste paginee d\'articles publies avec filtres optionnels.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Numero de page (defaut: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre de resultats par page (defaut: 10, max: 100)',
    example: 10,
  })
  @ApiQuery({
    name: 'statut',
    required: false,
    enum: ['brouillon', 'publie', 'archive'],
    description: 'Filtrer par statut',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Recherche dans le titre et le contenu',
  })
  @ApiOkResponse({
    description: 'Liste des articles retournee avec succes',
    type: [ArticleResponseDto],
  })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('statut') statut?: string,
    @Query('search') search?: string,
  ) {
    return this.articlesService.findAll(page, limit, statut, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Recuperer un article par ID' })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID de l\'article',
    example: 1,
  })
  @ApiOkResponse({
    description: 'Article trouve',
    type: ArticleResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Article introuvable' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.articlesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Creer un nouvel article' })
  @ApiBody({ type: CreateArticleDto })
  @ApiCreatedResponse({
    description: 'Article cree avec succes',
    type: ArticleResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Donnees de creation invalides' })
  @ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
  @ApiForbiddenResponse({ description: 'Role insuffisant' })
  create(@Body() createArticleDto: CreateArticleDto) {
    return this.articlesService.create(createArticleDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Mettre a jour un article' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({
    description: 'Article mis a jour avec succes',
    type: ArticleResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Article introuvable' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateArticleDto: UpdateArticleDto,
  ) {
    return this.articlesService.update(id, updateArticleDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un article' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Article supprime avec succes' })
  @ApiNotFoundResponse({ description: 'Article introuvable' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.articlesService.remove(id);
  }
}
```

### 2.5 Les decorateurs Swagger pour les DTOs

```typescript
// dto/create-article.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, IsOptional, IsEnum, IsArray, IsInt } from 'class-validator';

export class CreateArticleDto {
  @ApiProperty({
    description: 'Titre de l\'article',
    example: 'Introduction a NestJS',
    minLength: 3,
    maxLength: 200,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  titre: string;

  @ApiProperty({
    description: 'Contenu de l\'article en HTML ou Markdown',
    example: 'NestJS est un framework progressif pour Node.js...',
  })
  @IsString()
  @MinLength(10)
  contenu: string;

  @ApiPropertyOptional({
    description: 'Resume court de l\'article',
    example: 'Decouvrez NestJS, le framework Node.js inspire par Angular',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  resume?: string;

  @ApiPropertyOptional({
    description: 'Statut de l\'article',
    enum: ['brouillon', 'publie'],
    default: 'brouillon',
  })
  @IsEnum(['brouillon', 'publie'])
  @IsOptional()
  statut?: string;

  @ApiPropertyOptional({
    description: 'IDs des tags a associer',
    type: [Number],
    example: [1, 3, 5],
  })
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  tagIds?: number[];
}
```

```typescript
// dto/article-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class AuthorDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Alice Dupont' })
  nom: string;
}

class TagDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'NestJS' })
  nom: string;

  @ApiPropertyOptional({ example: '#E0234E' })
  couleur?: string;
}

export class ArticleResponseDto {
  @ApiProperty({ example: 1, description: 'ID unique de l\'article' })
  id: number;

  @ApiProperty({ example: 'Introduction a NestJS' })
  titre: string;

  @ApiProperty({ example: 'introduction-nestjs' })
  slug: string;

  @ApiProperty({ example: 'NestJS est un framework...' })
  contenu: string;

  @ApiPropertyOptional({ example: 'Decouvrez NestJS...' })
  resume?: string;

  @ApiProperty({ example: 'publie', enum: ['brouillon', 'publie', 'archive'] })
  statut: string;

  @ApiProperty({ example: 42 })
  nombreVues: number;

  @ApiProperty({ type: AuthorDto })
  auteur: AuthorDto;

  @ApiProperty({ type: [TagDto] })
  tags: TagDto[];

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-20T14:15:00.000Z' })
  updatedAt: Date;
}
```

### 2.6 Tableau des decorateurs Swagger

| Decorateur | Cible | Description |
|-----------|-------|-------------|
| `@ApiTags('nom')` | Controller | Groupe les routes sous un tag |
| `@ApiOperation({ summary })` | Méthode | Description de l'operation |
| `@ApiResponse({ status, description })` | Méthode | Reponse possible |
| `@ApiOkResponse()` | Méthode | Reponse 200 |
| `@ApiCreatedResponse()` | Méthode | Reponse 201 |
| `@ApiNotFoundResponse()` | Méthode | Reponse 404 |
| `@ApiBadRequestResponse()` | Méthode | Reponse 400 |
| `@ApiUnauthorizedResponse()` | Méthode | Reponse 401 |
| `@ApiForbiddenResponse()` | Méthode | Reponse 403 |
| `@ApiBearerAuth()` | Controller/Méthode | Authentification Bearer |
| `@ApiQuery({ name })` | Méthode | Paramètre de query string |
| `@ApiParam({ name })` | Méthode | Paramètre de route |
| `@ApiBody({ type })` | Méthode | Corps de la requête |
| `@ApiProperty()` | Propriété DTO | Propriété requise |
| `@ApiPropertyOptional()` | Propriété DTO | Propriété optionnelle |
| `@ApiExcludeEndpoint()` | Méthode | Exclut la route de Swagger |
| `@ApiExcludeController()` | Controller | Exclut le controller de Swagger |

### 2.7 Le plugin CLI pour la génération automatique

Au lieu de decorer manuellement chaque propriété avec `@ApiProperty()`, le plugin CLI de NestJS Swagger peut les générer automatiquement à partir des types TypeScript et des decorateurs class-validator.

```json
// nest-cli.json
{
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "plugins": [
      {
        "name": "@nestjs/swagger",
        "options": {
          "classValidatorShim": true,  // Lit les decorateurs class-validator
          "introspectComments": true,   // Utilise les commentaires JSDoc
          "dtoFileNameSuffix": [".dto.ts", ".entity.ts"],
          "controllerFileNameSuffix": ".controller.ts",
          "dtoKeyOfComment": "description",
          "controllerKeyOfComment": "summary"
        }
      }
    ]
  }
}
```

Avec le plugin active, ce DTO :

```typescript
export class CreateUserDto {
  /** Nom complet de l'utilisateur */
  @IsString()
  @MinLength(2)
  nom: string;

  /** Email de l'utilisateur */
  @IsEmail()
  email: string;

  /** Mot de passe (min 8 caracteres) */
  @IsString()
  @MinLength(8)
  motDePasse: string;

  /** Role (optionnel, defaut: user) */
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}
```

Genere automatiquement la documentation Swagger equivalente a ajouter `@ApiProperty()` sur chaque champ.

> **Bonne pratique** : Utilisez le plugin CLI pour les DTOs simples et ajoutez `@ApiProperty()` manuellement seulement quand vous avez besoin de personnaliser les exemples ou descriptions.

### 2.8 Exporter la spécification OpenAPI

```typescript
// main.ts (apres la creation du document)
import { writeFileSync } from 'fs';

const document = SwaggerModule.createDocument(app, config);

// Exporter en JSON
writeFileSync('./openapi.json', JSON.stringify(document, null, 2));

// Exporter en YAML
import * as yaml from 'yaml';
writeFileSync('./openapi.yaml', yaml.stringify(document));
```

Le fichier OpenAPI exporte peut etre importe dans :
- Postman
- Insomnia
- Des generateurs de SDK client
- Des outils de documentation comme ReadMe, Redoc, etc.

---

## 3. Patterns de configuration par environnement

### 3.1 Configuration multi-environnement

```
projet/
├── .env                  ← Defaut (developpement)
├── .env.staging          ← Staging
├── .env.production       ← Production (ne pas commiter !)
├── .env.test             ← Tests
├── .env.example          ← Exemple (a commiter)
```

```typescript
// app.module.ts
ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: [
    `.env.${process.env.NODE_ENV || 'development'}`,
    '.env',
  ],
})
```

### 3.2 Configuration par type

| Environnement | Swagger | Logging | Synchronize DB | Debug |
|--------------|---------|---------|----------------|-------|
| development | Oui | Verbose | Oui | Oui |
| staging | Oui | Info | Non | Non |
| production | Non | Warn/Error | Non | Non |
| test | Non | Error | Oui (SQLite) | Non |

```typescript
// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  // Swagger uniquement en dev et staging
  if (nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  console.log(`Application lancee sur le port ${port} (env: ${nodeEnv})`);
  if (nodeEnv !== 'production') {
    console.log(`Swagger : http://localhost:${port}/api/docs`);
  }
}
```

---

## 4. Exercices pratiques

### Exercice 1 : Configuration complete

Mettez en place une configuration avec :
1. Validation Joi de toutes les variables d'environnement
2. Trois namespaces (database, jwt, mail)
3. Fichiers .env pour dev et test

### Exercice 2 : Documentation Swagger

Documentez un CRUD complet de produits avec :
1. Tous les decorateurs Swagger sur le controller
2. DTOs avec @ApiProperty détaillés (exemples, descriptions)
3. Reponses d'erreur documentees
4. Authentification Bearer configuree

### Exercice 3 : Plugin CLI

Activez le plugin CLI Swagger et comparez avec la documentation manuelle. Quelles propriétés sont generees automatiquement ? Lesquelles necessitent toujours une configuration manuelle ?

---

## Liens

| Ressource | Lien |
|-----------|------|
| Quiz Module 20 | `quiz/20-quiz.md` |
| Lab Module 20 | `labs/20-lab-config-swagger.md` |
| Screencast | `screencasts/20-screencast.md` |
| Module précédent | [Module 19 — Authentification & Autorisation](19-nestjs-auth.md) |
| Module suivant | [Module 21 — WebSockets & Fichiers](21-nestjs-websockets-fichiers.md) |
| @nestjs/config | https://docs.nestjs.com/techniques/configuration |
| @nestjs/swagger | https://docs.nestjs.com/openapi/introduction |
| OpenAPI Specification | https://swagger.io/spécification/ |
| Joi | https://joi.dev/api/ |

---

<!-- parcours-recommande -->

::: tip Parcours recommandé
1. **Screencast** : [screencast 20 config swagger](../screencasts/screencast-20-config-swagger.md)
2. **Lab** : [lab-20-config-swagger](../labs/lab-20-config-swagger/README)
3. **Quiz** : [quiz 20 config swagger](../quizzes/quiz-20-config-swagger.html)
:::
