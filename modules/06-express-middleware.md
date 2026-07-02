---
titre: Express middleware
cours: 09-nestjs
notions: [concept de middleware, signature req res next, ordre d'exécution, middleware applicatif et de routeur, middleware d'erreur à 4 args, middleware intégrés json urlencoded static, middleware tiers cors helmet morgan, middleware custom réutilisable]
outcomes: [écrire un middleware custom, chaîner des middlewares dans le bon ordre, gérer les erreurs avec un middleware à 4 arguments, brancher cors/helmet/morgan]
prerequis: [05-express-fondamentaux]
next: 07-express-validation-erreurs
libs: [{ name: express, version: "^5" }, { name: node, version: "22" }]
tribuzen: middleware de l'API TribuZen (logging des requêtes, CORS, auth à venir)
last-reviewed: 2026-07
---

# Express middleware

> **Outcomes — tu sauras FAIRE :** écrire un middleware custom et réutilisable, chaîner des middlewares dans le bon ordre, gérer les erreurs avec un middleware à 4 arguments, brancher cors/helmet/morgan.
> **Difficulté :** :star::star:

## 1. Cas concret d'abord

L'API TribuZen sert un front Vue/Nuxt qui tourne sur `http://localhost:5173`. Quand tu lances les deux serveurs et que le front appelle `GET /familles`, le navigateur bloque la réponse : CORS error. Ensuite, tu veux tracer chaque requête pour déboguer — timestamp, méthode, chemin, durée, status. Et plus tard, il faudra couper l'accès aux routes protégées si le header `Authorization` est absent.

Tu essaies d'ajouter tout ça dans les handlers et tu te retrouves à dupliquer du code dans chaque route. Ce n'est pas tenable.

Express résout ça avec les **middleware** : des fonctions qui s'exécutent avant (ou après) le handler, dans un pipeline ordonné. Un middleware branché une fois s'applique à toutes les routes correspondantes. Ce module te montre comment en écrire, comment les chaîner, et comment gérer les erreurs avec le middleware à 4 arguments d'Express 5.

## 2. Théorie complète, concise

### 2.1 Concept de middleware et signature `(req, res, next)`

Un middleware est une fonction `(req, res, next) => void` qu'Express exécute dans l'ordre de déclaration pour chaque requête correspondante. `next()` passe la main au middleware suivant ; appeler `res.json()` ou `res.send()` termine la chaîne.

```ts
import { Request, Response, NextFunction } from 'express'

function monMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 1. Lire/modifier req ou res
  console.log(`${req.method} ${req.path}`)

  // 2a. Passer la main au middleware suivant
  next()

  // 2b. OU terminer la chaîne si une condition n'est pas remplie
  // res.status(401).json({ error: 'Non autorisé' })
}
```

Sans appel à `next()` ni envoi de réponse, la requête reste bloquée indéfiniment. C'est la cause la plus fréquente de timeout dans une API Express.

### 2.2 Ordre d'exécution

Les middleware s'exécutent dans l'ordre exact de `app.use()`. Cet ordre est non négociable et a des effets concrets :

```ts
import express from 'express'

const app = express()

// Déclaré en PREMIER : s'exécute sur toutes les requêtes avant tout le reste
app.use(express.json())              // parse le body JSON → req.body disponible

// Déclaré en DEUXIÈME
app.use((req, res, next) => {
  console.log('Logger')
  next()
})

// Handler de route — reçoit req.body déjà parsé
app.post('/familles', (req, res) => {
  res.status(201).json(req.body)
})

// Middleware d'erreur — toujours EN DERNIER
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ error: err.message })
})
```

Règle : **middleware globaux → routes → middleware d'erreur**. Si `express.json()` est déclaré après la route, `req.body` est `undefined` dans cette route.

### 2.3 Middleware applicatif et middleware de routeur

**Middleware applicatif** — attaché à l'instance `app`, s'applique à toutes les requêtes (ou à celles dont le chemin commence par un préfixe) :

```ts
// Toutes les requêtes
app.use(express.json())

// Uniquement les requêtes dont le chemin commence par /api
app.use('/api', (req, res, next) => {
  console.log('Requête API')
  next()
})

// Middleware inline sur une seule route (requireAuth s'exécute avant le handler)
app.get('/familles/:id', requireAuth, famillesController.getById)
```

**Middleware de routeur** — attaché à un `express.Router()`, il ne s'applique qu'aux routes de ce routeur :

```ts
import { Router } from 'express'

const router = Router()

// S'exécute pour toutes les routes de CE routeur uniquement
router.use((req, res, next) => {
  console.log('Scoped au routeur familles')
  next()
})

router.get('/', (req, res) => res.json([]))
router.get('/:id', (req, res) => res.json({ id: req.params.id }))

// Monté sous /familles dans l'app principale
app.use('/familles', router)
```

Le scoping du routeur est le précurseur direct des **modules NestJS** (module 09) : un module NestJS est conceptuellement un routeur Express avec injection de dépendances.

### 2.4 Middleware d'erreur à 4 args (Express 5)

Un middleware d'erreur se reconnaît à son **quatrième paramètre `err`** — Express l'identifie uniquement par le nombre d'arguments, pas par le nom. Il doit être déclaré **après toutes les routes**.

```ts
// middleware/error-handler.ts
import { Request, Response, NextFunction } from 'express'

export interface AppError extends Error {
  status?: number
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction   // le 4e param est requis même si non utilisé
): void {
  const status = err.status ?? 500
  const message = err.message ?? 'Erreur interne'

  console.error(`[ERROR] ${req.method} ${req.path} → ${status} ${message}`)

  res.status(status).json({ error: message })
}
```

**Express 5 — propagation async automatique.** En Express 5, tout handler `async` dont la Promise rejette appelle automatiquement `next(err)` — sans try/catch ni wrapper :

```ts
// Express 5 — pas de try/catch nécessaire dans les handlers async
app.get('/familles/:id', async (req, res) => {
  const famille = await familleService.findById(req.params.id)   // peut rejeter
  if (!famille) {
    const err: AppError = new Error('Famille introuvable')
    err.status = 404
    throw err   // Express 5 attrape, appelle next(err), route vers errorHandler
  }
  res.json(famille)
})
```

En Express 4, la même rejection disparaissait silencieusement — il fallait `try/catch` + `next(err)` ou le package `express-async-errors`. Express 5 supprime cette contrainte.

**Propager une erreur depuis un middleware normal** :

```ts
app.use('/familles', (req, res, next) => {
  const apiKey = req.get('X-API-Key')
  if (!apiKey) {
    const err: AppError = new Error('Clé API manquante')
    err.status = 401
    next(err)   // saute tous les middleware normaux, va direct à errorHandler
    return
  }
  next()
})
```

### 2.5 Middleware intégrés — `json`, `urlencoded`, `static`

Express 5 embarque trois middleware sans dépendance additionnelle :

```ts
// Parse les body Content-Type: application/json → req.body
app.use(express.json({
  limit: '1mb',      // taille max du body (défaut 100 ko) — protège contre les gros payloads
  strict: true,      // accepte uniquement les tableaux et objets JSON
}))

// Parse les body Content-Type: application/x-www-form-urlencoded (formulaires HTML)
app.use(express.urlencoded({
  extended: true,    // utilise la librairie qs — supporte les objets imbriqués
  limit: '1mb',
}))

// Sert les fichiers statiques d'un dossier local
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.use('/assets', express.static(path.join(__dirname, '../public'), {
  maxAge: '1d',       // Cache-Control navigateur (1 jour)
  index: false,       // désactive la page d'index automatique
  dotfiles: 'ignore', // ne sert pas les fichiers .gitignore, .env, etc.
}))
```

`express.json()` et `express.urlencoded()` doivent être déclarés **avant** toute route qui lit `req.body`. `express.static()` déclaré avant les routes dynamiques sert les fichiers en priorité.

### 2.6 Middleware tiers — `cors`, `helmet`, `morgan`

```bash
npm install cors helmet morgan
npm install -D @types/cors @types/morgan
```

**cors** — autorise les requêtes cross-origin (indispensable quand le front tourne sur un port différent) :

```ts
import cors from 'cors'

// Développement — toutes les origines
app.use(cors())

// Production — liste blanche stricte
app.use(cors({
  origin: ['http://localhost:5173', 'https://tribuzen.app'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,   // cookies et headers d'auth cross-origin
  maxAge: 86400,        // met en cache la réponse preflight 24 h
}))
```

**helmet** — ajoute une dizaine de headers HTTP de sécurité en une ligne :

```ts
import helmet from 'helmet'

app.use(helmet())
// Ajoute notamment :
// Content-Security-Policy: default-src 'self'
// X-Content-Type-Options: nosniff
// X-Frame-Options: SAMEORIGIN
// Strict-Transport-Security: max-age=15552000; includeSubDomains
// X-XSS-Protection: 0   (désactivé car géré par CSP en mode moderne)
```

**morgan** — logge chaque requête HTTP avec méthode, chemin, status, durée :

```ts
import morgan from 'morgan'

// Développement : coloré, lisible en console
app.use(morgan('dev'))
// → GET /familles 200 4.321 ms - 256

// Production : format Apache combined, pour agrégation dans un log collector
app.use(morgan('combined'))
// → ::1 - - [02/Jul/2026:14:00:00 +0000] "GET /familles HTTP/1.1" 200 256

// Format personnalisé avec timestamp ISO
app.use(morgan(':date[iso] :method :url :status :response-time ms'))
```

Ordre recommandé en production : `helmet()` → `cors()` → `morgan()` → `express.json()` → routes → errorHandler.

### 2.7 Middleware custom réutilisable

Un middleware custom peut être **une simple fonction** ou une **factory** qui retourne une fonction — le pattern factory permet de le paramétrer.

```ts
// middleware/request-id.ts — middleware simple (réutilisable partout)
import crypto from 'node:crypto'
import { Request, Response, NextFunction } from 'express'

export function requestId(req: Request, res: Response, next: NextFunction): void {
  // Réutilise l'id injecté par un proxy (nginx, ALB) ou en génère un
  const id = req.get('X-Request-Id') ?? crypto.randomUUID()
  // Attache à req pour que les handlers suivants y aient accès
  ;(req as Request & { id: string }).id = id
  // Propage en header de réponse pour le débogage côté client
  res.set('X-Request-Id', id)
  next()
}
```

```ts
// middleware/logger.ts — middleware custom avec mesure de durée
import { Request, Response, NextFunction } from 'express'

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now()

  // res.on('finish') se déclenche quand la réponse a été envoyée
  // C'est le seul moyen d'avoir le status code final depuis un middleware "before"
  res.on('finish', () => {
    const ms = Date.now() - start
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`)
  })

  next()
}
```

```ts
// middleware/require-bearer.ts — factory : paramétrable par liste de tokens
import { Request, Response, NextFunction } from 'express'
import { AppError } from './error-handler.js'

// Retourne un middleware qui accepte uniquement les tokens de la liste blanche
export function requireBearer(allowedTokens: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.get('Authorization') ?? ''

    if (!header.startsWith('Bearer ')) {
      const err: AppError = new Error('Token manquant ou format invalide')
      err.status = 401
      next(err)
      return
    }

    const token = header.slice(7)

    if (!allowedTokens.includes(token)) {
      const err: AppError = new Error('Token non autorisé')
      err.status = 403
      next(err)
      return
    }

    next()
  }
}

// Usage :
// const checkToken = requireBearer([process.env.API_TOKEN!])
// router.use(checkToken)  ← s'applique à toutes les routes du routeur
// app.get('/admin', checkToken, handler) ← route spécifique uniquement
```

Le pattern factory est le même que celui utilisé par `cors()`, `morgan()`, `helmet()` : ils prennent des options et retournent le middleware configuré.

## 3. Worked examples

### Exemple A — Stack middleware complète de l'API TribuZen

```ts
// src/index.ts — API TribuZen avec stack middleware production-ready
import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import crypto from 'node:crypto'
import famillesRouter from './routes/familles.js'

interface AppError extends Error {
  status?: number
}

const app = express()

// ── 1. helmet — headers de sécurité en tout premier ─────────────────────────
// Doit précéder cors : certains headers CSP peuvent interférer avec CORS
app.use(helmet())

// ── 2. cors — avant les routes pour couvrir aussi les réponses d'erreur ─────
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://tribuzen.app']
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}))

// ── 3. morgan — log avant les routes pour mesurer la durée réelle totale ────
app.use(morgan('dev'))

// ── 4. Request ID — corrélation entre logs client, serveur et DB ─────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  const id = req.get('X-Request-Id') ?? crypto.randomUUID()
  ;(req as Request & { id: string }).id = id
  res.set('X-Request-Id', id)
  next()
})

// ── 5. Body parsing ──────────────────────────────────────────────────────────
// APRÈS le logging : si le parsing échoue (body malformé), morgan a déjà loggé
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

// ── 6. Routes ────────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/familles', famillesRouter)

// ── 7. Catch-all 404 — après toutes les routes, avant l'error handler ────────
// Middleware à 3 params : ce n'est PAS un error handler, juste une route finale
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `${req.method} ${req.path} introuvable` })
})

// ── 8. Error handler — TOUJOURS EN DERNIER ───────────────────────────────────
// Express 5 : les handlers async qui throw atteignent automatiquement ici
app.use((err: AppError, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status ?? 500
  console.error(`[ERROR] ${status} ${err.message}`)
  res.status(status).json({ error: err.message ?? 'Erreur interne' })
})

app.listen(3000, () => console.log('API TribuZen sur http://localhost:3000'))
```

**Pas-à-pas :** (1) `helmet()` en premier — il ajoute des headers de sécurité avant que toute réponse soit envoyée ; (2) `cors()` juste après — les headers CORS doivent être présents même sur les réponses d'erreur ; (3) `morgan('dev')` log la requête depuis le premier middleware visible, donc il mesure la durée réelle totale ; (4) le middleware request-id inline plutôt qu'importé pour simplifier l'exemple ; (5) `express.json()` après le logging — si le body est malformé, morgan a déjà loggé avant l'erreur de parsing ; (6) le middleware 404 est une fonction à 3 paramètres, pas 4 — ce n'est pas un error handler ; (7) l'error handler à 4 paramètres est le dernier `app.use()` — en Express 5, il reçoit aussi les rejections async sans try/catch explicite.

### Exemple B — Router avec middleware scoped et propagation d'erreur async

```ts
// src/routes/familles.ts — router avec middleware scoped + async Express 5
import { Router, Request, Response, NextFunction } from 'express'
import crypto from 'node:crypto'

interface Famille { id: string; nom: string; createdAt: string }
interface AppError extends Error { status?: number }

let familles: Famille[] = []

// ── Middleware scoped au routeur ─────────────────────────────────────────────
// Ne s'exécute que sur les routes /familles/* — pas sur /health ni ailleurs
function logFamillesAccess(req: Request, _res: Response, next: NextFunction): void {
  console.log(`[familles] ${req.method} ${req.path} — user: ${req.get('X-User-Id') ?? 'anon'}`)
  next()
}

const router = Router()

// Attaché au routeur : s'exécute AVANT chaque route de ce routeur uniquement
router.use(logFamillesAccess)

// ── Routes async — Express 5 propage automatiquement les rejections ──────────

router.get('/', async (_req: Request, res: Response) => {
  // Si une Promise sous-jacente rejette, Express 5 appellera next(err) auto
  res.json({ data: familles, total: familles.length })
})

router.post('/', async (req: Request, res: Response) => {
  const { nom } = req.body
  if (!nom || typeof nom !== 'string') {
    // throw dans un async handler → Express 5 route vers errorHandler
    const err: AppError = new Error('nom requis (string)')
    err.status = 400
    throw err
  }
  const created: Famille = {
    id: crypto.randomUUID(),
    nom: nom.trim(),
    createdAt: new Date().toISOString(),
  }
  familles.push(created)
  res.status(201).json(created)
})

router.get('/:id', async (req: Request, res: Response) => {
  const famille = familles.find(f => f.id === req.params.id)
  if (!famille) {
    const err: AppError = new Error('Famille introuvable')
    err.status = 404
    throw err   // Express 5 attrape et appelle next(err)
  }
  res.json(famille)
})

export default router
```

**Pas-à-pas :** (1) `router.use(logFamillesAccess)` applique le middleware uniquement aux routes `/familles/*` — pas à `/health` ni aux autres routers ; (2) dans un handler `async`, `throw err` en Express 5 est équivalent à `next(err)` — pas besoin de `try/catch` ; (3) l'objet `AppError` porte un champ `status` que l'error handler global lit pour choisir le code HTTP correct ; (4) si `familles.find()` était un `await db.query()` qui rejette, Express 5 l'attraperait de la même manière.

## 4. Pièges & misconceptions

- **Oublier `next()`.** Un middleware sans appel à `next()` (et sans réponse) bloque la requête indéfiniment. Le client timeout, aucune erreur n'est loggée côté serveur. *Correct* : toujours finir par `next()`, `next(err)`, ou une réponse (`res.json()`, `res.send()`, `res.end()`).

- **4e paramètre absent du middleware d'erreur.** `app.use((err, req, res) => { ... })` — Express compte les paramètres et ne reconnaît PAS cette fonction comme un error handler (seulement 3 args). Les erreurs traversent ce middleware silencieusement. *Correct* : `(err, req, res, _next) => { ... }` — le 4e paramètre est obligatoire même s'il n'est pas utilisé.

- **Error handler non en dernier.** Un `app.use(errorHandler)` déclaré avant les routes ne reçoit jamais les erreurs levées par ces routes — il n'est pas encore dans la chaîne à ce moment. *Correct* : le middleware d'erreur est le tout dernier `app.use()`, après toutes les routes et le catch-all 404.

- **Confondre middleware applicatif et de routeur.** Un middleware attaché à `app.use()` s'applique à TOUTES les routes, y compris celles d'autres routers. Attacher `requireAuth` sur `app.use()` protège tout, y compris `/health` — souvent non voulu. *Correct* : `router.use(requireAuth)` pour le router `/familles` uniquement.

- **CORS manquant sur les réponses d'erreur.** Si `cors()` est déclaré après les routes, une route qui lève une erreur avant `cors()` envoie une réponse sans headers CORS. Le navigateur bloque alors la réponse et le front ne voit pas le message d'erreur. *Correct* : `cors()` en tout début de chaîne, avant les routes et l'error handler.

- **Express 5 async vs Express 4.** En Express 4, `throw` dans un handler `async` disparaît silencieusement (la Promise rejette sans que Express l'intercepte). En Express 5, la rejection est automatiquement catchée et routée vers l'error handler. Sur un projet Express 4 hérité, ajouter `express-async-errors` ou wrapper chaque handler avec `asyncHandler`.

## 5. Ancrage TribuZen

Couche fil-rouge : **middleware de l'API TribuZen (logging des requêtes, CORS, auth à venir)** (`smaurier/tribuzen`).

- **`cors()`** — le front Vue/Nuxt tourne sur `:5173` en développement, l'API sur `:3000`. Sans CORS, le navigateur bloque toutes les réponses cross-origin. En production, l'origine sera `https://tribuzen.app`.
- **`morgan('dev')`** — trace chaque appel API pendant le développement. En production, il sera remplacé par `morgan('combined')` ou un logger structuré JSON (Pino, Winston) pour l'ingestion dans un log collector.
- **`requestId`** — le middleware custom qui génère ou propage le `X-Request-Id` permettra de corréler les logs entre le front, l'API Express et les futures requêtes Prisma (module 10).
- **`requireBearer` (stub)** — le module 08 (JWT) complétera ce stub avec une vraie vérification de token. Le middleware de routeur scoped garantit que `/health` reste accessible sans auth.
- **Error handler global** — format `{ error: string }` uniforme. En Express 5, les handlers async du CRUD familles peuvent `throw` directement — l'error handler central gère tout, sans duplication de try/catch dans chaque route.

Structure cible dans `smaurier/tribuzen` :

```
tribuzen/apps/api/src/
  middleware/
    error-handler.ts    ← errorHandler global (ce module)
    request-id.ts       ← requestId middleware
    logger.ts           ← requestLogger custom
    require-bearer.ts   ← factory auth stub → JWT réel au module 08
  index.ts              ← stack middleware dans l'ordre
  routes/
    familles.ts         ← router scoped avec logFamillesAccess
```

## 6. Points clés

1. Un middleware est `(req, res, next) => void` — `next()` passe la main, une réponse termine la chaîne ; sans l'un ni l'autre, la requête est bloquée.
2. L'ordre de `app.use()` est non négociable : globaux → routes → error handler.
3. Middleware applicatif (`app.use`) : toutes les requêtes. Middleware de routeur (`router.use`) : routes du router uniquement.
4. Le middleware d'erreur a **exactement 4 paramètres** `(err, req, res, next)` — Express le détecte par le nombre, pas par le nom.
5. Express 5 — les handlers `async` qui `throw` ou dont la Promise rejette appellent automatiquement `next(err)` sans try/catch.
6. Middleware intégrés : `express.json()` (body JSON), `express.urlencoded()` (formulaires), `express.static()` (fichiers statiques).
7. `cors()` en tête de chaîne — doit précéder les routes et l'error handler pour couvrir aussi les réponses d'erreur.
8. `helmet()` avant `cors()` — ajoute les headers de sécurité avant toute réponse.
9. Pattern factory : un middleware paramétrable retourne une fonction — même pattern que `cors(options)`, `morgan(format)`, `helmet(config)`.

## 7. Seeds Anki

```
Pourquoi sans next() une requête Express est-elle bloquée ?|Sans next() ET sans réponse, le middleware ne passe pas la main — la requête reste en attente jusqu'au timeout client, sans aucune erreur loggée
Combien de paramètres doit avoir un middleware d'erreur Express ?|Exactement 4 : (err, req, res, next) — Express identifie les error handlers uniquement par ce nombre d'arguments ; 3 paramètres = middleware normal ignoré pour les erreurs
Quelle différence entre app.use(fn) et router.use(fn) ?|app.use(fn) s'applique à toutes les requêtes de l'app ; router.use(fn) s'applique uniquement aux routes de ce router — le scoping évite de protéger par erreur des routes publiques comme /health
Comment Express 5 gère-t-il les erreurs dans un handler async ?|En Express 5, si un handler async throw ou si sa Promise rejette, Express appelle automatiquement next(err) — pas de try/catch ni de wrapper asyncHandler nécessaire (contrairement à Express 4)
Quel ordre pour les middleware dans une app Express en production ?|helmet → cors → morgan/logging → express.json/urlencoded → routes → catch-all 404 → error handler
Pourquoi cors() doit-il être déclaré avant les routes et l'error handler ?|Les réponses d'erreur (4xx, 5xx) doivent aussi porter les headers CORS — si cors() est après les routes, une erreur sera bloquée par le navigateur faute de header Access-Control-Allow-Origin
À quoi sert le pattern factory dans les middleware custom ?|Retourner une fonction depuis une fonction permet de paramétrer le middleware à la déclaration — c'est le même pattern que cors(options), morgan(format) ou helmet(config)
Différence entre middleware catch-all 404 et middleware d'erreur ?|Le catch-all 404 est un middleware normal à 3 params déclaré après les routes qui répond directement — l'error handler est à 4 params et reçoit les erreurs propagées par next(err) ou throw dans async
```

## Pont vers le lab

> Lab associé : `09-nestjs/labs/lab-06-middleware/README.md`. Tu construis de A à Z la stack middleware de l'API TribuZen en Express 5 — requestId, logger custom, cors/helmet/morgan, error handler global, et un router scoped. Corrigé complet commenté + variante J+30 dans le README du lab.
