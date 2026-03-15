# Module 04 — Node.js — Serveur HTTP natif

> **Objectif** : Créer un serveur HTTP complet avec le module natif `http` de Node.js, comprendre IncomingMessage et ServerResponse, implementer du routing manuel et construire une API REST complete — pour ensuite comprendre ce qu'Express abstrait.
>
> **Difficulte** : ⭐⭐ (intermédiaire)

---

## 1. Le module http de Node.js

### 1.1 Créer un serveur minimal

```typescript
import http from 'http';

// Creer un serveur HTTP
const server = http.createServer((req, res) => {
  // req = IncomingMessage (la requete du client)
  // res = ServerResponse (la reponse a envoyer)

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello World !');
});

// Ecouter sur le port 3000
server.listen(3000, () => {
  console.log('Serveur demarre sur http://localhost:3000');
});
```

> **Analogie** : `http.createServer()` c'est comme embaucher un receptionniste a l'entree d'un batiment. A chaque visiteur (requête), il regarde ce que le visiteur demandé (URL, méthode), decide quoi faire, et lui donne une réponse. Le `server.listen(3000)` c'est ouvrir la porte du batiment — le receptionniste commence a accueillir les visiteurs.

### 1.2 Anatomie du callback

Le callback de `createServer` recoit deux objets fondamentaux :

```typescript
const server = http.createServer((req, res) => {
  // === req (IncomingMessage) — Ce que le client envoie ===
  console.log(req.method);          // 'GET', 'POST', 'PUT', etc.
  console.log(req.url);             // '/api/users?page=2'
  console.log(req.headers);         // { host: 'localhost:3000', ... }
  console.log(req.headers['content-type']); // 'application/json'
  console.log(req.httpVersion);     // '1.1'

  // === res (ServerResponse) — Ce que tu envoies au client ===
  res.statusCode = 200;             // Definir le status code
  res.setHeader('Content-Type', 'application/json'); // Definir un header
  res.writeHead(200, {              // Status + headers en une fois
    'Content-Type': 'application/json',
    'X-Custom-Header': 'valeur',
  });
  res.write('partie 1');            // Ecrire une partie du body
  res.write('partie 2');            // Ecrire une autre partie
  res.end('fin');                   // Terminer la reponse (obligatoire !)
});
```

> **Piege classique** : Tu DOIS toujours appeler `res.end()` pour terminer la réponse. Si tu oublies, le client reste en attente indefiniment (timeout). C'est le bug le plus courant des débutants avec le serveur HTTP natif.

---

## 2. Routing manuel

### 2.1 Router selon l'URL et la méthode

```typescript
import http from 'http';

const server = http.createServer((req, res) => {
  const { method, url } = req;

  // Definir les headers par defaut
  res.setHeader('Content-Type', 'application/json');

  // Router les requetes
  if (method === 'GET' && url === '/') {
    res.writeHead(200);
    res.end(JSON.stringify({ message: 'Bienvenue sur l\'API' }));
  }
  else if (method === 'GET' && url === '/api/users') {
    res.writeHead(200);
    res.end(JSON.stringify({ users: [] }));
  }
  else if (method === 'POST' && url === '/api/users') {
    // On traitera le body plus tard
    res.writeHead(201);
    res.end(JSON.stringify({ message: 'Utilisateur cree' }));
  }
  else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Route introuvable' }));
  }
});

server.listen(3000, () => {
  console.log('Serveur sur http://localhost:3000');
});
```

### 2.2 Extraire les paramètres d'URL

```typescript
import http from 'http';

const server = http.createServer((req, res) => {
  const { method, url } = req;
  res.setHeader('Content-Type', 'application/json');

  // Parser l'URL pour extraire le pathname et les query params
  const parsedUrl = new URL(url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;     // '/api/users/42'
  const searchParams = parsedUrl.searchParams;

  // Route avec parametre : /api/users/:id
  const userMatch = pathname.match(/^\/api\/users\/(\d+)$/);

  if (method === 'GET' && pathname === '/api/users') {
    // Query params : /api/users?page=2&limit=10
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;

    res.writeHead(200);
    res.end(JSON.stringify({
      page,
      limit,
      users: [],
    }));
  }
  else if (method === 'GET' && userMatch) {
    const userId = parseInt(userMatch[1]);

    res.writeHead(200);
    res.end(JSON.stringify({
      id: userId,
      nom: 'Alice',
      email: 'alice@example.com',
    }));
  }
  else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Route introuvable' }));
  }
});

server.listen(3000);
```

> **A retenir** : La classe `URL` (API Web standard, disponible nativement en Node.js) est la meilleure façon de parser les URLs. `URLSearchParams` facilite l'acces aux query parameters. Pas besoin de librairie externe.

---

## 3. Parser le body JSON

### 3.1 Le body arrive en chunks

En HTTP natif, le body n'est PAS disponible directement sur `req.body`. Il arrive sous forme de **chunks** (morceaux) via les événements du stream `req` :

```typescript
import http from 'http';

function parseJSON(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on('data', (chunk) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      try {
        const parsed = JSON.parse(raw);
        resolve(parsed);
      } catch (err) {
        reject(new Error('JSON invalide'));
      }
    });

    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const { method, url } = req;
  res.setHeader('Content-Type', 'application/json');

  if (method === 'POST' && url === '/api/users') {
    try {
      const body = await parseJSON(req);
      console.log('Body recu :', body);

      // Validation basique
      if (!body.nom || !body.email) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'nom et email requis' }));
        return;
      }

      res.writeHead(201);
      res.end(JSON.stringify({
        id: Date.now(),
        nom: body.nom,
        email: body.email,
      }));
    } catch (err) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: err.message }));
    }
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Route introuvable' }));
  }
});

server.listen(3000);
```

> **Analogie** : Parser le body en HTTP natif, c'est comme recevoir un colis par la poste en plusieurs paquets. Tu dois attendre d'avoir TOUS les paquets (`end`), les assembler (`Buffer.concat`), puis ouvrir le carton (`JSON.parse`). Express fait tout ça automatiquement avec `express.json()`.

---

## 4. Status codes et headers

### 4.1 Définir les headers correctement

```typescript
const server = http.createServer((req, res) => {
  // Methode 1 : setHeader (un par un)
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Request-Id', crypto.randomUUID());
  res.setHeader('Cache-Control', 'no-cache');
  res.statusCode = 200;
  res.end('{}');

  // Methode 2 : writeHead (tout en une fois)
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'X-Request-Id': crypto.randomUUID(),
    'Cache-Control': 'no-cache',
  });
  res.end('{}');
});
```

### 4.2 Headers CORS

```typescript
function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:4200');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight 24h
}

const server = http.createServer((req, res) => {
  setCORSHeaders(res);

  // Gerer le preflight OPTIONS
  if (req.method === 'OPTIONS') {
    res.writeHead(204); // No Content
    res.end();
    return;
  }

  // ... suite du routing
});
```

---

## 5. Servir des fichiers statiques

```typescript
import http from 'http';
import { createReadStream, existsSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');

// Map des types MIME
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.pdf': 'application/pdf',
};

const server = http.createServer((req, res) => {
  // Securite : empecher le path traversal (../../etc/passwd)
  const safePath = path.normalize(req.url).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(PUBLIC_DIR, safePath);

  // Si l'URL est '/', servir index.html
  if (safePath === '/' || safePath === '\\') {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  // Verifier que le fichier existe
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
    return;
  }

  // Determiner le Content-Type
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  // Streamer le fichier
  res.writeHead(200, { 'Content-Type': contentType });
  createReadStream(filePath).pipe(res);
});

server.listen(3000, () => {
  console.log('Serveur statique sur http://localhost:3000');
});
```

> **Piege classique** : Ne sers JAMAIS de fichiers statiques sans vérifier le chemin. Un attaquant pourrait envoyer `GET /../../../etc/passwd` pour lire des fichiers sensibles sur ton serveur. Toujours normaliser le chemin et vérifier qu'il reste dans le dossier public.

---

## 6. Construire une API REST complete

### 6.1 Le projet : API de gestion de taches (Todo)

```typescript
import http from 'http';
import crypto from 'crypto';

// === Base de donnees en memoire ===
let todos = [
  { id: '1', title: 'Apprendre Node.js', completed: false, createdAt: new Date().toISOString() },
  { id: '2', title: 'Construire une API', completed: false, createdAt: new Date().toISOString() },
];

// === Utilitaires ===
function parseJSON(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('JSON invalide'));
      }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function parseUrl(req) {
  return new URL(req.url, `http://${req.headers.host}`);
}

// === Handlers ===
function getAllTodos(req, res) {
  const url = parseUrl(req);
  const completed = url.searchParams.get('completed');

  let result = [...todos];

  if (completed !== null) {
    result = result.filter(t => t.completed === (completed === 'true'));
  }

  sendJSON(res, 200, {
    data: result,
    total: result.length,
  });
}

function getTodoById(res, id) {
  const todo = todos.find(t => t.id === id);

  if (!todo) {
    sendJSON(res, 404, { error: `Todo ${id} introuvable` });
    return;
  }

  sendJSON(res, 200, { data: todo });
}

async function createTodo(req, res) {
  try {
    const body = await parseJSON(req);

    if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
      sendJSON(res, 400, { error: 'Le champ "title" est requis et doit etre une chaine non vide' });
      return;
    }

    const newTodo = {
      id: crypto.randomUUID(),
      title: body.title.trim(),
      completed: false,
      createdAt: new Date().toISOString(),
    };

    todos.push(newTodo);
    sendJSON(res, 201, { data: newTodo });
  } catch (err) {
    sendJSON(res, 400, { error: err.message });
  }
}

async function updateTodo(req, res, id) {
  const index = todos.findIndex(t => t.id === id);

  if (index === -1) {
    sendJSON(res, 404, { error: `Todo ${id} introuvable` });
    return;
  }

  try {
    const body = await parseJSON(req);

    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || body.title.trim() === '') {
        sendJSON(res, 400, { error: '"title" doit etre une chaine non vide' });
        return;
      }
      todos[index].title = body.title.trim();
    }

    if (body.completed !== undefined) {
      if (typeof body.completed !== 'boolean') {
        sendJSON(res, 400, { error: '"completed" doit etre un booleen' });
        return;
      }
      todos[index].completed = body.completed;
    }

    sendJSON(res, 200, { data: todos[index] });
  } catch (err) {
    sendJSON(res, 400, { error: err.message });
  }
}

function deleteTodo(res, id) {
  const index = todos.findIndex(t => t.id === id);

  if (index === -1) {
    sendJSON(res, 404, { error: `Todo ${id} introuvable` });
    return;
  }

  todos.splice(index, 1);
  sendJSON(res, 204, null); // 204 No Content
}

// === Router ===
const server = http.createServer(async (req, res) => {
  const { method } = req;
  const url = parseUrl(req);
  const pathname = url.pathname;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Log de la requete
  const start = Date.now();

  try {
    // GET /api/todos
    if (method === 'GET' && pathname === '/api/todos') {
      getAllTodos(req, res);
    }
    // GET /api/todos/:id
    else if (method === 'GET' && pathname.match(/^\/api\/todos\/[\w-]+$/)) {
      const id = pathname.split('/').pop();
      getTodoById(res, id);
    }
    // POST /api/todos
    else if (method === 'POST' && pathname === '/api/todos') {
      await createTodo(req, res);
    }
    // PATCH /api/todos/:id
    else if (method === 'PATCH' && pathname.match(/^\/api\/todos\/[\w-]+$/)) {
      const id = pathname.split('/').pop();
      await updateTodo(req, res, id);
    }
    // DELETE /api/todos/:id
    else if (method === 'DELETE' && pathname.match(/^\/api\/todos\/[\w-]+$/)) {
      const id = pathname.split('/').pop();
      deleteTodo(res, id);
    }
    // 404
    else {
      sendJSON(res, 404, { error: `Route ${method} ${pathname} introuvable` });
    }
  } catch (err) {
    console.error('Erreur serveur :', err);
    sendJSON(res, 500, { error: 'Erreur interne du serveur' });
  }

  const duration = Date.now() - start;
  console.log(`${method} ${pathname} → ${res.statusCode} (${duration}ms)`);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`API Todo sur http://localhost:${PORT}`);
  console.log('Endpoints :');
  console.log('  GET    /api/todos');
  console.log('  GET    /api/todos/:id');
  console.log('  POST   /api/todos');
  console.log('  PATCH  /api/todos/:id');
  console.log('  DELETE /api/todos/:id');
});
```

### 6.2 Tester l'API avec curl ou Postman

```bash
# Lister toutes les taches
curl http://localhost:3000/api/todos

# Recuperer une tache
curl http://localhost:3000/api/todos/1

# Creer une tache
curl -X POST http://localhost:3000/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title": "Nouvelle tache"}'

# Modifier une tache
curl -X PATCH http://localhost:3000/api/todos/1 \
  -H "Content-Type: application/json" \
  -d '{"completed": true}'

# Supprimer une tache
curl -X DELETE http://localhost:3000/api/todos/1

# Filtrer les taches completees
curl "http://localhost:3000/api/todos?completed=true"
```

---

## 7. Gestion des erreurs

### 7.1 Erreurs dans le handler

```typescript
const server = http.createServer(async (req, res) => {
  try {
    // ... routing et logique
  } catch (err) {
    // Erreur inattendue — toujours renvoyer une reponse
    console.error('Erreur non geree :', err);

    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Erreur interne du serveur',
        // En developpement, inclure le message d'erreur
        ...(process.env.NODE_ENV !== 'production' && { details: err.message }),
      }));
    }
  }
});
```

### 7.2 Erreurs du serveur

```typescript
// Erreur au niveau du serveur (pas une requete specifique)
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Le port ${PORT} est deja utilise. Change de port ou arrete le processus existant.`);
    process.exit(1);
  }
  console.error('Erreur serveur :', err);
});

// Erreur de connexion client
server.on('clientError', (err, socket) => {
  if (err.code === 'ECONNRESET' || !socket.writable) return;
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});
```

---

## 8. Ce qu'Express va abstraire

Maintenant que tu as construit une API complete avec le module HTTP natif, voici ce qu'Express va simplifier :

| Avec HTTP natif | Avec Express |
|---|---|
| `if (method === 'GET' && url === '/api/users')` | `app.get('/api/users', handler)` |
| `parseJSON(req)` (fonction manuelle) | `express.json()` (middleware) |
| `sendJSON(res, 200, data)` | `res.json(data)` |
| Regex pour les paramètres d'URL | `app.get('/api/users/:id', ...)` → `req.params.id` |
| `new URL(url).searchParams` | `req.query` |
| CORS manuel | `app.use(cors())` |
| Error handling try/catch partout | Error-handling middleware |
| Pas de middleware | `app.use(middleware)` chainable |

```typescript
// === HTTP natif : 80+ lignes pour un CRUD basique ===
if (method === 'GET' && pathname === '/api/todos') {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(todos));
}
else if (method === 'GET' && pathname.match(/^\/api\/todos\/(\d+)$/)) {
  const id = pathname.match(/^\/api\/todos\/(\d+)$/)[1];
  const todo = todos.find(t => t.id === id);
  if (!todo) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(todo));
}

// === Express : 10 lignes pour la meme chose ===
app.get('/api/todos', (req, res) => {
  res.json(todos);
});

app.get('/api/todos/:id', (req, res) => {
  const todo = todos.find(t => t.id === req.params.id);
  if (!todo) return res.status(404).json({ error: 'Not found' });
  res.json(todo);
});
```

> **A retenir** : Construire une API avec le module HTTP natif est un excellent exercice pedagogique. Tu comprends exactement ce qui se passe à chaque étape. Mais en production, utilise Express (où NestJS) — le code natif est trop verbeux, fragile et difficile a maintenir pour une vraie application.

---

## 9. Exercices pratiques

### Exercice 1 — Serveur de fichiers statiques ameliore

Ameliore le serveur de fichiers statiques de la section 5 avec :
- Un cache `Cache-Control` de 1 heure pour les fichiers statiques
- Le support du header `If-Modified-Since` / `304 Not Modified`
- Un listing des fichiers si l'URL pointe vers un dossier

### Exercice 2 — API de notes avec persistance fichier

Cree une API REST de notes (`GET`, `POST`, `PUT`, `DELETE`) qui sauvegarde les donnees dans un fichier `notes.json` au lieu de la mémoire.

### Exercice 3 — Proxy HTTP simple

Cree un serveur qui agit comme proxy : il recoit les requêtes du client, les transmet à un autre serveur (ex: `jsonplaceholder.typicode.com`), et renvoie la réponse.

### Exercice 4 — Middleware maison

Implemente un système de middleware basic (tableau de fonctions executees dans l'ordre avant le handler) pour simuler le fonctionnement d'Express.

---

## 10. Résumé — Les concepts clés

| Concept | Definition |
|---|---|
| **http.createServer** | Cree un serveur HTTP qui ecoute les requêtes |
| **IncomingMessage (req)** | Objet representant la requête du client |
| **ServerResponse (res)** | Objet pour construire et envoyer la réponse |
| **res.writeHead** | Définir le status code et les headers |
| **res.end** | Terminer la réponse (OBLIGATOIRE) |
| **Routing manuel** | if/else ou switch/case sur method + URL |
| **Parsing du body** | Collecter les chunks et JSON.parse |
| **URL/URLSearchParams** | API standard pour parser les URLs |
| **CORS** | Headers nécessaires pour les requêtes cross-origin |
| **Path traversal** | Attaque securitaire via les chemins (`../../`) |

> **A retenir** : Le module HTTP natif est la fondation de tout serveur web Node.js. Express, Fastify, Koa, NestJS — tous sont construits par-dessus. Comprendre comment fonctionne le serveur HTTP natif te donne une comprehension profonde de ce que les frameworks abstraient, et te permet de debugger des problèmes que les développeurs qui n'ont jamais vu le code natif ne savent pas résoudre.

---

## Navigation

| | Lien |
|---|---|
| Module précédent | [Module 03 — Node.js — Streams & Buffers](./03-nodejs-streams-et-buffers.md) |
| Module suivant | [Module 05 — Express — Fondamentaux](./05-express-fondamentaux.md) |
| Quiz | [Quiz Module 04](../quizzes/04-nodejs-serveur-http.quiz.md) |
| Lab | [Lab 04 — Serveur HTTP natif](../labs/04-nodejs-serveur-http.lab.md) |

---

> **A retenir** : Tu viens de construire une API REST complete avec le module HTTP natif de Node.js. C'est verbeux, c'est manuel, et c'est exactement le point — tu sais maintenant EXACTEMENT ce qui se passe quand un framework recoit une requête. A partir du module suivant, Express va automatiser tout ça. Tu apprecieras d'autant plus sa simplicite que tu as vecu la difficulte du natif.

---

<!-- parcours-recommande -->

::: tip Parcours recommandé
1. **Screencast** : [screencast 04 serveur http](../screencasts/screencast-04-serveur-http.md)
2. **Lab** : [lab-04-serveur-http](../labs/lab-04-serveur-http/README)
3. **Quiz** : [quiz 04 serveur http](../quizzes/quiz-04-serveur-http.html)
:::
