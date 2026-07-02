---
titre: NestJS testing
cours: 09-nestjs
notions: [Test.createTestingModule, tester un service avec providers mockés, overrideProvider, tester un controller, tests e2e avec supertest, mock de repository, isolation des dépendances, structure des tests NestJS]
outcomes: [écrire un test unitaire d'un service NestJS avec dépendances mockées, tester un controller, écrire un test e2e avec supertest, isoler proprement les dépendances]
prerequis: [17-prisma-avance-comparaison]
next: 19-nestjs-auth
libs: [{ name: "@nestjs/testing", version: "^11" }, { name: supertest, version: "^7" }]
tribuzen: tester FamilyService (unit) et le flux d'invitation (e2e supertest) de l'API TribuZen
last-reviewed: 2026-07
---

# NestJS testing

> **Outcomes — tu sauras FAIRE :** écrire un test unitaire d'un service NestJS avec dépendances mockées, tester un controller, écrire un test e2e avec supertest, isoler proprement les dépendances.
> **Difficulté :** :star::star::star:

## 1. Cas concret d'abord

TribuZen doit vérifier que `FamilyService.canJoin()` refuse une famille pleine. La logique lit la base Prisma. Tu essaies de tester directement :

```ts
// ❌ tentative naïve — instanciation directe impossible
const service = new FamilyService()
// FamilyService attend PrismaService dans son constructeur
// → TypeError: Cannot read properties of undefined (reading 'family')
```

Il faut un module de test isolé qui fournit un faux `PrismaService` à la place du vrai. NestJS l'appelle `Test.createTestingModule()`.

```ts
// ✅ avec Test.createTestingModule — isolation réelle
const module = await Test.createTestingModule({
  providers: [
    FamilyService,
    { provide: PrismaService, useValue: mockPrisma }, // faux Prisma, zéro DB
  ],
}).compile()

const service = module.get(FamilyService)
```

Ce module couvre le mécanisme complet : tests unitaires de services, tests de controllers, et tests e2e HTTP avec supertest sur le flux d'invitation TribuZen.

## 2. Théorie complète, concise

### 2.1 Test.createTestingModule

`Test.createTestingModule()` crée un module NestJS jetable, identique à un vrai `@Module()` mais dédié aux tests. Il accepte les mêmes clés (`imports`, `controllers`, `providers`) et supporte `.overrideProvider()` avant `.compile()`.

```ts
import { Test, TestingModule } from '@nestjs/testing'

const moduleRef: TestingModule = await Test.createTestingModule({
  controllers: [FamilyController],
  providers: [
    FamilyService,
    { provide: PrismaService, useValue: mockPrisma },
  ],
}).compile()

// Récupérer une instance depuis le conteneur de test
const service = moduleRef.get<FamilyService>(FamilyService)
const controller = moduleRef.get<FamilyController>(FamilyController)
```

`.compile()` retourne une Promise — toujours `await` dans `beforeEach` ou `beforeAll`.

### 2.2 Mocker les dépendances

La forme `useValue` remplace la dépendance réelle par un objet dont chaque méthode est un `jest.fn()`. Ce pattern évite toute connexion réseau ou DB dans les tests unitaires.

```ts
// Objet mock — réutilisable, réinitialisé avant chaque test
const mockPrisma = {
  family: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  invitation: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
}

beforeEach(() => {
  jest.clearAllMocks() // reset les compteurs et valeurs entre tests
})
```

Dans le test, on configure le comportement du mock pour chaque scénario :

```ts
// Arrange — la DB retourne une famille pleine
mockPrisma.family.findUnique.mockResolvedValue({
  id: 'fam-1',
  memberCount: 12,
  maxSize: 12,
})

// Act
const result = await service.canJoin('fam-1')

// Assert
expect(result).toBe(false)
expect(mockPrisma.family.findUnique).toHaveBeenCalledWith({
  where: { id: 'fam-1' },
})
```

### 2.3 overrideProvider

`overrideProvider()` remplace un provider déjà enregistré dans un module importé, sans modifier le module source. Utile pour les tests e2e où on importe `AppModule` entier mais on veut substituer un service.

```ts
const moduleRef = await Test.createTestingModule({
  imports: [AppModule], // importe tout le module réel
})
  .overrideProvider(PrismaService) // substitue PrismaService dans tout l'arbre
  .useValue(mockPrisma)
  .compile()

const app = moduleRef.createNestApplication()
await app.init()
```

`.overrideProvider()` est chaînable — plusieurs substitutions avant `.compile()` :

```ts
const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(PrismaService).useValue(mockPrisma)
  .overrideProvider(MailService).useValue({ send: jest.fn() })
  .compile()
```

### 2.4 Tester un controller

Le controller délègue au service — il ne contient pas de logique métier. Son test vérifie uniquement la délégation et la propagation des exceptions. On mocke le service entier avec `useValue`.

```ts
const mockFamilyService = {
  canJoin: jest.fn(),
  invite: jest.fn(),
  findAll: jest.fn(),
}

const moduleRef = await Test.createTestingModule({
  controllers: [FamilyController],
  providers: [{ provide: FamilyService, useValue: mockFamilyService }],
}).compile()

const controller = moduleRef.get(FamilyController)
```

`jest.spyOn()` est l'alternative quand on veut garder l'implémentation réelle et espionner les appels :

```ts
const spy = jest.spyOn(service, 'canJoin').mockResolvedValue(false)
await controller.canJoin('fam-1')
expect(spy).toHaveBeenCalledWith('fam-1')
spy.mockRestore()
```

### 2.5 Tests e2e avec supertest

Les tests e2e démarrent une vraie application NestJS (`INestApplication`) et envoient des requêtes HTTP via supertest. La DB est remplacée par `overrideProvider`.

```ts
import * as request from 'supertest'
import { INestApplication, ValidationPipe } from '@nestjs/common'

let app: INestApplication

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue(mockPrisma)
    .compile()

  app = moduleRef.createNestApplication()
  // Même config que main.ts — les tests e2e doivent refléter la prod
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  await app.init()
})

afterAll(async () => {
  await app.close() // libère le port et les connexions
})

it('POST /invitations retourne 201', () => {
  return request(app.getHttpServer())
    .post('/families/fam-1/invitations')
    .send({ email: 'bob@tribu.fr' })
    .expect(201)
})
```

`app.getHttpServer()` retourne le serveur HTTP sous-jacent (Express ou Fastify) — supertest le consomme directement sans bind de port.

## 3. Worked examples

### Exemple A — Test unitaire de FamilyService avec PrismaService mocké

```ts
// src/family/family.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { FamilyService } from './family.service'
import { PrismaService } from '../prisma/prisma.service'
import { NotFoundException, BadRequestException } from '@nestjs/common'

// Mock de la couche Prisma — zéro connexion DB dans ces tests
const mockPrisma = {
  family: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  invitation: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
}

describe('FamilyService', () => {
  let service: FamilyService

  beforeEach(async () => {
    jest.clearAllMocks() // chaque test repart avec des mocks vierges

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FamilyService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile()

    service = module.get<FamilyService>(FamilyService)
  })

  it('est défini', () => {
    expect(service).toBeDefined()
  })

  describe('canJoin', () => {
    it('retourne false si la famille est pleine', async () => {
      // Arrange — famille avec memberCount = maxSize
      mockPrisma.family.findUnique.mockResolvedValue({
        id: 'fam-1',
        memberCount: 12,
        maxSize: 12,
      })

      // Act
      const result = await service.canJoin('fam-1')

      // Assert
      expect(result).toBe(false)
      expect(mockPrisma.family.findUnique).toHaveBeenCalledWith({
        where: { id: 'fam-1' },
      })
    })

    it('retourne true si la famille a de la place', async () => {
      mockPrisma.family.findUnique.mockResolvedValue({
        id: 'fam-2',
        memberCount: 3,
        maxSize: 12,
      })

      expect(await service.canJoin('fam-2')).toBe(true)
    })

    it('lève NotFoundException si la famille est introuvable', async () => {
      mockPrisma.family.findUnique.mockResolvedValue(null)

      // await + .rejects obligatoires pour les erreurs asynchrones
      await expect(service.canJoin('fam-999')).rejects.toThrow(NotFoundException)
    })
  })

  describe('invite', () => {
    it('crée une invitation si aucune invitation en attente', async () => {
      mockPrisma.family.findUnique.mockResolvedValue({
        id: 'fam-1',
        memberCount: 3,
        maxSize: 12,
      })
      mockPrisma.invitation.findFirst.mockResolvedValue(null)
      mockPrisma.invitation.create.mockResolvedValue({
        id: 'inv-1',
        familyId: 'fam-1',
        email: 'bob@tribu.fr',
        status: 'PENDING',
      })

      const result = await service.invite('fam-1', 'bob@tribu.fr')

      expect(result).toMatchObject({ familyId: 'fam-1', email: 'bob@tribu.fr' })
      expect(mockPrisma.invitation.create).toHaveBeenCalledTimes(1)
    })

    it('lève BadRequestException si une invitation est déjà en attente', async () => {
      mockPrisma.family.findUnique.mockResolvedValue({
        id: 'fam-1',
        memberCount: 1,
        maxSize: 12,
      })
      mockPrisma.invitation.findFirst.mockResolvedValue({ id: 'inv-0', status: 'PENDING' })

      await expect(service.invite('fam-1', 'bob@tribu.fr')).rejects.toThrow(BadRequestException)
      // L'invitation existante bloque — create ne doit pas être appelée
      expect(mockPrisma.invitation.create).not.toHaveBeenCalled()
    })
  })
})
```

**Pas-à-pas :** (1) `jest.clearAllMocks()` dans `beforeEach` — les compteurs et valeurs retournées sont remis à zéro avant chaque test, évitant les interférences entre cas ; (2) `mockPrisma.family.findUnique.mockResolvedValue(null)` configure le mock pour ce test uniquement — le suivant repart d'un mock propre ; (3) `await expect(...).rejects.toThrow(NotFoundException)` — le `await` et `.rejects` sont obligatoires pour les erreurs asynchrones ; (4) `expect(mockPrisma.invitation.create).not.toHaveBeenCalled()` — vérifie qu'un effet de bord indésirable n'a pas eu lieu.

### Exemple B — Test unitaire de FamilyController

```ts
// src/family/family.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { FamilyController } from './family.controller'
import { FamilyService } from './family.service'
import { NotFoundException } from '@nestjs/common'

describe('FamilyController', () => {
  let controller: FamilyController

  const mockFamilyService = {
    findAll: jest.fn(),
    canJoin: jest.fn(),
    invite: jest.fn(),
  }

  beforeEach(async () => {
    jest.clearAllMocks()

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FamilyController],
      providers: [
        { provide: FamilyService, useValue: mockFamilyService },
      ],
    }).compile()

    controller = module.get<FamilyController>(FamilyController)
  })

  describe('findAll', () => {
    it('délègue à FamilyService.findAll et retourne le résultat', async () => {
      const families = [{ id: 'fam-1', name: 'Famille Martin' }]
      mockFamilyService.findAll.mockResolvedValue(families)

      const result = await controller.findAll()

      expect(result).toEqual(families)
      // Le controller délègue — pas de transformation propre
      expect(mockFamilyService.findAll).toHaveBeenCalledTimes(1)
    })
  })

  describe('canJoin', () => {
    it('retourne { canJoin: true } si FamilyService le permet', async () => {
      mockFamilyService.canJoin.mockResolvedValue(true)

      const result = await controller.canJoin('fam-1')

      expect(result).toEqual({ canJoin: true })
      expect(mockFamilyService.canJoin).toHaveBeenCalledWith('fam-1')
    })

    it('propage NotFoundException si FamilyService la lève', async () => {
      mockFamilyService.canJoin.mockRejectedValue(new NotFoundException('fam-999'))

      await expect(controller.canJoin('fam-999')).rejects.toThrow(NotFoundException)
    })
  })

  describe('invite', () => {
    it('délègue à FamilyService.invite et retourne l\'invitation créée', async () => {
      const invitation = { id: 'inv-1', familyId: 'fam-1', email: 'bob@tribu.fr' }
      mockFamilyService.invite.mockResolvedValue(invitation)

      const result = await controller.invite('fam-1', { email: 'bob@tribu.fr' })

      expect(result).toEqual(invitation)
      expect(mockFamilyService.invite).toHaveBeenCalledWith('fam-1', 'bob@tribu.fr')
    })
  })
})
```

**Pas-à-pas :** (1) Le controller est testé sans le service réel — `useValue: mockFamilyService` ; (2) on vérifie la délégation (`toHaveBeenCalledWith`) et la réponse, pas la logique métier ; (3) `mockRejectedValue` simule une exception lancée par le service — le controller ne la capture pas (NestJS la gère via les filtres d'exception globaux).

### Exemple C — Test e2e du flux d'invitation avec supertest

```ts
// test/invitation.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import * as request from 'supertest'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma/prisma.service'

// Mock centralisé — shared entre tous les tests e2e de ce fichier
const mockPrisma = {
  family: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  invitation: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
}

describe('Flux invitation TribuZen (E2E)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // overrideProvider remplace PrismaService dans tout l'arbre de modules
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile()

    app = moduleRef.createNestApplication()
    // Reproduire exactement la config de main.ts
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    )
    await app.init()
  })

  afterAll(async () => {
    await app.close() // libère le port — sans ça, Jest ne termine pas
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /families/:familyId/invitations', () => {
    it('retourne 201 et l\'invitation créée', async () => {
      // Arrange — famille avec de la place
      mockPrisma.family.findUnique.mockResolvedValue({
        id: 'fam-1',
        memberCount: 3,
        maxSize: 12,
      })
      mockPrisma.invitation.findFirst.mockResolvedValue(null)
      mockPrisma.invitation.create.mockResolvedValue({
        id: 'inv-1',
        familyId: 'fam-1',
        email: 'bob@tribu.fr',
        status: 'PENDING',
      })

      const res = await request(app.getHttpServer())
        .post('/families/fam-1/invitations')
        .send({ email: 'bob@tribu.fr' })
        .expect(201)

      expect(res.body).toMatchObject({
        familyId: 'fam-1',
        email: 'bob@tribu.fr',
        status: 'PENDING',
      })
    })

    it('retourne 400 si email manquant (validation DTO)', () => {
      return request(app.getHttpServer())
        .post('/families/fam-1/invitations')
        .send({}) // body vide → ValidationPipe rejette
        .expect(400)
    })

    it('retourne 400 si une invitation est déjà en attente', async () => {
      mockPrisma.family.findUnique.mockResolvedValue({
        id: 'fam-1',
        memberCount: 3,
        maxSize: 12,
      })
      mockPrisma.invitation.findFirst.mockResolvedValue({ id: 'inv-0', status: 'PENDING' })

      await request(app.getHttpServer())
        .post('/families/fam-1/invitations')
        .send({ email: 'bob@tribu.fr' })
        .expect(400)
    })

    it('retourne 404 si la famille est introuvable', async () => {
      mockPrisma.family.findUnique.mockResolvedValue(null)

      await request(app.getHttpServer())
        .post('/families/fam-1/invitations')
        .send({ email: 'bob@tribu.fr' })
        .expect(404)
    })

    it('retourne 422 si la famille est pleine', async () => {
      mockPrisma.family.findUnique.mockResolvedValue({
        id: 'fam-1',
        memberCount: 12,
        maxSize: 12,
      })

      await request(app.getHttpServer())
        .post('/families/fam-1/invitations')
        .send({ email: 'bob@tribu.fr' })
        .expect(422)
    })
  })
})
```

**Pas-à-pas :** (1) `overrideProvider(PrismaService).useValue(mockPrisma)` substitue Prisma dans tout `AppModule` sans modifier le code source ; (2) `app.useGlobalPipes(new ValidationPipe(...))` dans `beforeAll` — refléter exactement `main.ts` : le test à body vide doit retourner 400 exactement comme en prod ; (3) `await app.close()` dans `afterAll` — obligatoire, sinon Jest attend le timeout ; (4) `request(app.getHttpServer())` — pas de bind de port, supertest consomme le serveur HTTP directement ; (5) `beforeEach(() => jest.clearAllMocks())` — reset entre tests e2e pour éviter les contaminations de mocks.

## 4. Pièges & misconceptions

- **Oublier `jest.clearAllMocks()` dans `beforeEach`.** Si le test A configure `mockPrisma.family.findUnique.mockResolvedValue(null)` et que le test B ne le reconfigure pas, B hérite de la valeur de A. Le test B peut passer pour la mauvaise raison. Correction : `jest.clearAllMocks()` systématique dans chaque `beforeEach`.

- **Ne pas appliquer les mêmes pipes qu'en prod dans les tests e2e.** Un test e2e sans `ValidationPipe` accepte les corps de requête invalides. En prod, les requêtes sont rejetées. Les tests ne valident alors pas le vrai comportement. Correction : reproduire exactement la config de `main.ts` dans `beforeAll` (pipes, intercepteurs, filtres globaux).

- **Oublier `await app.close()` dans `afterAll`.** Jest affiche `Jest did not exit one second after the test run has completed` — le serveur HTTP tient le processus ouvert. Correction : `afterAll(async () => { await app.close() })` systématique dans chaque fichier e2e.

- **`await` manquant avec `.rejects.toThrow()`.** `expect(promise).rejects.toThrow('msg')` sans `await` passe toujours vert — le rejet n'est jamais observé par le runner. Correction : `await expect(promise).rejects.toThrow('msg')` systématiquement.

- **Mocker `PrismaService` avec `jest.mock()` au lieu de `useValue`.** `jest.mock('../prisma/prisma.service')` bypasse le conteneur NestJS — `module.get(PrismaService)` peut retourner `undefined`. Correction : toujours passer le mock via `{ provide: PrismaService, useValue: mockPrisma }` dans `Test.createTestingModule`.

- **Importer `AppModule` dans un test unitaire.** Un test unitaire qui importe `AppModule` démarre toutes les dépendances (Prisma, ConfigService, etc.) — lent et couplé à l'infra. Correction : les tests unitaires n'importent que les classes testées et leurs dépendances mockées via `providers`.

## 5. Ancrage TribuZen

Couche fil-rouge : **tester FamilyService (unit) et le flux d'invitation (e2e supertest) de l'API TribuZen** (`smaurier/tribuzen`).

- `FamilyService.canJoin()` est une règle métier critique — un bug silencieux peut laisser une famille dépasser sa taille maximale. Le test unitaire couvre les trois cas : famille pleine (`false`), place disponible (`true`), famille introuvable (`NotFoundException`).
- `FamilyService.invite()` protège contre les doublons d'invitation — `findFirst` est vérifié avant `create`. Le test vérifie que `create` n'est pas appelé si une invitation `PENDING` existe déjà.
- `FamilyController` ne contient aucune logique métier — son test vérifie uniquement la délégation et la propagation des exceptions.
- Le test e2e du flux d'invitation couvre les 5 cas HTTP : 201 (créée), 400 (validation DTO), 400 (doublon), 404 (famille inconnue), 422 (famille pleine). `overrideProvider(PrismaService)` remplace la vraie DB — les tests sont rapides et reproductibles en CI.
- `ValidationPipe` est appliqué dans `beforeAll` — le test e2e à body vide doit retourner 400, ce qui valide que la prod se comporterait pareil.

Structure cible dans `smaurier/tribuzen` :

```
apps/api/src/family/
  family.service.spec.ts    ← tests unitaires FamilyService (Exemple A)
  family.controller.spec.ts ← tests unitaires FamilyController (Exemple B)
apps/api/test/
  invitation.e2e-spec.ts    ← tests e2e flux invitation (Exemple C)
```

## 6. Points clés

1. `Test.createTestingModule()` crée un module NestJS isolé — mêmes clés qu'un vrai `@Module()`, mais jetable après les tests.
2. `module.get<T>(Token)` récupère une instance depuis le conteneur de test — toujours après `.compile()`.
3. `useValue` dans `providers` remplace une dépendance par un objet mocké — pattern universel pour les tests unitaires.
4. `overrideProvider(Token).useValue(mock)` remplace un provider dans un module importé — pattern standard pour les tests e2e avec `AppModule`.
5. `jest.clearAllMocks()` dans chaque `beforeEach` — évite les contaminations entre tests.
6. Tests e2e : `app.useGlobalPipes(...)` dans `beforeAll` doit refléter exactement `main.ts` — sinon les tests ne valident pas la prod.
7. `await app.close()` dans `afterAll` — obligatoire pour libérer le serveur HTTP et terminer Jest proprement.
8. `await expect(promise).rejects.toThrow(...)` — `await` et `.rejects` sont tous deux requis pour les erreurs asynchrones.

## 7. Seeds Anki

```
Quel est le rôle de Test.createTestingModule() ?|Créer un module NestJS isolé pour les tests — mêmes clés qu'un @Module() réel mais jetable. .compile() retourne une Promise à await
Comment récupérer une instance depuis un module de test ?|module.get<MonService>(MonService) après .compile() — utilise le même conteneur IoC que l'app réelle
Différence entre useValue dans providers et overrideProvider ?|useValue dans providers remplace à la déclaration (tests unitaires) ; overrideProvider remplace dans un module importé comme AppModule (tests e2e) avant .compile()
Pourquoi jest.clearAllMocks() dans chaque beforeEach ?|Les mocks conservent leur état (compteurs et valeurs retournées) entre tests. Sans reset un test peut passer grâce à la configuration d'un test précédent
Pourquoi reproduire ValidationPipe dans beforeAll des tests e2e ?|Sans ValidationPipe les requêtes invalides passent en test mais sont rejetées en prod — les tests ne valideraient pas le comportement réel
Quelle est la syntaxe correcte pour tester un rejet de Promise asynchrone ?|await expect(promise).rejects.toThrow('message') — sans await le rejet n'est jamais observé et le test passe toujours vert
Pourquoi await app.close() dans afterAll est-il obligatoire ?|Sans close() le serveur HTTP tient le processus Node.js ouvert — Jest affiche "did not exit" et attend le timeout
Comment supertest consomme-t-il l'app NestJS sans bind de port ?|request(app.getHttpServer()) — getHttpServer() retourne le serveur HTTP sous-jacent que supertest consomme directement en mémoire
```

## Pont vers le lab

> Lab associé : `09-nestjs/labs/lab-18-testing/README.md`. Tu y écris les tests unitaires de `FamilyService` (canJoin + invite) et le test e2e du flux d'invitation — corrigé complet commenté + variante J+30 dans le README.
