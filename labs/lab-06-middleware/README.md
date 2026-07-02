# Lab 06 — Express middleware TribuZen

> **Outcome :** à la fin, tu sais brancher une stack middleware Express 5 complète (cors, helmet, morgan, middleware custom réutilisable, error handler global) sur l'API TribuZen.
> **Vrai outil :** Express 5 (`npm install express@^5`).
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

L'API TribuZen du module 05 (CRUD familles) n'a ni CORS, ni logging, ni gestion centralisée des erreurs. Le front Vue/Nuxt qui tourne sur `:5173` est bloqué par le navigateur à chaque appel.

**Ta tâche :** brancher la stack middleware complète sur le projet du module 05, sans modifier la logique des handlers de routes existants.

**Starter :** le dossier `09-nestjs/labs/lab-06-middleware/` contient un `package.json` minimal. Installe les dépendances :

```bash
npm install express@^5 cors helmet morgan
npm install -D @types/express @types/cors @types/morgan tsx typescript
```

L'entrée est `src/index.ts`. Les routes familles reprennent le CRUD du module 05.

## Étapes (en friction)

1. **Crée `src/middleware/error-handler.ts`.** Déclare l'interface `AppError extends Error` avec un champ `status?: number`. Écris la fonction `errorHandler(err, req, res, next)` — 4 paramètres obligatoires, status `err.status ?? 500`, réponse `{ error: err.message }`. Export nommé (pas `default`).

2. **Crée `src/middleware/request-id.ts`.** Middleware simple : lit le header `X-Request-Id` ou génère un UUID avec `crypto.randomUUID()`, attache le résultat à `req` (intersection de type `Request & { id: string }`) et au header de réponse `X-Request-Id`.

3. **Crée `src/middleware/logger.ts`.** Middleware `requestLogger` : enregistre `start = Date.now()` avant `next()`, puis log `[ISO] METHOD originalUrl → statusCode (Xms)` dans `res.on('finish', ...)`. Utilise `req.originalUrl` (pas `req.path` — `originalUrl` inclut le préfixe de montage `/familles/abc`, `path` ne contient que `/abc`).

4. **Dans `src/index.ts`**, assemble la stack dans l'ordre : `helmet()` → `cors()` → `morgan('dev')` → `requestId` → `requestLogger` → `express.json()` → routes familles → catch-all 404 → `errorHandler`. Lance `npx tsx src/index.ts` et appelle `GET /familles` depuis un navigateur sur un autre port pour vérifier l'absence d'erreur CORS.

5. **Dans `src/routes/familles.ts`**, convertis les handlers en `async` et remplace les `return res.status(4xx).json(...)` des cas d'erreur par `throw` avec un `AppError` portant le bon `status`. Vérifie que l'error handler central reçoit l'erreur (`[ERROR] 404 Famille introuvable` apparaît en console).

6. **Ajoute un middleware de routeur** `logFamillesAccess` dans `src/routes/familles.ts` — log `[familles] METHOD path` à chaque requête sur ce routeur. Attache-le avec `router.use(logFamillesAccess)` AVANT les routes.

## Corrigé complet commenté

```ts
// src/middleware/error-handler.ts
import { Request, Response, NextFunction } from 'express'

export interface AppError extends Error {
  status?: number
}

// Le 4e paramètre (_next) est OBLIGATOIRE même inutilisé :
// Express reconnaît les error handlers uniquement par le nombre d'arguments
// Avec 3 paramètres, Express traite la fonction comme un middleware normal
export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = err.status ?? 500
  // Log côté serveur pour le débogage — inclure method + path pour corréler
  console.error(`[ERROR] ${req.method} ${req.path} → ${status} ${err.message}`)
  // Réponse uniforme — le front lit toujours err.error pour afficher un message
  res.status(status).json({ error: err.message ?? 'Erreur interne' })
}
```

```ts
// src/middleware/request-id.ts
import crypto from 'node:crypto'
import { Request, Response, NextFunction } from 'express'

export interface RequestWithId extends Request {
  id: string
}

export function requestId(req: Request, res: Response, next: NextFunction): void {
  // Réutilise l'id injecté par un proxy upstream (nginx, ALB, Cloudflare)
  // ou en génère un nouveau si absent — garantit la traçabilité de bout en bout
  const id = req.get('X-Request-Id') ?? crypto.randomUUID()
  ;(req as RequestWithId).id = id
  // Propage en header de réponse : le front peut le logger pour corrélation
  res.set('X-Request-Id', id)
  next()
}
```

```ts
// src/middleware/logger.ts
import { Request, Response, NextFunction } from 'express'

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now()

  // res.on('finish') : déclenché une fois que tous les headers et le body
  // ont été envoyés au client — c'est le seul moment où res.statusCode est final
  // Un listener 'before next()' n'aurait pas encore le status code
  res.on('finish', () => {
    const ms = Date.now() - start
    // req.originalUrl inclut le préfixe de montage (/familles/abc)
    // req.path ne contient que le segment relatif au router (/abc)
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`
    )
  })

  // next() AVANT le listener : le listener est enregistré, la chaîne continue
  next()
}
```

```ts
// src/routes/familles.ts — router avec middleware scoped et async Express 5
import { Router, Request, Response, NextFunction } from 'express'
import crypto from 'node:crypto'
import { AppError } from '../middleware/error-handler.js'

interface Famille { id: string; nom: string; createdAt: string }

let familles: Famille[] = []

// ── Middleware scoped — s'exécute sur /familles/* uniquement ─────────────────
// Attaché au router, il ne touche pas /health ni les autres routers
function logFamillesAccess(req: Request, _res: Response, next: NextFunction): void {
  // req.path ici est relatif au router : /  ou  /abc  (sans /familles)
  console.log(`[familles] ${req.method} ${req.path}`)
  next()
}

const router = Router()

// router.use avant les routes : s'exécute avant chaque handler du routeur
router.use(logFamillesAccess)

// ── Routes async — Express 5 attrape les throw automatiquement ───────────────

router.get('/', async (_req: Request, res: Response) => {
  // Si cette ligne était `await db.findMany()` et rejetait,
  // Express 5 appellerait next(err) sans try/catch
  res.json({ data: familles, total: familles.length })
})

router.post('/', async (req: Request, res: Response) => {
  const { nom } = req.body
  if (!nom || typeof nom !== 'string') {
    // throw dans un async handler → Express 5 appelle next(err) automatiquement
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
    throw err   // → errorHandler reçoit { status: 404, message: 'Famille introuvable' }
  }
  res.json(famille)
})

router.put('/:id', async (req: Request, res: Response) => {
  const index = familles.findIndex(f => f.id === req.params.id)
  if (index === -1) {
    const err: AppError = new Error('Famille introuvable')
    err.status = 404
    throw err
  }
  const { nom } = req.body
  if (!nom || typeof nom !== 'string') {
    const err: AppError = new Error('nom requis (PUT)')
    err.status = 400
    throw err
  }
  familles[index] = {
    id: req.params.id,
    nom: nom.trim(),
    createdAt: familles[index].createdAt,
  }
  res.json(familles[index])
})

router.delete('/:id', async (req: Request, res: Response) => {
  const index = familles.findIndex(f => f.id === req.params.id)
  if (index === -1) {
    const err: AppError = new Error('Famille introuvable')
    err.status = 404
    throw err
  }
  familles.splice(index, 1)
  // 204 No Content — pas de body, ne pas appeler res.json() après
  res.status(204).end()
})

export default router
```

```ts
// src/index.ts — stack middleware complète dans l'ordre correct
import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import famillesRouter from './routes/familles.js'
import { requestId } from './middleware/request-id.js'
import { requestLogger } from './middleware/logger.js'
import { errorHandler } from './middleware/error-handler.js'

const app = express()

// ── 1. helmet — headers de sécurité en tout premier ─────────────────────────
// helmet ajoute des headers sur TOUTES les réponses — même les erreurs
app.use(helmet())

// ── 2. cors — avant les routes pour couvrir aussi les réponses d'erreur ─────
// Sans cors() en tête, une erreur 404 ou 500 n'aura pas les headers CORS
// et le navigateur bloquera la réponse (le front ne verra pas le message d'erreur)
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://tribuzen.app']
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}))

// ── 3. morgan — log chaque requête entrante ──────────────────────────────────
// Déclaré avant les routes pour mesurer la durée réelle incluant parsing + handler
app.use(morgan('dev'))

// ── 4. requestId — corrélation entre les logs client, serveur et DB ──────────
app.use(requestId)

// ── 5. requestLogger — log custom avec durée mesurée par res.on('finish') ────
app.use(requestLogger)

// ── 6. Body parsing ──────────────────────────────────────────────────────────
// APRÈS le logging : si le parsing échoue, morgan et requestLogger ont déjà loggé
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

// ── 7. Routes ────────────────────────────────────────────────────────────────
// /health sans auth — le middleware de routeur de famillesRouter ne s'y applique pas
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// famillesRouter contient son propre router.use(logFamillesAccess)
app.use('/familles', famillesRouter)

// ── 8. Catch-all 404 — après toutes les routes, avant l'error handler ────────
// Middleware à 3 params : ce n'est PAS un error handler
// Il répond directement si aucune route précédente n'a répondu
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `${req.method} ${req.path} introuvable` })
})

// ── 9. Error handler — TOUJOURS EN DERNIER ───────────────────────────────────
// Express 5 route ici les throw des async handlers sans next(err) explicite
// Doit être après le catch-all 404 : les deux ne se court-circuitent pas car
// le 404 n'appelle pas next(err), il répond directement
app.use(errorHandler)

const PORT = Number(process.env.PORT) || 3000
app.listen(PORT, () => console.log(`API TribuZen sur http://localhost:${PORT}`))
```

## Variante J+30 (fading)

Même objectif, deux contraintes supplémentaires :

1. **Sans relire le corrigé**, reproduis la stack depuis zéro en 25 minutes. Le seul indice autorisé : la liste ordonnée `helmet → cors → morgan → requestId → requestLogger → express.json → routes → 404 → errorHandler`.

2. **Ajoute un middleware factory `requireRole(roles: string[])`** : lit le header `X-User-Role`, vérifie que la valeur est dans `roles`, renvoie 403 sinon. Branche-le sur le routeur familles avec `router.use(requireRole(['owner', 'admin']))`. L'error handler global doit recevoir l'erreur et répondre `{ error: 'Rôle insuffisant' }`.

## Application TribuZen

Dans `smaurier/tribuzen`, la couche middleware se structure ainsi :

```
tribuzen/apps/api/src/
  middleware/
    error-handler.ts    ← errorHandler global (ce lab)
    request-id.ts       ← requestId (ce lab)
    logger.ts           ← requestLogger (ce lab)
    require-bearer.ts   ← factory stub → JWT réel au module 08
  index.ts              ← stack dans l'ordre (ce lab)
  routes/
    familles.ts         ← router avec logFamillesAccess (ce lab)
```

Pour committer dans `smaurier/tribuzen` : les fichiers `middleware/` sont autonomes et sans dépendances entre eux. Committer dans l'ordre `error-handler.ts` → `request-id.ts` → `logger.ts` → `index.ts` mis à jour. Message de commit :

```
feat(api): stack middleware Express 5 (cors, helmet, morgan, requestId, errorHandler)
```
