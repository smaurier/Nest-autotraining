---
titre: Node.js serveur HTTP
cours: 09-nestjs
notions: [module http, createServer, objet request et response, méthodes et URL, routing manuel, codes de statut, en-têtes HTTP, lecture du body, réponse JSON, limites du http brut]
outcomes: [créer un serveur HTTP avec le module http natif, router manuellement selon méthode/URL, lire un body et répondre en JSON, comprendre pourquoi Express existe]
prerequis: [03-nodejs-streams-et-buffers]
next: 05-express-fondamentaux
libs: [{ name: node, version: "22" }]
tribuzen: serveur HTTP brut d'une route TribuZen avant d'introduire Express/Nest
last-reviewed: 2026-07
---

# Node.js serveur HTTP

> **Outcomes — tu sauras FAIRE :** créer un serveur HTTP avec le module natif `http`, router manuellement selon la méthode et l'URL, lire un body JSON et répondre en JSON, comprendre pourquoi Express existe.
> **Difficulté :** :star::star:

## 1. Cas concret d'abord

Tu rejoins TribuZen pour la première semaine. Le mobile React Native a besoin d'une route `GET /api/families` pour afficher les familles de l'utilisateur connecté. Pas d'Express, pas de NestJS — tu dois exposer cette route avec uniquement Node.js.

Voici ce que tu écris, sans rien installer :

```ts
import http from 'node:http'

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/api/families') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ data: [] }))
    return
  }
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Route introuvable' }))
})

server.listen(3000, () => console.log('http://localhost:3000'))
```

Ça fonctionne. Mais quand tu ajoutes `POST /api/families`, tu découvres que `req.body` n'existe pas — le body arrive en morceaux via un stream et tu dois l'assembler manuellement. Quand tu atteins 5 routes, le `if/else` devient ingérable. Ce module explique pourquoi, puis montre ce qu'Express va régler.

## 2. Théorie complète, concise

### Le module `http`

Node.js expose le module `http` en natif — aucun `npm install`. Import ESM avec le préfixe `node:` (recommandé depuis Node 14, fortement conseillé en Node 22 — fonctionne sans, mais le préfixe explicite lève toute ambiguïté avec un éventuel package npm du même nom) :

```ts
import http from 'node:http'
```

### `createServer` — anatomie

`http.createServer(requestListener)` enregistre un callback invoqué à chaque requête entrante. Il retourne un `http.Server`. La mise en écoute se fait avec `.listen(port[, callback])` :

```ts
const server = http.createServer((req, res) => {
  // req = IncomingMessage  (Readable stream — ce que le client envoie)
  // res = ServerResponse   (Writable stream — ce que tu renvoies)
  res.writeHead(200)
  res.end('ok')
})

// listen() est asynchrone — le callback est appelé quand la socket est ouverte
server.listen(3000, () => {
  console.log('Serveur en écoute sur le port 3000')
})
```

### Objet `request` — `IncomingMessage`

`IncomingMessage` étend `stream.Readable` (Node.js docs). Les propriétés disponibles dès réception des headers :

```ts
const server = http.createServer((req, res) => {
  req.method      // 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | ...
  req.url         // '/api/families?page=2' — inclut la query string
  req.headers     // { 'content-type': 'application/json', host: 'localhost:3000', ... }
  req.httpVersion // '1.1' ou '1.0'

  // Le body N'EST PAS disponible directement sur req
  // Il arrive en chunks via les événements 'data' et 'end' (voir section Lecture du body)
})
```

Les noms de headers sont toujours en **minuscules** dans `req.headers` (normalisation HTTP/1.1).

### Objet `response` — `ServerResponse`

```ts
const server = http.createServer((req, res) => {
  // Option A — writeHead (status + headers en une instruction, retourne this pour chaînage)
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'X-Request-Id': crypto.randomUUID(),
  })
  res.end(JSON.stringify({ ok: true }))

  // Option B — statusCode + setHeader (séparément, avant write/end)
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ ok: true }))

  // writeHead() prend précédence sur setHeader() si les deux définissent la même clé
})
```

**`res.end()` est obligatoire dans tous les chemins d'exécution.** Sans appel à `end()`, la connexion HTTP reste ouverte et le client attend jusqu'au timeout.

`writeHead()` doit être appelé **avant** `write()` ou `end()`. Modifier les headers après leur envoi lève `Error [ERR_HTTP_HEADERS_SENT]`.

### Méthodes et URL

Le routing repose sur `req.method` et l'URL parsée. **Ne jamais comparer directement `req.url`** à une route fixe quand une query string est possible — utiliser l'API `URL` standard :

```ts
const server = http.createServer((req, res) => {
  const { method } = req

  // req.url peut valoir '/api/families?page=2'
  // new URL sépare le pathname des query params
  const parsed = new URL(req.url!, `http://${req.headers.host}`)
  const pathname = parsed.pathname                 // '/api/families'
  const page = parsed.searchParams.get('page')    // '2' ou null

  if (method === 'GET' && pathname === '/api/families') {
    // route matchée correctement, même avec query string
  }
})
```

### Routing manuel

Routing par `if/else` sur `method` + `pathname`. Segments dynamiques (`/api/families/:id`) : regex avec groupe capturant.

```ts
const server = http.createServer((req, res) => {
  const { method } = req
  const parsed = new URL(req.url!, `http://${req.headers.host}`)
  const pathname = parsed.pathname

  // Route statique
  if (method === 'GET' && pathname === '/api/families') { /* ... */ }

  // Route avec paramètre dynamique
  // ([^/]+) capture tout sauf '/' — retourne null si pas de match
  const byId = pathname.match(/^\/api\/families\/([^/]+)$/)
  if (method === 'GET' && byId) {
    const familyId = byId[1]   // premier groupe capturant
    // ...
  }
})
```

### Codes de statut

| Code | Signification HTTP |
|------|--------------------|
| 200  | OK |
| 201  | Created |
| 204  | No Content (DELETE réussi, body vide) |
| 400  | Bad Request (body invalide, champ manquant) |
| 404  | Not Found (route inconnue) |
| 405  | Method Not Allowed (route connue, méthode refusée) |
| 500  | Internal Server Error |

`404` = route inconnue. `405` = route connue, méthode non autorisée. La distinction est indispensable pour diagnostiquer une API proprement.

### En-têtes HTTP

`Content-Type` indique au client comment interpréter le body. Pour une API JSON, c'est toujours `application/json`. `Content-Length` est facultatif mais recommandé pour le keep-alive :

```ts
res.writeHead(200, {
  'Content-Type': 'application/json',
  'Content-Length': Buffer.byteLength(body),  // taille en octets, pas en caractères
})
```

`Buffer.byteLength(string)` donne la taille en octets (indispensable pour UTF-8 où un caractère peut occuper plusieurs octets).

### Lecture du body

`IncomingMessage` est un `Readable`. Le body arrive en chunks `Buffer` via l'événement `'data'`, et se termine par `'end'`. Assembler avec `Buffer.concat` **avant** de décoder en UTF-8 :

```ts
function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []

    // Chaque 'data' est un Buffer — on accumule sans convertir en string
    req.on('data', (chunk: Buffer) => chunks.push(chunk))

    req.on('end', () => {
      // Assembler tous les octets, puis décoder en une seule passe
      const raw = Buffer.concat(chunks).toString('utf-8')

      // POST sans body → chaîne vide → JSON.parse('') lèverait SyntaxError
      if (!raw) return resolve({})

      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new Error('Body JSON invalide'))
      }
    })

    req.on('error', reject)
  })
}
```

### Réponse JSON

Pattern standard : `JSON.stringify`, `Content-Type: application/json`, `res.end()`. Centraliser en helper évite de répéter les headers sur chaque route :

```ts
function sendJSON(
  res: http.ServerResponse,
  status: number,
  data: unknown,
): void {
  const body = JSON.stringify(data)
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(body)
  // Toujours via sendJSON — garantit que end() est appelé dans tous les chemins
}
```

### Limites du `http` brut

| Besoin | HTTP natif | Express / NestJS |
|--------|-----------|-----------------|
| Routing méthode + URL | `if/else` verbose | `app.get('/path', handler)` |
| Paramètres de route | Regex manuelle | `req.params.id` |
| Parsing body JSON | `readBody()` à écrire | `express.json()` middleware |
| Query string | `new URL(...).searchParams` | `req.query` |
| Middleware chainable | Pas de mécanisme natif | `app.use(fn)` |
| Gestion d'erreur centralisée | `try/catch` dans chaque handler | Error middleware dédié |

## 3. Worked examples

### Exemple A — `GET` et `POST /api/families` pour TribuZen

```ts
// server.ts — Node.js 22, aucune dépendance
import http from 'node:http'
import crypto from 'node:crypto'

type Family = { id: string; name: string; createdAt: string }
const families: Family[] = [
  { id: 'fam-seed', name: 'Dupont', createdAt: new Date().toISOString() },
]

// Helper : un seul endroit pour écrire Content-Type + end
function sendJSON(res: http.ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data)
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(body)
}

// Helper : body arrive en stream — assembler avant de parser
function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8')
      if (!raw) return resolve({})
      try { resolve(JSON.parse(raw)) }
      catch { reject(new Error('Body JSON invalide')) }
    })
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  const { method } = req
  // Extraire pathname pour ne pas être trompé par la query string
  const parsed = new URL(req.url!, `http://${req.headers.host}`)
  const pathname = parsed.pathname

  try {
    // GET /api/families → lister
    if (method === 'GET' && pathname === '/api/families') {
      sendJSON(res, 200, { data: families })
      return  // return obligatoire : évite de "tomber" dans le if suivant
    }

    // POST /api/families → créer
    if (method === 'POST' && pathname === '/api/families') {
      const body = await readBody(req) as Record<string, unknown>

      if (typeof body.name !== 'string' || !body.name.trim()) {
        sendJSON(res, 400, { error: 'Le champ "name" est requis' })
        return
      }

      const family: Family = {
        id: crypto.randomUUID(),
        name: body.name.trim(),
        createdAt: new Date().toISOString(),
      }
      families.push(family)
      sendJSON(res, 201, { data: family })
      return
    }

    // Aucune route
    sendJSON(res, 404, { error: `${method} ${pathname} — route inconnue` })

  } catch (err) {
    // readBody rejette si le JSON est malformé → 400 plutôt que 500
    const message = err instanceof Error ? err.message : 'Erreur interne'
    const status = message === 'Body JSON invalide' ? 400 : 500
    sendJSON(res, status, { error: message })
  }
})

server.listen(3000, () => console.log('TribuZen HTTP brut → http://localhost:3000'))
```

**Pas-à-pas :**
1. `new URL(req.url!, ...)` — sans ça, `req.url === '/api/families?page=2'` ne matche jamais `'/api/families'`. La base `http://...` est requise par `new URL` pour les URLs relatives.
2. `readBody` accumule des `Buffer` (pas des strings) — `Buffer.concat` puis `.toString('utf-8')` une seule fois. Concaténer des strings peut corrompre les caractères UTF-8 multi-octets (accents, emoji) si un chunk coupe un caractère en deux.
3. `sendJSON` centralise `writeHead` + `end` — chaque chemin d'exécution passe par lui. Impossible d'oublier `Content-Type` ou `end()`.
4. Le handler est `async` — `createServer` supporte les callbacks async. Sans `try/catch`, une erreur dans le handler async fermerait la connexion sans répondre au client.
5. Chaque branche se termine par `return` après `sendJSON` — sans `return`, l'exécution continuerait vers le `404` en bas.

### Exemple B — Route avec paramètre dynamique

```ts
// Ajout à l'exemple A : GET /api/families/:id
const server = http.createServer((req, res) => {
  const { method } = req
  const parsed = new URL(req.url!, `http://${req.headers.host}`)
  const pathname = parsed.pathname

  function send(status: number, data: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(data))
  }

  // Regex : capture tout segment non-vide après /api/families/
  // null si le pathname ne matche pas le pattern
  const byId = pathname.match(/^\/api\/families\/([^/]+)$/)

  if (method === 'GET' && byId) {
    const id = byId[1]                        // premier groupe capturant
    const found = families.find(f => f.id === id)

    if (!found) {
      // 404 : la route existe (/api/families/:id) mais CET id n'est pas en base
      send(404, { error: `Famille "${id}" introuvable` })
      return
    }

    send(200, { data: found })
    return
  }

  send(404, { error: 'Route inconnue' })
})
```

**Pas-à-pas :**
1. `([^/]+)` capture un ou plusieurs caractères non-`/` — correspond à des UUID, des slugs, des nombres. `pathname.match(...)` retourne `null` si pas de match → la branche `if (method === 'GET' && byId)` ne s'exécute pas.
2. `byId[1]` est l'id brut — toujours valider ou typer avant d'utiliser dans une requête DB.
3. La distinction 404 "route inconnue" vs 404 "ressource introuvable" est sémantiquement juste en HTTP. Le message d'erreur doit rester clair pour le client de l'API.

## 4. Pièges & misconceptions

**`req.body` n'existe pas en HTTP natif.**
C'est une abstraction d'Express (`express.json()` middleware). En HTTP natif, accéder à `(req as any).body` retourne toujours `undefined`. Le body arrive en stream via les événements `'data'` / `'end'` de l'`IncomingMessage`. *Correct* : `readBody(req)` avec `Buffer.concat`.

**Oublier `res.end()` — le client attend indéfiniment.**
Si un handler retourne sans appeler `res.end()`, la connexion HTTP reste ouverte. Le navigateur ou le client API affiche un spinner jusqu'au timeout réseau. *Correct* : passer par un helper `sendJSON` qui garantit `end()` dans tous les cas.

**Comparer `req.url === '/api/families'` quand une query string est possible.**
`req.url` contient la chaîne complète : `'/api/families?page=2'`. La comparaison stricte échoue. *Correct* : `new URL(req.url!, base).pathname` avant de comparer.

**Appeler `res.writeHead()` ou `res.setHeader()` après `res.write()` / `res.end()`.**
Lève `Error [ERR_HTTP_HEADERS_SENT]`. Se produit typiquement quand on oublie un `return` après `sendJSON()` et que le code continue à écrire. *Correct* : toujours `return` immédiatement après chaque `sendJSON()` ou `res.end()`.

**Concaténer les chunks en string avec `+=`.**
`body += chunk` fonctionne pour de l'ASCII pur, mais corrompt les caractères UTF-8 multi-octets (emoji, accents) si un chunk coupe un caractère entre deux octets. *Correct* : tableau de `Buffer[]`, puis `Buffer.concat(chunks).toString('utf-8')` une seule fois à la fin du stream.

**`JSON.parse('')` lève une `SyntaxError`.**
Un POST sans body donne `raw === ''` et `JSON.parse('')` plante. *Correct* : `if (!raw) return resolve({})` avant de parser — voir `readBody` en section 2.

## 5. Ancrage TribuZen

Couche fil-rouge : **serveur HTTP brut d'une route TribuZen avant d'introduire Express/Nest** (`smaurier/tribuzen`).

Ce serveur est la couche zéro — celle qu'Express puis NestJS remplacent. Son rôle pédagogique est de rendre visible ce que les frameworks font en coulisses :

- `express.json()` = exactement `readBody()` de ce module (events `data`/`end`, `Buffer.concat`, `JSON.parse`)
- `res.json(data)` = exactement `sendJSON(res, 200, data)`
- `req.params.id` = exactement `pathname.match(/([^/]+)$/)[1]`
- `app.get('/path', handler)` = un `if (method === 'GET' && pathname === '/path')` plus concis

Fichier cible dans `smaurier/tribuzen` (couche d'apprentissage, pas de production) :

```
tribuzen/
  scratch/
    04-http-brut/
      server.ts    ← Exemple A de ce module (GET + POST /api/families)
```

Au module 05 (Express), la même route `GET /api/families` sera réécrite en 4 lignes avec `app.get(...)`. L'écart de code illustre concrètement ce qu'un framework apporte. Au module 09 (NestJS), un `@Controller('families')` + `@Get()` remplacera le tout.

## 6. Points clés

1. `http.createServer(callback)` + `server.listen(port)` — deux lignes suffisent pour un serveur HTTP Node.js, zéro dépendance.
2. `req` est un `IncomingMessage` (Readable) — `method`, `url`, `headers` disponibles directement ; le body doit être collecté via `data`/`end`.
3. `req.url` inclut la query string — utiliser `new URL(req.url!, base).pathname` avant de comparer des routes.
4. `res` est un `ServerResponse` (Writable) — `writeHead(status, headers)` puis `end(body)` ; `end()` est obligatoire.
5. `writeHead()` doit précéder `write()` et `end()` — modifier les headers après envoi lève `ERR_HTTP_HEADERS_SENT`.
6. Routing manuel = `if/else` sur `method` + `pathname` + regex avec groupe capturant pour les segments dynamiques.
7. Codes à mémoriser : 200, 201, 204, 400, 404, 405, 500. `404` = route inconnue ; `405` = méthode refusée sur route connue.
8. `Buffer.concat(chunks).toString('utf-8')` est le pattern correct pour assembler un body stream — ne pas concaténer des strings directement.
9. Le module `http` brut est la fondation d'Express, Fastify, Koa et NestJS — comprendre ce niveau permet de debugger ce que les abstractions cachent.

## 7. Seeds Anki

```
Pourquoi req.body est-il undefined en HTTP natif Node.js ?|Il n'existe pas — c'est une abstraction d'Express. Le body arrive via les événements data/end de IncomingMessage (Readable). Il faut le collecter avec Buffer.concat(chunks) puis JSON.parse.
Que se passe-t-il si on oublie res.end() dans un handler HTTP ?|La connexion reste ouverte indéfiniment. Le client attend jusqu'au timeout. res.end() est obligatoire pour terminer la réponse.
Pourquoi comparer req.url === '/api/families' est souvent faux ?|req.url inclut la query string : '/api/families?page=2'. Il faut extraire le pathname via new URL(req.url, base).pathname avant de comparer.
Quelle erreur lève-t-on en appelant res.setHeader() après res.end() ?|Error [ERR_HTTP_HEADERS_SENT] — les headers ont déjà été envoyés. Toujours return immédiatement après res.end() ou sendJSON().
Quelle est la différence entre un 404 et un 405 ?|404 = route inconnue (ni la ressource ni le chemin n'existent). 405 = route connue mais méthode non autorisée (ex DELETE sur /api/families si seul GET/POST sont supportés).
Comment lire un body JSON en HTTP natif Node.js ?|Collecter les Buffer via req.on('data', c => chunks.push(c)), attendre req.on('end'), puis Buffer.concat(chunks).toString('utf-8') et JSON.parse.
Pourquoi Buffer.concat(chunks) plutôt que body += chunk ?|Concaténer des strings peut couper un caractère UTF-8 multi-octets entre deux chunks et corrompre le texte. Buffer.concat assemble les octets bruts avant de décoder en UTF-8 une seule fois.
Dans quel ordre appeler writeHead, write et end sur ServerResponse ?|1. writeHead(status, headers) — optionnel si on utilise setHeader+statusCode. 2. write(chunk) — facultatif, plusieurs fois. 3. end(body) — obligatoire et terminal.
```

## Pont vers le lab

> Lab associé : `09-nestjs/labs/lab-04-serveur-http/README.md`. Tu y construis les routes `GET /api/families` et `POST /api/families` de TribuZen avec le module `http` natif — routing, body parsing, réponse JSON, codes de statut. Starter minimal, corrigé intégral commenté et variante J+30 dans le README.
