# Lab 04 — Node.js serveur HTTP

> **Outcome :** à la fin, tu sais construire un serveur HTTP Node.js sans framework, router selon la méthode et l'URL, lire un body JSON et répondre correctement avec les bons codes de statut.
> **Vrai outil :** module `http` natif de Node.js 22 — zéro dépendance externe.
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

TribuZen a besoin de deux routes pour gérer les familles. Sans Express ni NestJS — uniquement avec le module `http` natif :

- `GET /api/families` → liste les familles en mémoire, 200 JSON
- `POST /api/families` → crée une famille (`name` requis), 201 JSON ou 400 si invalide
- Toute autre route → 404 JSON

Starter à créer dans un dossier vide (`server.ts`) :

```ts
import http from 'node:http'
import crypto from 'node:crypto'

type Family = { id: string; name: string; createdAt: string }
const families: Family[] = []

const server = http.createServer(async (req, res) => {
  // À toi de router et répondre
})

server.listen(3000, () => console.log('http://localhost:3000'))
```

Lance avec `npx tsx server.ts`. Teste avec curl.

## Étapes (en friction)

1. **Extraire `pathname`** depuis `req.url` avec l'API `URL` — ne pas comparer directement `req.url` (contient la query string).
2. **Écrire `sendJSON(res, status, data)`** — helper qui pose `Content-Type: application/json`, appelle `writeHead(status, headers)` et `end(body)`. Toutes les réponses passent par lui.
3. **Router `GET /api/families`** — appeler `sendJSON` avec 200 et `{ data: families }`.
4. **Écrire `readBody(req)`** — retourne `Promise<unknown>`. Collecter les chunks `Buffer[]`, assembler avec `Buffer.concat`, décoder en UTF-8, `JSON.parse`. Gérer le body vide et le JSON invalide.
5. **Router `POST /api/families`** — `await readBody(req)`, valider que `name` est une string non vide, créer la famille avec `crypto.randomUUID()`, pousser dans `families`, répondre 201.
6. **Gérer les erreurs** — route inconnue → 404 ; `readBody` rejette (JSON invalide) → 400 ; erreur inattendue → 500.
7. **Vérifier avec curl** — GET liste vide, POST valide, POST sans `name`, JSON malformé, route inconnue.

## Corrigé complet commenté

```ts
import http from 'node:http'
import crypto from 'node:crypto'

// ─── Modèle ──────────────────────────────────────────────────────────────────
type Family = { id: string; name: string; createdAt: string }
const families: Family[] = []

// ─── Helper : répondre en JSON ───────────────────────────────────────────────
// Centralise writeHead + end — impossible d'oublier Content-Type ou end()
function sendJSON(res: http.ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data)
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(body)
  // res.end() est obligatoire — sans lui, la connexion reste ouverte indéfiniment
}

// ─── Helper : lire le body JSON ───────────────────────────────────────────────
// IncomingMessage est un Readable : le body arrive en chunks Buffer, pas d'un coup
function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []

    // Accumuler les Buffer bruts — ne pas convertir en string ici :
    // un chunk peut couper un caractère UTF-8 multi-octets (accents, emoji) en deux
    req.on('data', (chunk: Buffer) => chunks.push(chunk))

    req.on('end', () => {
      // Assembler TOUS les octets, puis décoder en une seule passe
      const raw = Buffer.concat(chunks).toString('utf-8')

      // POST sans body → raw === '' → JSON.parse('') lèverait SyntaxError
      if (!raw) return resolve({})

      try {
        resolve(JSON.parse(raw))
      } catch {
        // Le client a envoyé quelque chose qui n'est pas du JSON valide
        reject(new Error('Body JSON invalide'))
      }
    })

    // Erreur réseau ou connexion coupée avant la fin du body
    req.on('error', reject)
  })
}

// ─── Serveur ──────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const { method } = req

  // req.url peut valoir '/api/families?page=2'
  // new URL sépare pathname et query string avant de router
  const parsed = new URL(req.url!, `http://${req.headers.host}`)
  const pathname = parsed.pathname

  try {
    // ── GET /api/families ────────────────────────────────────────────────────
    if (method === 'GET' && pathname === '/api/families') {
      sendJSON(res, 200, { data: families })
      return  // return obligatoire : sans lui, l'exécution tombe dans le if suivant
    }

    // ── POST /api/families ───────────────────────────────────────────────────
    if (method === 'POST' && pathname === '/api/families') {
      // await : le body arrive en stream, pas immédiatement
      const body = await readBody(req) as Record<string, unknown>

      // Validation : name doit être une string non vide
      if (typeof body.name !== 'string' || !body.name.trim()) {
        sendJSON(res, 400, { error: 'Le champ "name" est requis et doit être non vide' })
        return
      }

      const family: Family = {
        id: crypto.randomUUID(),            // UUID v4 sans dépendance externe
        name: body.name.trim(),             // normaliser les espaces
        createdAt: new Date().toISOString(),
      }

      families.push(family)

      // 201 Created : convention HTTP pour une ressource créée avec succès
      sendJSON(res, 201, { data: family })
      return
    }

    // ── Route inconnue ───────────────────────────────────────────────────────
    // 404 : ni le pathname ni la méthode ne correspondent à une route connue
    sendJSON(res, 404, { error: `${method} ${pathname} — route inconnue` })

  } catch (err) {
    // Attrape les rejets de readBody (Body JSON invalide) et les erreurs inattendues
    const message = err instanceof Error ? err.message : 'Erreur interne'
    const status = message === 'Body JSON invalide' ? 400 : 500
    sendJSON(res, status, { error: message })
  }
})

// ─── Écoute ───────────────────────────────────────────────────────────────────
server.listen(3000, () => {
  console.log('TribuZen HTTP brut → http://localhost:3000')
  console.log('  GET  /api/families')
  console.log('  POST /api/families')
})
```

**Tests curl à vérifier ligne par ligne :**

```bash
# 200 — liste vide au départ
curl http://localhost:3000/api/families

# 201 — famille créée
curl -X POST http://localhost:3000/api/families \
  -H "Content-Type: application/json" \
  -d '{"name": "Dupont"}'

# 200 — liste avec la famille créée
curl http://localhost:3000/api/families

# 400 — champ name manquant
curl -X POST http://localhost:3000/api/families \
  -H "Content-Type: application/json" \
  -d '{"color": "bleu"}'

# 400 — JSON malformé
curl -X POST http://localhost:3000/api/families \
  -H "Content-Type: application/json" \
  -d 'pas du json'

# 404 — route inconnue
curl http://localhost:3000/api/unknown
```

## Variante J+30 (fading)

Même problème, trois contraintes ajoutées — sans relire le corrigé, en 30 minutes :

1. Ajouter `GET /api/families/:id` — renvoyer 200 avec la famille trouvée, ou 404 si l'id est inconnu. Utiliser une regex avec groupe capturant.
2. Ajouter `DELETE /api/families/:id` — supprimer la famille, répondre 204 sans body. Renvoyer 404 si l'id est inconnu.
3. Tout appel sur `/api/families` avec une méthode autre que `GET` ou `POST` doit renvoyer `405 Method Not Allowed` avec un header `Allow: GET, POST`.

## Application TribuZen

Ce serveur correspond à `scratch/04-http-brut/server.ts` dans `smaurier/tribuzen`. Il est volontairement remplacé au module 05 par Express, puis au module 07 par NestJS. L'objectif n'est pas de le garder en production — c'est de sentir la friction que les frameworks éliminent.

Au module 05, la même route `GET /api/families` tient en 4 lignes avec `app.get(...)`. L'écart est la démonstration vivante de ce qu'Express abstrait.

Commit suggéré après validation en session :

```
feat(scratch): lab 04 — GET+POST /api/families en HTTP natif
```
