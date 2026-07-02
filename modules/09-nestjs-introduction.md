---
titre: NestJS introduction
cours: 09-nestjs
notions: [pourquoi NestJS sur Express, architecture modulaire, décorateurs TypeScript, aperçu de l'injection de dépendances, CLI nest, structure controllers providers modules, plateforme Express ou Fastify, bootstrap main.ts]
outcomes: [expliquer ce que NestJS apporte sur Express nu, générer une app avec le CLI, situer controllers/providers/modules, comprendre le rôle des décorateurs]
prerequis: [08-express-auth-securite]
next: 10-nestjs-controllers
libs: [{ name: "@nestjs/core", version: "^11" }, { name: node, version: "22" }]
tribuzen: bootstrap de l'API NestJS TribuZen (structure modulaire familles/posts/invitations)
last-reviewed: 2026-07
---

# NestJS introduction

> **Outcomes — tu sauras FAIRE :** expliquer ce que NestJS apporte sur Express nu, générer une app avec le CLI, situer controllers/providers/modules dans la structure générée, comprendre le rôle des décorateurs.
> **Difficulté :** :star::star:

## 1. Cas concret d'abord

À l'issue des modules Express, ton `api/src/` ressemble à ça :

```
src/
  index.ts          ← app + middlewares + montage routers (200 lignes)
  routes/
    familles.ts     ← CRUD familles
    invitations.ts  ← à créer
    posts.ts        ← à créer
  middleware/
    auth.ts
    logger.ts
  utils/
    errors.ts
```

Un nouveau membre de l'équipe arrive et pose la question : *«où est-ce que je mets la logique d'envoi d'e-mail d'invitation ? Dans `routes/invitations.ts` ? Dans un `services/` que j'invente ? Comment je récupère le service d'e-mail dans le handler de route ?»*

Pas de réponse évidente. Tu as créé ta propre architecture — qui n'est pas celle du prochain développeur.

Avant de lire la suite, essaie mentalement de répondre à ces deux questions :
1. Comment diviserais-tu ce code en «domaines» (familles, posts, invitations) chacun avec ses propres fichiers ?
2. Comment un handler de route obtiendrait-il une instance d'un service partagé sans l'instancier lui-même ?

Ce module répond exactement à ça.

## 2. Théorie complète, concise

### 2.1 Pourquoi NestJS sur Express

Express est intentionnellement minimaliste : il expose les primitives HTTP et laisse tout le reste au développeur. C'est sa force pour les petits projets, et sa faiblesse dès que l'équipe grandit.

| Problème Express | Solution NestJS |
|------------------|-----------------|
| Aucune structure imposée — chaque repo est différent | Architecture modulaire avec conventions claires |
| Injection de dépendances manuelle (`require`, factories) | DI intégré via conteneur IoC |
| Middleware artisanal pour la validation | Pipes + `class-validator` intégrés |
| Gestion d'erreurs via un middleware en bas de fichier | Exception filters intégrés avec HTTP exceptions prêtes |
| TypeScript optionnel, `tsconfig` à configurer soi-même | TypeScript par défaut, pré-configuré |
| Tests Jest à câbler manuellement | Jest (ou Vitest) pré-configuré avec mocking DI |

NestJS n'est pas «mieux» qu'Express — c'est Express plus une couche d'organisation. Le runtime HTTP est toujours Express (ou Fastify) en dessous.

### 2.2 Architecture modulaire

NestJS organise le code en **modules**. Un module est une frontière de domaine : tout ce qui concerne les familles vit dans `FamillesModule`, tout ce qui concerne les invitations vit dans `InvitationsModule`.

```
src/
  familles/
    familles.module.ts      ← frontière du domaine
    familles.controller.ts  ← routing HTTP
    familles.service.ts     ← logique métier
  invitations/
    invitations.module.ts
    invitations.controller.ts
    invitations.service.ts
  app.module.ts             ← module racine, importe les autres
  main.ts                   ← bootstrap
```

La règle : un module déclare ses propres controllers et providers. Pour qu'un module utilise un service d'un autre module, il l'importe explicitement. Cette règle rend les dépendances visibles et le refactoring prévisible.

### 2.3 Décorateurs TypeScript

Un décorateur est une fonction qui s'applique à une classe, une méthode ou un paramètre avec la syntaxe `@NomDuDecorateur`. NestJS les utilise massivement pour exprimer le rôle de chaque composant sans code d'enregistrement manuel.

```ts
// @Module() — déclare une frontière de domaine
@Module({
  imports: [],          // autres modules dont celui-ci dépend
  controllers: [],      // controllers qui reçoivent les requêtes HTTP
  providers: [],        // services injectables dans ce module
  exports: [],          // providers exposés aux modules importateurs
})
export class FamillesModule {}

// @Controller() — marque une classe comme handler de routes HTTP
@Controller('familles')
export class FamillesController {}

// @Injectable() — marque une classe comme injectable via le conteneur DI
@Injectable()
export class FamillesService {}

// Décorateurs de méthode HTTP
@Get()          // GET /familles
@Post()         // POST /familles
@Get(':id')     // GET /familles/:id
@Patch(':id')   // PATCH /familles/:id
@Delete(':id')  // DELETE /familles/:id

// Décorateurs de paramètre — extraient les données de la requête
@Param('id') id: string      // req.params.id en Express
@Body() dto: CreateFamilleDto // req.body
@Query('page') page: string  // req.query.page
```

Sous le capot, un décorateur est une fonction qui attache des métadonnées à la classe via `Reflect.metadata`. NestJS lit ces métadonnées au démarrage pour câbler le routing et le conteneur DI. Il n'y a pas de magie : c'est du code TypeScript qui s'exécute au moment de la définition de la classe.

Pour que les décorateurs fonctionnent, deux options dans `tsconfig.json` doivent être activées :

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

`nest new` les active automatiquement. Sur un projet existant, oublier ces deux lignes fait planter le conteneur DI au démarrage.

### 2.4 Aperçu de l'injection de dépendances

L'injection de dépendances (DI) est le mécanisme par lequel NestJS instancie et fournit les services à ceux qui en ont besoin, sans que tu gères le `new` manuellement.

Principe en trois étapes :

1. **Déclarer** le service injectable avec `@Injectable()`
2. **Enregistrer** le service dans le `providers` d'un `@Module`
3. **Demander** le service via le constructeur du controller (ou d'un autre service)

```ts
// 1. Le service déclare qu'il est injectable
@Injectable()
export class FamillesService {
  private familles: Famille[] = []

  findAll(): Famille[] {
    return this.familles
  }
}

// 2. Le module enregistre le service
@Module({
  controllers: [FamillesController],
  providers: [FamillesService],   // ← sans ça, l'injection échoue
})
export class FamillesModule {}

// 3. Le controller reçoit le service via le constructeur
@Controller('familles')
export class FamillesController {
  constructor(private readonly famillesService: FamillesService) {}
  //          ↑ NestJS lit le type TypeScript, instancie FamillesService
  //            et l'injecte ici automatiquement

  @Get()
  findAll() {
    return this.famillesService.findAll()
  }
}
```

Le conteneur IoC de NestJS résout le graphe de dépendances au démarrage. Si `FamillesService` dépend lui-même d'un autre service, NestJS l'instancie aussi — récursivement, sans que tu n'écrive de factory.

### 2.5 CLI nest

La CLI est l'outil principal pour scaffolder un projet et générer des fichiers :

```bash
# Installer la CLI globalement
npm i -g @nestjs/cli

# Vérifier la version (11.x)
nest --version

# Créer un nouveau projet
nest new tribuzen-api
# → choisir pnpm ou npm

# Générer les briques d'un domaine
nest g module familles       # crée familles/familles.module.ts + màj app.module.ts
nest g controller familles   # crée familles.controller.ts + spec
nest g service familles      # crée familles.service.ts + spec

# Tout d'un coup (module + controller + service + DTOs + entity)
nest g resource familles
# → choisir "REST API", puis "Yes" pour CRUD
```

Tableau des raccourcis CLI :

| Commande longue | Raccourci | Résultat |
|-----------------|-----------|---------|
| `nest g module` | `nest g mo` | Module |
| `nest g controller` | `nest g co` | Controller + spec |
| `nest g service` | `nest g s` | Service + spec |
| `nest g resource` | `nest g res` | Module + Controller + Service + DTOs + entity |
| `nest g guard` | `nest g gu` | Guard |
| `nest g pipe` | `nest g pi` | Pipe |
| `nest g interceptor` | `nest g itc` | Interceptor |
| `nest g filter` | `nest g f` | Exception filter |
| `nest g middleware` | `nest g mi` | Middleware |

Règle : utiliser systématiquement la CLI pour générer des fichiers. Elle applique les conventions de nommage, ajoute les bons décorateurs, et met à jour le module parent automatiquement. Générer manuellement est une source d'oublis (décorateur manquant, module non mis à jour).

### 2.6 Structure controllers / providers / modules

Après `nest new tribuzen-api`, la structure générée :

```
src/
  app.controller.ts       ← controller racine avec GET /
  app.controller.spec.ts  ← test unitaire du controller racine
  app.module.ts           ← module racine (importe tous les autres)
  app.service.ts          ← service racine (getHello)
  main.ts                 ← bootstrap — point d'entrée unique
test/
  app.e2e-spec.ts         ← test e2e (supertest sur le serveur réel)
nest-cli.json             ← config CLI (sourceRoot, entryFile, plugins)
tsconfig.json             ← config TS avec experimentalDecorators activé
```

Rôle de chaque brique :

- **Module** : frontière de domaine. Déclare qui appartient à quoi. Ne contient pas de logique.
- **Controller** : reçoit les requêtes HTTP, extrait les paramètres, délègue au service. Ne contient pas de logique métier.
- **Service (Provider)** : contient la logique métier, accès à la base de données, appels externes. Injectable.

Le pattern obligatoire : un controller ne crée jamais ses propres données — il appelle un service. Un service ne sait pas qu'il est dans un contexte HTTP — il pourrait être appelé depuis un job cron ou un test unitaire.

### 2.7 Plateforme Express ou Fastify

NestJS abstrait la couche HTTP. Tu choisis l'adaptateur au bootstrap :

**Express** (défaut depuis toujours, Express 5 par défaut depuis NestJS 11) :

```ts
// main.ts — Express (défaut, pas besoin d'importer l'adaptateur)
const app = await NestFactory.create(AppModule)
await app.listen(process.env.PORT ?? 3000)
```

**Fastify** (performances brutes supérieures sur HTTP pur) :

```ts
import { NestFactory } from '@nestjs/core'
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  )
  await app.listen(process.env.PORT ?? 3000)
}
bootstrap()
```

Installation Fastify : `npm install @nestjs/platform-fastify`

Comparaison pratique :

| | Express | Fastify |
|--|---------|---------|
| Ecosystème middlewares | Immense (historique) | Plugins Fastify dédiés |
| Performance brute | Bonne | Meilleure sur HTTP pur |
| Cas courant | API généralistes | APIs haute fréquence |
| Compatibilité Nest | Parfaite | Parfaite, API Nest identique |

Pour apprendre NestJS : Express suffit. L'architecture Nest est la même dans les deux cas — tu changes l'adaptateur sans toucher à tes modules, controllers et services.

### 2.8 Bootstrap main.ts

`main.ts` est le seul fichier qui sait que l'application est une application Node. Les modules ne connaissent pas leur contexte d'exécution.

```ts
// src/main.ts — NestJS 11, Express (défaut)
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  // NestFactory.create instancie le conteneur IoC complet à partir du module racine
  // Résout le graphe de dépendances, initialise tous les modules
  const app = await NestFactory.create(AppModule)

  // Préfixe global — toutes les routes commencent par /api
  // GET /familles devient GET /api/familles
  app.setGlobalPrefix('api')

  // CORS — à configurer avec les origines autorisées en production
  app.enableCors()

  // process.env.PORT ?? 3000 — pattern NestJS 11
  // ?? (nullish coalescing) = utilise 3000 seulement si PORT est null/undefined
  await app.listen(process.env.PORT ?? 3000)
}

bootstrap()
// bootstrap() est appelé sans await au niveau module — intentionnel
// Node.js attend la résolution de la Promise avant de traiter les requêtes
```

`NestFactory.create(AppModule)` déclenche :
1. Construction du conteneur IoC
2. Résolution du graphe de dépendances (qui dépend de qui)
3. Instanciation des modules dans l'ordre des imports
4. Enregistrement des routes dans le router Express sous-jacent
5. Démarrage du serveur HTTP

## 3. Worked examples

### Exemple A — Bootstrap complet d'un module familles TribuZen

Voici la séquence complète : CLI → structure → fichiers.

```bash
nest new tribuzen-api --package-manager pnpm
cd tribuzen-api
nest g module familles
nest g controller familles
nest g service familles
```

Résultat de structure :

```
src/
  familles/
    familles.controller.spec.ts
    familles.controller.ts
    familles.module.ts
    familles.service.ts
  app.module.ts     ← mis à jour automatiquement par la CLI
  app.service.ts
  app.controller.ts
  main.ts
```

```ts
// src/familles/familles.service.ts
import { Injectable } from '@nestjs/common'

// @Injectable() = ce service peut être injecté dans d'autres classes
// NestJS lit cette métadonnée au bootstrap pour construire le conteneur
@Injectable()
export class FamillesService {
  // Store en mémoire — remplacé par Prisma au module 10 (PostgreSQL)
  private familles: { id: string; nom: string }[] = []

  findAll() {
    return this.familles
  }

  findOne(id: string) {
    return this.familles.find(f => f.id === id) ?? null
  }

  create(nom: string) {
    const famille = { id: crypto.randomUUID(), nom }
    this.familles.push(famille)
    return famille
  }
}
```

```ts
// src/familles/familles.controller.ts
import { Controller, Get, Post, Param, Body } from '@nestjs/common'
import { FamillesService } from './familles.service'

// @Controller('familles') — toutes les routes de ce controller sont sous /familles
@Controller('familles')
export class FamillesController {
  // NestJS injecte FamillesService ici — tu ne fais jamais new FamillesService()
  // private readonly = convention : le service ne sera pas réassigné
  constructor(private readonly famillesService: FamillesService) {}

  // @Get() sans argument → GET /familles
  @Get()
  findAll() {
    // Retourner directement l'objet — NestJS sérialise en JSON automatiquement
    return this.famillesService.findAll()
  }

  // @Get(':id') → GET /familles/:id
  @Get(':id')
  findOne(@Param('id') id: string) {
    // @Param('id') extrait req.params.id — équivalent Express
    return this.famillesService.findOne(id)
  }

  // @Post() → POST /familles
  @Post()
  create(@Body() body: { nom: string }) {
    // @Body() extrait req.body parsé — NestJS parse le JSON automatiquement
    return this.famillesService.create(body.nom)
  }
}
```

```ts
// src/familles/familles.module.ts
import { Module } from '@nestjs/common'
import { FamillesController } from './familles.controller'
import { FamillesService } from './familles.service'

@Module({
  // controllers — reçoivent les requêtes HTTP, ne sont pas injectables
  controllers: [FamillesController],
  // providers — injectables dans ce module (et dans les modules importateurs si exportés)
  providers: [FamillesService],
})
export class FamillesModule {}
```

```ts
// src/app.module.ts — mis à jour automatiquement par la CLI
import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { FamillesModule } from './familles/familles.module'

@Module({
  // imports = modules dont ce module a besoin
  // FamillesModule expose ses controllers → Nest les enregistre dans le router
  imports: [FamillesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

```ts
// src/main.ts — NestJS 11
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.setGlobalPrefix('api')
  await app.listen(process.env.PORT ?? 3000)
}
bootstrap()
```

Pas-à-pas : (1) `nest g module familles` crée `familles.module.ts` et ajoute `FamillesModule` dans `imports` de `app.module.ts` — la CLI s'en charge ; (2) le controller reçoit `FamillesService` via le constructeur — NestJS résout le type TypeScript et injecte l'instance ; (3) `@Controller('familles')` + `@Get(':id')` = la route finale est `GET /api/familles/:id` grâce au `setGlobalPrefix('api')` dans `main.ts` ; (4) le controller ne fait jamais de `new FamillesService()` — c'est le conteneur qui gère l'instance unique (singleton par défaut).

### Exemple B — Comparaison Express vs NestJS côte à côte

```ts
// === Express — router familles ===
import { Router } from 'express'

const router = Router()
// Instanciation manuelle — si FamillesService change de constructeur, tous les fichiers qui font new FamillesService() doivent être mis à jour
const service = new FamillesService()

router.get('/', (_req, res) => {
  res.json(service.findAll())
})

router.get('/:id', (req, res) => {
  const f = service.findOne(req.params.id)
  if (!f) return res.status(404).json({ error: 'Introuvable' })
  res.json(f)
})

export default router
```

```ts
// === NestJS — controller familles ===
import { Controller, Get, Param, NotFoundException } from '@nestjs/common'
import { FamillesService } from './familles.service'

@Controller('familles')
export class FamillesController {
  constructor(private readonly famillesService: FamillesService) {}
  // ↑ Injection automatique — si FamillesService change, NestJS s'adapte

  @Get()
  findAll() {
    return this.famillesService.findAll()
    // NestJS sérialise automatiquement en JSON avec status 200
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    const f = this.famillesService.findOne(id)
    if (!f) throw new NotFoundException(`Famille ${id} introuvable`)
    // NotFoundException → NestJS répond automatiquement :
    // { "statusCode": 404, "message": "Famille ...", "error": "Not Found" }
    return f
  }
}
```

Pas-à-pas : (1) Express — `new FamillesService()` est manuel ; si le service a des dépendances à son tour, tu gères la chaîne de `new` ; (2) NestJS — `private readonly famillesService: FamillesService` dans le constructeur suffit : le type est lu, l'instance est fournie ; (3) Express — `res.status(404).json(...)` est artisanal ; NestJS — `throw new NotFoundException(...)` déclenche le filtre d'exceptions intégré qui répond avec le bon format JSON et le bon status.

## 4. Pièges & misconceptions

- **Provider non déclaré dans `providers` du module.** `@Injectable()` ne suffit pas. Sans `providers: [FamillesService]` dans le `@Module`, NestJS ne sait pas que ce service existe et lève `Nest can't resolve dependencies of FamillesController`. Le décorateur ajoute des métadonnées, mais c'est le module qui enregistre le provider dans le conteneur IoC. Correction : vérifier `providers` dans `familles.module.ts`.

- **`emitDecoratorMetadata: false` dans tsconfig.** Les décorateurs d'injection (`@Injectable`, `@Controller`) reposent sur les métadonnées TypeScript pour connaître le type des paramètres du constructeur. Sans `emitDecoratorMetadata: true`, NestJS ne peut pas résoudre les dépendances et lève une erreur au démarrage. Correction : vérifier `tsconfig.json` — `nest new` l'active, mais un projet migré depuis zéro peut l'avoir oublié.

- **`bootstrap()` sans `async/await`.** `NestFactory.create()` retourne une Promise. Sans `await`, le serveur ne démarre pas réellement avant que Node.js ait continué l'exécution du module — comportement non déterministe. Correction : `async function bootstrap() { const app = await NestFactory.create(...) ; await app.listen(...) }`.

- **Confondre `controllers` et `providers` dans `@Module`.** Un service mis dans `controllers` lève une erreur silencieuse (NestJS ignore les providers déclarés comme controllers). Un controller mis dans `providers` n'enregistre pas ses routes. La règle : les classes avec `@Controller` vont dans `controllers`, les classes avec `@Injectable` vont dans `providers`.

- **`@Injectable()` ne crée pas un singleton global.** Par défaut, NestJS crée une instance par module (singleton dans le scope du module, pas de l'application entière). Pour partager un service entre modules, le module qui le détient doit l'exporter dans `exports: [FamillesService]` et le module consommateur doit importer `FamillesModule`. Sans l'export, le service est privé au module.

- **Penser que NestJS remplace Express.** NestJS s'appuie sur Express (ou Fastify) en dessous. `app.use(middleware)` fonctionne toujours. Un middleware Express compatible peut être utilisé dans NestJS. La stack Express est là — NestJS ajoute une couche d'organisation au-dessus.

## 5. Ancrage TribuZen

Couche fil-rouge : **bootstrap de l'API NestJS TribuZen (structure modulaire familles/posts/invitations)** (`smaurier/tribuzen`).

L'API TribuZen démarre avec trois modules de domaine :

```
tribuzen/
  apps/
    api/
      src/
        familles/
          familles.module.ts
          familles.controller.ts   ← GET /api/familles, POST /api/familles, etc.
          familles.service.ts      ← logique CRUD, remplacé par Prisma au module 10
        posts/
          posts.module.ts
          posts.controller.ts      ← GET /api/posts (posts d'une famille)
          posts.service.ts
        invitations/
          invitations.module.ts
          invitations.controller.ts ← POST /api/invitations, PATCH /api/invitations/:id/accept
          invitations.service.ts    ← logique d'envoi e-mail (module 12)
        app.module.ts              ← importe FamillesModule, PostsModule, InvitationsModule
        main.ts                    ← NestFactory.create + setGlobalPrefix('api')
```

Ce que chaque module des cours suivants apporte à cette base :
- **Module 10 (Controllers avancés)** : DTOs typés, `@HttpCode`, `@Query` avec validation.
- **Module 11 (Providers avancés)** : `exports`, modules partagés (ex. `NotificationsModule` utilisé par `InvitationsModule`).
- **Module 12 (PostgreSQL + Prisma)** : les services passent de tableaux en mémoire à `PrismaService`.
- **Module 14 (Auth)** : guards JWT sur les routes protégées.

À ce stade (module 09), le store est en mémoire et il n'y a pas de validation des DTOs — c'est intentionnel pour se concentrer sur la structure modulaire.

## 6. Points clés

1. NestJS = Express (ou Fastify) + architecture modulaire + TypeScript natif + DI intégré. Le runtime HTTP reste Express.
2. Trio fondamental : **Module** (frontière de domaine) → **Controller** (routing HTTP) → **Service/Provider** (logique métier).
3. `@Module({ imports, controllers, providers, exports })` — les quatre clés du décorateur de module.
4. `@Injectable()` + enregistrement dans `providers` du module = condition nécessaire et suffisante pour l'injection.
5. `@Controller('prefix')` + `@Get(':id')` = route finale composée : `GET /prefix/:id` (plus `setGlobalPrefix` si défini).
6. `NestFactory.create(AppModule)` résout le graphe DI complet au démarrage — erreurs DI détectées avant la première requête.
7. `experimentalDecorators: true` + `emitDecoratorMetadata: true` dans `tsconfig.json` — obligatoires pour que la DI fonctionne.
8. `nest g resource <name>` génère l'ensemble module + controller + service + DTOs + entity et met à jour le module parent.
9. Express ou Fastify — même API NestJS (modules, decorateurs, DI), seul l'adaptateur change dans `NestFactory.create`.

## 7. Seeds Anki

```
Quel problème fondamental NestJS résout-il par rapport à Express nu ?|Absence de structure imposée : chaque équipe invente sa propre architecture. NestJS apporte modules/controllers/services avec des conventions claires et une DI intégrée.
Quelles sont les trois briques fondamentales de NestJS et leurs rôles ?|Module = frontière de domaine (déclare les composants) ; Controller = reçoit les requêtes HTTP et délègue ; Service/Provider = logique métier injectable
Quelle condition double est nécessaire pour qu'un service soit injectable ?|1) Décorer la classe avec @Injectable() ; 2) L'enregistrer dans le tableau providers du @Module correspondant — l'un sans l'autre ne suffit pas
Que fait NestFactory.create(AppModule) au démarrage ?|Instancie le conteneur IoC, résout le graphe de dépendances, enregistre toutes les routes dans le router HTTP sous-jacent (Express ou Fastify)
Quels deux flags tsconfig.json sont obligatoires pour la DI NestJS ?|experimentalDecorators: true (active les décorateurs) et emitDecoratorMetadata: true (permet à NestJS de lire les types des paramètres de constructeur)
Comment partager un service FamillesService entre deux modules NestJS ?|Ajouter FamillesService dans exports: [FamillesService] de FamillesModule, puis importer FamillesModule dans le module consommateur
Différence entre controllers et providers dans @Module ?|controllers = classes avec @Controller — NestJS enregistre leurs routes HTTP ; providers = classes avec @Injectable — NestJS les instancie et les injecte
Quelle commande CLI génère module + controller + service + DTOs d'un coup ?|nest g resource <name> (ou nest g res <name>) — choisir "REST API" puis "Yes" pour le CRUD
```

## Pont vers le lab

> Lab associé : `09-nestjs/labs/lab-09-nestjs-premiers-pas/README.md`. Tu bootstrappes l'API NestJS TribuZen avec le CLI, génères le module `familles`, câbles controller et service, et valides les routes avec curl. Corrigé complet commenté + variante J+30 dans le README du lab.

---

| Navigation | Lien |
|------------|------|
| Module précédent | `09-nestjs/modules/08-express-auth-securite.md` |
| Module suivant | `09-nestjs/modules/10-nestjs-controllers.md` |
| Lab | `09-nestjs/labs/lab-09-nestjs-premiers-pas/README.md` |
