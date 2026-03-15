# Screencast 12 — Modules & Architecture

## Informations
- **Duree estimee** : 12-15 min
- **Module** : `modules/12-nestjs-modules.md`
- **Lab associe** : `labs/lab-12-modules-architecture/`
- **Prérequis** : Screencast 11 (Providers & DI)

## Setup
- [ ] Node.js 20+ installe
- [ ] Terminal ouvert dans `nest-course/`
- [ ] Projet NestJS du screencast précédent disponible
- [ ] Editeur de code ouvert
- [ ] Port 3000 disponible

## Script

### [00:00-02:30] Introduction — Les modules NestJS

> Salut ! On a vu les controllers et les providers. Aujourd'hui on va voir comment tout ça s'organise avec les modules. Les modules, c'est le système d'organisation de NestJS. Chaque fonctionnalite a son module.

**Action** : Afficher le slide de titre "Module 12 — Modules & Architecture".

> Un module NestJS, c'est une classe decoree avec `@Module()`. Il declare ses controllers, ses providers, ses imports (les modules dont il depend) et ses exports (les providers qu'il partage).

### [02:30-06:00] Multi-module — Structurer l'application

> On va construire une application avec plusieurs modules qui collaborent.

**Action** : Générer les modules avec le CLI.

```bash
nest g module users
nest g controller users
nest g service users
nest g module notifications
nest g service notifications
```

**Action** : Implementer le module users.

```typescript
// src/users/users.module.ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // Rend UsersService disponible pour les autres modules
})
export class UsersModule {}
```

```typescript
// src/users/users.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class UsersService {
  private users = [
    { id: 1, name: 'Alice', email: 'alice@test.com' },
    { id: 2, name: 'Bob', email: 'bob@test.com' },
  ];

  findAll() {
    return this.users;
  }

  findOne(id: number) {
    const user = this.users.find(u => u.id === id);
    if (!user) throw new NotFoundException(`User #${id} non trouve`);
    return user;
  }

  findByEmail(email: string) {
    return this.users.find(u => u.email === email);
  }
}
```

**Action** : Implementer le module notifications qui depend de users.

```typescript
// src/notifications/notifications.module.ts
import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule], // Importe le module users
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
```

```typescript
// src/notifications/notifications.service.ts
import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly usersService: UsersService) {}

  sendNotification(userId: number, message: string) {
    const user = this.usersService.findOne(userId);
    console.log(`[NOTIFICATION] A: ${user.email} - ${message}`);
    return { sent: true, to: user.email, message };
  }
}
```

> Le module Notifications importe le module Users. Grâce à l'export de UsersService dans UsersModule, il peut l'injecter dans NotificationsService. C'est l'encapsulation des modules.

### [06:00-09:00] Module partage — Shared module

> Certains services sont utilises partout dans l'application. On les met dans un module partage.

**Action** : Créer un module partage.

```bash
nest g module shared
nest g service shared/logger
```

```typescript
// src/shared/shared.module.ts
import { Module, Global } from '@nestjs/common';
import { LoggerService } from './logger/logger.service';

@Global() // Disponible partout sans import explicite
@Module({
  providers: [LoggerService],
  exports: [LoggerService],
})
export class SharedModule {}
```

```typescript
// src/shared/logger/logger.service.ts
import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';

@Injectable()
export class LoggerService {
  log(context: string, message: string) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${context}] ${message}`);
  }

  error(context: string, message: string, trace?: string) {
    console.error(`[ERROR] [${context}] ${message}`);
    if (trace) console.error(trace);
  }

  warn(context: string, message: string) {
    console.warn(`[WARN] [${context}] ${message}`);
  }
}
```

> Le decorateur `@Global()` rend le module disponible partout sans avoir besoin de l'importer explicitement. A utiliser avec moderation — la plupart des modules doivent etre importes explicitement pour garder les dépendances claires.

**Action** : Utiliser le LoggerService dans un autre service.

```typescript
// src/tasks/tasks.service.ts
import { Injectable } from '@nestjs/common';
import { LoggerService } from '../shared/logger/logger.service';

@Injectable()
export class TasksService {
  constructor(private readonly logger: LoggerService) {}

  create(createTaskDto: CreateTaskDto) {
    // ...
    this.logger.log('TasksService', `Tache creee: ${createTaskDto.title}`);
    return task;
  }
}
```

### [09:00-12:00] Module dynamique — Configuration

> Les modules dynamiques sont crees avec une méthode statique qui accepte des options de configuration.

**Action** : Créer un module dynamique.

```typescript
// src/database/database.module.ts
import { Module, DynamicModule } from '@nestjs/common';

@Module({})
export class DatabaseModule {
  static forRoot(options: { host: string; port: number; database: string }): DynamicModule {
    const connectionProvider = {
      provide: 'DATABASE_CONNECTION',
      useFactory: () => {
        console.log(`Connexion a ${options.host}:${options.port}/${options.database}`);
        return {
          query: (sql: string) => console.log(`SQL: ${sql}`),
          close: () => console.log('Connexion fermee'),
        };
      },
    };

    return {
      module: DatabaseModule,
      providers: [connectionProvider],
      exports: [connectionProvider],
      global: true,
    };
  }
}
```

**Action** : Utiliser le module dynamique dans AppModule.

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [
    DatabaseModule.forRoot({
      host: 'localhost',
      port: 5432,
      database: 'taskdb',
    }),
    SharedModule,
    TasksModule,
    UsersModule,
  ],
})
export class AppModule {}
```

> Le pattern `forRoot` est utilise par tous les modules NestJS de configuration : TypeOrmModule.forRoot(), ConfigModule.forRoot(), etc. C'est un pattern fondamental.

### [12:00-14:00] Recap

> Les modules encapsulent les fonctionnalites. Ils declarent leurs controllers, providers, imports et exports. Les modules globaux sont disponibles partout. Les modules dynamiques acceptent des options de configuration.

**Action** : Afficher le schema de l'architecture multi-module.

> Le lab est dans `labs/lab-12-modules-architecture/`. Vous allez construire une application multi-module avec des modules partages et dynamiques. C'est la base de toute application NestJS serieuse. Au prochain screencast, on attaque les pipes, guards et interceptors !

## Points d'attention pour l'enregistrement
- Montrer clairement le graphe de dépendances entre les modules
- Insister sur le fait que sans export, un provider est prive au module
- Montrer l'erreur quand on essaie d'injecter un provider non exporte
- Le pattern forRoot/forRootAsync est essentiel pour la suite de la formation
