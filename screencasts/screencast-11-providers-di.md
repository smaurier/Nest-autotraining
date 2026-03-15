# Screencast 11 — Providers & DI

## Informations
- **Duree estimee** : 15-18 min
- **Module** : `modules/11-nestjs-providers-di.md`
- **Lab associe** : `labs/lab-11-providers-di/`
- **Prérequis** : Screencast 10 (Controllers & Routing)

## Setup
- [ ] Node.js 20+ installe
- [ ] Terminal ouvert dans `nest-course/`
- [ ] Projet NestJS du screencast précédent disponible
- [ ] Editeur de code ouvert
- [ ] Port 3000 disponible

## Script

### [00:00-03:00] Introduction — L'injection de dépendances

> Salut ! Aujourd'hui on va comprendre en profondeur le système de providers et d'injection de dépendances de NestJS. C'est le coeur du framework, ce qui rend le code testable, modulaire et maintenable.

**Action** : Afficher le slide de titre "Module 11 — Providers & DI".

> L'injection de dépendances, c'est un pattern ou les objets ne creent pas eux-memes leurs dépendances. Au lieu de ça, ils les recoivent de l'exterieur. NestJS géré ça automatiquement grace au container DI.

> Quand vous ecrivez `constructor(private readonly tasksService: TasksService)` dans un controller, NestJS créé automatiquement une instance de TasksService et la fournit au controller. Vous n'avez jamais écrit `new TasksService()`. C'est ça, l'injection de dépendances.

### [03:00-07:00] Services — Les providers de base

> Un provider, c'est n'importe quelle classe decoree avec `@Injectable()`. Le service est le type de provider le plus courant.

**Action** : Créer un service avec des dépendances.

```typescript
// src/tasks/tasks.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);
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
    this.logger.log(`Tache creee: ${task.title}`);
    return task;
  }

  findAll(filters?: { status?: string }) {
    let result = this.tasks;
    if (filters?.status === 'done') {
      result = result.filter(t => t.done);
    }
    return result;
  }

  findOne(id: number) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) throw new NotFoundException(`Task #${id} non trouvee`);
    return task;
  }

  update(id: number, updateTaskDto: UpdateTaskDto) {
    const task = this.findOne(id);
    Object.assign(task, updateTaskDto);
    this.logger.log(`Tache modifiee: #${id}`);
    return task;
  }

  remove(id: number) {
    const index = this.tasks.findIndex(t => t.id === id);
    if (index === -1) throw new NotFoundException(`Task #${id} non trouvee`);
    this.tasks.splice(index, 1);
    this.logger.log(`Tache supprimee: #${id}`);
  }
}
```

> Le decorateur `@Injectable()` dit a NestJS que cette classe peut etre injectee. Le Logger est un provider built-in de NestJS. Tout est un provider.

### [07:00-11:00] Custom providers — Factory et Value

> Parfois, un simple `@Injectable()` ne suffit pas. On a besoin de providers personnalises : par valeur, par factory, ou par classe.

**Action** : Créer différents types de providers.

```typescript
// src/tasks/tasks.module.ts
import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

// Provider par valeur
const CONFIG_OPTIONS = {
  provide: 'TASK_CONFIG',
  useValue: {
    maxTasks: 100,
    defaultPriority: 'medium',
  },
};

// Provider par factory
const TASK_REPOSITORY = {
  provide: 'TASK_REPOSITORY',
  useFactory: () => {
    console.log('Initialisation du repository...');
    return {
      storage: new Map(),
      save: (task) => { /* ... */ },
    };
  },
};

// Provider par factory avec dependances
const TASK_LOGGER = {
  provide: 'TASK_LOGGER',
  useFactory: (config: any) => {
    return {
      log: (msg: string) => console.log(`[Tasks][${config.defaultPriority}] ${msg}`),
    };
  },
  inject: ['TASK_CONFIG'],
};

@Module({
  controllers: [TasksController],
  providers: [
    TasksService,
    CONFIG_OPTIONS,
    TASK_REPOSITORY,
    TASK_LOGGER,
  ],
})
export class TasksModule {}
```

**Action** : Injecter les custom providers dans le service.

```typescript
// src/tasks/tasks.service.ts
import { Injectable, Inject } from '@nestjs/common';

@Injectable()
export class TasksService {
  constructor(
    @Inject('TASK_CONFIG') private config: any,
    @Inject('TASK_LOGGER') private taskLogger: any,
  ) {
    console.log('Config:', this.config);
  }

  create(createTaskDto: CreateTaskDto) {
    if (this.tasks.length >= this.config.maxTasks) {
      throw new Error('Limite de taches atteinte');
    }
    // ...
    this.taskLogger.log(`Tache creee: ${createTaskDto.title}`);
    return task;
  }
}
```

> Les custom providers sont essentiels pour intégrer des librairies externes, des configurations, ou des abstractions. Le token `'TASK_CONFIG'` est une clé que NestJS utilise pour résoudre la dépendance.

### [11:00-14:00] Le container DI — Comment ça marche

> Voyons comment NestJS resout les dépendances en coulisses.

**Action** : Afficher un schema du container DI.

> Quand NestJS demarre, il scanne tous les modules, collecte tous les providers, et construit un graphe de dépendances. Quand un controller a besoin d'un service, NestJS regarde le graphe, créé l'instance si elle n'existe pas encore, et l'injecte.

> Par defaut, les providers sont des singletons. Une seule instance est créée et partagee partout. Si le TasksService est injecte dans deux controllers, ils recoivent la même instance.

**Action** : Demontrer le scope des providers.

```typescript
// Singleton (defaut)
@Injectable()
export class TasksService {}

// Request scope - nouvelle instance par requete
@Injectable({ scope: Scope.REQUEST })
export class RequestScopedService {}

// Transient scope - nouvelle instance a chaque injection
@Injectable({ scope: Scope.TRANSIENT })
export class TransientService {}
```

> En pratique, utilisez presque toujours le scope par defaut (singleton). Le scope REQUEST est utile pour des cas spécifiques comme le multi-tenancy. Le scope TRANSIENT est rare.

### [14:00-16:30] Recap

> L'injection de dépendances est la colonne vertebrale de NestJS. Les providers sont des classes injectables. On peut les définir par valeur, par factory, ou par classe. Le container DI géré leur cycle de vie et les resout automatiquement.

**Action** : Afficher le slide recap.

> Ce pattern rend le code testable : dans les tests, on peut remplacer un vrai service par un mock. On verra ça en detail dans le screencast sur le testing. Le lab est dans `labs/lab-11-providers-di/`. Vous allez créer des services avec des dépendances, des custom providers et explorer le container DI.

## Points d'attention pour l'enregistrement
- Bien expliquer le concept de DI avant de montrer le code NestJS
- Insister sur le fait que les providers sont des singletons par defaut
- Montrer comment NestJS resout les dépendances circulaires avec forwardRef
- Faire le lien entre custom providers et l'intégration de librairies externes
