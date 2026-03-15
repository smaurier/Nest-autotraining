# Screencast 20 — Config & Swagger

## Informations
- **Duree estimee** : 15-18 min
- **Module** : `modules/20-nestjs-config-swagger.md`
- **Lab associe** : `labs/lab-20-config-swagger/`
- **Prérequis** : Screencast 19 (Auth NestJS)

## Setup
- [ ] Node.js 20+ installe
- [ ] Terminal ouvert dans `nest-course/`
- [ ] Projet NestJS avec auth configuree
- [ ] Editeur de code ouvert
- [ ] Port 3000 disponible

## Script

### [00:00-02:30] Introduction — Configuration et documentation

> Salut ! Aujourd'hui on couvre deux sujets essentiels pour la production : la gestion de la configuration avec ConfigModule, et la documentation API avec Swagger. Deux piliers pour une API professionnelle.

**Action** : Afficher le slide de titre "Module 20 — Config & Swagger".

> Jusqu'ici, on a code en dur les secrets, les ports, les URLs de base de donnees. En production, tout ça doit venir de variables d'environnement. ConfigModule géré ça proprement.

### [02:30-07:00] ConfigModule — Gestion de la configuration

**Action** : Installer et configurer le ConfigModule.

```bash
npm install @nestjs/config joi
```

**Action** : Créer le fichier .env et la validation.

```bash
# .env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nestcourse
JWT_SECRET=ma-cle-secrete-tres-longue-et-aleatoire
JWT_EXPIRATION=3600
```

```typescript
// src/config/env.validation.ts
import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().required().min(20),
  JWT_EXPIRATION: Joi.number().default(3600),
});
```

**Action** : Configurer dans AppModule.

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { envValidationSchema } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      envFilePath: [`.env.${process.env.NODE_ENV}`, '.env'],
    }),
    // ...autres modules
  ],
})
export class AppModule {}
```

**Action** : Utiliser ConfigService dans les autres modules.

```typescript
// src/auth/auth.module.ts
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: `${config.get('JWT_EXPIRATION')}s` },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AuthModule {}
```

```typescript
// src/main.ts
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.get('PORT');

  await app.listen(port);
  console.log(`Serveur sur http://localhost:${port}`);
}
```

> ConfigService injecte les variables d'environnement de manière type-safe. La validation Joi s'assure que toutes les variables requises sont presentes au démarrage. Si une variable manque, l'application refuse de démarrer.

**Action** : Tester en supprimant une variable requise.

```bash
# Supprimer JWT_SECRET du .env et relancer
npm run start:dev
```

> Vous voyez l'erreur ? "JWT_SECRET is required". L'application refuse de démarrer sans configuration complete. C'est exactement ce qu'on veut en production.

### [07:00-13:00] Swagger — Documentation API automatique

**Action** : Installer Swagger.

```bash
npm install @nestjs/swagger
```

**Action** : Configurer Swagger dans main.ts.

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle('Task API')
    .setDescription('API de gestion de taches - Formation NestJS')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentification et autorisation')
    .addTag('tasks', 'Gestion des taches')
    .addTag('users', 'Gestion des utilisateurs')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(3000);
  console.log('Swagger UI : http://localhost:3000/api/docs');
}
bootstrap();
```

> Swagger généré une documentation interactive à partir de votre code. Mais pour qu'elle soit vraiment utile, il faut ajouter des decorateurs sur les DTOs et les controllers.

**Action** : Enrichir les DTOs avec les decorateurs Swagger.

```typescript
// src/tasks/dto/create-task.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class CreateTaskDto {
  @ApiProperty({ example: 'Implementer le CRUD', description: 'Titre de la tache' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'Utiliser Prisma pour le CRUD complet' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: ['low', 'medium', 'high'], default: 'medium' })
  @IsEnum(['low', 'medium', 'high'])
  @IsOptional()
  priority?: string;
}
```

**Action** : Enrichir le controller avec les decorateurs Swagger.

```typescript
// src/tasks/tasks.controller.ts
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  @Post()
  @ApiOperation({ summary: 'Creer une tache' })
  @ApiResponse({ status: 201, description: 'Tache creee avec succes' })
  @ApiResponse({ status: 400, description: 'Donnees invalides' })
  @ApiResponse({ status: 401, description: 'Non authentifie' })
  create(@Body() dto: CreateTaskDto) {
    return this.tasksService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les taches' })
  @ApiResponse({ status: 200, description: 'Liste des taches' })
  findAll() {
    return this.tasksService.findAll();
  }
}
```

**Action** : Ouvrir Swagger UI dans le navigateur.

```bash
# Ouvrir http://localhost:3000/api/docs
```

> Swagger UI affiche toutes les routes, les schemas de requête et de réponse, et permet de tester les endpoints directement depuis le navigateur. Cliquez sur "Try it out", remplissez les champs, et "Execute". C'est comme Postman intégré a votre documentation.

### [13:00-16:00] Swagger avance — Auth et schemas

**Action** : Tester l'authentification via Swagger.

> Cliquez sur le bouton "Authorize" en haut. Collez votre token JWT. Maintenant toutes les requêtes incluront le header Authorization automatiquement.

**Action** : Ajouter un schema de réponse.

```typescript
// src/tasks/dto/task-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class TaskResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Ma tache' })
  title: string;

  @ApiProperty({ example: false })
  done: boolean;

  @ApiProperty({ example: '2024-01-15T10:30:00Z' })
  createdAt: Date;
}
```

> Les schemas de réponse apparaissent dans la documentation. Les développeurs frontend peuvent voir exactement ce que l'API renvoie sans lire le code backend.

### [16:00-17:30] Recap

> ConfigModule géré la configuration via les variables d'environnement avec validation. Swagger généré une documentation interactive automatiquement. Les decorateurs enrichissent la documentation avec des exemples et des descriptions.

**Action** : Afficher le slide recap.

> Le lab est dans `labs/lab-20-config-swagger/`. Vous allez configurer ConfigModule, ajouter Swagger et documenter toute votre API. Au prochain screencast, les WebSockets et l'upload de fichiers !

## Points d'attention pour l'enregistrement
- Montrer Swagger UI de manière impressionnante — agrandir le navigateur
- Faire un "Try it out" en direct pour montrer l'interactivite
- Le .env ne doit jamais etre commit — montrer le .env.example
- Insister sur la validation Joi qui protege contre les erreurs de configuration
