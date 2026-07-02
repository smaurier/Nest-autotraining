# Lab 11 — NestJS providers et DI

> **Outcome :** à la fin, tu sais créer un service `@Injectable()`, l'injecter dans un controller, et définir des providers custom (`useValue`, `useFactory`) dans un module NestJS 11.
> **Vrai outil :** NestJS 11 (`@nestjs/common`, `@nestjs/core`).
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

Tu construis le module `FamilyModule` de TribuZen dans un projet NestJS 11 existant. Pas de gap-fill — tu écris tout de A à Z à partir d'un projet vierge (`nest new tribuzen-di`).

Objectif fonctionnel :

- `GET /families` → retourne la liste des familles
- `GET /families/:id/can-join/:userId` → retourne `{ canJoin: boolean }`
- Un provider `useValue` injecte la config `{ maxFamilySize: number }` dans `FamilyService`
- Un provider `useFactory` choisit un `StorageService` (local ou S3) selon `NODE_ENV`
- `FamilyService` est exporté et injectable dans un `NotificationModule` séparé

## Étapes (en friction)

1. Créer `src/family/family.service.ts` avec `@Injectable()`. Implémenter `findAll()` (store en mémoire) et `canJoin(familyId)` qui retourne `false` si la famille n'existe pas. Enregistrer dans `FamilyModule.providers`.

2. Créer `src/family/family.controller.ts` qui injecte `FamilyService` par constructeur (`private readonly`). Implémenter `GET /families` et `GET /families/:id/can-join/:userId`. Aucune logique métier dans le controller.

3. Ajouter un provider `useValue` dans `FamilyModule` avec le token string `'FAMILY_CONFIG'` et la valeur `{ maxFamilySize: 12 }`. Injecter ce token dans `FamilyService` via `@Inject()`. Utiliser `config.maxFamilySize` dans `canJoin()` pour refuser les familles pleines.

4. Créer `src/storage/storage.interface.ts` (interface `StorageService` + `STORAGE_SERVICE = Symbol('STORAGE_SERVICE')`), `LocalStorageService` et `S3StorageService`. Ajouter un provider `useFactory` qui retourne `LocalStorageService` si `NODE_ENV !== 'production'`, sinon `S3StorageService`. Injecter `STORAGE_SERVICE` dans `FamilyService` via `@Inject()`.

5. Ajouter `exports: [FamilyService]` dans `FamilyModule`. Créer `NotificationModule` qui `imports: [FamilyModule]` et injecte `FamilyService` dans `NotificationService`. Vérifier que l'app démarre sans erreur et que `GET /families` répond 200.

## Corrigé complet commenté

```ts
// src/family/family.service.ts
import { Injectable, Inject } from '@nestjs/common'
import { STORAGE_SERVICE, StorageService } from '../storage/storage.interface'

export interface Family {
  id: string
  name: string
  memberCount: number
}

export interface FamilyConfig {
  maxFamilySize: number
}

@Injectable() // NestJS peut instancier et injecter cette classe
export class FamilyService {
  // Store en mémoire — sera remplacé par Prisma au module 14
  private families: Family[] = [
    { id: 'fam-1', name: 'Famille Martin', memberCount: 3 },
    { id: 'fam-2', name: 'Famille Dupont', memberCount: 12 },
  ]

  constructor(
    // @Inject() obligatoire pour token string — TypeScript ne peut pas le déduire
    @Inject('FAMILY_CONFIG') private readonly config: FamilyConfig,
    // @Inject() obligatoire pour token Symbol
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  findAll(): Family[] {
    return this.families
  }

  canJoin(familyId: string): boolean {
    const family = this.families.find(f => f.id === familyId)
    if (!family) return false
    // Règle métier TribuZen — isolée dans le service, testable sans controller
    return family.memberCount < this.config.maxFamilySize
  }

  async uploadAvatar(familyId: string, data: Buffer): Promise<string> {
    // FamilyService ne sait pas si le storage est local ou S3 — découplage réel
    return this.storage.upload(`families/${familyId}/avatar`, data)
  }
}
```

```ts
// src/family/family.controller.ts
import { Controller, Get, Param, NotFoundException } from '@nestjs/common'
import { FamilyService } from './family.service'

@Controller('families')
export class FamilyController {
  // NestJS lit le type FamilyService, cherche le provider, injecte le singleton
  constructor(private readonly familyService: FamilyService) {}

  @Get()
  findAll() {
    // Aucune logique métier — uniquement orchestration et réponse HTTP
    return this.familyService.findAll()
  }

  @Get(':id/can-join/:userId')
  canJoin(@Param('id') id: string, @Param('userId') _userId: string) {
    const family = this.familyService.findAll().find(f => f.id === id)
    // 404 si famille inexistante — responsabilité du controller
    if (!family) throw new NotFoundException(`Famille ${id} introuvable`)
    return { canJoin: this.familyService.canJoin(id) }
  }
}
```

```ts
// src/storage/storage.interface.ts

export interface StorageService {
  upload(path: string, data: Buffer): Promise<string>
}

// Symbol = token unique par définition — pas de collision possible entre modules
export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE')
```

```ts
// src/storage/local-storage.service.ts
import { Injectable } from '@nestjs/common'
import type { StorageService } from './storage.interface'

@Injectable()
export class LocalStorageService implements StorageService {
  async upload(path: string, _data: Buffer): Promise<string> {
    console.log(`[local] upload ${path}`)
    return `file://${path}` // simulation dev — pas d'écriture disque réelle ici
  }
}
```

```ts
// src/storage/s3-storage.service.ts
import { Injectable } from '@nestjs/common'
import type { StorageService } from './storage.interface'

@Injectable()
export class S3StorageService implements StorageService {
  async upload(path: string, _data: Buffer): Promise<string> {
    console.log(`[s3] upload ${path}`)
    return `s3://bucket/${path}` // simulation prod — AWS SDK réel en production
  }
}
```

```ts
// src/family/family.module.ts
import { Module } from '@nestjs/common'
import { FamilyService } from './family.service'
import { FamilyController } from './family.controller'
import { LocalStorageService } from '../storage/local-storage.service'
import { S3StorageService } from '../storage/s3-storage.service'
import { STORAGE_SERVICE } from '../storage/storage.interface'

@Module({
  controllers: [FamilyController],
  providers: [
    FamilyService,

    // useValue : valeur constante — aucune logique, instanciée une fois
    {
      provide: 'FAMILY_CONFIG',
      useValue: { maxFamilySize: 12 } satisfies { maxFamilySize: number },
    },

    // useFactory : sélection conditionnelle à l'exécution
    // Dans un vrai projet, injecter ConfigService via inject: [ConfigService]
    {
      provide: STORAGE_SERVICE,
      useFactory: (): LocalStorageService | S3StorageService => {
        // La factory s'exécute au démarrage, une seule fois (singleton par défaut)
        return process.env.NODE_ENV === 'production'
          ? new S3StorageService()
          : new LocalStorageService()
      },
      // inject: [] est vide ici — on lit process.env directement
      // Étape 4 de la variante J+30 : remplacer par inject: [ConfigService]
    },
  ],
  // Sans exports, FamilyService est privé à FamilyModule
  exports: [FamilyService],
})
export class FamilyModule {}
```

```ts
// src/notification/notification.service.ts
import { Injectable } from '@nestjs/common'
import { FamilyService } from '../family/family.service'

@Injectable()
export class NotificationService {
  constructor(
    // FamilyService injectable grâce à imports: [FamilyModule] dans NotificationModule
    // Même instance singleton que dans FamilyController — NestJS ne la recrée pas
    private readonly familyService: FamilyService,
  ) {}

  notifyFamilies(): string[] {
    return this.familyService.findAll().map(f => `Notified: ${f.name}`)
  }
}
```

```ts
// src/notification/notification.module.ts
import { Module } from '@nestjs/common'
import { FamilyModule } from '../family/family.module'
import { NotificationService } from './notification.service'

@Module({
  imports: [FamilyModule],           // importe le module qui possède et exporte FamilyService
  providers: [NotificationService],  // NotificationService peut maintenant injecter FamilyService
})
export class NotificationModule {}
```

## Variante J+30 (fading)

Même exercice, sans consulter le corrigé. Contraintes supplémentaires :

1. Remplacer le token string `'FAMILY_CONFIG'` par `FAMILY_CONFIG = Symbol('FAMILY_CONFIG')` défini dans `src/family/family.tokens.ts`. Mettre à jour le `providers` du module et le `@Inject()` dans `FamilyService`.

2. Ajouter `ConfigService` (une classe simple avec `get(key: string): string`) injectable dans `FamilyModule`. Faire passer `ConfigService` à la `useFactory` du `STORAGE_SERVICE` via `inject: [ConfigService]`. La factory lit `config.get('NODE_ENV')` au lieu de `process.env` directement.

3. Rendre `NotificationService` `REQUEST`-scoped (`@Injectable({ scope: Scope.REQUEST })`). Observer la cascade : que se passe-t-il sur `FamilyService` ? Documenter en commentaire pourquoi ce scope n'est pas idéal ici.

Temps cible : 30 minutes sans le corrigé.

## Application TribuZen

Commit cible dans `smaurier/tribuzen` :

```
feat(family): FamilyService injectable + providers custom useValue/useFactory
```

Fichiers à créer :

- `apps/api/src/family/family.service.ts`
- `apps/api/src/family/family.controller.ts`
- `apps/api/src/family/family.module.ts`
- `apps/api/src/family/family.tokens.ts`
- `apps/api/src/storage/storage.interface.ts`
- `apps/api/src/storage/local-storage.service.ts`
- `apps/api/src/storage/s3-storage.service.ts`
- `apps/api/src/notification/notification.service.ts`
- `apps/api/src/notification/notification.module.ts`

Critère de done : `GET /families` répond 200 avec la liste, `GET /families/fam-2/can-join/user-x` répond `{ canJoin: false }` car `fam-2` a 12 membres = `maxFamilySize`.
