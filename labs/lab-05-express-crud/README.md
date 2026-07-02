# Lab 05 — Express CRUD familles TribuZen

> **Outcome :** à la fin, tu sais construire une API REST CRUD complète avec Express 5, extraire les routes dans un Router modulaire, et tester chaque endpoint avec curl.
> **Vrai outil :** Express 5 (Node 22, TypeScript via tsx).
> **Feedback :** le coach valide en session — teste les endpoints curl lors de la révision.

## Énoncé

Tu construis l'API familles de TribuZen en Express 5 — la fondation avant la migration NestJS.

**Entité :**

```ts
interface Famille {
  id: string           // UUID v4 (crypto.randomUUID())
  nom: string          // ex. 'Famille Martin'
  description: string  // ex. 'Tribu du Nord'
  createdAt: string    // ISO 8601
}
```

**Endpoints à implémenter :**

| Méthode | Route | Status succès | Status erreur |
|---------|-------|---------------|---------------|
| GET | /familles | 200 | — |
| GET | /familles?nom=martin | 200 (filtre) | — |
| GET | /familles/:id | 200 | 404 |
| POST | /familles | 201 | 400 |
| PUT | /familles/:id | 200 | 400 / 404 |
| PATCH | /familles/:id | 200 | 404 |
| DELETE | /familles/:id | 204 | 404 |

**Structure cible :**

```
src/
  routes/
    familles.ts   ← Router Express (store + routes)
  index.ts        ← app + express.json() + montage + middleware erreur + listen
```

**Setup (Express 5, Node 22) :**

```ts
// npm init -y
// Ajouter "type": "module" dans package.json
// npm install express@^5
// npm install -D @types/express@^5 tsx
// script dev : "npx tsx --watch src/index.ts"
```

## Étapes (en friction)

1. Initialise le projet : `npm init -y`, ajoute `"type": "module"`, installe les dépendances ci-dessus. Crée `src/index.ts` avec `express()`, `app.use(express.json())`, un endpoint `GET /health` qui renvoie `{ status: 'ok' }`, et `app.listen(3000)`. Vérifie : `curl http://localhost:3000/health`.

2. Crée `src/routes/familles.ts` avec le `Router()` et le store en mémoire (`let familles: Famille[] = []`). Implémente uniquement `GET /` (liste) et `GET /:id` (par id). Monte le router dans `index.ts` avec `app.use('/familles', famillesRouter)`. Vérifie les deux routes.

3. Implémentes `POST /` avec validation (`nom` requis, `typeof nom === 'string'`). Génères l'id avec `crypto.randomUUID()`. Vérifie le 201 sur succès et le 400 sur body invalide.

4. Implémentes `PUT /:id` (remplacement complet — `nom` obligatoire) et `PATCH /:id` (partiel — seuls les champs présents sont mis à jour). Distingue bien les deux comportements avec curl.

5. Implémentes `DELETE /:id` avec `res.status(204).end()`. Vérifie le 404 sur un id inconnu.

6. Ajoutes un middleware d'erreur global `(err, req, res, next)` dans `index.ts` après le montage du router. Simule une erreur dans une route pour vérifier qu'il est bien atteint.

7. Testes l'ensemble avec les commandes curl ci-dessous.

**Commandes curl de vérification :**

```ts
// Créer une famille
// curl -X POST http://localhost:3000/familles \
//   -H 'Content-Type: application/json' \
//   -d '{"nom":"Famille Martin","description":"Tribu du Nord"}'

// Lister toutes les familles
// curl http://localhost:3000/familles

// Filtrer par nom (insensible à la casse)
// curl 'http://localhost:3000/familles?nom=martin'

// Récupérer par id (remplacer <id> par l'UUID renvoyé à la création)
// curl http://localhost:3000/familles/<id>

// Remplacer complètement (PUT — nom obligatoire)
// curl -X PUT http://localhost:3000/familles/<id> \
//   -H 'Content-Type: application/json' \
//   -d '{"nom":"Famille Martin Modifiée","description":"Mise à jour complète"}'

// Modifier partiellement (PATCH — seul description envoyé)
// curl -X PATCH http://localhost:3000/familles/<id> \
//   -H 'Content-Type: application/json' \
//   -d '{"description":"Nouvelle description seulement"}'

// Supprimer (doit renvoyer 204 sans body)
// curl -v -X DELETE http://localhost:3000/familles/<id>

// Vérifier 404 sur id inconnu
// curl http://localhost:3000/familles/id-inexistant
```

## Corrigé complet commenté

### src/routes/familles.ts

```ts
// Router Express pour la ressource /familles — TribuZen API
import { Router, Request, Response } from 'express'
import crypto from 'node:crypto'

// Entité famille — stockée en mémoire (remplacée par Prisma au module 10)
interface Famille {
  id: string           // UUID v4 généré à la création, immuable
  nom: string          // obligatoire
  description: string  // optionnel, défaut ''
  createdAt: string    // ISO 8601, généré à la création, immuable
}

// Store mutable — Array car findIndex + splice suffisent pour un CRUD en mémoire
let familles: Famille[] = [
  {
    id: crypto.randomUUID(),
    nom: 'Famille Martin',
    description: 'Tribu du Nord',
    createdAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(),
    nom: 'Famille Dupont',
    description: 'Tribu du Sud',
    createdAt: new Date().toISOString(),
  },
]

const router = Router()

// ─── GET /familles ─────────────────────────────────────────────────────────────
// Liste toutes les familles avec filtre optionnel ?nom= (insensible à la casse)
router.get('/', (req: Request, res: Response) => {
  const { nom } = req.query

  // req.query.nom est string | string[] | ParsedQs | undefined
  // On vérifie typeof === 'string' avant d'appeler .toLowerCase()
  const filtre = typeof nom === 'string' ? nom.toLowerCase() : null

  const résultat = filtre
    ? familles.filter(f => f.nom.toLowerCase().includes(filtre))
    : familles

  // Enveloppe { data, total } — pattern courant pour les listes, facilite la pagination future
  res.json({ data: résultat, total: résultat.length })
})

// ─── GET /familles/:id ─────────────────────────────────────────────────────────
router.get('/:id', (req: Request, res: Response) => {
  // req.params.id est TOUJOURS une string — UUID comparé à UUID, aucune conversion nécessaire
  const famille = familles.find(f => f.id === req.params.id)

  if (!famille) {
    // return obligatoire — sans lui, Express tente d'envoyer une 2e réponse après le 404
    return res.status(404).json({ error: 'Famille introuvable', id: req.params.id })
  }

  res.json(famille)
})

// ─── POST /familles ────────────────────────────────────────────────────────────
router.post('/', (req: Request, res: Response) => {
  // req.body est undefined si express.json() n'est pas monté dans index.ts avant ce router
  const { nom, description } = req.body

  // Validation minimale — nom est le seul champ obligatoire
  if (!nom || typeof nom !== 'string') {
    return res.status(400).json({ error: 'nom requis (string)' })
  }

  const nouvelle: Famille = {
    id: crypto.randomUUID(),         // Node 18+ — pas besoin du package uuid
    nom: nom.trim(),
    description: typeof description === 'string' ? description.trim() : '',
    createdAt: new Date().toISOString(),
  }

  familles.push(nouvelle)
  res.status(201).json(nouvelle)    // 201 Created — renvoie la ressource créée
})

// ─── PUT /familles/:id ─────────────────────────────────────────────────────────
// PUT = remplacement TOTAL — tous les champs éditables doivent être présents dans le body
router.put('/:id', (req: Request, res: Response) => {
  const index = familles.findIndex(f => f.id === req.params.id)

  if (index === -1) {
    return res.status(404).json({ error: 'Famille introuvable' })
  }

  const { nom, description } = req.body

  if (!nom || typeof nom !== 'string') {
    return res.status(400).json({ error: 'nom requis pour un remplacement complet (PUT)' })
  }

  // Reconstruction complète de l'objet — id et createdAt sont immuables
  familles[index] = {
    id: req.params.id,
    nom: nom.trim(),
    description: typeof description === 'string' ? description.trim() : '',
    createdAt: familles[index].createdAt,   // createdAt immuable
  }

  res.json(familles[index])
})

// ─── PATCH /familles/:id ───────────────────────────────────────────────────────
// PATCH = modification PARTIELLE — seuls les champs présents dans le body sont mis à jour
router.patch('/:id', (req: Request, res: Response) => {
  const famille = familles.find(f => f.id === req.params.id)

  if (!famille) {
    return res.status(404).json({ error: 'Famille introuvable' })
  }

  const { nom, description } = req.body

  // Mutation directe de l'objet dans le tableau (find retourne une référence)
  // undefined signifie "champ absent du body" → ne pas modifier
  if (nom !== undefined) famille.nom = String(nom).trim()
  if (description !== undefined) famille.description = String(description).trim()

  res.json(famille)
})

// ─── DELETE /familles/:id ──────────────────────────────────────────────────────
router.delete('/:id', (req: Request, res: Response) => {
  const index = familles.findIndex(f => f.id === req.params.id)

  if (index === -1) {
    return res.status(404).json({ error: 'Famille introuvable' })
  }

  familles.splice(index, 1)   // suppression physique (soft delete avec deletedAt en DB réelle)
  res.status(204).end()       // 204 No Content — pas de body pour un DELETE réussi
})

export default router
```

### src/index.ts

```ts
// Point d'entrée — configure l'app Express, monte les routers, démarre le serveur
import express from 'express'
import famillesRouter from './routes/familles.js'  // .js obligatoire avec "type": "module"

const app = express()

// ─── Middleware globaux ────────────────────────────────────────────────────────
// Déclarés AVANT les routes — sinon req.body est undefined dans les routes POST/PUT/PATCH
app.use(express.json())

// ─── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ─── Routers métier ───────────────────────────────────────────────────────────
// router.get('/') → GET /familles
// router.get('/:id') → GET /familles/:id
app.use('/familles', famillesRouter)

// ─── Middleware d'erreur ───────────────────────────────────────────────────────
// 4 paramètres — Express reconnaît les middleware d'erreur par leur arité
// Déclaré APRÈS tous les routers pour être atteignable
// Express 5 — les handlers async propagent automatiquement les rejections ici
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack)
  res.status(500).json({ error: err.message ?? 'Erreur interne du serveur' })
})

// ─── Démarrage ─────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 3000

app.listen(PORT, () => {
  console.log(`API TribuZen (Express 5) sur http://localhost:${PORT}`)
})
```

## Variante J+30 (fading)

Même API familles, en 25 minutes, sans consulter le module ni le corrigé :

1. Sépare le store en un module dédié `src/data/familles.ts` (exporte `familles` et les fonctions `findById`, `create`, `update`, `remove`) — le router importe ces fonctions au lieu de manipuler le tableau directement.
2. Ajoute un middleware de logging (avant les routes) qui loggue `[timestamp] METHOD /path` et la durée de la requête (calcul entre `Date.now()` en entrée et en sortie via `res.on('finish', cb)`).
3. Ajoute la pagination sur `GET /familles` : `?page=1&limit=5` — renvoie `{ data, total, page, limit, totalPages }`.

Contrainte : pas de npm install supplémentaire, tout en Node 22 standard + Express 5.

## Application TribuZen

Porter le résultat dans `smaurier/tribuzen` :

- `apps/api/src/routes/familles.ts` → le router de ce lab devient le point de départ de l'API TribuZen.
- `apps/api/src/index.ts` → point d'entrée Express avec montage et middleware d'erreur.
- Ce code Express sera conservé comme référence lors de la migration NestJS (module 09) pour comparer les patterns : controller NestJS ↔ router Express, service NestJS ↔ store exporté, module NestJS ↔ montage dans `app.module.ts`.

Commit suggéré : `feat(api): CRUD familles Express 5 — base avant migration NestJS`.
