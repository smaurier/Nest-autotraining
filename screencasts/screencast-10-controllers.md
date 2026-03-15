# Screencast 10 — Controllers & Routing

## Informations
- **Duree estimee** : 12-15 min
- **Module** : `modules/10-nestjs-controllers.md`
- **Lab associe** : `labs/lab-10-controllers-dto/`
- **Prérequis** : Screencast 09 (NestJS Introduction)

## Setup
- [ ] Node.js 20+ installe
- [ ] Terminal ouvert dans `nest-course/`
- [ ] Projet NestJS du screencast 09 disponible
- [ ] Editeur de code ouvert
- [ ] Port 3000 disponible

## Script

### [00:00-02:30] Introduction — Le controller en detail

> Salut ! Dans le screencast précédent, on a decouvert NestJS et généré notre premier CRUD. Aujourd'hui on va approfondir les controllers : routing avance, DTOs, class-validator, et gestion fine des requêtes et réponses.

**Action** : Afficher le slide de titre "Module 10 — Controllers & Routing".

> Le controller est le point d'entree HTTP de votre API. Il recoit les requêtes, délégué le travail au service, et renvoie les réponses. NestJS utilise des decorateurs pour decrire chaque aspect du controller.

### [02:30-06:00] Decorateurs de routing avances

**Action** : Ouvrir le projet NestJS et modifier le controller tasks.

```typescript
// src/tasks/tasks.controller.ts
import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, Headers, Ip,
  HttpCode, HttpStatus, Header,
  ParseIntPipe,
} from '@nestjs/common';
import { TasksService } from './tasks.service';

@Controller('api/v1/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @Header('Cache-Control', 'no-cache')
  findAll(
    @Query('status') status?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.tasksService.findAll({ status, page, limit });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.tasksService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createTaskDto: CreateTaskDto, @Ip() ip: string) {
    console.log(`Creation depuis IP: ${ip}`);
    return this.tasksService.create(createTaskDto);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTaskDto: UpdateTaskDto,
  ) {
    return this.tasksService.update(id, updateTaskDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tasksService.remove(id);
  }
}
```

> `ParseIntPipe` convertit automatiquement le paramètre string en nombre. `@Query` recupe les query parameters. `@HttpCode` définit le code de statut. `@Header` ajoute un header de réponse. Tout est declaratif.

**Action** : Tester les routes.

```bash
curl http://localhost:3000/api/v1/tasks
curl "http://localhost:3000/api/v1/tasks?status=done&page=1&limit=10"
curl http://localhost:3000/api/v1/tasks/1
```

### [06:00-10:00] DTOs et class-validator

> Les DTOs (Data Transfer Objects) definissent la forme des donnees entrantes. Avec class-validator, on ajoute la validation directement sur les propriétés.

**Action** : Installer class-validator et class-transformer.

```bash
npm install class-validator class-transformer
```

**Action** : Créer les DTOs avec validation.

```typescript
// src/tasks/dto/create-task.dto.ts
import { IsString, IsNotEmpty, IsOptional, MinLength, MaxLength, IsEnum } from 'class-validator';

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty({ message: 'Le titre est requis' })
  @MinLength(3, { message: 'Minimum 3 caracteres' })
  @MaxLength(100, { message: 'Maximum 100 caracteres' })
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority = TaskPriority.MEDIUM;
}
```

```typescript
// src/tasks/dto/update-task.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateTaskDto } from './create-task.dto';

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @IsBoolean()
  @IsOptional()
  done?: boolean;
}
```

**Action** : Activer le ValidationPipe global dans main.ts.

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  await app.listen(3000);
}
bootstrap();
```

**Action** : Tester la validation.

```bash
# Valide
curl -X POST -H "Content-Type: application/json" \
  -d '{"title":"Ma tache","priority":"high"}' \
  http://localhost:3000/api/v1/tasks

# Titre trop court
curl -X POST -H "Content-Type: application/json" \
  -d '{"title":"AB"}' \
  http://localhost:3000/api/v1/tasks

# Propriete interdite
curl -X POST -H "Content-Type: application/json" \
  -d '{"title":"Test","hack":"injection"}' \
  http://localhost:3000/api/v1/tasks
```

> `whitelist: true` supprime les propriétés non declarees dans le DTO. `forbidNonWhitelisted: true` renvoie une erreur si une propriété non declaree est envoyee. C'est une protection contre l'injection de donnees.

### [10:00-13:00] Routes imbriquees et sous-ressources

> On peut créer des routes imbriquees pour modeliser les relations entre ressources.

**Action** : Créer un controller pour les commentaires d'une tache.

```typescript
// src/tasks/comments.controller.ts
import { Controller, Get, Post, Body, Param, ParseIntPipe } from '@nestjs/common';

@Controller('api/v1/tasks/:taskId/comments')
export class CommentsController {
  @Get()
  findAll(@Param('taskId', ParseIntPipe) taskId: number) {
    return { taskId, comments: [] };
  }

  @Post()
  create(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body('text') text: string,
  ) {
    return { taskId, text, createdAt: new Date() };
  }
}
```

**Action** : Tester les routes imbriquees.

```bash
curl http://localhost:3000/api/v1/tasks/1/comments
curl -X POST -H "Content-Type: application/json" \
  -d '{"text":"Super tache !"}' \
  http://localhost:3000/api/v1/tasks/1/comments
```

> Les routes imbriquees refletent la hiérarchie des ressources. `GET /tasks/1/comments` liste les commentaires de la tache 1. C'est du REST propre.

### [13:00-14:30] Recap

> Les controllers NestJS utilisent des decorateurs pour tout decrire : routes, paramètres, codes de statut. Les DTOs avec class-validator gerent la validation de manière declarative. Et le ValidationPipe global applique ces regles automatiquement.

**Action** : Afficher le slide recap.

> Le lab est dans `labs/lab-10-controllers-dto/`. Vous allez créer des controllers avec DTOs valides, des routes imbriquees et du filtrage par query parameters. A bientot pour les providers et l'injection de dépendances !

## Points d'attention pour l'enregistrement
- Montrer les messages d'erreur de validation — ils sont clairs et structures
- Insister sur whitelist et forbidNonWhitelisted pour la sécurité
- Bien montrer PartialType qui rend toutes les propriétés optionnelles
- Le lien avec Zod vu precedemment : class-validator est l'équivalent NestJS
