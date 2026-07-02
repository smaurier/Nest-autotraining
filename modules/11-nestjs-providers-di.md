---
titre: NestJS providers et DI
cours: 09-nestjs
notions: [provider et décorateur Injectable, injection de dépendances et conteneur IoC, injection par constructeur, providers custom useClass useValue useFactory, tokens d'injection, scopes singleton request transient, exports entre modules]
outcomes: [créer un service Injectable et l'injecter dans un controller, définir un provider custom (useValue/useFactory), comprendre les scopes, partager un provider entre modules]
prerequis: [10-nestjs-controllers]
next: 12-nestjs-modules
libs: [{ name: "@nestjs/common", version: "^11" }]
tribuzen: FamilyService injecté dans FamilyController (logique métier TribuZen découplée)
last-reviewed: 2026-07
---

# NestJS providers et DI

> **Outcomes — tu sauras FAIRE :** créer un service `@Injectable()` et l'injecter dans un controller, définir un provider custom avec `useValue` ou `useFactory`, choisir le bon scope, partager un provider entre modules via `exports`.
> **Difficulté :** :star::star::star:

## 1. Cas concret d'abord

TribuZen doit décider si un utilisateur peut rejoindre une famille. La règle métier — vérifier que la famille n'est pas pleine, que l'invitation est valide — ne doit pas vivre dans le controller. Tu essaies d'écrire `FamilyController` et tu bloques immédiatement :

```ts
// ❌ tentative naïve — couplage fort
@Controller('families')
export class FamilyController {
  private familyService = new FamilyService() // impossible : FamilyService dépend de la DB
  // Et si FamilyService change de constructeur ? → tout casse ici
}
```

NestJS résout ça avec un conteneur IoC. Tu déclares ce dont tu as besoin ; NestJS instancie et injecte :

```ts
// ✅ avec DI — découplé
@Controller('families')
export class FamilyController {
  constructor(private readonly familyService: FamilyService) {} // NestJS fournit l'instance
}
```

Ce module explique le mécanisme complet : `@Injectable()`, conteneur IoC, providers custom, tokens, scopes, partage entre modules.

## 2. Théorie complète, concise

### 2.1 `@Injectable()` et le conteneur IoC

`@Injectable()` est un décorateur de classe qui dit au conteneur NestJS : « gère cette classe pour moi ». Sans lui, la classe ne peut pas être injectée ni recevoir des dépendances via DI.

```ts
import { Injectable } from '@nestjs/common'

@Injectable()
export class FamilyService {
  private families: string[] = []

  findAll(): string[] {
    return this.families
  }

  canJoin(familyId: string): boolean {
    // règle métier TribuZen — isolée ici, testable séparément
    return this.families.includes(familyId)
  }
}
```

Le conteneur IoC (Inversion of Control) de NestJS maintient un registre des providers. Au démarrage, il résout les dépendances dans le bon ordre, instancie les singletons une seule fois, et les distribue à ceux qui en ont besoin.

Les trois acteurs :

| Acteur | Rôle | Exemple |
|--------|------|---------|
| Provider | La classe ou valeur injectée | `FamilyService` |
| Consumer | La classe qui déclare un besoin | `FamilyController` |
| Conteneur | Instancie et distribue | Géré par NestJS |

Pour que NestJS sache qu'un provider existe, il doit être déclaré dans le tableau `providers` du `@Module()` :

```ts
@Module({
  controllers: [FamilyController],
  providers: [FamilyService], // enregistrement obligatoire
})
export class FamilyModule {}
```

### 2.2 Injection par constructeur

C'est le mécanisme standard. NestJS lit les métadonnées TypeScript du constructeur (via `emitDecoratorMetadata: true` dans `tsconfig.json`) et résout les types comme tokens d'injection.

```ts
@Controller('families')
export class FamilyController {
  // Le type FamilyService sert de token — NestJS cherche ce provider dans le module
  constructor(private readonly familyService: FamilyService) {}

  @Get()
  findAll() {
    return this.familyService.findAll()
  }
}
```

`private readonly` : `private` empêche l'accès depuis l'extérieur, `readonly` empêche la réassignation. Ce pattern est la norme dans tout code NestJS.

Un service peut lui-même injecter d'autres services — NestJS résout la chaîne de dépendances automatiquement :

```ts
@Injectable()
export class FamilyService {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,
  ) {}
}
```

### 2.3 Custom providers

Par défaut, `providers: [FamilyService]` est un raccourci pour `{ provide: FamilyService, useClass: FamilyService }`. NestJS propose quatre formes longues.

#### `useClass` — remplacer l'implémentation

```ts
// Classe abstraite = contrat
export abstract class NotificationService {
  abstract send(to: string, message: string): Promise<void>
}

@Injectable()
export class EmailNotificationService extends NotificationService {
  async send(to: string, message: string) { /* envoi email */ }
}

@Module({
  providers: [
    {
      provide: NotificationService,       // token = la classe abstraite
      useClass: EmailNotificationService, // implémentation concrète
    },
  ],
})
export class NotificationModule {}
```

Les consommateurs dépendent du contrat (`NotificationService`), pas de l'implémentation. Changer l'implémentation ne touche aucun consumer.

#### `useValue` — valeur fixe ou mock

```ts
@Module({
  providers: [
    {
      provide: 'APP_CONFIG',
      useValue: { maxFamilySize: 12, inviteExpiryDays: 7 },
    },
  ],
})
export class AppModule {}

@Injectable()
export class FamilyService {
  // @Inject() obligatoire pour les tokens non-classe
  constructor(@Inject('APP_CONFIG') private config: { maxFamilySize: number }) {}
}
```

`useValue` est aussi la forme idiomatique pour remplacer un service par un mock dans les tests unitaires (`Test.createTestingModule`).

#### `useFactory` — création dynamique ou asynchrone

```ts
@Module({
  providers: [
    ConfigService,
    {
      provide: 'DATABASE_CONNECTION',
      useFactory: async (config: ConfigService) => {
        const url = config.get('DATABASE_URL')
        return await createDatabaseConnection(url) // opération async réelle
      },
      inject: [ConfigService], // tokens résolus par NestJS, passés à la factory dans l'ordre
    },
  ],
})
export class DatabaseModule {}
```

La factory peut être `async` — NestJS attend la Promise avant de continuer le démarrage. La propriété `inject` peut inclure des tokens optionnels : `{ token: 'SomeProvider', optional: true }`.

#### Récapitulatif des formes

| Forme | Valeur produite | Cas type |
|-------|-----------------|----------|
| `useClass` | nouvelle instance de la classe | swap d'implémentation, pattern Strategy |
| `useValue` | valeur telle quelle | config, constantes, mocks de test |
| `useFactory` | retour de la factory (peut être async) | connexion DB, sélection conditionnelle |
| `useExisting` | alias vers une instance existante du conteneur | rétro-compatibilité |

### 2.4 Tokens d'injection

Le token est l'identifiant qu'utilise NestJS pour retrouver un provider dans son registre.

**Token par type de classe (défaut) — aucun `@Inject()` nécessaire**

```ts
constructor(private readonly service: FamilyService) {}
```

**Token par string — `@Inject()` obligatoire**

```ts
@Module({
  providers: [{ provide: 'MAX_FAMILY_SIZE', useValue: 12 }],
})
export class AppModule {}

constructor(@Inject('MAX_FAMILY_SIZE') private maxSize: number) {}
```

**Token par Symbol — recommandé pour les tokens non-classe**

```ts
// family.tokens.ts
export const FAMILY_CONFIG = Symbol('FAMILY_CONFIG')

@Module({
  providers: [{ provide: FAMILY_CONFIG, useValue: { maxSize: 12 } }],
})
export class FamilyModule {}

constructor(@Inject(FAMILY_CONFIG) private config: FamilyConfig) {}
```

Les Symbols évitent les collisions de noms entre modules. Deux modules ne peuvent pas se retrouver avec le même `Symbol('FAMILY_CONFIG')` — contrairement aux strings `'FAMILY_CONFIG'` qui sont globales et peuvent entrer en conflit.

### 2.5 Scopes des providers

Par défaut, tout provider est un singleton. NestJS offre trois scopes :

| Scope | Comportement | Cas d'usage |
|-------|-------------|-------------|
| `DEFAULT` (singleton) | Une instance partagée par toute l'app | 95 % des cas — services, repositories |
| `REQUEST` | Une nouvelle instance par requête HTTP | Logger avec request ID, contexte multi-tenant |
| `TRANSIENT` | Une nouvelle instance par consumer | Objets avec état local par consommateur |

```ts
import { Injectable, Scope } from '@nestjs/common'

// Singleton — par défaut, pas besoin de le déclarer
@Injectable()
export class FamilyService {}

// Request-scoped — nouvelle instance par requête HTTP
@Injectable({ scope: Scope.REQUEST })
export class RequestContextService {
  private requestId: string
  setId(id: string) { this.requestId = id }
  getId() { return this.requestId }
}

// Transient — nouvelle instance par consumer
@Injectable({ scope: Scope.TRANSIENT })
export class AuditLogService {
  private entries: string[] = []
  add(entry: string) { this.entries.push(entry) }
}
```

Pour les providers custom, le scope se place dans l'objet de définition :

```ts
{
  provide: 'CACHE_MANAGER',
  useClass: CacheManager,
  scope: Scope.TRANSIENT,
}
```

**Propagation du scope REQUEST :** un provider `REQUEST`-scoped rend automatiquement `REQUEST`-scoped tous ses consommateurs remontant jusqu'au controller. Chaque requête crée une nouvelle instance — coût CPU/mémoire non négligeable si la chaîne est longue.

### 2.6 Exports entre modules

Un provider déclaré dans `FamilyModule` n'est accessible que dans ce module. Pour le partager, il faut l'exporter et que le module consommateur l'importe :

```ts
// family.module.ts
@Module({
  providers: [FamilyService],
  exports: [FamilyService], // disponible pour tout module qui importe FamilyModule
})
export class FamilyModule {}

// notification.module.ts
@Module({
  imports: [FamilyModule],         // FamilyService devient injectable dans ce module
  providers: [NotificationService],
})
export class NotificationModule {}

@Injectable()
export class NotificationService {
  constructor(private readonly familyService: FamilyService) {} // fonctionne
}
```

L'instance partagée est la même singleton — NestJS ne la recrée pas pour chaque module importeur. Pour un provider custom, on peut exporter par token : `exports: ['CONNECTION']`.

## 3. Worked examples

### Exemple A — FamilyService injectable dans FamilyController

```ts
// src/family/family.service.ts
import { Injectable, Inject } from '@nestjs/common'

export interface Family {
  id: string
  name: string
  memberCount: number
}

export interface FamilyConfig {
  maxFamilySize: number
}

@Injectable()
export class FamilyService {
  // Store en mémoire — remplacé par Prisma au module 14
  private families: Family[] = [
    { id: 'fam-1', name: 'Famille Martin', memberCount: 3 },
    { id: 'fam-2', name: 'Famille Dupont', memberCount: 12 },
  ]

  constructor(
    // @Inject() obligatoire pour le token string — TypeScript ne sait pas le déduire
    @Inject('FAMILY_CONFIG') private readonly config: FamilyConfig,
  ) {}

  findAll(): Family[] {
    return this.families
  }

  canJoin(familyId: string): boolean {
    const family = this.families.find(f => f.id === familyId)
    if (!family) return false
    // Règle métier TribuZen — isolée dans le service, pas dans le controller
    return family.memberCount < this.config.maxFamilySize
  }
}
```

```ts
// src/family/family.controller.ts
import { Controller, Get, Param, NotFoundException } from '@nestjs/common'
import { FamilyService } from './family.service'

@Controller('families')
export class FamilyController {
  // NestJS lit le type FamilyService, cherche le provider dans le module, injecte le singleton
  constructor(private readonly familyService: FamilyService) {}

  @Get()
  findAll() {
    // Controller = orchestration uniquement, zéro logique métier
    return this.familyService.findAll()
  }

  @Get(':id/can-join/:userId')
  canJoin(@Param('id') id: string, @Param('userId') _userId: string) {
    const family = this.familyService.findAll().find(f => f.id === id)
    if (!family) throw new NotFoundException(`Famille ${id} introuvable`)
    return { canJoin: this.familyService.canJoin(id) }
  }
}
```

```ts
// src/family/family.module.ts
import { Module } from '@nestjs/common'
import { FamilyService } from './family.service'
import { FamilyController } from './family.controller'

@Module({
  controllers: [FamilyController],
  providers: [
    FamilyService,
    // useValue : valeur constante, aucune logique de création
    {
      provide: 'FAMILY_CONFIG',
      useValue: { maxFamilySize: 12 },
    },
  ],
  exports: [FamilyService], // FamilyService injectable dans tout module qui importe FamilyModule
})
export class FamilyModule {}
```

**Pas-à-pas :** (1) `@Injectable()` sur `FamilyService` — NestJS peut l'instancier et la gérer ; (2) `providers: [FamilyService]` dans `@Module()` — l'enregistrement est obligatoire, sans lui NestJS lève `Nest can't resolve dependencies` ; (3) le constructeur de `FamilyController` déclare `FamilyService` — NestJS résout le type comme token et injecte le singleton ; (4) `@Inject('FAMILY_CONFIG')` dans `FamilyService` — obligatoire car le token est une string, pas un type de classe ; (5) `exports: [FamilyService]` — d'autres modules peuvent importer `FamilyModule` et injecter `FamilyService`.

### Exemple B — provider `useFactory` conditionnel avec token Symbol

```ts
// src/storage/storage.interface.ts

export interface StorageService {
  upload(path: string, data: Buffer): Promise<string>
}

// Symbol = token unique — deux modules déclarant Symbol('STORAGE_SERVICE')
// obtiennent deux tokens distincts, impossible avec une string
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
    return `file://${path}`
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
    return `s3://bucket/${path}`
  }
}
```

```ts
// src/storage/storage.module.ts
import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { LocalStorageService } from './local-storage.service'
import { S3StorageService } from './s3-storage.service'
import { STORAGE_SERVICE } from './storage.interface'

@Module({
  providers: [
    LocalStorageService,
    S3StorageService,
    {
      provide: STORAGE_SERVICE,
      // useFactory : sélection conditionnelle à l'exécution
      // ConfigService est injecté via inject: [ConfigService]
      useFactory: (config: ConfigService) => {
        return config.get('NODE_ENV') === 'production'
          ? new S3StorageService()
          : new LocalStorageService()
      },
      inject: [ConfigService], // NestJS résout ConfigService et le passe à la factory
    },
  ],
  exports: [STORAGE_SERVICE], // on exporte le token, pas la classe
})
export class StorageModule {}
```

```ts
// src/family/family.service.ts (extrait — injection du storage via Symbol)
import { Injectable, Inject } from '@nestjs/common'
import { STORAGE_SERVICE, StorageService } from '../storage/storage.interface'

@Injectable()
export class FamilyService {
  constructor(
    @Inject('FAMILY_CONFIG') private readonly config: { maxFamilySize: number },
    // @Inject() obligatoire : le token est un Symbol, pas un type de classe
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  async uploadAvatar(familyId: string, data: Buffer): Promise<string> {
    // FamilyService ne sait pas si le storage est local ou S3
    return this.storage.upload(`families/${familyId}/avatar`, data)
  }
}
```

**Pas-à-pas :** (1) `STORAGE_SERVICE = Symbol(...)` — token unique, pas de collision ; (2) `useFactory` reçoit `ConfigService` via `inject: [ConfigService]` — NestJS le résout et le passe en premier paramètre ; (3) la factory retourne `LocalStorageService` ou `S3StorageService` selon l'environnement — `FamilyService` n'en sait rien ; (4) `exports: [STORAGE_SERVICE]` — on exporte le token Symbol pour que les modules importeurs puissent injecter via le même Symbol ; (5) `@Inject(STORAGE_SERVICE)` dans `FamilyService` — obligatoire pour les tokens Symbol.

## 4. Pièges & misconceptions

- **Provider absent du tableau `providers`.** `@Injectable()` ne suffit pas. Si `FamilyService` n'est pas dans `providers: [FamilyService]` du module, NestJS lève `Nest can't resolve dependencies of FamilyController (?). Please make sure that the argument FamilyService at index [0] is available in the FamilyModule context`. Correction : toujours déclarer le provider dans le module qui le possède.

- **Token string sans `@Inject()`.** `constructor(private config: 'APP_CONFIG')` est du TypeScript invalide et NestJS ne peut pas résoudre un token string depuis le type du paramètre. Seuls les types de classe fonctionnent sans `@Inject()`. Correction : `constructor(@Inject('APP_CONFIG') private config: AppConfig)` systématiquement pour les tokens string et Symbol.

- **État mutable dans un singleton.** Un service `DEFAULT`-scoped est partagé par toutes les requêtes simultanées. Un tableau `private items = []` dans un singleton est partagé : la requête A voit les données ajoutées par la requête B. Correction : ne pas stocker d'état par-requête dans un singleton — utiliser `Scope.REQUEST` ou externaliser l'état dans une couche persistance (Prisma, Redis).

- **`useClass` et `useExisting` confondus.** `useClass: SomeService` crée une nouvelle instance de `SomeService` distincte de celle déjà dans le conteneur. `useExisting: SomeService` pointe vers l'instance déjà existante — aucune nouvelle instance. Si tu veux un alias vers la même instance singleton, c'est `useExisting`.

- **Scope `REQUEST` cascade invisible.** Rendre un provider `REQUEST`-scoped rend automatiquement `REQUEST`-scoped tous ses consommateurs remontant jusqu'au controller. Un seul service `REQUEST`-scoped injecté dans un service partagé peut désoptimiser toute une sous-arborescence. Vérifier la portée avant d'ajouter `Scope.REQUEST`.

- **Oublier `exports` pour partager entre modules.** Un provider défini dans `FamilyModule` sans `exports: [FamilyService]` est privé à ce module. Un module qui importe `FamilyModule` sans cet export obtiendra `Nest can't resolve dependencies`. Correction : ajouter le provider à `exports` dès qu'il doit être accessible depuis l'extérieur du module.

## 5. Ancrage TribuZen

Couche fil-rouge : **FamilyService injecté dans FamilyController (logique métier TribuZen découplée)** (`smaurier/tribuzen`).

- `FamilyService` concentre toutes les règles métier familles : `canJoin()`, `canInvite()`, `canKick()`. Le controller orchestre sans logique — il appelle le service et traduit en réponse HTTP.
- `'FAMILY_CONFIG'` (puis `FAMILY_CONFIG` Symbol) injecte la configuration métier sans hard-code dans le service — `maxFamilySize`, `inviteExpiryDays` configurables par environnement.
- `STORAGE_SERVICE` sélectionne `LocalStorageService` en dev et `S3StorageService` en prod via `useFactory` + `ConfigService` — le controller de photo de profil reste identique dans les deux environnements.
- `FamilyService` est exporté depuis `FamilyModule` et réutilisé dans `NotificationModule`, `InvitationModule` — même instance singleton distribuée, zéro recréation.
- `RequestContextService` (`Scope.REQUEST`) pourra tenir le `userId` extrait du JWT sans polluer `FamilyService` singleton.

Structure cible dans `smaurier/tribuzen` :

```
apps/api/src/
  family/
    family.service.ts        ← FamilyService @Injectable(), logique métier
    family.controller.ts     ← FamilyController injecte FamilyService
    family.module.ts         ← providers + useValue config + exports
    family.tokens.ts         ← FAMILY_CONFIG = Symbol(...)
  storage/
    storage.interface.ts     ← STORAGE_SERVICE Symbol + interface StorageService
    local-storage.service.ts
    s3-storage.service.ts
    storage.module.ts        ← useFactory conditionnel
```

## 6. Points clés

1. `@Injectable()` rend une classe gérable par le conteneur IoC — sans lui, pas d'injection possible.
2. Déclaration obligatoire dans `providers: [...]` du `@Module()` — le décorateur seul ne suffit pas.
3. Injection par constructeur = type TypeScript comme token ; `@Inject(token)` obligatoire pour les tokens string ou Symbol.
4. `useClass` remplace l'implémentation d'un token ; `useValue` injecte une constante ; `useFactory` crée dynamiquement (peut être `async`) avec `inject: [...]`.
5. `useExisting` crée un alias vers une instance déjà dans le conteneur — distinct de `useClass` qui crée une nouvelle instance.
6. `DEFAULT` (singleton) = une instance pour toute l'app ; `REQUEST` = une par requête HTTP ; `TRANSIENT` = une par consumer.
7. Scope `REQUEST` est contagieux : il propage automatiquement à tous les consommateurs remontants.
8. `exports: [FamilyService]` dans le module propriétaire + `imports: [FamilyModule]` dans le module consommateur — les deux sont nécessaires.

## 7. Seeds Anki

```
Que fait @Injectable() et pourquoi est-il insuffisant seul ?|Il marque la classe comme gérable par le conteneur IoC mais NestJS ne l'enregistre que si elle est aussi dans providers: [...] du @Module()
Quel token NestJS utilise-t-il pour l'injection par constructeur ?|Le type TypeScript de la classe déclarée dans le constructeur — NestJS lit les métadonnées via emitDecoratorMetadata
Quand @Inject() est-il obligatoire ?|Toujours pour les tokens string et Symbol — NestJS ne peut pas déduire un token non-classe depuis le type du paramètre
Différence useClass vs useExisting ?|useClass crée une nouvelle instance de la classe cible ; useExisting pointe vers l'instance déjà existante dans le conteneur (alias sans création)
Comment useFactory reçoit-il ses dépendances ?|Via la propriété inject: [...] dans l'objet provider — NestJS résout les tokens listés et les passe en ordre à la fonction factory
Pourquoi préférer Symbol à string pour un token d'injection ?|Un Symbol est unique par définition — deux modules qui déclarent Symbol('CONFIG') obtiennent deux tokens distincts, impossible avec des strings globales
Qu'est-ce que la propagation du scope REQUEST ?|Un provider REQUEST-scoped rend automatiquement REQUEST-scoped tous ses consommateurs jusqu'au controller — nouvelle instance à chaque requête
Comment partager FamilyService entre FamilyModule et NotificationModule ?|exports: [FamilyService] dans FamilyModule + imports: [FamilyModule] dans NotificationModule — les deux sont nécessaires
```

## Pont vers le lab

> Lab associé : `09-nestjs/labs/lab-11-providers-di/README.md`. Tu y implémentes `FamilyService` injectable, un provider `useValue` de configuration, et un provider `useFactory` conditionnel — corrigé complet commenté + variante J+30 dans le README.
