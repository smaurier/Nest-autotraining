# Module 12 — NestJS — Modules & Architecture

> **Objectif** : Maîtriser l'architecture modulaire de NestJS — modules feature, modules partages, modules globaux, modules dynamiques (forRoot/forRootAsync/forFeature), et concevoir une architecture d'application réelle, maintenable et evolutive.
>
> **Difficulte** : ⭐⭐⭐ (avance)

---

## 1. Le decorateur @Module

### 1.1 Anatomie d'un module

Un module NestJS est une classe decoree avec `@Module()` qui organise un ensemble de composants lies :

```typescript
import { Module } from '@nestjs/common';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';

@Module({
  imports: [],              // Modules dont on a besoin
  controllers: [BooksController], // Controllers de ce module
  providers: [BooksService],      // Providers (services) de ce module
  exports: [BooksService],        // Providers accessibles aux autres modules
})
export class BooksModule {}
```

| Propriété | Role | Analogie |
|---|---|---|
| `imports` | Modules dont ce module depend | Les fournisseurs externes |
| `controllers` | Classes qui gerent les routes HTTP | Les employes en contact avec le client |
| `providers` | Services, repositories, factories | Les employes internes |
| `exports` | Providers partages avec les modules importateurs | Les produits vendus a l'exterieur |

> **Analogie** : Un module NestJS, c'est comme un departement dans une entreprise. Il a ses employes (providers), ses points de contact avec l'exterieur (controllers), ses fournisseurs (imports), et il peut vendre des services aux autres departements (exports). Chaque departement est autonome mais collabore avec les autres.

### 1.2 Encapsulation par defaut

Par defaut, les providers d'un module sont **prives** — ils ne sont accessibles qu'a l'interieur du module. Pour les rendre disponibles a d'autres modules, tu dois les **exporter** :

```typescript
// users.module.ts
@Module({
  providers: [UsersService],
  exports: [UsersService], // ← Rend UsersService accessible aux importateurs
})
export class UsersModule {}

// orders.module.ts
@Module({
  imports: [UsersModule], // ← Importe le module pour acceder a UsersService
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}

// orders.service.ts
@Injectable()
export class OrdersService {
  // UsersService est disponible car OrdersModule importe UsersModule
  // et UsersModule exporte UsersService
  constructor(private readonly usersService: UsersService) {}
}
```

> **Piege classique** : Si tu importes un module mais que le provider dont tu as besoin n'est PAS dans `exports`, tu obtiendras une erreur au démarrage : `Nest can't resolve dependencies`. Verifie toujours que le provider est exporte.

---

## 2. Feature Modules

### 2.1 Qu'est-ce qu'un feature module

Un **feature module** regroupe tout le code lie à une fonctionnalite metier. C'est l'unite d'organisation principale de NestJS.

```
src/
├── app.module.ts            ← Module racine (importe les feature modules)
├── books/
│   ├── books.module.ts      ← Feature module "Books"
│   ├── books.controller.ts
│   ├── books.service.ts
│   ├── dto/
│   │   ├── create-book.dto.ts
│   │   └── update-book.dto.ts
│   └── entities/
│       └── book.entity.ts
├── users/
│   ├── users.module.ts      ← Feature module "Users"
│   ├── users.controller.ts
│   ├── users.service.ts
│   └── dto/
│       └── create-user.dto.ts
└── auth/
    ├── auth.module.ts       ← Feature module "Auth"
    ├── auth.controller.ts
    ├── auth.service.ts
    └── guards/
        └── jwt-auth.guard.ts
```

### 2.2 Le module racine (AppModule)

Le module racine importe tous les feature modules :

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { BooksModule } from './books/books.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    BooksModule,
    UsersModule,
    AuthModule,
  ],
})
export class AppModule {}
```

> **Bonne pratique** : Le module racine devrait etre le plus leger possible. Il importe les feature modules et eventuellement configure les modules globaux (ConfigModule, DatabaseModule). Il ne devrait PAS contenir de controllers ou de services propres.

---

## 3. Shared Modules (modules partages)

### 3.1 Le concept

Un **shared module** contient des providers réutilisables par plusieurs feature modules. Il est importe la ou il est nécessaire.

```typescript
// common/common.module.ts
import { Module } from '@nestjs/common';
import { LoggerService } from './logger.service';
import { DateService } from './date.service';
import { SlugService } from './slug.service';

@Module({
  providers: [LoggerService, DateService, SlugService],
  exports: [LoggerService, DateService, SlugService], // Tout est exporte
})
export class CommonModule {}
```

```typescript
// Chaque feature module qui en a besoin l'importe
@Module({
  imports: [CommonModule], // ← Acces a LoggerService, DateService, SlugService
  controllers: [BooksController],
  providers: [BooksService],
})
export class BooksModule {}

@Module({
  imports: [CommonModule], // ← Meme chose ici
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
```

### 3.2 Singleton garanti

Même si `CommonModule` est importe dans 5 modules différents, les providers restent des **singletons**. NestJS ne créé qu'une seule instance de `LoggerService`, partagee par tous les consommateurs.

```
  AppModule
  ├── BooksModule
  │   └── imports: [CommonModule]  ← meme instance de LoggerService
  ├── UsersModule
  │   └── imports: [CommonModule]  ← meme instance de LoggerService
  └── AuthModule
      └── imports: [CommonModule]  ← meme instance de LoggerService
```

---

## 4. Le decorateur @Global

### 4.1 Modules globaux

Un module decore avec `@Global()` rend ses exports disponibles **partout** sans avoir besoin de l'importer explicitement :

```typescript
import { Global, Module } from '@nestjs/common';
import { LoggerService } from './logger.service';
import { ConfigService } from './config.service';

@Global()
@Module({
  providers: [LoggerService, ConfigService],
  exports: [LoggerService, ConfigService],
})
export class CoreModule {}
```

```typescript
// app.module.ts — Il suffit de l'importer UNE SEULE fois dans le module racine
@Module({
  imports: [CoreModule, BooksModule, UsersModule],
})
export class AppModule {}

// books.service.ts — Pas besoin d'importer CoreModule dans BooksModule !
@Injectable()
export class BooksService {
  constructor(
    private readonly logger: LoggerService,    // Disponible globalement
    private readonly config: ConfigService,    // Disponible globalement
  ) {}
}
```

> **Piege classique** : N'abuse PAS de `@Global()`. Si tout est global, tu perds l'avantage de l'encapsulation modulaire. Seuls les modules vraiment transversaux (config, logger, database) meritent d'etre globaux. Les feature modules ne doivent JAMAIS etre globaux.

| Module | Global ? | Justification |
|---|---|---|
| ConfigModule | Oui | Utilise partout |
| LoggerModule | Oui | Utilise partout |
| DatabaseModule | Oui | Utilise par la plupart des services |
| BooksModule | Non | Feature spécifique |
| AuthModule | Non | Feature spécifique |
| UsersModule | Non | Feature spécifique |

---

## 5. Modules dynamiques

### 5.1 Qu'est-ce qu'un module dynamique

Un **module dynamique** est un module dont la configuration est parametrable au moment de l'import. Au lieu d'un `@Module()` statique, il expose des méthodes statiques (`forRoot`, `forFeature`, `register`) qui retournent un module configure.

> **Analogie** : Un module statique, c'est comme un meuble déjà monte — tu le prends tel quel. Un module dynamique, c'est comme un meuble IKEA configurable — tu choisis la couleur, la taille et les options au moment de la commande.

### 5.2 Le pattern forRoot / forFeature

Ce pattern est utilise par de nombreux modules NestJS officiels (`TypeOrmModule`, `ConfigModule`, `JwtModule`, etc.) :

| Méthode | Usage | Quand l'utiliser |
|---|---|---|
| `forRoot()` | Configuration principale (une seule fois dans AppModule) | Connexion base de donnees, configuration globale |
| `forRootAsync()` | Comme forRoot mais avec des dépendances async | Quand la config depend d'un service (ConfigService) |
| `forFeature()` | Configuration par feature module | Enregistrer des entites, des repositories spécifiques |
| `register()` | Configuration par module (pas de pattern root/feature) | Modules simples sans distinction root/feature |

### 5.3 Implementer un module dynamique

```typescript
// database/database.module.ts
import { Module, DynamicModule, Global } from '@nestjs/common';

export interface DatabaseModuleOptions {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

@Global()
@Module({})
export class DatabaseModule {
  static forRoot(options: DatabaseModuleOptions): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [
        {
          provide: 'DATABASE_OPTIONS',
          useValue: options,
        },
        {
          provide: 'DATABASE_CONNECTION',
          useFactory: async (opts: DatabaseModuleOptions) => {
            console.log(`Connexion a ${opts.host}:${opts.port}/${opts.database}`);
            // const connection = await createPool(opts);
            // return connection;
            return { connected: true, ...opts };
          },
          inject: ['DATABASE_OPTIONS'],
        },
      ],
      exports: ['DATABASE_CONNECTION'],
    };
  }
}
```

```typescript
// app.module.ts — Utilisation
@Module({
  imports: [
    DatabaseModule.forRoot({
      host: 'localhost',
      port: 5432,
      database: 'mydb',
      username: 'admin',
      password: 'secret',
    }),
    BooksModule,
    UsersModule,
  ],
})
export class AppModule {}
```

### 5.4 forRootAsync — Configuration avec dépendances

```typescript
// database/database.module.ts (suite)
@Global()
@Module({})
export class DatabaseModule {
  static forRoot(options: DatabaseModuleOptions): DynamicModule {
    // ... comme avant
  }

  static forRootAsync(options: {
    imports?: any[];
    useFactory: (...args: any[]) => DatabaseModuleOptions | Promise<DatabaseModuleOptions>;
    inject?: any[];
  }): DynamicModule {
    return {
      module: DatabaseModule,
      imports: options.imports || [],
      providers: [
        {
          provide: 'DATABASE_OPTIONS',
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        {
          provide: 'DATABASE_CONNECTION',
          useFactory: async (opts: DatabaseModuleOptions) => {
            console.log(`Connexion async a ${opts.host}:${opts.port}/${opts.database}`);
            return { connected: true, ...opts };
          },
          inject: ['DATABASE_OPTIONS'],
        },
      ],
      exports: ['DATABASE_CONNECTION'],
    };
  }
}
```

```typescript
// app.module.ts — Utilisation avec ConfigService
@Module({
  imports: [
    ConfigModule.forRoot(), // Module de configuration
    DatabaseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        host: config.get('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        database: config.get('DB_NAME'),
        username: config.get('DB_USER'),
        password: config.get('DB_PASSWORD'),
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

### 5.5 Le pattern forFeature

```typescript
// cache/cache.module.ts
@Module({})
export class CacheModule {
  // Configuration globale
  static forRoot(options: { ttl: number; max: number }): DynamicModule {
    return {
      module: CacheModule,
      global: true,
      providers: [
        { provide: 'CACHE_OPTIONS', useValue: options },
        CacheService,
      ],
      exports: [CacheService],
    };
  }

  // Configuration par feature — enregistrer des cles de cache specifiques
  static forFeature(prefix: string): DynamicModule {
    return {
      module: CacheModule,
      providers: [
        { provide: 'CACHE_PREFIX', useValue: prefix },
        {
          provide: `CACHE_${prefix.toUpperCase()}`,
          useFactory: (cacheService: CacheService) => {
            return cacheService.createNamespacedCache(prefix);
          },
          inject: [CacheService],
        },
      ],
      exports: [`CACHE_${prefix.toUpperCase()}`],
    };
  }
}
```

```typescript
// Utilisation
@Module({
  imports: [
    CacheModule.forRoot({ ttl: 300, max: 100 }), // Configuration globale
  ],
})
export class AppModule {}

@Module({
  imports: [
    CacheModule.forFeature('books'), // Cache specifique aux livres
  ],
})
export class BooksModule {}
```

---

## 6. ConfigurableModuleBuilder

NestJS 9+ fournit un utilitaire pour simplifier la création de modules dynamiques :

```typescript
import { ConfigurableModuleBuilder } from '@nestjs/common';

export interface HttpClientModuleOptions {
  baseUrl: string;
  timeout?: number;
  headers?: Record<string, string>;
}

// Genere automatiquement les methodes register et registerAsync
export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} = new ConfigurableModuleBuilder<HttpClientModuleOptions>()
  .setClassMethodName('forRoot') // Nom personnalise (defaut: register)
  .build();
```

```typescript
// http-client.module.ts
import { Module } from '@nestjs/common';
import { ConfigurableModuleClass } from './http-client.module-definition';
import { HttpClientService } from './http-client.service';

@Module({
  providers: [HttpClientService],
  exports: [HttpClientService],
})
export class HttpClientModule extends ConfigurableModuleClass {}
// Herite automatiquement de forRoot() et forRootAsync()
```

```typescript
// http-client.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { MODULE_OPTIONS_TOKEN, HttpClientModuleOptions } from './http-client.module-definition';

@Injectable()
export class HttpClientService {
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN) private options: HttpClientModuleOptions,
  ) {
    console.log(`HTTP Client configure pour ${options.baseUrl}`);
  }

  async get(path: string) {
    const url = `${this.options.baseUrl}${path}`;
    const response = await fetch(url, {
      headers: this.options.headers,
      signal: AbortSignal.timeout(this.options.timeout || 5000),
    });
    return response.json();
  }
}
```

```typescript
// Utilisation
@Module({
  imports: [
    HttpClientModule.forRoot({
      baseUrl: 'https://api.example.com',
      timeout: 10000,
      headers: { 'X-API-Key': 'my-key' },
    }),
  ],
})
export class AppModule {}
```

---

## 7. Re-exports de modules

Un module peut re-exporter les modules qu'il importe :

```typescript
@Module({
  imports: [CommonModule, DatabaseModule],
  exports: [CommonModule, DatabaseModule], // ← Re-export
})
export class CoreModule {}

// Tout module qui importe CoreModule
// a automatiquement acces aux exports de CommonModule ET DatabaseModule
@Module({
  imports: [CoreModule], // Pas besoin d'importer CommonModule et DatabaseModule separement
})
export class BooksModule {}
```

---

## 8. Dependances circulaires et forwardRef

### 8.1 Le problème

Deux modules qui s'importent mutuellement creent une dépendance circulaire :

```typescript
// UsersModule importe OrdersModule
// OrdersModule importe UsersModule
// → ERREUR : dependance circulaire
```

### 8.2 La solution : forwardRef

```typescript
import { Module, forwardRef } from '@nestjs/common';

@Module({
  imports: [forwardRef(() => OrdersModule)],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

@Module({
  imports: [forwardRef(() => UsersModule)],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
```

Même chose pour les services :

```typescript
@Injectable()
export class UsersService {
  constructor(
    @Inject(forwardRef(() => OrdersService))
    private ordersService: OrdersService,
  ) {}
}
```

> **Piege classique** : Les dépendances circulaires sont un signe d'architecture problematique. Avant d'utiliser `forwardRef`, demandé-toi si tu ne devrais pas refactorer pour eliminer la circularite. Souvent, un module intermédiaire ou une interface partagee resout le problème plus proprement.

### 8.3 Alternatives a forwardRef

| Solution | Description |
|---|---|
| **Module intermédiaire** | Cree un module C qui contient la logique partagee entre A et B |
| **Events** | Utilise EventEmitter pour decouple la communication |
| **Interface partagee** | Extrais l'interface dans un module common |
| **Refactoring** | Restructure les dépendances pour eliminer le cycle |

---

## 9. Lazy-loaded modules

NestJS 8+ supporte le chargement paresseux de modules (utile pour les très grandes applications ou les micro-services) :

```typescript
import { Module } from '@nestjs/common';
import { LazyModuleLoader } from '@nestjs/core';

@Injectable()
export class AppService {
  constructor(private readonly lazyModuleLoader: LazyModuleLoader) {}

  async loadReportModule() {
    // Le module n'est charge que quand cette methode est appelee
    const { ReportModule } = await import('./report/report.module');
    const moduleRef = await this.lazyModuleLoader.load(() => ReportModule);

    // Recuperer un service du module charge
    const reportService = moduleRef.get(ReportService);
    return reportService.generate();
  }
}
```

> **A retenir** : Le lazy loading est un pattern avance, utile pour les applications monolithiques très grandes ou les modules rarement utilises (génération de rapports, import/export massif). Pour la plupart des applications, le chargement standard suffit.

---

## 10. Architecture d'une vraie application

### 10.1 Structure recommandee

```
src/
├── main.ts                         ← Bootstrap
├── app.module.ts                   ← Module racine (imports uniquement)
│
├── core/                           ← Module global (config, logger, DB)
│   ├── core.module.ts              ← @Global()
│   ├── config/
│   │   └── config.service.ts
│   ├── logger/
│   │   └── logger.service.ts
│   ├── database/
│   │   └── database.module.ts
│   ├── guards/
│   │   └── jwt-auth.guard.ts
│   ├── interceptors/
│   │   └── logging.interceptor.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   └── pipes/
│       └── validation.pipe.ts
│
├── common/                         ← Module partage (utilitaires)
│   ├── common.module.ts
│   ├── decorators/
│   │   └── current-user.decorator.ts
│   ├── dto/
│   │   └── pagination.dto.ts
│   └── interfaces/
│       └── paginated-result.interface.ts
│
├── auth/                           ← Feature module "Auth"
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── strategies/
│   │   └── jwt.strategy.ts
│   └── dto/
│       ├── login.dto.ts
│       └── register.dto.ts
│
├── users/                          ← Feature module "Users"
│   ├── users.module.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── dto/
│   │   ├── create-user.dto.ts
│   │   └── update-user.dto.ts
│   └── entities/
│       └── user.entity.ts
│
├── books/                          ← Feature module "Books"
│   ├── books.module.ts
│   ├── books.controller.ts
│   ├── books.service.ts
│   ├── dto/
│   │   ├── create-book.dto.ts
│   │   └── update-book.dto.ts
│   └── entities/
│       └── book.entity.ts
│
└── orders/                         ← Feature module "Orders"
    ├── orders.module.ts
    ├── orders.controller.ts
    ├── orders.service.ts
    ├── dto/
    │   └── create-order.dto.ts
    └── entities/
        └── order.entity.ts
```

### 10.2 Le graphe de dépendances

```
                    AppModule
                    ├── CoreModule (@Global)
                    │   ├── ConfigService
                    │   ├── LoggerService
                    │   └── DatabaseModule
                    │
                    ├── AuthModule
                    │   ├── imports: [UsersModule]
                    │   └── exports: [JwtAuthGuard]
                    │
                    ├── UsersModule
                    │   ├── imports: [CommonModule]
                    │   └── exports: [UsersService]
                    │
                    ├── BooksModule
                    │   ├── imports: [CommonModule]
                    │   └── exports: [BooksService]
                    │
                    └── OrdersModule
                        ├── imports: [UsersModule, BooksModule, CommonModule]
                        └── exports: []
```

### 10.3 Le module racine ideal

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CoreModule } from './core/core.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BooksModule } from './books/books.module';
import { OrdersModule } from './orders/orders.module';

@Module({
  imports: [
    // Configuration globale
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
    }),

    // Module core (global — config, logger, DB)
    CoreModule,

    // Feature modules
    AuthModule,
    UsersModule,
    BooksModule,
    OrdersModule,
  ],
})
export class AppModule {}
```

---

## 11. Bonnes pratiques pour l'organisation des modules

| Pratique | Explication |
|---|---|
| **Un module par feature metier** | books, users, auth, orders — pas de mega-module |
| **Module racine leger** | Seulement des imports, pas de controllers ni de providers |
| **CoreModule global** | Pour config, logger, database — importe une seule fois |
| **CommonModule partage** | Pour les utilitaires réutilisables — importe la ou nécessaire |
| **Exporter explicitement** | Ne rend public que ce qui DOIT etre public |
| **Éviter @Global** | Seulement pour les modules vraiment transversaux |
| **Éviter forwardRef** | Refactore pour eliminer les dépendances circulaires |
| **Nommer avec convention** | `books.module.ts`, `books.controller.ts`, `books.service.ts` |
| **Colocaliser** | Controller, service, DTOs et entities dans le même dossier |
| **Modules dynamiques pour les libs** | forRoot/forRootAsync pour les modules configurables |

---

## 12. Exercices pratiques

### Exercice 1 — Module dynamique configurable

Cree un `MailModule` dynamique avec :
- `forRoot({ provider: 'sendgrid', apiKey: '...' })` pour la configuration globale
- `forRootAsync({ useFactory: ..., inject: [ConfigService] })` pour la config async
- Un `MailService` qui utilise la configuration injectee

### Exercice 2 — Architecture complete

Dessine et implemente l'architecture d'une application de e-commerce avec les modules suivants :
- `ProductsModule`
- `CategoriesModule`
- `CartModule`
- `OrdersModule`
- `PaymentModule`
- `AuthModule`
- `UsersModule`
- `CoreModule` (global)
- `CommonModule` (partage)

Definis les `imports` et `exports` de chaque module.

### Exercice 3 — Eliminer une dépendance circulaire

Tu as :
- `UsersService` qui a besoin de `OrdersService` (pour lister les commandes d'un utilisateur)
- `OrdersService` qui a besoin de `UsersService` (pour valider l'utilisateur)

Propose et implemente une solution sans `forwardRef`.

---

## 13. Résumé — Les concepts clés

| Concept | Definition |
|---|---|
| **@Module** | Decorateur qui declare un module avec imports, controllers, providers, exports |
| **Feature module** | Module qui encapsule une fonctionnalite metier |
| **Shared module** | Module réutilisable importe par plusieurs feature modules |
| **@Global** | Rend les exports d'un module disponibles partout |
| **forRoot** | Méthode statique pour la configuration principale d'un module dynamique |
| **forRootAsync** | Comme forRoot mais avec des dépendances injectables |
| **forFeature** | Configuration par feature (entites, repositories spécifiques) |
| **ConfigurableModuleBuilder** | Utilitaire pour créer des modules dynamiques facilement |
| **exports** | Rend les providers accessibles aux modules importateurs |
| **forwardRef** | Resout les dépendances circulaires (a éviter si possible) |
| **Re-export** | Un module qui re-exporte les modules qu'il importe |

> **A retenir** : L'architecture modulaire est la force de NestJS. Chaque module est une unite autonome avec des frontieres claires. Les modules communiquent via des imports/exports explicites, ce qui rend le graphe de dépendances visible et controlable. Un bon découpage en modules rend l'application maintenable a long terme, facilite le travail en équipe (chaque développeur travaille sur un module) et prepare naturellement la migration vers des microservices si nécessaire.

---

## Navigation

| | Lien |
|---|---|
| Module précédent | [Module 11 — NestJS — Providers & Injection de Dependances](./11-nestjs-providers-di.md) |
| Module suivant | Fin du parcours — Bravo ! |
| Quiz | [Quiz Module 12](../quizzes/12-nestjs-modules.quiz.md) |
| Lab | [Lab 12 — Architecture NestJS](../labs/12-nestjs-modules.lab.md) |

---

> **A retenir** : Tu as termine le parcours complet — de zero connaissance backend à la maîtrise de l'architecture NestJS. Tu sais maintenant comment fonctionne Node.js (event loop, streams), comment construire des API avec Express (routing, middleware, validation, auth), et comment structurer des applications maintenables avec NestJS (modules, controllers, providers, DI). Ces compétences sont directement applicables en entreprise. La prochaine étape : intégrer une base de donnees (PostgreSQL avec TypeORM ou Prisma), ajouter du testing complet, et déployer en production.

---

<!-- parcours-recommande -->

::: tip Parcours recommandé
1. **Screencast** : [screencast 12 modules](../screencasts/screencast-12-modules.md)
2. **Lab** : [lab-12-modules-architecture](../labs/lab-12-modules-architecture/README)
3. **Quiz** : [quiz 12 modules](../quizzes/quiz-12-modules.html)
:::
