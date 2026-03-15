# Module 05 — Express — Fondamentaux

> **Objectif** : Maitriser les bases d'Express.js — creation d'une application, routing, objets req et res, middleware de base, et construire un premier CRUD complet.
>
> **Difficulte** : ⭐⭐ (intermediaire)

---

## 1. Qu'est-ce qu'Express.js

### 1.1 Le framework web minimaliste

Express est un **framework web minimaliste** pour Node.js. Il ajoute une couche d'abstraction au-dessus du module `http` natif pour simplifier le developpement d'API et d'applications web.

> **Analogie** : Si le module `http` natif est une boite a outils avec des marteaux, des clous et des planches, Express c'est un kit de construction IKEA — les pieces sont pre-decoupees, le manuel est fourni, et tu assembles beaucoup plus vite. Tu peux toujours utiliser les outils bruts si tu veux, mais pour 99% des cas, le kit suffit.

### 1.2 Express en chiffres

| Statistique | Valeur |
|---|---|
| Telechargements npm/semaine | ~30 millions |
| Stars GitHub | ~65 000 |
| Premiere release | 2010 |
| Taille (installe) | ~200 Ko |
| Dependances | Tres peu (~30) |

### 1.3 Initialiser un projet Express

```bash
# Creer le dossier et initialiser
mkdir mon-api && cd mon-api
npm init -y

# Installer Express
npm install express

# Installer nodemon pour le rechargement automatique
npm install -D nodemon
```

Ajouter les scripts dans `package.json` :

```json
{
  "name": "mon-api",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  }
}
```

> **Express 5 (2024)** : Express 5.0 est sorti en octobre 2024. Les differences cles : gestion native des erreurs async (plus besoin de `express-async-errors`), `req.query` retourne un objet pur (`Object.create(null)`), `res.render()` est async, et les chemins regex utilisant des caracteres non-echappes levent une erreur. Pour un nouveau projet, privilegiez Express 5. NestJS 11 l'utilise par defaut.

---

## 2. Premier serveur Express

### 2.1 Hello World

```typescript
// src/index.js
import express from 'express';

// Creer l'application Express
const app = express();

// Definir une route
app.get('/', (req, res) => {
  res.send('Hello World !');
});

// Demarrer le serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur Express demarre sur http://localhost:${PORT}`);
});
```

```bash
# Lancer en mode developpement (avec rechargement automatique)
npm run dev
```

### 2.2 Comprendre express()

```typescript
import express from 'express';

// express() cree une application Express
// C'est une fonction qui retourne un objet avec des methodes pour :
// - Definir des routes (app.get, app.post, etc.)
// - Ajouter des middleware (app.use)
// - Configurer l'application (app.set)
// - Ecouter un port (app.listen)

const app = express();

// app.listen est un raccourci pour :
// const server = http.createServer(app);
// server.listen(PORT);
```

---

## 3. Le Routing

### 3.1 Les methodes HTTP

```typescript
import express from 'express';
const app = express();

// GET — Recuperer des donnees
app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});

// POST — Creer une ressource
app.post('/api/users', (req, res) => {
  res.status(201).json({ message: 'Utilisateur cree' });
});

// PUT — Remplacer une ressource completement
app.put('/api/users/:id', (req, res) => {
  res.json({ message: `Utilisateur ${req.params.id} remplace` });
});

// PATCH — Modifier partiellement une ressource
app.patch('/api/users/:id', (req, res) => {
  res.json({ message: `Utilisateur ${req.params.id} modifie` });
});

// DELETE — Supprimer une ressource
app.delete('/api/users/:id', (req, res) => {
  res.status(204).end(); // 204 No Content — pas de body
});

// ALL — Toutes les methodes HTTP
app.all('/api/health', (req, res) => {
  res.json({ status: 'OK', method: req.method });
});
```

### 3.2 Parametres de route

```typescript
// :id est un parametre de route → disponible dans req.params
app.get('/api/users/:id', (req, res) => {
  console.log(req.params.id); // '42'
  res.json({ userId: req.params.id });
});

// Plusieurs parametres
app.get('/api/users/:userId/posts/:postId', (req, res) => {
  console.log(req.params.userId);  // '42'
  console.log(req.params.postId);  // '7'
  res.json(req.params);
});

// Parametres optionnels (avec ?)
app.get('/api/files/:name.:ext?', (req, res) => {
  console.log(req.params.name); // 'photo'
  console.log(req.params.ext);  // 'jpg' ou undefined
  res.json(req.params);
});

// Wildcards
app.get('/api/docs/*', (req, res) => {
  // Capture tout apres /api/docs/
  console.log(req.params[0]); // 'section/subsection/page'
  res.send(`Document : ${req.params[0]}`);
});
```

> **Bonne pratique** : Les parametres de route sont toujours des **strings**. Si tu attends un nombre (comme un ID), pense a le convertir : `const id = parseInt(req.params.id, 10)`. Ou mieux, valide-le avec une librairie comme Zod (voir module 07).

---

## 4. L'objet req (Request)

L'objet `req` est une version enrichie de `http.IncomingMessage` :

```typescript
app.post('/api/users', (req, res) => {
  // === Parametres de route ===
  // Definis par la route : '/api/users/:id'
  console.log(req.params);          // { id: '42' }

  // === Query parameters ===
  // URL: /api/users?page=2&limit=10
  console.log(req.query);           // { page: '2', limit: '10' }
  console.log(req.query.page);      // '2' (toujours une string !)

  // === Body de la requete ===
  // Necessite express.json() middleware
  console.log(req.body);            // { nom: 'Alice', email: 'alice@...' }

  // === Headers ===
  console.log(req.headers);         // { 'content-type': 'application/json', ... }
  console.log(req.get('Content-Type')); // 'application/json'
  console.log(req.get('Authorization')); // 'Bearer eyJhb...'

  // === Methode et URL ===
  console.log(req.method);          // 'POST'
  console.log(req.path);            // '/api/users'
  console.log(req.originalUrl);     // '/api/users?page=2'
  console.log(req.baseUrl);         // '' (ou '/api' si utilise un Router)
  console.log(req.hostname);        // 'localhost'
  console.log(req.ip);              // '127.0.0.1'
  console.log(req.protocol);        // 'http' ou 'https'
  console.log(req.secure);          // false (true si HTTPS)

  // === Cookies (avec cookie-parser) ===
  // console.log(req.cookies);      // { session: 'abc123' }

  res.json({ received: true });
});
```

---

## 5. L'objet res (Response)

L'objet `res` est une version enrichie de `http.ServerResponse` :

```typescript
app.get('/api/demo', (req, res) => {
  // === Envoyer du JSON ===
  res.json({ message: 'Hello' });
  // Equivalent de : res.setHeader('Content-Type', 'application/json');
  //                 res.end(JSON.stringify({ message: 'Hello' }));

  // === Envoyer du texte ===
  res.send('Hello World');
  // Detecte automatiquement le Content-Type

  // === Definir le status code ===
  res.status(201).json({ id: 1 });
  res.status(404).json({ error: 'Not found' });
  res.status(204).end(); // No Content, pas de body

  // === Redirection ===
  res.redirect('/nouvelle-url');           // 302 par defaut
  res.redirect(301, '/nouvelle-url');      // 301 Moved Permanently

  // === Definir des headers ===
  res.set('X-Custom-Header', 'valeur');
  res.set({
    'X-Header-1': 'valeur1',
    'X-Header-2': 'valeur2',
  });

  // === Envoyer un fichier ===
  res.sendFile('/chemin/absolu/vers/fichier.pdf');

  // === Telecharger un fichier ===
  res.download('/chemin/vers/rapport.pdf', 'rapport-2024.pdf');
  // Declenche un telechargement dans le navigateur

  // === Cookies ===
  res.cookie('session', 'abc123', {
    httpOnly: true,
    secure: true,
    maxAge: 3600000, // 1 heure en ms
  });
  res.clearCookie('session');

  // === Chainer les methodes ===
  res
    .status(201)
    .set('X-Request-Id', 'uuid')
    .json({ id: 1, name: 'Alice' });
});
```

> **Piege classique** : Tu ne peux envoyer qu'UNE SEULE reponse par requete. Si tu appelles `res.json()` ou `res.send()` deux fois, Express leve une erreur `Error: Cannot set headers after they are sent`. Utilise `return` pour arreter la fonction apres avoir envoye la reponse.

```typescript
app.get('/api/users/:id', (req, res) => {
  const user = findUser(req.params.id);

  if (!user) {
    return res.status(404).json({ error: 'Not found' });
    // SANS le return, le code continue et appelle res.json() une deuxieme fois !
  }

  res.json(user);
});
```

---

## 6. Les middleware de base

### 6.1 express.json() — Parser le body JSON

```typescript
import express from 'express';
const app = express();

// OBLIGATOIRE pour lire req.body sur les requetes POST/PUT/PATCH
app.use(express.json());

app.post('/api/users', (req, res) => {
  console.log(req.body); // { nom: 'Alice', email: 'alice@...' }
  // Sans express.json(), req.body serait undefined !
  res.status(201).json(req.body);
});
```

> **Piege classique** : Si `req.body` est `undefined`, tu as probablement oublie `app.use(express.json())`. C'est l'erreur la plus frequente chez les debutants Express. Mets-le toujours au debut de ta configuration middleware.

### 6.2 express.urlencoded() — Parser les formulaires HTML

```typescript
// Pour les formulaires HTML classiques (Content-Type: application/x-www-form-urlencoded)
app.use(express.urlencoded({ extended: true }));

app.post('/login', (req, res) => {
  console.log(req.body.username); // Valeur du champ <input name="username">
  console.log(req.body.password); // Valeur du champ <input name="password">
});
```

### 6.3 express.static() — Servir des fichiers statiques

```typescript
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Servir les fichiers du dossier 'public'
app.use(express.static(path.join(__dirname, 'public')));
// GET /style.css → public/style.css
// GET /images/logo.png → public/images/logo.png

// Avec un prefixe
app.use('/static', express.static(path.join(__dirname, 'public')));
// GET /static/style.css → public/style.css
```

---

## 7. Nodemon pour le developpement

**Nodemon** surveille les fichiers et redemarre automatiquement le serveur a chaque modification :

```bash
npm install -D nodemon
```

Configuration dans `package.json` :

```json
{
  "scripts": {
    "dev": "nodemon src/index.js"
  }
}
```

Ou avec un fichier `nodemon.json` pour plus d'options :

```json
{
  "watch": ["src"],
  "ext": "js,json",
  "ignore": ["node_modules", "tests"],
  "delay": "500"
}
```

> **Bonne pratique** : Utilise TOUJOURS nodemon (ou `--watch` de Node.js 18+) en developpement. Redemarrer manuellement le serveur a chaque modification est une perte de temps enorme. En production, utilise `node` directement (pas nodemon).

---

## 8. Variables d'environnement

```typescript
// src/index.js
import 'dotenv/config'; // Charge les variables depuis .env
import express from 'express';

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    environment: NODE_ENV,
    uptime: process.uptime(),
  });
});

app.listen(PORT, () => {
  console.log(`[${NODE_ENV}] Serveur sur http://localhost:${PORT}`);
});
```

```bash
# .env (a la racine du projet)
PORT=3000
NODE_ENV=development

# .gitignore
node_modules/
.env
```

---

## 9. Premier CRUD complet

### 9.1 API de gestion de livres

```typescript
// src/index.js
import express from 'express';
import crypto from 'crypto';

const app = express();
app.use(express.json());

// === Base de donnees en memoire ===
let books = [
  {
    id: '1',
    title: 'Clean Code',
    author: 'Robert C. Martin',
    year: 2008,
    isbn: '978-0132350884',
  },
  {
    id: '2',
    title: 'The Pragmatic Programmer',
    author: 'David Thomas & Andrew Hunt',
    year: 2019,
    isbn: '978-0135957059',
  },
  {
    id: '3',
    title: 'Design Patterns',
    author: 'Gang of Four',
    year: 1994,
    isbn: '978-0201633610',
  },
];

// === GET /api/books — Lister tous les livres ===
app.get('/api/books', (req, res) => {
  const { author, year, search } = req.query;
  let result = [...books];

  // Filtrer par auteur
  if (author) {
    result = result.filter(b =>
      b.author.toLowerCase().includes(author.toLowerCase())
    );
  }

  // Filtrer par annee
  if (year) {
    result = result.filter(b => b.year === parseInt(year, 10));
  }

  // Recherche textuelle
  if (search) {
    const searchLower = search.toLowerCase();
    result = result.filter(b =>
      b.title.toLowerCase().includes(searchLower) ||
      b.author.toLowerCase().includes(searchLower)
    );
  }

  res.json({
    data: result,
    total: result.length,
  });
});

// === GET /api/books/:id — Recuperer un livre ===
app.get('/api/books/:id', (req, res) => {
  const book = books.find(b => b.id === req.params.id);

  if (!book) {
    return res.status(404).json({
      error: 'Livre introuvable',
      id: req.params.id,
    });
  }

  res.json({ data: book });
});

// === POST /api/books — Creer un livre ===
app.post('/api/books', (req, res) => {
  const { title, author, year, isbn } = req.body;

  // Validation basique
  const errors = [];
  if (!title || typeof title !== 'string') errors.push('title est requis (string)');
  if (!author || typeof author !== 'string') errors.push('author est requis (string)');
  if (!year || typeof year !== 'number') errors.push('year est requis (number)');

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  // Verifier l'unicite de l'ISBN
  if (isbn && books.some(b => b.isbn === isbn)) {
    return res.status(409).json({
      error: 'Un livre avec cet ISBN existe deja',
    });
  }

  const newBook = {
    id: crypto.randomUUID(),
    title: title.trim(),
    author: author.trim(),
    year,
    isbn: isbn || null,
  };

  books.push(newBook);

  res.status(201).json({ data: newBook });
});

// === PUT /api/books/:id — Remplacer un livre ===
app.put('/api/books/:id', (req, res) => {
  const index = books.findIndex(b => b.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Livre introuvable' });
  }

  const { title, author, year, isbn } = req.body;

  // PUT = remplacement total, tous les champs sont requis
  const errors = [];
  if (!title) errors.push('title est requis');
  if (!author) errors.push('author est requis');
  if (!year) errors.push('year est requis');

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  books[index] = {
    id: req.params.id, // L'ID ne change pas
    title: title.trim(),
    author: author.trim(),
    year,
    isbn: isbn || null,
  };

  res.json({ data: books[index] });
});

// === PATCH /api/books/:id — Modifier partiellement ===
app.patch('/api/books/:id', (req, res) => {
  const book = books.find(b => b.id === req.params.id);

  if (!book) {
    return res.status(404).json({ error: 'Livre introuvable' });
  }

  // PATCH = modification partielle, seuls les champs presents sont modifies
  const { title, author, year, isbn } = req.body;

  if (title !== undefined) book.title = title.trim();
  if (author !== undefined) book.author = author.trim();
  if (year !== undefined) book.year = year;
  if (isbn !== undefined) book.isbn = isbn;

  res.json({ data: book });
});

// === DELETE /api/books/:id — Supprimer un livre ===
app.delete('/api/books/:id', (req, res) => {
  const index = books.findIndex(b => b.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Livre introuvable' });
  }

  books.splice(index, 1);
  res.status(204).end();
});

// === Demarrage ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API Livres sur http://localhost:${PORT}`);
});
```

---

## 10. Comparaison HTTP natif vs Express

| Fonctionnalite | HTTP natif | Express |
|---|---|---|
| Creer un serveur | `http.createServer(handler)` | `const app = express()` |
| Routing GET | `if (method === 'GET' && url === '/path')` | `app.get('/path', handler)` |
| Parametres de route | Regex manuelle | `req.params.id` |
| Query params | `new URL(url).searchParams` | `req.query` |
| Lire le body JSON | Collecter les chunks + JSON.parse | `express.json()` + `req.body` |
| Envoyer du JSON | `res.writeHead(200); res.end(JSON.stringify(data))` | `res.json(data)` |
| Status code | `res.statusCode = 404` | `res.status(404)` |
| Fichiers statiques | Stream manuel + MIME types | `express.static()` |
| Middleware | Implementation manuelle | `app.use(fn)` |
| Gestion d'erreurs | try/catch partout | Error middleware |

> **A retenir** : Express ne fait rien de magique — il simplifie les patterns que tu as implementes manuellement au module 04. Connaitre le HTTP natif te permet de comprendre ce qu'Express fait "sous le capot" et de debugger quand quelque chose ne fonctionne pas.

---

## 11. Exercices pratiques

### Exercice 1 — API de contacts

Cree une API CRUD pour gerer des contacts (nom, email, telephone, entreprise) avec :
- Recherche par nom ou entreprise via query params
- Pagination (`?page=1&limit=10`)
- Tri (`?sort=nom&order=asc`)

### Exercice 2 — Convertir l'API native

Reprends l'API Todo du module 04 et convertis-la en Express. Compare le nombre de lignes et la lisibilite.

### Exercice 3 — API avec sous-ressources

Cree une API avec des sous-ressources :
- `GET /api/authors/:authorId/books` — Livres d'un auteur
- `POST /api/authors/:authorId/books` — Ajouter un livre a un auteur

---

## Navigation

| | Lien |
|---|---|
| Module precedent | [Module 04 — Node.js — Serveur HTTP natif](./04-nodejs-serveur-http.md) |
| Module suivant | [Module 06 — Express — Middleware & Architecture](./06-express-middleware.md) |
| Quiz | [Quiz Module 05](../quizzes/05-express-fondamentaux.quiz.md) |
| Lab | [Lab 05 — Express CRUD](../labs/05-express-fondamentaux.lab.md) |

---

> **A retenir** : Express est le framework web Node.js le plus utilise au monde. Il simplifie enormement le routing, la gestion des requetes/reponses et l'ajout de middleware. Maitriser les bases d'Express (app.get/post/..., req.params/query/body, res.json/status) est une competence indispensable pour tout developpeur backend Node.js. Le module suivant approfondira le concept central d'Express : les middleware.
