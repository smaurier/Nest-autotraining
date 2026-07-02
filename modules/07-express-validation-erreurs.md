---
titre: Express validation et erreurs
cours: 09-nestjs
notions: [validation des entrées, schéma zod et inférence de type, middleware de validation, gestion centralisée des erreurs, classes d'erreur custom, codes de statut appropriés, erreurs async en Express 5, réponses d'erreur cohérentes]
outcomes: [valider un payload avec zod, centraliser la gestion d'erreurs dans un middleware, définir des classes d'erreur métier, renvoyer des erreurs HTTP cohérentes]
prerequis: [06-express-middleware]
next: 08-express-auth-securite
libs: [{ name: express, version: "^5" }, { name: zod, version: "^3" }]
tribuzen: valider les payloads d'invitation TribuZen et centraliser les erreurs API
last-reviewed: 2026-07
---

# Express validation et erreurs

> **Outcomes — tu sauras FAIRE :** valider un payload avec Zod, centraliser la gestion d'erreurs dans un middleware, définir des classes d'erreur métier, renvoyer des erreurs HTTP cohérentes.
> **Difficulté :** :star::star::star:

## 1. Cas concret d'abord

Dans TribuZen, un membre `admin` veut inviter quelqu'un dans sa famille. Il envoie :

```ts
POST /invitations
{ "email": "", "familyId": 42, "role": "superadmin" }
```

Sans validation, ton handler reçoit un email vide, un `familyId` qui devrait être un UUID (pas un entier), et un rôle inexistant dans le domaine. La DB va soit rejeter silencieusement, soit stocker des données corrompues. L'erreur qui remonte est souvent une `TypeError` interne qui fuite la stack trace au client.

Le problème a trois faces :

1. **Entrées** : les données du client ne correspondent pas au contrat attendu.
2. **Erreurs métier** : invitation d'un utilisateur déjà membre, famille introuvable — des cas prévus qui nécessitent des codes HTTP précis.
3. **Erreurs inattendues** : bugs qui ne doivent jamais exposer leur stack trace en production.

Ce module installe les trois solutions : un schéma Zod qui valide et infère le type, un middleware de validation réutilisable, et un error handler centralisé qui produit des réponses cohérentes pour les trois cas.

## 2. Théorie complète, concise

### 2.1 Validation des entrées — pourquoi le backend est la seule barrière réelle

La validation frontend est un confort utilisateur, pas une protection. Un attaquant ou un script curl contourne un formulaire Angular en cinq secondes. Seul le serveur contrôle ce qui entre dans la base de données.

La règle : **valider le body, les params, et la query à l'entrée de chaque route**, avant toute logique métier. Toute donnée non validée est une donnée non-typée au runtime.

```ts
// Sans validation — req.body est `any` à l'exécution
router.post('/invitations', async (req, res) => {
  // req.body.email peut être undefined, null, un objet, 42…
  await db.insert(req.body) // stocke n'importe quoi
})
```

### 2.2 Schéma Zod et inférence de type

Zod est une librairie de validation TypeScript-first. Un schéma Zod décrit la forme attendue d'une donnée ; Zod valide, transforme, et infère le type TypeScript statique correspondant.

```ts
import { z } from 'zod'

// Schéma pour POST /invitations
const InvitationSchema = z.object({
  email: z.string().email('Email invalide').toLowerCase().trim(),
  familyId: z.string().uuid('familyId doit être un UUID'),
  role: z.enum(['admin', 'member', 'guest']).default('member'),
})

// z.infer extrait le type TypeScript du schéma — source de vérité unique
type InvitationPayload = z.infer<typeof InvitationSchema>
// { email: string; familyId: string; role: 'admin' | 'member' | 'guest' }
```

**`parse` vs `safeParse`** — deux modes de validation :

```ts
// parse — lance une ZodError si invalide (à utiliser avec try/catch)
const data = InvitationSchema.parse(req.body)

// safeParse — retourne { success: true, data } ou { success: false, error }
// préférable dans un middleware : contrôle explicite du chemin d'erreur
const result = InvitationSchema.safeParse(req.body)
if (!result.success) {
  // result.error.issues : tableau de { path: string[], message: string, code: string }
  result.error.issues.forEach(issue => {
    console.log(issue.path.join('.'), issue.message)
    // 'email' 'Email invalide'
  })
}
```

**Transformations intégrées** : `.toLowerCase()`, `.trim()`, `.default()`, `.coerce.number()` s'appliquent pendant la validation. Après un `safeParse` réussi, `result.data` contient les données transformées, pas les données brutes.

**Schéma partiel pour PATCH** :

```ts
// .partial() rend chaque champ optionnel — pattern standard pour PATCH
const UpdateInvitationSchema = InvitationSchema.partial()
// { email?: string; familyId?: string; role?: 'admin' | 'member' | 'guest' }

// .pick() sélectionne un sous-ensemble de champs
const RoleUpdateSchema = InvitationSchema.pick({ role: true })
```

### 2.3 Middleware de validation générique

Un middleware Express reçoit `(req, res, next)`. Le middleware de validation applique un schéma Zod sur `req.body`, `req.params` ou `req.query`, et mute la source avec les données transformées si la validation réussit.

```ts
// src/middleware/validate.ts
import { z, ZodSchema } from 'zod'
import { Request, Response, NextFunction } from 'express'

export function validate(
  schema: ZodSchema,
  source: 'body' | 'params' | 'query' = 'body'
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source])

    if (!result.success) {
      // On n'appelle PAS next(err) ici — c'est une erreur de validation 400 attendue
      return res.status(400).json({
        error: 'Validation échouée',
        details: result.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      })
    }

    // Mutater req[source] avec les données validées+transformées (trim, toLowerCase, default…)
    // Sans cette ligne, les transformations Zod sont ignorées
    req[source] = result.data
    next()
  }
}
```

Usage dans le router :

```ts
// src/routes/invitations.ts
import { Router } from 'express'
import { validate } from '../middleware/validate.js'
import { InvitationSchema } from '../schemas/invitation.js'

const router = Router()

router.post('/', validate(InvitationSchema), async (req, res) => {
  // req.body est maintenant typé et transformé
  const payload = req.body as z.infer<typeof InvitationSchema>
  // …logique métier
})
```

### 2.4 Classes d'erreur custom

Les classes d'erreur permettent de distinguer les erreurs prévues (domaine métier) des bugs. Chaque classe porte son code HTTP et son flag `isOperational`.

```ts
// src/utils/errors.ts

// Classe de base — toutes les erreurs métier en héritent
export class AppError extends Error {
  readonly statusCode: number
  readonly isOperational = true  // erreur prévue, pas un bug

  constructor(message: string, statusCode = 500) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    // Préserve la stack trace en pointant sur l'appelant, pas sur AppError
    Error.captureStackTrace(this, this.constructor)
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const msg = id ? `${resource} "${id}" introuvable` : `${resource} introuvable`
    super(msg, 404)
  }
}

// 400 — données malformées ou manquantes
export class BadRequestError extends AppError {
  constructor(message = 'Requête invalide') {
    super(message, 400)
  }
}

// 409 — violation de contrainte métier (doublon, état incompatible)
export class ConflictError extends AppError {
  constructor(message = 'Conflit avec une ressource existante') {
    super(message, 409)
  }
}
```

Usage dans un handler — on lève l'erreur, le error handler la reçoit via `next` :

```ts
// Express 5 — l'erreur throwée dans un async handler atteint automatiquement next(err)
router.get('/:id', async (req, res) => {
  const invitation = await db.findInvitation(req.params.id)
  if (!invitation) {
    throw new NotFoundError('Invitation', req.params.id)  // pas de next(err) manuel
  }
  res.json(invitation)
})
```

### 2.5 Codes de statut appropriés

Chaque cas d'erreur a un code HTTP sémantique. Renvoyer `500` pour toutes les erreurs masque l'intention et casse le contrat client.

| Code | Signification | Exemple dans TribuZen |
|------|---------------|-----------------------|
| `400 Bad Request` | Corps malformé, champ manquant, type incorrect | `familyId` absent du payload |
| `404 Not Found` | Ressource absente | Famille inconnue dans l'invitation |
| `409 Conflict` | Contrainte métier violée | Utilisateur déjà membre de la famille |
| `422 Unprocessable Entity` | Données syntaxiquement valides mais métier invalides | Invitation d'un owner vers lui-même |
| `500 Internal Server Error` | Bug non prévu | TypeError inattendue |

**400 vs 422** : `400` = données malformées (Zod échoue sur le type). `422` = données bien formées mais logique métier impossible (email valide, mais l'utilisateur s'invite lui-même).

### 2.6 Gestion centralisée des erreurs

Un middleware d'erreur Express reçoit quatre paramètres : `(err, req, res, next)`. C'est la signature exacte qui le distingue d'un middleware normal. Il doit être déclaré **après toutes les routes**.

```ts
// src/middleware/error-handler.ts
import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { AppError } from '../utils/errors.js'

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // Erreurs Zod remontées par parse() (pas par safeParse)
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation échouée',
      details: err.issues.map(i => ({ field: i.path.join('.'), message: i.message })),
    })
  }

  // Erreurs métier prévues
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message })
  }

  // Body JSON mal formé (SyntaxError levée par express.json())
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'JSON invalide dans le body' })
  }

  // Bug non prévu — ne jamais exposer la stack en production
  const message = process.env.NODE_ENV === 'production'
    ? 'Erreur interne du serveur'
    : (err instanceof Error ? err.message : String(err))

  res.status(500).json({ error: message })
}
```

Montage dans `index.ts` :

```ts
import express from 'express'
import invitationsRouter from './routes/invitations.js'
import { errorHandler } from './middleware/error-handler.js'

const app = express()
app.use(express.json())
app.use('/invitations', invitationsRouter)

// APRÈS toutes les routes — sinon les erreurs n'atteignent jamais ce handler
app.use(errorHandler)

app.listen(3000)
```

### 2.7 Erreurs async en Express 5

En Express 4, un handler `async` dont la Promise rejette ne déclenche pas le middleware d'erreur — l'exception disparaît silencieusement. Il fallait un wrapper `asyncHandler` ou un bloc `try/catch` manuel.

**Express 5 propage automatiquement** les rejections des handlers async vers `next(err)` sans aucun wrapper :

```ts
// Express 5 — propre, aucun try/catch nécessaire
router.post('/', validate(InvitationSchema), async (req, res) => {
  const created = await invitationService.create(req.body)
  // Si create() rejette (ConflictError, DB error…) → next(err) automatique
  res.status(201).json(created)
})

// Express 4 — try/catch obligatoire sinon l'erreur est perdue
router.post('/', validate(InvitationSchema), async (req, res, next) => {
  try {
    const created = await invitationService.create(req.body)
    res.status(201).json(created)
  } catch (err) {
    next(err)  // sans ça, le client attend indéfiniment (timeout)
  }
})
```

La migration Express 4 → 5 sur ce point est transparente : le code Express 4 avec `try/catch` continue de fonctionner. Le bénéfice d'Express 5 est de pouvoir supprimer le boilerplate.

### 2.8 Réponses d'erreur cohérentes

Un contrat d'erreur stable permet au frontend de parser les erreurs de façon uniforme, quelle que soit la route. La forme recommandée :

```ts
// Erreur de validation (400)
{
  "error": "Validation échouée",
  "details": [
    { "field": "email", "message": "Email invalide" },
    { "field": "familyId", "message": "familyId doit être un UUID" }
  ]
}

// Erreur métier (404, 409…)
{
  "error": "Invitation \"inv-abc\" introuvable"
}

// Erreur interne en production (500)
{
  "error": "Erreur interne du serveur"
}
```

La clé `error` est toujours présente. `details` n'apparaît que pour les erreurs de validation. En production, aucune stack trace ne fuite.

## 3. Worked examples

### Exemple A — Schéma Zod complet + middleware de validation sur POST /invitations

```ts
// src/schemas/invitation.ts
import { z } from 'zod'

export const InvitationSchema = z.object({
  // email normalisé automatiquement : trim + toLowerCase → pas besoin de le faire dans le handler
  email: z.string({
    required_error: 'email est obligatoire',
    invalid_type_error: 'email doit être une chaîne',
  }).email('Email invalide').toLowerCase().trim(),

  familyId: z.string().uuid('familyId doit être un UUID v4'),

  // enum restreint les valeurs possibles — 'superadmin' sera rejeté avec un message lisible
  role: z.enum(['admin', 'member', 'guest'], {
    errorMap: () => ({ message: 'role doit être admin, member ou guest' }),
  }).default('member'),
})

// Type inféré — source de vérité unique pour handler et service
export type InvitationPayload = z.infer<typeof InvitationSchema>
// { email: string; familyId: string; role: 'admin' | 'member' | 'guest' }
```

```ts
// src/routes/invitations.ts
import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../middleware/validate.js'
import { InvitationSchema, type InvitationPayload } from '../schemas/invitation.js'
import { ConflictError, NotFoundError } from '../utils/errors.js'

const router = Router()

// Données en mémoire (Prisma viendra au module 10)
const invitations: Array<InvitationPayload & { id: string }> = []

// POST /invitations
// validate() agit avant le handler : si le body est invalide, répond 400 immédiatement
router.post('/', validate(InvitationSchema), async (req, res) => {
  // req.body est maintenant de type InvitationPayload (transformé et validé)
  const payload = req.body as InvitationPayload

  // Vérification d'unicité — erreur métier 409
  const duplicate = invitations.find(
    i => i.email === payload.email && i.familyId === payload.familyId
  )
  if (duplicate) {
    throw new ConflictError(`${payload.email} est déjà invité dans cette famille`)
    // Express 5 : ce throw atteint le error handler automatiquement
  }

  const created = { id: crypto.randomUUID(), ...payload }
  invitations.push(created)
  res.status(201).json(created)
})

// GET /invitations/:id
router.get('/:id', async (req, res) => {
  const invitation = invitations.find(i => i.id === req.params.id)
  if (!invitation) {
    throw new NotFoundError('Invitation', req.params.id)
    // Express 5 : pas de next(err) — le throw suffit
  }
  res.json(invitation)
})

export default router
```

**Pas-à-pas :**
1. `validate(InvitationSchema)` est un middleware — il s'exécute avant le handler. Si le body échoue, il répond `400` et n'appelle pas `next()` : le handler n'est jamais atteint.
2. `req.body = result.data` dans le middleware remplace les données brutes par les données transformées (`email` est déjà en minuscules et trimmé).
3. `throw new ConflictError(...)` dans un handler `async` Express 5 déclenche automatiquement `next(err)` — pas de `try/catch`.
4. `z.infer<typeof InvitationSchema>` donne le type TypeScript exact, aligné sur le schéma — si le schéma change, le type change aussi sans intervention manuelle.

### Exemple B — Error handler complet + test des trois chemins d'erreur

```ts
// src/index.ts — assemblage complet
import express from 'express'
import invitationsRouter from './routes/invitations.js'
import { errorHandler } from './middleware/error-handler.js'

const app = express()
app.use(express.json())  // parse le body JSON — lève SyntaxError si JSON malformé

app.use('/invitations', invitationsRouter)

// Route catch-all pour les URL inconnues
app.use((_req, res) => {
  res.status(404).json({ error: 'Route introuvable' })
})

// error handler — APRÈS toutes les routes et middlewares
// Gère : ZodError (si parse() utilisé), AppError, SyntaxError, bugs
app.use(errorHandler)

app.listen(3000, () => console.log('API TribuZen sur http://localhost:3000'))
```

Trois requêtes curl pour tester les trois chemins :

```bash
# Chemin 1 — validation échouée (400)
curl -X POST http://localhost:3000/invitations \
  -H 'Content-Type: application/json' \
  -d '{"email":"","familyId":42,"role":"superadmin"}'
# → 400 { "error": "Validation échouée", "details": [
#     { "field": "email", "message": "Email invalide" },
#     { "field": "familyId", "message": "familyId doit être un UUID v4" },
#     { "field": "role", "message": "role doit être admin, member ou guest" }
#   ] }

# Chemin 2 — doublon (409)
curl -X POST http://localhost:3000/invitations \
  -H 'Content-Type: application/json' \
  -d '{"email":"bob@tribu.fr","familyId":"550e8400-e29b-41d4-a716-446655440000"}'
# → 409 { "error": "bob@tribu.fr est déjà invité dans cette famille" }

# Chemin 3 — ressource absente (404)
curl http://localhost:3000/invitations/inv-inconnu
# → 404 { "error": "Invitation \"inv-inconnu\" introuvable" }
```

**Pas-à-pas :**
1. Le middleware `validate()` répond `400` directement — il ne passe jamais au handler ni au error handler.
2. `throw new ConflictError(...)` dans le handler async Express 5 passe à `errorHandler` via `next(err)` automatique. `err instanceof AppError` est vrai → `409`.
3. `throw new NotFoundError(...)` idem → `404`.
4. Un bug inattendu (ex. `TypeError` sur une valeur nulle) passe aussi dans `errorHandler`. `isOperational` est `false` → `500` avec message générique en production.

## 4. Pièges & misconceptions

- **`parse()` throw, `safeParse()` retourne.** `schema.parse(data)` lève une `ZodError` si les données sont invalides — il faut un `try/catch` ou que l'erreur soit captée par le error handler. `schema.safeParse(data)` ne throw jamais : il retourne `{ success: false, error }`. Dans un middleware de validation, `safeParse` est préférable car on contrôle explicitement le code de statut. Dans un service où on veut que l'erreur remonte, `parse` avec Express 5 est correct.

- **Oublier de muter `req[source]`.** Sans `req.body = result.data`, les transformations Zod (`.trim()`, `.toLowerCase()`, `.default()`) ne sont jamais appliquées dans le handler. L'email arrive avec sa casse originale, les valeurs par défaut sont absentes. Le handler reçoit les données brutes, pas les données transformées.

- **Middleware d'erreur déclaré avant les routes.** Un `app.use(errorHandler)` placé avant `app.use('/invitations', router)` ne reçoit jamais les erreurs des routes — les erreurs passent dans le vide (timeout client). Il doit être le dernier `app.use()` de l'application.

- **Express 4 vs Express 5 — async silencieux.** En Express 4, un `throw` ou une Promise rejetée dans un handler `async` sans `try/catch` ne déclenche pas le middleware d'erreur. La requête reste en attente indéfiniment. En Express 5, ce throw remonte automatiquement. Si tu vois des timeouts inexpliqués, vérifie la version d'Express et la présence du `try/catch` ou du wrapper `asyncHandler`.

- **`400` vs `422` — confusion sur le code.** `400 Bad Request` = données malformées (mauvais type, champ manquant) — c'est ce que Zod détecte. `422 Unprocessable Entity` = données bien formées mais règle métier impossible (invitation de soi-même, rôle incompatible avec la famille). Utiliser `400` pour les deux mélange les couches validation et domaine et complique le débogage côté client.

- **Exposer la stack trace en production.** `res.status(500).json({ error: err.stack })` expose l'architecture interne, les chemins de fichiers, les noms de bibliothèques — informations précieuses pour un attaquant. En production, toujours renvoyer un message générique et logger la stack côté serveur.

- **`req.body` de type `any` après validation.** Sans un cast explicite (`const payload = req.body as InvitationPayload`) ou un type générique sur `Request`, TypeScript ne sait pas que le middleware a transformé `req.body`. Variante propre : créer un type `ValidatedRequest<T>` qui étend `Request` avec un `body: T` typé.

## 5. Ancrage TribuZen

Couche fil-rouge : **valider les payloads d'invitation TribuZen et centraliser les erreurs API** (`smaurier/tribuzen`).

- `POST /invitations` → `InvitationSchema` avec Zod valide email, UUID de famille, rôle enum. Le middleware `validate(InvitationSchema)` est branché avant le handler — le handler ne voit jamais de données invalides.
- `ConflictError` est levée si l'utilisateur invité est déjà membre de la famille — code `409` explicite pour que le frontend affiche "Déjà membre" plutôt qu'une erreur générique.
- `NotFoundError` couvre le cas `GET /invitations/:id` avec un UUID inconnu — `404` propre.
- L'`errorHandler` centralisé garantit que toutes les routes TribuZen (familles, invitations, membres) renvoient le même shape d'erreur — le frontend peut parser avec un intercepteur Axios unique.
- En Express 5 (version cible), aucun handler async ne contient de `try/catch` — le code est plus lisible et l'erreur ne peut pas être avalée silencieusement.

Structure cible dans `smaurier/tribuzen` :

```
tribuzen/
  apps/
    api/
      src/
        schemas/
          invitation.ts       ← InvitationSchema + z.infer
        middleware/
          validate.ts         ← validate(schema, source)
          error-handler.ts    ← errorHandler centralisé
        utils/
          errors.ts           ← AppError, NotFoundError, ConflictError
        routes/
          invitations.ts      ← router avec validate + handlers async Express 5
        index.ts              ← app.use(errorHandler) en dernier
```

## 6. Points clés

1. `z.object({...})` définit le schéma ; `z.infer<typeof Schema>` en extrait le type TypeScript — une seule source de vérité.
2. `safeParse` retourne `{ success, data | error }` sans throw ; `parse` throw une `ZodError` — préférer `safeParse` dans les middlewares pour contrôler le code de statut.
3. `result.error.issues` est un tableau `{ path: string[], message: string, code: string }` — `path.join('.')` donne le nom du champ (`email`, `preferences.theme`).
4. Le middleware `validate(schema, source)` mute `req[source] = result.data` pour que les transformations Zod (trim, toLowerCase, default) soient effectives dans le handler.
5. `AppError` porte `statusCode` et `isOperational = true` — le error handler distingue les erreurs prévues des bugs.
6. `400` = données malformées (Zod), `404` = ressource absente, `409` = contrainte métier, `422` = règle domaine invalide, `500` = bug non prévu.
7. Middleware d'erreur Express = 4 paramètres `(err, req, res, next)` — déclaré après toutes les routes, sinon inatteignable.
8. Express 5 propage automatiquement les rejections des handlers async vers `next(err)` — pas de `try/catch` ni de `asyncHandler` wrapper nécessaire.
9. En production, le error handler renvoie un message générique pour les `500` — jamais de stack trace exposée au client.

## 7. Seeds Anki

```
Différence parse vs safeParse dans Zod ?|parse lève une ZodError si invalide (nécessite try/catch) ; safeParse retourne { success, data } ou { success, error } sans throw — préférable dans un middleware pour contrôler le code de statut
Comment extraire le type TypeScript d'un schéma Zod ?|z.infer<typeof MonSchema> — source de vérité unique, le type change si le schéma change sans intervention manuelle
Pourquoi muter req.body = result.data dans le middleware validate ?|Sans cette mutation, les transformations Zod (trim, toLowerCase, default) ne sont pas appliquées — le handler reçoit les données brutes du client
Quelle signature distingue un middleware d'erreur Express d'un middleware normal ?|(err, req, res, next) — 4 paramètres, express reconnaît le error handler uniquement par ce nombre ; déclaré après toutes les routes
Comment Express 5 améliore-t-il la gestion des handlers async ?|Express 5 propage automatiquement les rejections de Promise vers next(err) — plus besoin de try/catch ni de wrapper asyncHandler ; en Express 4, l'erreur était silencieuse et le client restait en attente
Différence HTTP 400 vs 422 dans une API REST ?|400 Bad Request = données malformées (type incorrect, champ manquant) — ce que Zod détecte ; 422 Unprocessable Entity = données valides syntaxiquement mais règle métier impossible
À quoi sert isOperational sur une classe AppError ?|Distinguer les erreurs prévues (domaine métier — 404, 409) des bugs (TypeError, ReferenceError) ; le error handler renvoie un message générique pour les non-opérationnelles en production
Comment accéder aux détails d'une ZodError ?|err.issues — tableau de { path: string[], message: string, code: string } ; path.join('.') donne le nom du champ ('email', 'preferences.theme')
```

## Pont vers le lab

> Lab associé : `09-nestjs/labs/lab-07-validation-erreurs/`. Tu construis de zéro le endpoint `POST /invitations` TribuZen avec Zod + validate middleware + error handler centralisé en Express 5 — pas de gap-fill, code de A à Z. Corrigé complet commenté + variante J+30 dans le README.
