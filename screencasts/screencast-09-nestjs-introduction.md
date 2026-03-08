# Screencast 09 — NestJS Introduction

## Informations
- **Duree estimee** : 15-20 min
- **Module** : `modules/09-nestjs-introduction.md`
- **Lab associe** : `labs/lab-09-nestjs-premiers-pas/`
- **Prerequis** : Screencast 08 (Auth & Securite), connaissances TypeScript basiques

## Setup
- [ ] Node.js 20+ installe
- [ ] Terminal ouvert dans `nest-course/`
- [ ] Editeur de code ouvert
- [ ] NestJS CLI installe (`npm i -g @nestjs/cli`)
- [ ] Port 3000 disponible

## Script

### [00:00-03:00] Introduction — Pourquoi NestJS ?

> Salut ! On a passe huit screencasts a construire des APIs avec Node.js natif et Express. On a vu les limites : pas de structure imposee, pas de typage, pas d'injection de dependances. NestJS resout tous ces problemes.

**Action** : Afficher le slide de titre "Module 09 — NestJS Introduction".

> NestJS est un framework Node.js qui utilise TypeScript et s'inspire d'Angular. Il impose une architecture solide avec des decorateurs, des modules, des controllers et des providers. C'est le framework le plus populaire pour les APIs enterprise en Node.js.

**Action** : Installer le CLI NestJS.

```bash
npm i -g @nestjs/cli
nest --version
```

### [03:00-07:00] Creer un projet NestJS

> On va creer notre premier projet NestJS avec le CLI.

**Action** : Generer un nouveau projet.

```bash
nest new task-api
cd task-api
```

> Le CLI genere une structure complete. Regardons ce qu'il y a dedans.

**Action** : Explorer la structure dans l'editeur.

```bash
ls -la src/
```

```typescript
// src/main.ts — Point d'entree
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
```

```typescript
// src/app.module.ts — Module racine
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

```typescript
// src/app.controller.ts — Controller
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
```

> Vous voyez les decorateurs ? `@Module`, `@Controller`, `@Get`. C'est la signature de NestJS. Les decorateurs decrivent le role de chaque classe. Et le constructeur du controller recoit le service automatiquement — c'est l'injection de dependances.

**Action** : Lancer le serveur.

```bash
npm run start:dev
```

```bash
curl http://localhost:3000
```

> `start:dev` lance le serveur en mode watch : chaque modification du code redemarre automatiquement.

### [07:00-12:00] Generer une ressource CRUD

> Le CLI NestJS peut generer une ressource complete en une commande. C'est la ou ca devient magique.

**Action** : Generer la ressource tasks.

```bash
nest g resource tasks
```

> Choisissez "REST API" et "Yes" pour les CRUD entry points. Le CLI a genere un controller, un service, un module, des DTOs et des entites. Tout est cable automatiquement.

**Action** : Explorer les fichiers generes.

```typescript
// src/tasks/tasks.controller.ts
import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(@Body() createTaskDto: CreateTaskDto) {
    return this.tasksService.create(createTaskDto);
  }

  @Get()
  findAll() {
    return this.tasksService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTaskDto: UpdateTaskDto) {
    return this.tasksService.update(+id, updateTaskDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tasksService.remove(+id);
  }
}
```

> Comparez avec Express : plus de `app.get()`, plus de `req.params`. Chaque route est une methode decoree. `@Get()`, `@Post()`, `@Param('id')`, `@Body()`. C'est declaratif, typesafe, et auto-documente.

### [12:00-16:00] Implementer la logique metier

> Le service genere a des methodes vides. Implementons-les.

**Action** : Completer le service.

```typescript
// src/tasks/tasks.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  private tasks = [];
  private nextId = 1;

  create(createTaskDto: CreateTaskDto) {
    const task = {
      id: this.nextId++,
      ...createTaskDto,
      done: false,
      createdAt: new Date(),
    };
    this.tasks.push(task);
    return task;
  }

  findAll() {
    return this.tasks;
  }

  findOne(id: number) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) throw new NotFoundException(`Task #${id} non trouvee`);
    return task;
  }

  update(id: number, updateTaskDto: UpdateTaskDto) {
    const task = this.findOne(id);
    Object.assign(task, updateTaskDto);
    return task;
  }

  remove(id: number) {
    const index = this.tasks.findIndex(t => t.id === id);
    if (index === -1) throw new NotFoundException(`Task #${id} non trouvee`);
    this.tasks.splice(index, 1);
  }
}
```

**Action** : Tester l'API.

```bash
# Creer une tache
curl -X POST -H "Content-Type: application/json" \
  -d '{"title":"Apprendre NestJS","description":"Suivre la formation"}' \
  http://localhost:3000/tasks

# Lister
curl http://localhost:3000/tasks

# Obtenir une tache
curl http://localhost:3000/tasks/1

# Modifier
curl -X PATCH -H "Content-Type: application/json" \
  -d '{"done":true}' \
  http://localhost:3000/tasks/1

# Supprimer
curl -X DELETE http://localhost:3000/tasks/1
```

> NestJS gere automatiquement les exceptions. `NotFoundException` renvoie un 404 avec un message JSON propre. Pas besoin de middleware d'erreur comme avec Express.

### [16:00-18:30] Recap — NestJS vs Express

> Resumons la difference. Avec Express, on construit tout a la main : routing, validation, erreurs, structure. Avec NestJS, on a une architecture imposee, des decorateurs pour tout decrire, l'injection de dependances pour les services, et la gestion d'erreurs integree.

**Action** : Afficher le slide comparatif.

> NestJS n'est pas "mieux" qu'Express, il est "au-dessus" d'Express. Sous le capot, NestJS utilise Express (ou Fastify) comme couche HTTP. Il ajoute la structure, le typage et l'architecture.

> Le lab est dans `labs/lab-09-nestjs-premiers-pas/`. Vous allez creer votre premier projet NestJS et generer une API CRUD complete. C'est le debut de l'aventure NestJS, et on va approfondir chaque concept dans les screencasts suivants !

## Points d'attention pour l'enregistrement
- S'assurer que le CLI NestJS est installe globalement avant de commencer
- Prendre le temps de montrer chaque fichier genere par `nest g resource`
- Insister sur les decorateurs — c'est le concept central de NestJS
- Faire le parallele explicite avec les patterns Express vus precedemment
