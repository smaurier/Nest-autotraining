# Lab 18 — NestJS testing

> **Outcome :** à la fin, tu sais écrire des tests unitaires d'un service NestJS avec dépendances mockées (`Test.createTestingModule` + `useValue`), tester un controller, et écrire un test e2e avec supertest + `overrideProvider`.
> **Vrai outil :** `@nestjs/testing` ^11, Jest, supertest ^7.
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

Tu testes le module famille de TribuZen dans le projet NestJS de ce lab. Les sources (`src/`) et les entêtes de tests (`test/`) sont fournis — tu écris les implémentations de tests de A à Z, sans gap-fill.

Objectif fonctionnel :

- Tests unitaires `FamilyService` : couvrir `canJoin` (famille pleine, place disponible, introuvable) et `invite` (succès, doublon bloqué)
- Tests unitaires `FamilyController` : vérifier la délégation au service et la propagation des exceptions
- Tests e2e `POST /families/:familyId/invitations` : couvrir 201, 400 (DTO), 400 (doublon), 404, 422 avec supertest

## Étapes (en friction)

1. Ouvre `src/family/family.service.spec.ts`. Crée un objet `mockPrisma` avec les méthodes `family.findUnique`, `invitation.findFirst` et `invitation.create` en `jest.fn()`. Construis le `TestingModule` dans `beforeEach` avec `FamilyService` et `{ provide: PrismaService, useValue: mockPrisma }`. Appelle `jest.clearAllMocks()` avant chaque test.

2. Écris les tests `canJoin` : (a) famille pleine retourne `false`, (b) place disponible retourne `true`, (c) `findUnique` retourne `null` → `NotFoundException`. Pour le cas (c), utilise `await expect(...).rejects.toThrow(NotFoundException)`.

3. Écris les tests `invite` : (a) `findFirst` retourne `null` → invitation créée, résultat match `{ familyId, email }` ; (b) `findFirst` retourne une invitation `PENDING` → `BadRequestException` et `create` n'est pas appelée (`not.toHaveBeenCalled()`).

4. Ouvre `src/family/family.controller.spec.ts`. Crée un `mockFamilyService` avec les méthodes `findAll`, `canJoin`, `invite`. Construis le `TestingModule` avec `FamilyController` et `{ provide: FamilyService, useValue: mockFamilyService }`. Teste la délégation pour chaque méthode du controller.

5. Ouvre `test/invitation.e2e-spec.ts`. Construis le `TestingModule` avec `imports: [AppModule]`, puis `.overrideProvider(PrismaService).useValue(mockPrisma)`. Dans `beforeAll`, crée l'app, applique `ValidationPipe({ whitelist: true, transform: true })` et appelle `app.init()`. Dans `afterAll`, appelle `app.close()`. Écris les 5 cas HTTP avec `request(app.getHttpServer())`.

## Corrigé complet commenté

```ts
// src/family/family.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { FamilyService } from './family.service'
import { PrismaService } from '../prisma/prisma.service'
import { NotFoundException, BadRequestException } from '@nestjs/common'

// Objet mock — chaque méthode est un jest.fn() indépendant
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
    // Reset systématique — chaque test repart avec des mocks vierges
    jest.clearAllMocks()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FamilyService,
        // useValue remplace PrismaService par le mock — zéro connexion DB
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
      // Arrange — configure le mock pour CE test uniquement
      mockPrisma.family.findUnique.mockResolvedValue({
        id: 'fam-1',
        memberCount: 12,
        maxSize: 12,
      })

      // Act
      const result = await service.canJoin('fam-1')

      // Assert
      expect(result).toBe(false)
      // Vérifier l'appel exact — le service ne doit pas sur-fetcher
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

      // await + .rejects obligatoires — sans await le test passe toujours vert
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
      // findFirst retourne null → pas de doublon
      mockPrisma.invitation.findFirst.mockResolvedValue(null)
      mockPrisma.invitation.create.mockResolvedValue({
        id: 'inv-1',
        familyId: 'fam-1',
        email: 'bob@tribu.fr',
        status: 'PENDING',
      })

      const result = await service.invite('fam-1', 'bob@tribu.fr')

      // toMatchObject tolère les champs futurs (id, createdAt) — le contrat reste stable
      expect(result).toMatchObject({ familyId: 'fam-1', email: 'bob@tribu.fr' })
      expect(mockPrisma.invitation.create).toHaveBeenCalledTimes(1)
    })

    it('lève BadRequestException si une invitation est déjà en attente', async () => {
      mockPrisma.family.findUnique.mockResolvedValue({
        id: 'fam-1',
        memberCount: 1,
        maxSize: 12,
      })
      // findFirst retourne une invitation PENDING → doublon
      mockPrisma.invitation.findFirst.mockResolvedValue({ id: 'inv-0', status: 'PENDING' })

      await expect(service.invite('fam-1', 'bob@tribu.fr')).rejects.toThrow(BadRequestException)
      // Vérifier qu'aucun effet de bord indésirable n'a eu lieu
      expect(mockPrisma.invitation.create).not.toHaveBeenCalled()
    })
  })
})
```

```ts
// src/family/family.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { FamilyController } from './family.controller'
import { FamilyService } from './family.service'
import { NotFoundException } from '@nestjs/common'

describe('FamilyController', () => {
  let controller: FamilyController

  // Mock du service — le controller délègue tout, aucune logique métier à tester ici
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
      // Le controller délègue — toHaveBeenCalledTimes(1) vérifie qu'il n'appelle pas deux fois
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
      // Le controller ne doit pas catcher l'exception — NestJS la gère via les filtres globaux
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

```ts
// test/invitation.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import * as request from 'supertest'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma/prisma.service'

// Mock centralisé — partagé entre tous les tests de ce fichier
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
      // overrideProvider remplace PrismaService dans tout l'arbre AppModule
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile()

    app = moduleRef.createNestApplication()
    // Même config que main.ts — sans ça, les tests e2e ne reflètent pas la prod
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    )
    await app.init()
  })

  afterAll(async () => {
    // Obligatoire — libère le port, sinon Jest attend le timeout
    await app.close()
  })

  beforeEach(() => {
    // Reset entre tests e2e — les mocks sont partagés dans ce fichier
    jest.clearAllMocks()
  })

  describe('POST /families/:familyId/invitations', () => {
    it('retourne 201 et l\'invitation créée', async () => {
      // Arrange — famille avec de la place + pas de doublon
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

      // toMatchObject — tolère les champs supplémentaires (id, timestamps)
      expect(res.body).toMatchObject({
        familyId: 'fam-1',
        email: 'bob@tribu.fr',
        status: 'PENDING',
      })
    })

    it('retourne 400 si email manquant (validation DTO)', () => {
      // Pas de mock nécessaire — ValidationPipe rejette avant d'atteindre le service
      return request(app.getHttpServer())
        .post('/families/fam-1/invitations')
        .send({})
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

## Variante J+30 (fading)

Même exercice, sans consulter le corrigé. Contraintes supplémentaires :

1. Ajouter un test `canJoin` sur le cas où `memberCount` vaut exactement `maxSize - 1` (la limite haute avant plein) — doit retourner `true`. Vérifier que le test échouerait si la comparaison utilisait `<=` au lieu de `<`.

2. Dans les tests e2e, ajouter l'authentification : créer un helper `getAuthToken(app)` qui appelle `POST /auth/login` avec un user mocké et retourne le token JWT. Protéger `POST /families/:id/invitations` avec un guard — le test doit envoyer `Authorization: Bearer <token>` et vérifier que sans token le retour est 401.

3. Remplacer le mock manuel `const mockPrisma = { family: { findUnique: jest.fn() } }` par `useMocker` de `@nestjs/testing` pour auto-générer les mocks des dépendances. Comparer la lisibilité et la maintenabilité avec le mock manuel.

Temps cible : 45 minutes sans le corrigé.

## Application TribuZen

Commit cible dans `smaurier/tribuzen` :

```
test(family): tests unitaires FamilyService + e2e flux invitation
```

Fichiers à créer :

- `apps/api/src/family/family.service.spec.ts`
- `apps/api/src/family/family.controller.spec.ts`
- `apps/api/test/invitation.e2e-spec.ts`

Critère de done : `npm test` passe avec les 3 fichiers de tests unitaires verts, `npm run test:e2e` passe avec les 5 cas e2e verts, aucun test ne dépend d'une vraie connexion Prisma.
