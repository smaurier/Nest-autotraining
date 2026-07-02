---
titre: NestJS modules
cours: 09-nestjs
notions: [décorateur Module, imports controllers providers exports, feature modules, modules partagés, modules dynamiques forRoot et forFeature, modules globaux, organisation d'une application par domaine]
outcomes: [organiser une app NestJS en feature modules, partager un provider entre modules via exports, créer un module dynamique configurable, structurer par domaine métier]
prerequis: [11-nestjs-providers-di]
next: 13-nestjs-pipes-guards-interceptors
libs: [{ name: "@nestjs/common", version: "^11" }]
tribuzen: organiser l'API TribuZen en modules par domaine (FamilyModule, PostModule, InvitationModule, AuthModule)
last-reviewed: 2026-07
---

# NestJS modules

> **Outcomes — tu sauras FAIRE :** organiser une app NestJS en feature modules, partager un provider entre modules via `exports`, créer un module dynamique configurable avec `forRoot`/`forFeature`, structurer une API par domaine métier.
> **Difficulté :** :star::star::star:

## 1. Cas concret d'abord

TribuZen grossit. Après avoir posé controllers et DI, tu te retrouves avec tout dans `AppModule` :

```ts
// ❌ AppModule monolithique — 4 domaines mélangés dans un seul fichier
@Module({
  controllers: [FamilyController, PostController, InvitationController, AuthController],
  providers: [
    FamilyService, PostService, InvitationService, AuthService,
    NotificationService, TokenService, LoggerService,
    { provide: 'FAMILY_CONFIG', useValue: { maxFamilySize: 12 } },
    { provide: 'JWT_SECRET', useValue: process.env.JWT_SECRET },
    // ... 15 providers de plus
  ],
})
export class AppModule {}
```

Trois problèmes immédiats : (1) tout est public — `PostService` peut injecter `TokenService` sans que personne ne le remarque ; (2) la moindre modif dans `FamilyService` oblige à relire tout le fichier ; (3) tester `PostService` en isolation requiert de charger tous les providers de l'app.

NestJS résout ça avec les **modules**. Un module = une unité d'encapsulation par domaine métier. Les providers sont privés par défaut ; on exporte explicitement ce qui doit traverser la frontière.

```ts
// ✅ AppModule orchestrateur — aucune logique, que des imports
@Module({
  imports: [FamilyModule, PostModule, InvitationModule, AuthModule],
})
export class AppModule {}
```

Ce module explique comment découper une API par domaine, partager des providers communs, créer des modules dynamiques configurables et décider quand rendre un module global.

## 2. Théorie complète, concise

### 2.1 Décorateur `@Module`

`@Module()` déclare un module NestJS. Il reçoit un objet avec quatre propriétés :

```ts
import { Module } from '@nestjs/common'
import { FamilyController } from './family.controller'
import { FamilyService } from './family.service'

@Module({
  imports: [],                      // modules dont ce module dépend
  controllers: [FamilyController],  // classes qui gèrent les routes HTTP
  providers: [FamilyService],       // services, repositories, factories
  exports: [FamilyService],         // providers accessibles aux modules importateurs
})
export class FamilyModule {}
```

| Propriété | Rôle | Sans elle |
|-----------|------|-----------|
| `imports` | Rend les exports d'un autre module disponibles ici | Providers de l'autre module inaccessibles |
| `controllers` | NestJS enregistre les routes de ces classes | Routes non montées (404) |
| `providers` | Enregistre les providers dans le conteneur du module | `Nest can't resolve dependencies` |
| `exports` | Rend ces providers accessibles depuis l'extérieur | Providers encapsulés — privés au module |

**Encapsulation par défaut.** Un provider dans `providers` est privé à son module. Sans `exports`, aucun autre module ne peut l'injecter, même si son module est importé.

### 2.2 Feature modules et module racine

Un **feature module** encapsule tout le code d'un domaine métier : controller, service, DTOs, entités. Il est l'unité d'organisation principale d'une app NestJS.

```
src/
  app.module.ts          ← racine : imports uniquement, zéro providers propres
  family/
    family.module.ts     ← feature module Famille
    family.controller.ts
    family.service.ts
  post/
    post.module.ts       ← feature module Post
    post.controller.ts
    post.service.ts
  invitation/
    invitation.module.ts ← feature module Invitation
    invitation.service.ts
```

Le **module racine** (`AppModule`) est l'entrée de l'application. Il importe les feature modules et configure les modules globaux. Il ne contient pas de controllers ni de providers directs :

```ts
// src/app.module.ts — orchestrateur pur
import { Module } from '@nestjs/common'
import { FamilyModule } from './family/family.module'
import { PostModule } from './post/post.module'
import { InvitationModule } from './invitation/invitation.module'

@Module({
  imports: [FamilyModule, PostModule, InvitationModule],
})
export class AppModule {}
```

NestJS parcourt le graphe de modules au démarrage, résout toutes les dépendances dans le bon ordre et instancie les singletons.

### 2.3 Modules partagés

Un **module partagé** contient des providers utilitaires réutilisables par plusieurs feature modules. Le pattern : tout exporter, importer le module là où on en a besoin.

```ts
// src/shared/shared.module.ts
import { Module } from '@nestjs/common'
import { LoggerService } from './logger.service'
import { DateService } from './date.service'

@Module({
  providers: [LoggerService, DateService],
  exports: [LoggerService, DateService], // les deux providers traversent la frontière
})
export class SharedModule {}
```

```ts
// src/family/family.module.ts — importe SharedModule
@Module({
  imports: [SharedModule], // LoggerService et DateService sont injectables dans FamilyModule
  controllers: [FamilyController],
  providers: [FamilyService],
})
export class FamilyModule {}

// src/post/post.module.ts — importe le même SharedModule
@Module({
  imports: [SharedModule], // même singleton LoggerService, pas une nouvelle instance
  controllers: [PostController],
  providers: [PostService],
})
export class PostModule {}
```

**Singleton garanti.** Même si `SharedModule` est importé dans cinq modules, NestJS ne crée `LoggerService` qu'une seule fois. Chaque module reçoit la même instance singleton — aucune recréation à l'import.

### 2.4 Modules globaux avec `@Global`

`@Global()` rend les exports d'un module disponibles dans toute l'application sans import explicite dans chaque module consommateur. Il suffit d'importer le module une seule fois dans `AppModule` (ou un module racine).

```ts
import { Global, Module } from '@nestjs/common'
import { LoggerService } from './logger.service'

@Global() // exports disponibles partout, sans imports: [CoreModule] dans chaque module
@Module({
  providers: [LoggerService],
  exports: [LoggerService],
})
export class CoreModule {}
```

```ts
// app.module.ts — un seul import suffit
@Module({
  imports: [CoreModule, FamilyModule, PostModule],
})
export class AppModule {}

// family.service.ts — pas besoin d'imports: [CoreModule] dans FamilyModule
@Injectable()
export class FamilyService {
  constructor(private readonly logger: LoggerService) {} // fonctionne grâce à @Global
}
```

`@Global()` est adapté aux modules vraiment transversaux : configuration, logging, connexion DB. Ne jamais l'appliquer à un feature module — l'encapsulation disparaît et le graphe de dépendances devient opaque.

### 2.5 Modules dynamiques — `forRoot`, `forRootAsync`, `forFeature`

Un **module dynamique** expose des méthodes statiques qui retournent un objet `DynamicModule` configuré au moment de l'import. NestJS utilise ce pattern partout : `TypeOrmModule.forRoot(...)`, `ConfigModule.forRoot(...)`, `JwtModule.register(...)`.

#### `forRoot` — configuration principale, une fois dans `AppModule`

```ts
import { Module, DynamicModule, Global } from '@nestjs/common'

export const DATABASE_CONFIG = 'DATABASE_CONFIG'

export interface DatabaseOptions {
  type: string
  host?: string
  port?: number
}

@Global()
@Module({})
export class DatabaseModule {
  static forRoot(options: DatabaseOptions): DynamicModule {
    return {
      module: DatabaseModule, // obligatoire — identifie le module propriétaire
      providers: [
        {
          provide: DATABASE_CONFIG, // token exportable — évite les typos vs string inline
          useValue: options,        // options passées à forRoot = provider injectable
        },
      ],
      exports: [DATABASE_CONFIG], // disponible globalement grâce à @Global + exports
    }
  }
}
```

```ts
// app.module.ts
@Module({
  imports: [
    DatabaseModule.forRoot({ type: 'postgres', host: 'localhost', port: 5432 }),
    FamilyModule, // peut injecter DATABASE_CONFIG sans imports: [DatabaseModule]
  ],
})
export class AppModule {}
```

#### `forRootAsync` — configuration dépendant d'un service injecté

Quand la configuration dépend de `ConfigService`, on ne peut pas la passer en objet statique. `forRootAsync` accepte une factory :

```ts
static forRootAsync(options: {
  imports?: any[]
  useFactory: (...args: any[]) => DatabaseOptions | Promise<DatabaseOptions>
  inject?: any[]
}): DynamicModule {
  return {
    module: DatabaseModule,
    imports: options.imports ?? [],
    providers: [
      {
        provide: DATABASE_CONFIG,
        useFactory: options.useFactory,
        inject: options.inject ?? [],
      },
    ],
    exports: [DATABASE_CONFIG],
  }
}
```

```ts
// app.module.ts — avec ConfigService
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: config.get<string>('DB_TYPE'),
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

#### `forFeature` — configuration par feature module

`forFeature` configure le module pour un contexte spécifique — typiquement pour enregistrer des entités TypeORM ou des permissions par domaine :

```ts
// Exemple : CacheModule.forFeature pour un namespace de cache par domaine
static forFeature(prefix: string): DynamicModule {
  return {
    module: CacheModule,
    providers: [{ provide: 'CACHE_PREFIX', useValue: prefix }],
    exports: ['CACHE_PREFIX'],
  }
}

// Dans FamilyModule : cache avec le préfixe 'family'
@Module({
  imports: [CacheModule.forFeature('family')],
})
export class FamilyModule {}
```

| Méthode | Appelé depuis | Usage typique |
|---------|--------------|---------------|
| `forRoot` | `AppModule` une fois | Configuration globale (DB, JWT, config) |
| `forRootAsync` | `AppModule` une fois | Config qui dépend de `ConfigService` injecté |
| `forFeature` | Chaque feature module | Entités TypeORM, scopes spécifiques au domaine |
| `register` | N'importe où | Configuration par module, sans notion root/feature |

## 3. Worked examples

### Exemple A — `SharedModule` + `FamilyModule` + `PostModule`

```ts
// src/shared/logger.service.ts
import { Injectable } from '@nestjs/common'

@Injectable()
export class LoggerService {
  log(context: string, message: string): string {
    const formatted = `[${context}] ${message}`
    console.log(formatted)
    return formatted
  }
}
```

```ts
// src/shared/date.service.ts
import { Injectable } from '@nestjs/common'

@Injectable()
export class DateService {
  now(): string {
    return new Date().toISOString()
  }

  format(date: Date): string {
    return date.toISOString().split('T')[0]
  }
}
```

```ts
// src/shared/shared.module.ts
import { Module } from '@nestjs/common'
import { LoggerService } from './logger.service'
import { DateService } from './date.service'

@Module({
  providers: [LoggerService, DateService],
  exports: [LoggerService, DateService], // les deux providers traversent les frontières du module
})
export class SharedModule {}
```

```ts
// src/family/family.service.ts
import { Injectable } from '@nestjs/common'
import { LoggerService } from '../shared/logger.service'
import { DateService } from '../shared/date.service'

export interface Family { id: string; name: string; createdAt: string }

@Injectable()
export class FamilyService {
  private families: Family[] = []

  // LoggerService et DateService disponibles grâce à imports: [SharedModule] dans FamilyModule
  // NestJS les résout par type sans @Inject() — token = type TypeScript
  constructor(
    private readonly logger: LoggerService,
    private readonly dateService: DateService,
  ) {}

  findAll(): Family[] { return this.families }

  create(name: string): Family {
    const family: Family = { id: `fam-${Date.now()}`, name, createdAt: this.dateService.now() }
    this.families.push(family)
    this.logger.log('FamilyService', `Created family: ${name}`)
    return family
  }
}
```

```ts
// src/family/family.module.ts
import { Module } from '@nestjs/common'
import { SharedModule } from '../shared/shared.module'
import { FamilyController } from './family.controller'
import { FamilyService } from './family.service'

@Module({
  imports: [SharedModule], // rend LoggerService + DateService injectables ici
  controllers: [FamilyController],
  providers: [FamilyService],
  exports: [FamilyService], // partageable avec InvitationModule et PostModule
})
export class FamilyModule {}
```

```ts
// src/post/post.module.ts — même pattern, domaine différent
import { Module } from '@nestjs/common'
import { SharedModule } from '../shared/shared.module'
import { FamilyModule } from '../family/family.module'
import { PostController } from './post.controller'
import { PostService } from './post.service'

@Module({
  imports: [
    SharedModule,   // même singleton LoggerService — pas de nouvelle instance
    FamilyModule,   // PostService peut vérifier qu'une famille existe avant de poster
  ],
  controllers: [PostController],
  providers: [PostService],
})
export class PostModule {}
```

```ts
// src/app.module.ts
import { Module } from '@nestjs/common'
import { FamilyModule } from './family/family.module'
import { PostModule } from './post/post.module'

// AppModule n'importe pas SharedModule directement :
// FamilyModule et PostModule gèrent leur propre dépendance vers SharedModule
@Module({
  imports: [FamilyModule, PostModule],
})
export class AppModule {}
```

**Pas-à-pas :** (1) `SharedModule` déclare `LoggerService` + `DateService` dans `providers` et les place dans `exports` — sans `exports`, ils restent privés à `SharedModule` ; (2) `FamilyModule` déclare `imports: [SharedModule]` — les deux services deviennent injectables dans tous ses providers ; (3) `FamilyService` les reçoit par constructeur avec token par type (pas de `@Inject()`) ; (4) `PostModule` importe `SharedModule` aussi — NestJS retourne le même singleton `LoggerService`, zéro recréation ; (5) `AppModule` n'importe que les feature modules — il ne sait pas que `SharedModule` existe ; (6) `exports: [FamilyService]` dans `FamilyModule` permet à `PostModule` d'injecter `FamilyService` dans `PostService`.

### Exemple B — `DatabaseModule` dynamique avec `forRoot`

```ts
// src/database/database.module.ts
import { Module, DynamicModule, Global } from '@nestjs/common'

// Token string comme constante exportée — évite les typos et permet l'injection typée
export const DATABASE_CONFIG = 'DATABASE_CONFIG'

export interface DatabaseConfig {
  type: string
  host?: string
  port?: number
}

@Global() // DATABASE_CONFIG injectable partout sans imports: [DatabaseModule] dans chaque module
@Module({})
export class DatabaseModule {
  static forRoot(config: DatabaseConfig): DynamicModule {
    return {
      module: DatabaseModule, // obligatoire — NestJS identifie le module propriétaire
      providers: [
        {
          provide: DATABASE_CONFIG,
          useValue: config, // la config passée à forRoot devient un provider injectable
        },
      ],
      exports: [DATABASE_CONFIG], // disponible globalement grâce à @Global + exports
    }
  }
}
```

```ts
// src/app.module.ts — usage de forRoot
import { Module } from '@nestjs/common'
import { DatabaseModule } from './database/database.module'
import { FamilyModule } from './family/family.module'

@Module({
  imports: [
    DatabaseModule.forRoot({ type: 'postgres', host: 'localhost', port: 5432 }),
    FamilyModule,
  ],
})
export class AppModule {}
```

```ts
// src/family/family.service.ts — injection du config global
import { Injectable, Inject } from '@nestjs/common'
import { DATABASE_CONFIG, DatabaseConfig } from '../database/database.module'

@Injectable()
export class FamilyService {
  constructor(
    // @Global sur DatabaseModule → DATABASE_CONFIG injectable sans imports: [DatabaseModule]
    // @Inject() obligatoire : token string, pas un type de classe
    @Inject(DATABASE_CONFIG) private readonly dbConfig: DatabaseConfig,
  ) {}

  getDatabaseInfo(): string {
    return `${this.dbConfig.type}://${this.dbConfig.host}:${this.dbConfig.port}`
  }
}
```

**Pas-à-pas :** (1) `DatabaseModule.forRoot(config)` retourne un objet `DynamicModule` — `module: DatabaseModule` est obligatoire, il pointe vers la classe du module propriétaire ; (2) `DATABASE_CONFIG` est une constante exportée — les consommateurs importent la constante, pas la string `'DATABASE_CONFIG'` ; (3) `useValue: config` — la config passée à `forRoot` devient un provider injectable directement ; (4) `@Global()` sur la classe + `exports: [DATABASE_CONFIG]` — le token est injectable dans toute l'app sans import explicite ; (5) `FamilyService` injecte via `@Inject(DATABASE_CONFIG)` — obligatoire car le token est une string, pas un type de classe.

## 4. Pièges & misconceptions

- **`exports` absent mais provider attendu à l'extérieur.** `providers: [FamilyService]` sans `exports: [FamilyService]` rend `FamilyService` privé. Un module qui importe `FamilyModule` sans cet export obtient `Nest can't resolve dependencies of PostService (?). Please make sure that the argument FamilyService at index [0] is available in the PostModule context`. Correction : ajouter le provider à `exports` dès qu'il doit traverser une frontière de module.

- **Import sans export correspondant.** `imports: [FamilyModule]` dans `PostModule` ne suffit pas si `FamilyModule` n'a pas `exports: [FamilyService]`. Les deux côtés sont requis : `exports` côté propriétaire, `imports` côté consommateur.

- **`@Global()` sur un feature module.** `FamilyModule` global : `FamilyService` devient injectable partout sans déclaration visible. Le graphe de dépendances devient invisible, les tests unitaires deviennent imprévisibles (contexte implicite). `@Global()` est réservé aux modules transversaux : config, logger, connexion DB.

- **`module:` absent dans le retour `DynamicModule`.** Un `DynamicModule` doit contenir `module: DatabaseModule`. Sans ce champ, NestJS ne peut pas identifier le module propriétaire et lève une erreur au démarrage. Ce champ n'est pas optionnel.

- **Importer `SharedModule` dans `AppModule` en plus des feature modules.** Si `AppModule` importe `SharedModule` et que `FamilyModule` l'importe aussi, les providers sont bien singletons — mais l'import dans `AppModule` est superflu. `AppModule` ne doit importer que les modules dont il a besoin directement, pas les transitives.

- **Dépendances circulaires résolues avec `forwardRef` sans refactoring.** `forwardRef(() => PostModule)` dans `FamilyModule` + `forwardRef(() => FamilyModule)` dans `PostModule` résout le démarrage mais masque un problème : deux domaines trop couplés. Solution : module intermédiaire partagé (ex : `ContentModule`) ou découpler via events.

## 5. Ancrage TribuZen

Couche fil-rouge : **organiser l'API TribuZen en modules par domaine** (`smaurier/tribuzen`).

- `SharedModule` expose `LoggerService`, `DateService` et les DTOs partagés (pagination, etc.). Importé dans `FamilyModule`, `PostModule`, `InvitationModule` — même singleton, zéro duplication.
- `FamilyModule` encapsule `FamilyService`, `FamilyController`, les DTOs famille et les règles d'appartenance. Il exporte `FamilyService` pour que `InvitationModule` vérifie les limites de taille avant d'envoyer une invitation.
- `PostModule` importe `FamilyModule` (pour vérifier que l'auteur appartient à une famille valide avant de poster) et `SharedModule`. `PostService` ne connaît pas l'implémentation de `FamilyService` — il la reçoit par DI.
- `AuthModule` exposera `AuthGuard` via `exports: [AuthGuard]` — `FamilyModule` et `PostModule` l'importeront pour protéger leurs routes sans re-implémenter la logique JWT.
- `CoreModule` (`@Global()`) exposera `ConfigService` et `LoggerService` partout — chargé une seule fois dans `AppModule`.

Structure cible dans `smaurier/tribuzen` :

```
apps/api/src/
  app.module.ts                   ← imports uniquement (Core, Family, Post, Invitation, Auth)
  core/
    core.module.ts                ← @Global() — ConfigService + LoggerService
  shared/
    shared.module.ts              ← exports DateService + DTOs partagés
  family/
    family.module.ts              ← imports SharedModule, exports FamilyService
    family.controller.ts
    family.service.ts
  post/
    post.module.ts                ← imports FamilyModule + SharedModule
    post.service.ts
    post.controller.ts
  invitation/
    invitation.module.ts          ← imports FamilyModule + AuthModule
    invitation.service.ts
  auth/
    auth.module.ts                ← exports AuthGuard
    auth.service.ts
```

## 6. Points clés

1. `@Module({ imports, controllers, providers, exports })` — `providers` et `controllers` s'appliquent au module courant ; `imports` apporte des exports d'autres modules ; `exports` rend des providers disponibles à l'extérieur.
2. Les providers sont **privés par défaut** — `exports` est la seule façon de les partager avec un autre module.
3. Les deux côtés sont nécessaires : `exports: [Service]` dans le module propriétaire **et** `imports: [OwnerModule]` dans le module consommateur.
4. Un **shared module** exporte ses providers ; importer le module dans N modules ne crée pas N instances — NestJS garantit le singleton dans tout le contexte de l'application.
5. `@Global()` supprime l'obligation d'importer dans chaque consommateur — réservé aux modules transversaux (config, logger, DB) ; ne jamais l'appliquer à un feature module.
6. Un **module dynamique** retourne un objet `DynamicModule` depuis une méthode statique (`forRoot`, `forRootAsync`, `forFeature`, `register`) — le champ `module:` est obligatoire dans cet objet.
7. `forRoot` accepte des options statiques ; `forRootAsync` accepte une factory avec `inject: [ConfigService]` pour lire les variables d'environnement depuis le conteneur.
8. `AppModule` doit rester un orchestrateur pur — imports uniquement, sans controllers ni providers directs.

## 7. Seeds Anki

```
Que font exports: [FamilyService] côté FamilyModule et imports: [FamilyModule] côté PostModule ?|exports rend le provider partageable ; imports l'apporte dans le module consommateur — les deux sont obligatoires, l'un sans l'autre ne suffit pas
Différence entre imports: [SharedModule] répété et @Global() ?|imports: [SharedModule] doit être déclaré dans chaque module consommateur ; @Global() rend les exports disponibles partout sans imports répétés — réservé aux modules transversaux (config, logger, DB)
Qu'est-ce qu'un DynamicModule et quel champ est obligatoire ?|Un objet littéral retourné par une méthode statique (forRoot, register) ; le champ module: ClassName est obligatoire — NestJS l'utilise pour identifier le module propriétaire
Combien d'instances de LoggerService NestJS crée-t-il si SharedModule est importé dans 5 modules ?|Une seule — le singleton est garanti par le conteneur IoC même si le module est importé N fois
Différence forRoot vs forRootAsync vs forFeature ?|forRoot = config statique passée directement ; forRootAsync = config via une factory avec inject: [...] (ex: ConfigService) ; forFeature = config par feature module (ex: entités TypeORM ou namespace de cache)
Pourquoi ne pas appliquer @Global() sur FamilyModule ?|Les providers deviennent injectables partout sans déclaration visible — le graphe de dépendances devient opaque et les tests unitaires deviennent imprévisibles (contexte implicite)
Quel est le rôle d'AppModule dans une app NestJS bien structurée ?|Orchestrateur pur : imports uniquement (feature modules + modules globaux), zéro controllers ni providers directs — la logique vit dans les feature modules
Que se passe-t-il si on omet module: DatabaseModule dans le retour DynamicModule ?|NestJS ne peut pas identifier le module propriétaire et lève une erreur au démarrage — module: est obligatoire dans tout objet DynamicModule
```

## Pont vers le lab

> Lab associé : `09-nestjs/labs/lab-12-modules-architecture/README.md`. Tu y implémentes un `SharedModule` (LoggerService + DateService), deux feature modules qui l'importent, et un module dynamique avec `forRoot` — corrigé complet commenté + variante J+30 dans le README.

---

← [Module 11 — NestJS providers et DI](./11-nestjs-providers-di.md) · [Module 13 — NestJS pipes, guards, interceptors](./13-nestjs-pipes-guards-interceptors.md) →
