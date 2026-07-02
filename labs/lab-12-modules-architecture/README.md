# Lab 12 — NestJS modules

> **Outcome :** à la fin, tu sais créer un `SharedModule` réutilisable, deux feature modules qui l'importent, et un module dynamique `forRoot` — tout en comprenant pourquoi les providers restent privés par défaut.
> **Vrai outil :** NestJS 11 (`@nestjs/common`, `@nestjs/core`).
> **Feedback :** `npm test` dans `09-nestjs/labs/lab-12-modules-architecture/` valide automatiquement (tests e2e).

## Énoncé

Tu construis une app NestJS multi-modules qui illustre les patterns d'organisation par domaine. Pas de gap-fill — les fichiers dans `src/` sont des stubs vides ; tu écris chaque implémentation de A à Z.

Objectif fonctionnel :

- `POST /users` → crée un utilisateur (name + email) avec un `createdAt` généré par `DateService`
- `GET /users` → liste tous les utilisateurs
- `POST /products` → crée un produit (name + price) avec un `createdAt` généré par `DateService`
- `GET /products` → liste tous les produits
- `UsersService` et `ProductsService` injectent tous les deux `LoggerService` et `DateService` depuis `SharedModule`
- `DatabaseModule.forRoot({ type: 'memory' })` retourne un `DynamicModule` avec un token `DATABASE_CONFIG` injectable globalement

## Étapes (en friction)

1. Implémenter `src/shared/logger.service.ts` (`log(context, message)` retourne et logge `[context] message`) et `src/shared/date.service.ts` (`now()` retourne un ISO string, `format(date)` retourne `YYYY-MM-DD`). Compléter `src/shared/shared.module.ts` pour exporter les deux services.

2. Implémenter `src/users/users.service.ts` : interface `User { id, name, email, createdAt }`, store en mémoire, méthodes `findAll()` et `create({ name, email })`. Le service injecte `LoggerService` et `DateService` par constructeur. Compléter `src/users/users.controller.ts` avec `GET /users` et `POST /users`. Mettre à jour `src/users/users.module.ts` pour importer `SharedModule`.

3. Faire pareil pour `ProductsModule` : interface `Product { id, name, price, createdAt }`, `src/products/products.service.ts`, `src/products/products.controller.ts`, `src/products/products.module.ts` (importe `SharedModule`).

4. Implémenter `src/database/database.module.ts` : classe `DatabaseModule` avec `@Global()` et méthode statique `forRoot(config: DatabaseConfig): DynamicModule`. La config est exposée via le token `DATABASE_CONFIG = 'DATABASE_CONFIG'`. Exporter la constante `DATABASE_CONFIG` pour que les tests puissent l'injecter.

5. Vérifier que `src/app.module.ts` importe dans cet ordre : `DatabaseModule.forRoot({ type: 'memory' })`, `UsersModule`, `ProductsModule`. Lancer `npm test` — les 6 tests doivent passer.

## Corrigé complet commenté

```ts
// src/shared/logger.service.ts
import { Injectable } from '@nestjs/common'

@Injectable()
export class LoggerService {
  log(context: string, message: string): string {
    const formatted = `[${context}] ${message}`
    console.log(formatted)
    // Retourner la string formattée permet aux tests de vérifier sans mocker console
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
    return new Date().toISOString() // format ISO complet : 2024-06-15T12:00:00.000Z
  }

  format(date: Date): string {
    // split('T')[0] découpe '2024-06-15T12:00:00.000Z' → '2024-06-15'
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
  // exports obligatoires : sans eux, LoggerService et DateService
  // restent privés à SharedModule et ne peuvent pas être injectés ailleurs
  exports: [LoggerService, DateService],
})
export class SharedModule {}
```

```ts
// src/users/users.service.ts
import { Injectable } from '@nestjs/common'
import { LoggerService } from '../shared/logger.service'
import { DateService } from '../shared/date.service'

export interface User {
  id: number
  name: string
  email: string
  createdAt: string
}

@Injectable()
export class UsersService {
  private users: User[] = []
  private idCounter = 0

  // LoggerService et DateService injectés par type — disponibles grâce à imports: [SharedModule]
  constructor(
    private readonly logger: LoggerService,
    private readonly dateService: DateService,
  ) {}

  findAll(): User[] {
    return this.users
  }

  create(data: { name: string; email: string }): User {
    const user: User = {
      id: ++this.idCounter,
      name: data.name,
      email: data.email,
      createdAt: this.dateService.now(), // DateService fournit le timestamp — pas new Date() inline
    }
    this.users.push(user)
    this.logger.log('UsersService', `Created user: ${user.name}`)
    return user
  }
}
```

```ts
// src/users/users.controller.ts
import { Controller, Get, Post, Body } from '@nestjs/common'
import { UsersService } from './users.service'

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll()
  }

  @Post()
  create(@Body() body: { name: string; email: string }) {
    // Controller = orchestration uniquement — aucune logique métier
    return this.usersService.create(body)
  }
}
```

```ts
// src/users/users.module.ts
import { Module } from '@nestjs/common'
import { SharedModule } from '../shared/shared.module'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'

@Module({
  imports: [SharedModule], // rend LoggerService + DateService injectables dans UsersService
  controllers: [UsersController],
  providers: [UsersService],
  // UsersService n'est pas exporté ici — il n'est pas partagé avec d'autres modules
})
export class UsersModule {}
```

```ts
// src/products/products.service.ts
import { Injectable } from '@nestjs/common'
import { LoggerService } from '../shared/logger.service'
import { DateService } from '../shared/date.service'

export interface Product {
  id: number
  name: string
  price: number
  createdAt: string
}

@Injectable()
export class ProductsService {
  private products: Product[] = []
  private idCounter = 0

  constructor(
    private readonly logger: LoggerService,
    private readonly dateService: DateService, // même singleton DateService que UsersService
  ) {}

  findAll(): Product[] {
    return this.products
  }

  create(data: { name: string; price: number }): Product {
    const product: Product = {
      id: ++this.idCounter,
      name: data.name,
      price: data.price,
      createdAt: this.dateService.now(),
    }
    this.products.push(product)
    this.logger.log('ProductsService', `Created product: ${product.name}`)
    return product
  }
}
```

```ts
// src/products/products.controller.ts
import { Controller, Get, Post, Body } from '@nestjs/common'
import { ProductsService } from './products.service'

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll() {
    return this.productsService.findAll()
  }

  @Post()
  create(@Body() body: { name: string; price: number }) {
    return this.productsService.create(body)
  }
}
```

```ts
// src/products/products.module.ts
import { Module } from '@nestjs/common'
import { SharedModule } from '../shared/shared.module'
import { ProductsController } from './products.controller'
import { ProductsService } from './products.service'

@Module({
  imports: [SharedModule], // même SharedModule — NestJS retourne la même instance singleton
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
```

```ts
// src/database/database.module.ts
import { Module, DynamicModule, Global } from '@nestjs/common'

// Constante exportée = token injectable et importable par les tests
// Évite les typos vs la string 'DATABASE_CONFIG' inline
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
      module: DatabaseModule, // obligatoire — identifie le module propriétaire du DynamicModule
      providers: [
        {
          provide: DATABASE_CONFIG,
          useValue: config, // la config passée à forRoot devient un provider injectable
        },
      ],
      exports: [DATABASE_CONFIG], // @Global + exports = injectable partout dans l'app
    }
  }
}
```

```ts
// src/app.module.ts — déjà présent dans le scaffold, vérifier qu'il ressemble à ça
import { Module } from '@nestjs/common'
import { SharedModule } from './shared/shared.module'
import { UsersModule } from './users/users.module'
import { ProductsModule } from './products/products.module'
import { DatabaseModule } from './database/database.module'

@Module({
  imports: [
    // DatabaseModule.forRoot crée un DynamicModule configuré avec { type: 'memory' }
    // @Global sur DatabaseModule → DATABASE_CONFIG injectable dans UsersModule et ProductsModule
    // sans imports: [DatabaseModule] dans chacun d'eux
    DatabaseModule.forRoot({ type: 'memory' }),
    SharedModule, // optionnel ici si les feature modules l'importent eux-mêmes
    UsersModule,
    ProductsModule,
  ],
})
export class AppModule {}
```

## Variante J+30 (fading)

Même exercice, sans consulter le corrigé. Contraintes supplémentaires :

1. Rendre `DatabaseModule` configurable via `forRootAsync`. Ajouter une méthode `forRootAsync({ imports?, useFactory, inject? }): DynamicModule` qui accepte une factory. Tester que `DatabaseModule.forRootAsync({ useFactory: () => ({ type: 'memory' }) })` fonctionne comme `forRoot({ type: 'memory' })`.

2. Créer un `CoreModule` marqué `@Global()` qui exporte `LoggerService`. Le charger dans `AppModule` et retirer l'import de `SharedModule` dans `UsersModule` et `ProductsModule` (qui n'en ont plus besoin pour `LoggerService`). Observer : `DateService` doit encore être dans `SharedModule`. Comprendre pourquoi.

3. Ajouter un `InvitationModule` vide qui `imports: [UsersModule]` (pour vérifier qu'un utilisateur existe avant d'inviter). Exporter `UsersService` depuis `UsersModule`. Injecter `UsersService` dans un `InvitationService` minimal et vérifier que l'app démarre.

Temps cible : 35 minutes sans le corrigé.

## Application TribuZen

Les patterns de ce lab s'appliquent directement à l'architecture TribuZen.

Commit cible dans `smaurier/tribuzen` :

```
feat(modules): structure API TribuZen en feature modules par domaine
```

Mapping des patterns :

| Lab (générique) | TribuZen | Pattern appris |
|-----------------|----------|----------------|
| `SharedModule` | `SharedModule` (DateService, etc.) | exports + singleton garanti |
| `UsersModule` | `FamilyModule` | feature module avec imports SharedModule |
| `ProductsModule` | `PostModule` | feature module + import FamilyModule pour valider |
| `DatabaseModule.forRoot` | `DatabaseModule.forRoot` (Prisma URL) | DynamicModule configurable |

Fichiers à créer dans TribuZen :

- `apps/api/src/shared/shared.module.ts` — exports DateService + utilitaires communs
- `apps/api/src/family/family.module.ts` — imports SharedModule, exports FamilyService
- `apps/api/src/family/family.controller.ts` — GET /families, POST /families
- `apps/api/src/post/post.module.ts` — imports FamilyModule + SharedModule
- `apps/api/src/post/post.controller.ts` — GET /posts, POST /posts

Critère de done : `GET /families` répond 200 avec un tableau, `POST /families` crée une famille avec `createdAt` fourni par `DateService`, les deux modules partagent la même instance singleton de `LoggerService`.
