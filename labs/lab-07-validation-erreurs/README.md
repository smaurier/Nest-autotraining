# Lab 07 — Validation et erreurs Express

> **Outcome :** à la fin, tu sais valider un payload d'invitation TribuZen avec Zod, centraliser la gestion d'erreurs dans un middleware Express 5, et renvoyer des réponses d'erreur HTTP cohérentes.
> **Vrai outil :** Express 5 + Zod v3 — pas de harnais simulé.
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

Tu construis le endpoint `POST /invitations` de l'API TribuZen. Un admin envoie un payload pour inviter quelqu'un dans sa famille — tu dois valider ce payload avec Zod, gérer les erreurs métier avec des classes custom, et centraliser toutes les réponses d'erreur dans un unique middleware.

**Starter :** projet Express 5 minimal déjà configuré (`npm install` dans ce dossier). Aucun fichier de logique pré-écrit — tu codes de A à Z.

**Contrat à respecter :**

```
POST /invitations
  body: { email: string, familyId: string (UUID), role?: 'admin' | 'member' | 'guest' }

  → 201 { id, email, familyId, role }        si valide et non-doublon
  → 400 { error, details: [{field, message}] } si body invalide (Zod)
  → 409 { error }                            si email déjà invité dans cette famille
  → 500 { error }                            si bug non prévu (message générique)

GET /invitations/:id
  → 200 { id, email, familyId, role }        si trouvé
  → 404 { error }                            si inconnu
```

## Étapes (en friction)

1. Crée `src/schemas/invitation.ts`. Définis `InvitationSchema` avec Zod : `email` (string, email valide, toLowerCase, trim), `familyId` (string, UUID), `role` (enum `admin | member | guest`, default `'member'`). Exporte le schéma et le type `InvitationPayload` via `z.infer`.

2. Crée `src/utils/errors.ts`. Définis `AppError` (message, statusCode, isOperational = true), `NotFoundError` (404), `ConflictError` (409). Chaque classe hérite d'`AppError` et appelle `super(message, code)`.

3. Crée `src/middleware/validate.ts`. Définis la factory `validate(schema, source = 'body')` qui retourne un middleware Express. Utilise `safeParse`. Si invalide → `400` avec `details`. Si valide → `req[source] = result.data`, `next()`.

4. Crée `src/middleware/error-handler.ts`. Définis `errorHandler(err, req, res, next)` à 4 paramètres. Gère les cas : `AppError` (statusCode + message), `SyntaxError` avec `'body'` (400 JSON malformé), défaut (500 générique en production, message réel en dev).

5. Crée `src/routes/invitations.ts`. Importe le router, le schema, les classes d'erreur. Branche `validate(InvitationSchema)` sur `POST /`. Dans le handler async Express 5 : vérifie doublon → `throw new ConflictError(...)`. Sinon crée et répond `201`. Pour `GET /:id` : trouve ou `throw new NotFoundError(...)`.

6. Crée `src/index.ts`. Monte `express.json()`, le router, la route catch-all 404, puis `errorHandler` en dernier. Lance sur le port 3000.

7. Teste manuellement avec `curl` ou Postman les 5 cas du contrat. Chaque erreur doit avoir le bon code et le bon shape.

## Corrigé complet commenté

```ts
// src/schemas/invitation.ts
import { z } from 'zod'

export const InvitationSchema = z.object({
  // email : normalisé pendant la validation — le handler reçoit déjà la version propre
  email: z.string({
    required_error: 'email est obligatoire',
    invalid_type_error: 'email doit être une chaîne',
  }).email('Email invalide').toLowerCase().trim(),

  familyId: z.string().uuid('familyId doit être un UUID v4'),

  // default('member') : si role absent du body, result.data.role vaut 'member'
  role: z.enum(['admin', 'member', 'guest'], {
    errorMap: () => ({ message: 'role doit être admin, member ou guest' }),
  }).default('member'),
})

// Source de vérité unique : si le schéma évolue, le type suit automatiquement
export type InvitationPayload = z.infer<typeof InvitationSchema>
```

```ts
// src/utils/errors.ts

export class AppError extends Error {
  readonly statusCode: number
  readonly isOperational = true  // erreur prévue — pas un bug

  constructor(message: string, statusCode = 500) {
    super(message)
    this.name = this.constructor.name  // 'NotFoundError' dans les logs
    this.statusCode = statusCode
    // Pointe la stack trace sur l'appelant, pas sur la classe AppError elle-même
    Error.captureStackTrace(this, this.constructor)
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const msg = id ? `${resource} "${id}" introuvable` : `${resource} introuvable`
    super(msg, 404)
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflit avec une ressource existante') {
    super(message, 409)
  }
}
```

```ts
// src/middleware/validate.ts
import { ZodSchema } from 'zod'
import { Request, Response, NextFunction } from 'express'

export function validate(
  schema: ZodSchema,
  source: 'body' | 'params' | 'query' = 'body'
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source])

    if (!result.success) {
      // On répond directement — on n'appelle PAS next(err)
      // Ce n'est pas un bug, c'est un cas prévu géré ici
      return res.status(400).json({
        error: 'Validation échouée',
        details: result.error.issues.map(issue => ({
          field: issue.path.join('.'),    // 'email', 'preferences.theme'
          message: issue.message,
        })),
      })
    }

    // Muter req[source] avec les données transformées (toLowerCase, trim, default…)
    // Sans cette ligne, les transformations Zod restent invisibles dans le handler
    req[source] = result.data
    next()
  }
}
```

```ts
// src/middleware/error-handler.ts
import { Request, Response, NextFunction } from 'express'
import { AppError } from '../utils/errors.js'

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction  // obligatoire même inutilisé — sans lui Express ignore ce middleware
) {
  // Erreurs métier prévues (NotFoundError, ConflictError…)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message })
  }

  // Body JSON syntaxiquement invalide — express.json() lève une SyntaxError
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'JSON invalide dans le body' })
  }

  // Bug non prévu — ne pas exposer les détails internes en production
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Erreur interne du serveur'
      : err instanceof Error
        ? err.message
        : String(err)

  res.status(500).json({ error: message })
}
```

```ts
// src/routes/invitations.ts
import { Router } from 'express'
import crypto from 'node:crypto'
import { validate } from '../middleware/validate.js'
import { InvitationSchema, type InvitationPayload } from '../schemas/invitation.js'
import { ConflictError, NotFoundError } from '../utils/errors.js'

const router = Router()

// Store mémoire (Prisma + PostgreSQL au module 10)
const invitations: Array<InvitationPayload & { id: string }> = []

// POST /invitations
// validate() s'exécute avant le handler — si le body est invalide, répond 400, handler ignoré
router.post('/', validate(InvitationSchema), async (req, res) => {
  const payload = req.body as InvitationPayload

  // Vérification doublon — erreur métier 409
  const duplicate = invitations.find(
    i => i.email === payload.email && i.familyId === payload.familyId
  )
  if (duplicate) {
    // Express 5 : throw dans async handler → next(err) automatique → errorHandler
    throw new ConflictError(`${payload.email} est déjà invité dans cette famille`)
  }

  const created = { id: crypto.randomUUID(), ...payload }
  invitations.push(created)
  res.status(201).json(created)  // 201 Created — pas 200
})

// GET /invitations/:id
router.get('/:id', async (req, res) => {
  const invitation = invitations.find(i => i.id === req.params.id)
  if (!invitation) {
    throw new NotFoundError('Invitation', req.params.id)
    // Express 5 : throw suffit, errorHandler reçoit l'erreur
  }
  res.json(invitation)
})

export default router
```

```ts
// src/index.ts
import express from 'express'
import invitationsRouter from './routes/invitations.js'
import { errorHandler } from './middleware/error-handler.js'

const app = express()

// express.json() AVANT toutes les routes — sinon req.body est undefined
// Il lève aussi SyntaxError si le body JSON est malformé
app.use(express.json())

app.use('/invitations', invitationsRouter)

// Catch-all pour les routes inconnues — AVANT errorHandler, APRÈS les routers
app.use((_req, res) => {
  res.status(404).json({ error: 'Route introuvable' })
})

// errorHandler EN DERNIER — après tous les app.use() et routes
// Un seul error handler pour toute l'application
app.use(errorHandler)

const PORT = Number(process.env.PORT) || 3000
app.listen(PORT, () => console.log(`API TribuZen sur http://localhost:${PORT}`))
```

## Variante J+30 (fading)

Même objectif, deux contraintes ajoutées — sans relire le corrigé :

1. **Validation des params :** ajoute un schéma Zod pour `GET /invitations/:id` qui vérifie que `id` est un UUID valide. Branche `validate(ParamsSchema, 'params')` sur la route. Si `id` n'est pas un UUID → `400` avant même de chercher en base.

2. **Shape d'erreur étendu :** ajoute un champ `requestId` (UUID généré par requête) dans toutes les réponses d'erreur. Le frontend peut l'envoyer au support pour retrouver l'erreur dans les logs. Génère-le dans un middleware de logging branché avant les routes, stocke-le dans `res.locals.requestId`, et utilise-le dans le error handler.

## Application TribuZen

Dans `smaurier/tribuzen/apps/api/` :

- Copie `src/schemas/invitation.ts`, `src/utils/errors.ts`, `src/middleware/validate.ts`, `src/middleware/error-handler.ts` tels quels — ils sont déjà prêts pour la production.
- Branche `errorHandler` sur l'app principale : un seul handler couvre toutes les routes (familles, invitations, membres).
- Quand Prisma arrive (module 10), les `PrismaClientKnownRequestError` avec code `P2002` (unique constraint) seront mappées en `ConflictError` dans `errorHandler` — sans changer les handlers.
- Le type `InvitationPayload = z.infer<typeof InvitationSchema>` sera partagé entre l'API et les tests unitaires du domaine — aucun type dupliqué.
