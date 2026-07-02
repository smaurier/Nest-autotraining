---
titre: Express fondamentaux
cours: 09-nestjs
notions: [application Express, routing et méthodes HTTP, req params query body, res et réponses, middleware introduction, router modulaire, fichiers statiques, gestion d'un CRUD]
outcomes: [créer une API Express, définir des routes REST, lire params/query/body, structurer un CRUD avec un router modulaire]
prerequis: [04-nodejs-serveur-http]
next: 06-express-middleware
libs: [{ name: node, version: "22" }, { name: express, version: "^5" }]
tribuzen: premières routes de l'API TribuZen en Express (CRUD familles) avant NestJS
last-reviewed: 2026-07
---

# Express fondamentaux

> **Outcomes — tu sauras FAIRE :** créer une API Express avec un router modulaire, définir des routes REST complètes, lire params/query/body, structurer un CRUD de bout en bout.
> **Difficulté :** :star::star:

## 1. Cas concret d'abord

TribuZen est une app de gestion de familles. Avant de passer sous NestJS (module suivant), on construit le socle API en Express — pour comprendre ce que NestJS abstrait. Voici la première vraie tâche :

```
POST   /familles      → créer une famille
GET    /familles      → lister toutes les familles (filtre ?nom=)
GET    /familles/:id  → récupérer une famille par id
PUT    /familles/:id  → remplacer une famille
DELETE /familles/:id  → supprimer une famille
```

Tu essaies de l'écrire et tu bloques sur plusieurs points : comment parser le body JSON ? comment extraire l'id de la route ? comment renvoyer 404 si la famille n'existe pas ? comment ne pas tout mettre dans un seul fichier ?

Ce module répond exactement à ça.

## 2. Théorie complète, concise

### 2.1 Application Express — créer, configurer, démarrer

Express est un framework web minimaliste qui encapsule le module `http` natif. `express()` retourne une application qui orchestre routes et middleware.

```ts
// src/index.ts
import express from 'express'

const app = express()

// Middleware global — parse le body JSON sur chaque requête POST/PUT/PATCH
// Doit être déclaré AVANT les routes qui lisent req.body
app.use(express.json())

const PORT = Number(process.env.PORT) || 3000

app.listen(PORT, () => {
  console.log(`API TribuZen sur http://localhost:${PORT}`)
})
```

Installation avec Node 22 et Express 5 :

```ts
// npm install express@^5
// npm install -D @types/express@^5 tsx
// "type": "module" dans package.json
// script dev : "npx tsx --watch src/index.ts"
```

**Express 4 vs Express 5 — différence clé :** Express 5 (sorti octobre 2024, utilisé par défaut dans NestJS 11) gère nativement les erreurs des handlers async. En Express 4, un handler `async` dont la Promise rejette ne déclenchait pas le middleware d'erreur — il fallait un `try/catch` explicite ou le package `express-async-errors`. En Express 5, un handler `async` qui throw ou rejette appelle automatiquement `next(err)`.

### 2.2 Routing et méthodes HTTP

`app.METHOD(chemin, handler)` enregistre une route. Chaque `handler` reçoit `(req, res, next)`.

```ts
// Les verbes REST courants dans une API CRUD
app.get('/familles', (req, res) => { /* lister */ })
app.post('/familles', (req, res) => { /* créer → 201 */ })
app.put('/familles/:id', (req, res) => { /* remplacer complet */ })
app.patch('/familles/:id', (req, res) => { /* modifier partiel */ })
app.delete('/familles/:id', (req, res) => { /* supprimer → 204 */ })

// app.all — répond à toutes les méthodes HTTP sur un chemin
app.all('/health', (req, res) => { res.json({ status: 'ok', method: req.method }) })
```

**`PUT` vs `PATCH` :** `PUT` remplace la ressource entière (tous les champs requis côté client) ; `PATCH` ne modifie que les champs envoyés (les champs absents restent inchangés).

### 2.3 req — params, query, body

```ts
app.get('/familles/:id', (req, res) => {
  // Paramètre de route — toujours une string
  console.log(req.params.id)             // '3a7f...' (string, jamais number)

  // Query string — toujours des strings (ou tableaux de strings)
  // GET /familles?page=2&limit=10
  console.log(req.query.page)            // '2' (string)
  console.log(req.query.limit)           // '10' (string)

  // Body JSON — objet parsé (nécessite express.json() déclaré en amont)
  // POST /familles { "nom": "Famille Martin" }
  console.log(req.body.nom)              // 'Famille Martin'

  // Autres propriétés utiles
  console.log(req.method)                // 'GET'
  console.log(req.path)                  // '/familles/3a7f...'
  console.log(req.get('Authorization'))  // header Authorization
})
```

**Express 5 — `req.query` :** retourne un objet `Object.create(null)` sans prototype. En Express 4, il héritait de `Object.prototype`. Pour l'usage courant, pas de changement — mais `req.query.constructor` vaut `undefined` en Express 5.

### 2.4 res — répondre à une requête

```ts
app.get('/demo', (req, res) => {
  // JSON — définit Content-Type: application/json automatiquement
  res.json({ id: 1, nom: 'Martin' })

  // Status + JSON (chaînable)
  res.status(201).json({ id: 2 })
  res.status(404).json({ error: 'Famille introuvable' })
  res.status(204).end()       // No Content — pas de body (DELETE réussi)

  // Texte — Express détecte automatiquement le Content-Type
  res.send('Hello')

  // Redirection
  res.redirect('/familles')        // 302 Found (défaut)
  res.redirect(301, '/familles')   // 301 Moved Permanently

  // Headers personnalisés
  res.set('X-Total-Count', '42')
  res.set({ 'Cache-Control': 'no-store', 'X-Request-Id': 'uuid' })
})
```

### 2.5 Middleware — introduction

Un middleware est une fonction `(req, res, next) => void` qui intercepte chaque requête. `next()` passe la main au middleware ou au handler suivant dans la chaîne.

```ts
// Middleware global — exécuté sur chaque requête
app.use(express.json())                             // parse body JSON
app.use(express.urlencoded({ extended: true }))     // parse formulaires HTML

// Middleware de logging maison
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()  // obligatoire — sans next(), la requête est bloquée ici
})

// Middleware d'erreur — 4 paramètres (signature spéciale, reconnue par Express)
// Doit être déclaré APRÈS toutes les routes
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.message)
  res.status(500).json({ error: err.message })
})
```

L'ordre des `app.use()` est crucial : les middleware s'exécutent dans l'ordre de déclaration.

### 2.6 Router modulaire

`express.Router()` crée un mini-routeur autonome. On le monte sur l'app principale avec `app.use(préfixe, router)`. C'est le précurseur direct des modules NestJS.

```ts
// src/routes/familles.ts
import { Router, Request, Response } from 'express'

const router = Router()

// Les routes sont relatives au préfixe de montage
router.get('/', (req: Request, res: Response) => { /* GET /familles */ })
router.post('/', (req: Request, res: Response) => { /* POST /familles */ })
router.get('/:id', (req: Request, res: Response) => { /* GET /familles/:id */ })
router.put('/:id', (req: Request, res: Response) => { /* PUT /familles/:id */ })
router.delete('/:id', (req: Request, res: Response) => { /* DELETE /familles/:id */ })

export default router
```

```ts
// src/index.ts — montage du router
import express from 'express'
import famillesRouter from './routes/familles.js'  // .js obligatoire avec "type": "module"

const app = express()
app.use(express.json())
app.use('/familles', famillesRouter)  // toutes les routes /familles/* sont dans le router

app.listen(3000)
```

### 2.7 Fichiers statiques

```ts
import express from 'express'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Sert les fichiers du dossier public/ à la racine de l'URL
app.use(express.static(path.join(__dirname, '../public')))
// GET /logo.png → public/logo.png

// Avec préfixe URL — les fichiers statiques sont accessibles sous /assets/
app.use('/assets', express.static(path.join(__dirname, '../public')))
// GET /assets/logo.png → public/logo.png
```

Si `express.static()` est déclaré avant les routes dynamiques, les fichiers statiques sont servis en priorité.

### 2.8 CRUD complet — patterns de base

```ts
// Pattern store mémoire (avant base de données)
let items: Item[] = []

// Identifiant unique — crypto.randomUUID() disponible nativement dans Node 18+
const newId = () => crypto.randomUUID()

// Pattern GET :id avec 404
router.get('/:id', (req, res) => {
  const item = items.find(i => i.id === req.params.id)
  if (!item) return res.status(404).json({ error: 'Introuvable' })
  res.json(item)
})

// Pattern POST avec validation
router.post('/', (req, res) => {
  const { nom } = req.body
  if (!nom || typeof nom !== 'string') {
    return res.status(400).json({ error: 'nom requis (string)' })
  }
  const created = { id: newId(), nom: nom.trim() }
  items.push(created)
  res.status(201).json(created)
})

// Pattern DELETE avec 204
router.delete('/:id', (req, res) => {
  const index = items.findIndex(i => i.id === req.params.id)
  if (index === -1) return res.status(404).json({ error: 'Introuvable' })
  items.splice(index, 1)
  res.status(204).end()
})
```

## 3. Worked examples

### Exemple A — CRUD familles TribuZen (un seul fichier, avant extraction)

```ts
// src/index.ts — version plate
import express from 'express'
import crypto from 'node:crypto'

interface Famille {
  id: string
  nom: string
  description: string
  createdAt: string
}

const app = express()

// express.json() AVANT toutes les routes — sinon req.body est undefined sur POST/PUT/PATCH
app.use(express.json())

// Store en mémoire (Prisma + PostgreSQL au module 10)
let familles: Famille[] = [
  { id: crypto.randomUUID(), nom: 'Famille Martin', description: 'Tribu du Nord', createdAt: new Date().toISOString() },
  { id: crypto.randomUUID(), nom: 'Famille Dupont', description: 'Tribu du Sud', createdAt: new Date().toISOString() },
]

// ─── GET /familles ─────────────────────────────────────────────────────────────
app.get('/familles', (req, res) => {
  const { nom } = req.query

  // req.query.nom est string | string[] | ParsedQs — vérifier le type avant usage
  const filtre = typeof nom === 'string' ? nom.toLowerCase() : null

  const résultat = filtre
    ? familles.filter(f => f.nom.toLowerCase().includes(filtre))
    : familles

  res.json({ data: résultat, total: résultat.length })
})

// ─── GET /familles/:id ─────────────────────────────────────────────────────────
app.get('/familles/:id', (req, res) => {
  // req.params.id est TOUJOURS une string — UUID comparé à UUID, pas de parseInt nécessaire
  const famille = familles.find(f => f.id === req.params.id)

  if (!famille) {
    // return arrête l'exécution — sans lui, la fonction continue et envoie une 2e réponse
    return res.status(404).json({ error: 'Famille introuvable', id: req.params.id })
  }

  res.json(famille)
})

// ─── POST /familles ────────────────────────────────────────────────────────────
app.post('/familles', (req, res) => {
  const { nom, description } = req.body

  if (!nom || typeof nom !== 'string') {
    return res.status(400).json({ error: 'nom requis (string)' })
  }

  const nouvelle: Famille = {
    id: crypto.randomUUID(),
    nom: nom.trim(),
    description: typeof description === 'string' ? description.trim() : '',
    createdAt: new Date().toISOString(),
  }

  familles.push(nouvelle)
  res.status(201).json(nouvelle)   // 201 Created
})

// ─── PUT /familles/:id — remplacement TOTAL ───────────────────────────────────
app.put('/familles/:id', (req, res) => {
  const index = familles.findIndex(f => f.id === req.params.id)
  if (index === -1) return res.status(404).json({ error: 'Famille introuvable' })

  const { nom, description } = req.body

  // PUT = tous les champs requis — si un champ manque, c'est une erreur 400
  if (!nom || typeof nom !== 'string') {
    return res.status(400).json({ error: 'nom requis pour un remplacement complet (PUT)' })
  }

  // id et createdAt sont préservés — seuls les champs éditables sont remplacés
  familles[index] = {
    id: req.params.id,
    nom: nom.trim(),
    description: typeof description === 'string' ? description.trim() : '',
    createdAt: familles[index].createdAt,
  }

  res.json(familles[index])
})

// ─── PATCH /familles/:id — modification PARTIELLE ─────────────────────────────
app.patch('/familles/:id', (req, res) => {
  const famille = familles.find(f => f.id === req.params.id)
  if (!famille) return res.status(404).json({ error: 'Famille introuvable' })

  const { nom, description } = req.body

  // PATCH — seuls les champs présents dans le body sont mis à jour
  if (nom !== undefined) famille.nom = String(nom).trim()
  if (description !== undefined) famille.description = String(description).trim()

  res.json(famille)
})

// ─── DELETE /familles/:id ──────────────────────────────────────────────────────
app.delete('/familles/:id', (req, res) => {
  const index = familles.findIndex(f => f.id === req.params.id)
  if (index === -1) return res.status(404).json({ error: 'Famille introuvable' })

  familles.splice(index, 1)
  res.status(204).end()   // 204 No Content — pas de body possible après un DELETE réussi
})

app.listen(3000, () => console.log('API TribuZen sur http://localhost:3000'))
```

**Pas-à-pas :** (1) `app.use(express.json())` en premier — sans lui `req.body` est `undefined` sur toutes les routes POST/PUT/PATCH ; (2) `return res.status(404).json(...)` — le `return` est obligatoire, sinon la fonction continue et Express lève `Cannot set headers after they are sent` ; (3) `req.params.id` est une string — comparée à un UUID string, pas besoin de parseInt ; (4) `res.status(204).end()` — DELETE réussi renvoie 204 sans body, on ne peut pas chaîner `.json()` après ; (5) Express 5 — si un handler était `async` et rejetait, `next(err)` serait appelé automatiquement sans try/catch.

### Exemple B — Extraction du router modulaire

```ts
// src/routes/familles.ts — router autonome
import { Router, Request, Response } from 'express'
import crypto from 'node:crypto'

interface Famille {
  id: string
  nom: string
  description: string
  createdAt: string
}

let familles: Famille[] = []

const router = Router()

router.get('/', (req: Request, res: Response) => {
  const { nom } = req.query
  const filtre = typeof nom === 'string' ? nom.toLowerCase() : null
  const résultat = filtre
    ? familles.filter(f => f.nom.toLowerCase().includes(filtre))
    : familles
  res.json({ data: résultat, total: résultat.length })
})

router.post('/', (req: Request, res: Response) => {
  const { nom, description } = req.body
  if (!nom || typeof nom !== 'string') {
    return res.status(400).json({ error: 'nom requis (string)' })
  }
  const nouvelle: Famille = {
    id: crypto.randomUUID(),
    nom: nom.trim(),
    description: typeof description === 'string' ? description.trim() : '',
    createdAt: new Date().toISOString(),
  }
  familles.push(nouvelle)
  res.status(201).json(nouvelle)
})

router.get('/:id', (req: Request, res: Response) => {
  const famille = familles.find(f => f.id === req.params.id)
  if (!famille) return res.status(404).json({ error: 'Famille introuvable' })
  res.json(famille)
})

router.put('/:id', (req: Request, res: Response) => {
  const index = familles.findIndex(f => f.id === req.params.id)
  if (index === -1) return res.status(404).json({ error: 'Famille introuvable' })
  const { nom, description } = req.body
  if (!nom || typeof nom !== 'string') {
    return res.status(400).json({ error: 'nom requis (PUT)' })
  }
  familles[index] = {
    id: req.params.id,
    nom: nom.trim(),
    description: typeof description === 'string' ? description.trim() : '',
    createdAt: familles[index].createdAt,
  }
  res.json(familles[index])
})

router.patch('/:id', (req: Request, res: Response) => {
  const famille = familles.find(f => f.id === req.params.id)
  if (!famille) return res.status(404).json({ error: 'Famille introuvable' })
  const { nom, description } = req.body
  if (nom !== undefined) famille.nom = String(nom).trim()
  if (description !== undefined) famille.description = String(description).trim()
  res.json(famille)
})

router.delete('/:id', (req: Request, res: Response) => {
  const index = familles.findIndex(f => f.id === req.params.id)
  if (index === -1) return res.status(404).json({ error: 'Famille introuvable' })
  familles.splice(index, 1)
  res.status(204).end()
})

export default router
```

```ts
// src/index.ts — point d'entrée après extraction
import express from 'express'
import famillesRouter from './routes/familles.js'

const app = express()

app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Monte le router sur le préfixe /familles
// router.get('/') → répond à GET /familles
// router.get('/:id') → répond à GET /familles/:id
app.use('/familles', famillesRouter)

// Middleware d'erreur — déclaré APRÈS les routers pour être atteignable
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack)
  res.status(500).json({ error: err.message ?? 'Erreur interne' })
})

app.listen(3000, () => console.log('API TribuZen sur http://localhost:3000'))
```

**Pas-à-pas :** (1) `Router()` crée un mini-app autonome — ses routes sont relatives au préfixe de montage, donc `router.get('/')` répond à `GET /familles` ; (2) le store `familles` est local au module router — en production ce sera un service injectable (NestJS au module suivant) ; (3) le middleware d'erreur à 4 paramètres est déclaré après `app.use('/familles', famillesRouter)` pour intercepter les erreurs levées dans le router ; (4) `import ... from './routes/familles.js'` — l'extension `.js` est obligatoire avec `"type": "module"` dans `package.json`.

## 4. Pièges & misconceptions

- **`req.body` est `undefined`.** Tu as oublié `app.use(express.json())` — ou tu l'as déclaré après la route. Sans ce middleware, Express ne parse pas le body. Correction : déclarer `express.json()` en tête de la configuration, avant toute route qui lit `req.body`.

- **Double réponse sans `return`.** Appeler `res.json()` ou `res.send()` deux fois sur la même requête lève `Error: Cannot set headers after they are sent to the client`. Pattern correct : `if (!item) return res.status(404).json(...)` — le `return` arrête immédiatement l'exécution du handler.

- **`req.params.id` est une string.** `app.get('/familles/:id')` → `req.params.id` vaut `'3a7f...'` (string), jamais un nombre. Comparer un UUID string à un UUID string ne pose pas de problème. Si tu utilises des IDs numériques en DB, convertis : `parseInt(req.params.id, 10)`.

- **`req.query` — tout est string.** `GET /familles?page=2` → `req.query.page === '2'` (string). Convertis avant usage numérique : `const page = Number(req.query.page) || 1`. En Express 5, `req.query` est `Object.create(null)` sans prototype.

- **Express 4 vs 5 — async silencieux.** En Express 4, un handler `async` dont la Promise rejette ne déclenche pas le middleware d'erreur — l'exception disparaît silencieusement. En Express 5, la rejection est automatiquement propagée à `next(err)`. Sur un projet Express 4, toujours wraper : `try { await ... } catch (err) { next(err) }`.

- **Middleware d'erreur non atteignable.** Un middleware `(err, req, res, next)` déclaré avant les routes ne sera jamais atteint par les erreurs des routes. Il doit être le dernier `app.use()` de la chaîne.

## 5. Ancrage TribuZen

Couche fil-rouge : **premières routes de l'API TribuZen en Express (CRUD familles) avant NestJS** (`smaurier/tribuzen`).

- `GET /familles` avec filtre `?nom=` — la liste des familles accessibles à l'utilisateur connecté. La pagination (`?page=&limit=`) sera ajoutée au module 10 (PostgreSQL).
- `POST /familles` — un owner crée une nouvelle famille. La validation du `nom` ici est inline ; elle sera extraite dans un DTO NestJS avec `class-validator` au module 09.
- `GET /familles/:id` — chargement d'une famille par UUID.
- `PUT /familles/:id` / `PATCH /familles/:id` — mise à jour de la fiche famille.
- `DELETE /familles/:id` — suppression physique (soft delete avec champ `deletedAt` en DB réelle).

Ce code Express est provisoire et pédagogique : le module 06 (middleware) ajoute auth et logging, le module 09 (NestJS) remplace le router par des modules/controllers/services injectables, le module 10 (PostgreSQL) remplace le store mémoire par Prisma.

Structure cible dans `smaurier/tribuzen` :

```
tribuzen/
  apps/
    api/
      src/
        routes/
          familles.ts    ← Exemple B de ce module
        index.ts         ← app Express + montage routers + middleware erreur
```

## 6. Points clés

1. `express()` + `app.listen(PORT, cb)` — création et démarrage du serveur Express.
2. `app.use(express.json())` en premier — sans lui, `req.body` est toujours `undefined`.
3. `app.get/post/put/patch/delete(chemin, handler)` — chaque verbe HTTP a sa méthode Express.
4. `req.params.id` = string (route), `req.query.page` = string (URL), `req.body.nom` = valeur parsée (JSON).
5. `return res.status(404).json(...)` — le `return` est obligatoire pour stopper l'exécution après avoir envoyé une réponse.
6. `res.status(201).json(data)` pour créer, `res.status(204).end()` pour supprimer sans body.
7. `express.Router()` — extrait les routes dans un module autonome, monté avec `app.use('/prefix', router)`.
8. Middleware d'erreur `(err, req, res, next)` — 4 paramètres, déclaré après toutes les routes.
9. Express 5 — les handlers `async` propagent automatiquement les rejections vers `next(err)`, sans try/catch manuel.

## 7. Seeds Anki

```
Pourquoi req.body est-il undefined dans une route POST Express ?|express.json() n'a pas été déclaré avec app.use() avant la route — ce middleware parse le body JSON et le place dans req.body
Quel est le type de req.params.id dans app.get('/familles/:id') ?|string — les paramètres de route sont toujours des strings, même si la valeur ressemble à un nombre
Différence PUT vs PATCH dans un CRUD REST Express ?|PUT remplace la ressource entière (tous les champs requis), PATCH modifie uniquement les champs présents dans le body
Comment arrêter l'exécution du handler après avoir envoyé une réponse 404 ?|Préfixer l'appel avec return : `return res.status(404).json(...)` — sans return le code continue et tente une deuxième réponse
Quel status code pour un DELETE réussi sans body de retour ?|204 No Content — res.status(204).end() — ne pas appeler res.json() après un 204
Comment Express 5 améliore-t-il la gestion des handlers async par rapport à Express 4 ?|Express 5 propage automatiquement les rejections de Promise vers next(err) — plus besoin de try/catch ou du package express-async-errors
Comment monter un Router Express sur le préfixe /familles ?|app.use('/familles', famillesRouter) — les routes dans le router sont alors relatives : router.get('/') répond à GET /familles
Quel est le 4e paramètre qui distingue un middleware d'erreur d'un middleware normal ?|err — signature (err, req, res, next) à 4 paramètres ; Express identifie les middleware d'erreur uniquement par ce nombre de paramètres
```

## Pont vers le lab

> Lab associé : `09-nestjs/labs/lab-05-express-crud/README.md`. Tu construis le CRUD familles TribuZen en Express 5 avec router modulaire — pas de gap-fill, code de A à Z, corrigé complet commenté inline.
