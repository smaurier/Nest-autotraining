# Module 06 — Express — Middleware & Architecture

> **Objectif** : Comprendre le concept central d'Express — les middleware — maîtriser le pipeline d'exécution, créer des middleware personnalises, organiser le code en architecture MVC avec des Router modulaires.
>
> **Difficulte** : ⭐⭐ (intermédiaire)

---

## 1. Le concept de middleware

### 1.1 Definition

Un **middleware** est une fonction qui a acces a l'objet `req`, l'objet `res`, et la fonction `next()`. Les middleware forment une **chaine** (pipeline) — chaque requête traverse les middleware dans l'ordre ou ils sont declares.

```typescript
function monMiddleware(req, res, next) {
  // 1. Faire quelque chose avec req et/ou res
  console.log(`${req.method} ${req.url}`);

  // 2. Passer au middleware suivant
  next();

  // OU envoyer une reponse (arrete la chaine)
  // res.status(403).json({ error: 'Interdit' });
}
```

> **Analogie** : Les middleware, c'est comme une chaine de montage en usine. Chaque poste (middleware) recoit le produit (requête), effectue une operation (logging, authentification, validation...) et le passe au poste suivant (`next()`). Si un poste détecté un defaut, il peut rejeter le produit (envoyer une erreur) sans le passer au suivant.

### 1.2 Le pipeline de middleware

```
  Requete HTTP entrante
       │
       ▼
  ┌─────────────────┐
  │ express.json()   │  ← Parse le body JSON
  └────────┬────────┘
           │ next()
  ┌────────▼────────┐
  │ cors()           │  ← Ajoute les headers CORS
  └────────┬────────┘
           │ next()
  ┌────────▼────────┐
  │ morgan()         │  ← Log la requete
  └────────┬────────┘
           │ next()
  ┌────────▼────────┐
  │ authMiddleware() │  ← Verifie l'authentification
  └────────┬────────┘
           │ next()
  ┌────────▼────────┐
  │ Route handler    │  ← Traite la requete et envoie la reponse
  └────────┬────────┘
           │
       Reponse HTTP
```

### 1.3 Ordre d'exécution

L'ordre des `app.use()` est **crucial** — les middleware sont executes dans l'ordre de declaration :

```typescript
import express from 'express';
const app = express();

// 1. Ce middleware s'execute en PREMIER sur TOUTES les requetes
app.use((req, res, next) => {
  console.log('Middleware 1');
  next();
});

// 2. Ce middleware s'execute en DEUXIEME
app.use((req, res, next) => {
  console.log('Middleware 2');
  next();
});

// 3. Le route handler s'execute en DERNIER
app.get('/', (req, res) => {
  console.log('Route handler');
  res.send('OK');
});

// Sortie pour GET / :
// Middleware 1
// Middleware 2
// Route handler
```

> **Piege classique** : Si tu mets `express.json()` APRES tes routes, `req.body` sera `undefined` dans ces routes car le body n'aura pas encore ete parse. L'ordre des middleware est fondamental.

```typescript
// MAUVAIS — express.json() trop tard
app.post('/api/users', (req, res) => {
  console.log(req.body); // undefined !
});
app.use(express.json());

// BON — express.json() en premier
app.use(express.json());
app.post('/api/users', (req, res) => {
  console.log(req.body); // { nom: 'Alice', ... }
});
```

---

## 2. Les types de middleware

### 2.1 Middleware d'application (app-level)

```typescript
// S'execute sur TOUTES les routes
app.use(express.json());

// S'execute sur TOUTES les routes commencant par /api
app.use('/api', (req, res, next) => {
  console.log('Requete API');
  next();
});

// S'execute uniquement sur GET /api/users
app.get('/api/users', (req, res, next) => {
  // Ce handler est AUSSI un middleware
  // Il peut appeler next() pour passer au handler suivant
  next();
}, (req, res) => {
  res.json({ users: [] });
});
```

### 2.2 Middleware de routeur (router-level)

```typescript
import express from 'express';
const router = express.Router();

// S'execute sur toutes les routes de CE routeur
router.use((req, res, next) => {
  console.log('Middleware du routeur');
  next();
});

router.get('/', (req, res) => {
  res.json({ users: [] });
});

// Monter le routeur sur un prefixe
app.use('/api/users', router);
```

### 2.3 Middleware d'erreur (4 arguments)

```typescript
// Un middleware d'erreur a EXACTEMENT 4 arguments
// C'est le nombre d'arguments qui le distingue d'un middleware normal
app.use((err, req, res, next) => {
  console.error('Erreur :', err.message);
  res.status(err.statusCode || 500).json({
    error: err.message || 'Erreur interne du serveur',
  });
});
```

---

## 3. Middleware integres (built-in)

### 3.1 express.json()

```typescript
// Parse le body au format JSON
app.use(express.json({
  limit: '10mb',          // Taille maximale du body (defaut: 100kb)
  strict: true,            // Accepte uniquement les tableaux et objets
  type: 'application/json', // Type MIME a parser
}));
```

### 3.2 express.urlencoded()

```typescript
// Parse le body au format URL-encoded (formulaires HTML)
app.use(express.urlencoded({
  extended: true,  // Utilise la librairie qs (objets imbriques)
  limit: '10mb',
}));
```

### 3.3 express.static()

```typescript
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1h',        // Cache navigateur de 1 heure
  index: 'index.html', // Fichier par defaut pour les dossiers
  dotfiles: 'ignore',  // Ignorer les fichiers commencant par .
}));
```

---

## 4. Middleware tiers populaires

### 4.1 cors — Cross-Origin Resource Sharing

```bash
npm install cors
```

```typescript
import cors from 'cors';

// Autoriser toutes les origines (developpement uniquement)
app.use(cors());

// Configuration fine (production)
app.use(cors({
  origin: ['http://localhost:4200', 'https://monapp.com'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,      // Autoriser les cookies cross-origin
  maxAge: 86400,           // Cache le preflight pendant 24h
}));
```

### 4.2 helmet — Headers de sécurité

```bash
npm install helmet
```

```typescript
import helmet from 'helmet';

// Ajoute automatiquement des headers de securite
app.use(helmet());

// Equivalent de :
// X-Content-Type-Options: nosniff
// X-Frame-Options: DENY
// Strict-Transport-Security: max-age=15552000
// X-XSS-Protection: 0
// Content-Security-Policy: default-src 'self'
// ... et d'autres
```

### 4.3 morgan — Logging HTTP

```bash
npm install morgan
```

```typescript
import morgan from 'morgan';

// Formats predefinies
app.use(morgan('dev'));
// GET /api/users 200 12.345 ms - 234

app.use(morgan('combined'));
// ::1 - - [10/Jan/2024:14:30:00 +0000] "GET /api/users HTTP/1.1" 200 234

app.use(morgan('tiny'));
// GET /api/users 200 234 - 12.345 ms

// Format personnalise
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));
```

### 4.4 compression — Compression gzip

```bash
npm install compression
```

```typescript
import compression from 'compression';

// Compresse automatiquement les reponses > 1 Ko
app.use(compression({
  threshold: 1024,  // Minimum 1 Ko pour compresser
  level: 6,         // Niveau de compression (1-9, 6 = bon equilibre)
}));
```

### 4.5 Tableau récapitulatif

| Middleware | npm install | Role |
|---|---|---|
| `express.json()` | Integre | Parser le body JSON |
| `express.urlencoded()` | Integre | Parser les formulaires |
| `express.static()` | Integre | Servir des fichiers statiques |
| `cors` | `cors` | Gérer le CORS |
| `helmet` | `helmet` | Headers de sécurité |
| `morgan` | `morgan` | Logging des requêtes |
| `compression` | `compression` | Compression gzip |
| `cookie-parser` | `cookie-parser` | Parser les cookies |
| `express-rate-limit` | `express-rate-limit` | Limiter le nombre de requêtes |

---

## 5. Créer des middleware personnalises

### 5.1 Logger avec timestamps

```typescript
function logger(req, res, next) {
  const start = Date.now();

  // Intercepter la fin de la reponse
  res.on('finish', () => {
    const duration = Date.now() - start;
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] ${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms)`
    );
  });

  next();
}

app.use(logger);
```

### 5.2 Timer de requête

```typescript
function requestTimer(req, res, next) {
  req.startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    // Avertir si la requete est lente
    if (duration > 1000) {
      console.warn(`SLOW REQUEST: ${req.method} ${req.originalUrl} took ${duration}ms`);
    }
  });

  next();
}

app.use(requestTimer);
```

### 5.3 Vérification d'authentification

```typescript
function requireAuth(req, res, next) {
  const authHeader = req.get('Authorization');

  if (!authHeader) {
    return res.status(401).json({ error: 'Token d\'authentification manquant' });
  }

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Format de token invalide' });
  }

  const token = authHeader.slice(7); // Enlever 'Bearer '

  try {
    // Verifier le token (simplifie — voir module 08 pour JWT)
    const user = verifyToken(token);
    req.user = user; // Attacher l'utilisateur a la requete
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalide ou expire' });
  }
}

// Utiliser sur des routes specifiques (pas toutes)
app.get('/api/profile', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Ou sur un groupe de routes
app.use('/api/admin', requireAuth);
app.get('/api/admin/dashboard', (req, res) => {
  res.json({ message: 'Dashboard admin' });
});
```

### 5.4 Validation des query params

```typescript
function validatePagination(req, res, next) {
  const page = parseInt(req.query.page, 10);
  const limit = parseInt(req.query.limit, 10);

  req.pagination = {
    page: isNaN(page) || page < 1 ? 1 : page,
    limit: isNaN(limit) || limit < 1 || limit > 100 ? 10 : limit,
  };

  req.pagination.offset = (req.pagination.page - 1) * req.pagination.limit;

  next();
}

app.get('/api/users', validatePagination, (req, res) => {
  const { page, limit, offset } = req.pagination;
  const paginatedUsers = users.slice(offset, offset + limit);

  res.json({
    data: paginatedUsers,
    page,
    limit,
    total: users.length,
    totalPages: Math.ceil(users.length / limit),
  });
});
```

### 5.5 Request ID

```typescript
import crypto from 'crypto';

function requestId(req, res, next) {
  const id = req.get('X-Request-Id') || crypto.randomUUID();
  req.id = id;
  res.set('X-Request-Id', id);
  next();
}

app.use(requestId);
```

---

## 6. Le Router — Routes modulaires

### 6.1 Pourquoi les Routers

Quand ton API grandit, mettre toutes les routes dans un seul fichier devient ingerable. `express.Router()` permet de **découper les routes en modules** :

```typescript
// routes/books.js
import { Router } from 'express';
const router = Router();

router.get('/', (req, res) => {
  res.json({ books: [] });
});

router.get('/:id', (req, res) => {
  res.json({ bookId: req.params.id });
});

router.post('/', (req, res) => {
  res.status(201).json({ message: 'Livre cree' });
});

router.patch('/:id', (req, res) => {
  res.json({ message: `Livre ${req.params.id} modifie` });
});

router.delete('/:id', (req, res) => {
  res.status(204).end();
});

export default router;
```

```typescript
// routes/users.js
import { Router } from 'express';
const router = Router();

router.get('/', (req, res) => res.json({ users: [] }));
router.get('/:id', (req, res) => res.json({ userId: req.params.id }));
router.post('/', (req, res) => res.status(201).json({ message: 'Utilisateur cree' }));

export default router;
```

```typescript
// src/index.js
import express from 'express';
import booksRouter from './routes/books.js';
import usersRouter from './routes/users.js';

const app = express();
app.use(express.json());

// Monter les routeurs
app.use('/api/books', booksRouter);
app.use('/api/users', usersRouter);

// GET /api/books → booksRouter.get('/')
// GET /api/books/42 → booksRouter.get('/:id')
// GET /api/users → usersRouter.get('/')

app.listen(3000);
```

### 6.2 Middleware spécifique à un routeur

```typescript
// routes/admin.js
import { Router } from 'express';
const router = Router();

// Ce middleware ne s'applique qu'aux routes de CE routeur
router.use((req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acces reserve aux administrateurs' });
  }
  next();
});

router.get('/dashboard', (req, res) => {
  res.json({ message: 'Dashboard admin' });
});

router.get('/users', (req, res) => {
  res.json({ message: 'Liste des utilisateurs (admin)' });
});

export default router;
```

---

## 7. Architecture MVC

### 7.1 Le pattern MVC

**MVC** (Model-View-Controller) est un pattern d'architecture qui separe le code en trois responsabilites :

| Couche | Responsabilite | Fichiers |
|---|---|---|
| **Model** | Donnees et logique metier | `models/`, `services/` |
| **View** | Presentation (pour une API : le format JSON) | Pas de fichier dedie en API |
| **Controller** | Orchestre : recoit la requête, appelle les services, envoie la réponse | `controllers/` |

> **Analogie** : Dans un restaurant, le **serveur** (Controller) prend la commande du client, la transmet au **chef** (Service/Model) qui prepare le plat, et le serveur revient avec le plat dans une **assiette** (View/JSON). Le serveur ne cuisine pas, le chef ne sert pas — chacun son role.

### 7.2 Structure de fichiers

```
src/
├── index.js                 ← Point d'entree, configuration Express
├── config/
│   └── index.js             ← Variables d'environnement
├── routes/
│   ├── index.js             ← Aggregation de tous les routeurs
│   ├── books.routes.js      ← Routes pour /api/books
│   └── users.routes.js      ← Routes pour /api/users
├── controllers/
│   ├── books.controller.js  ← Logique de routing pour les livres
│   └── users.controller.js  ← Logique de routing pour les users
├── services/
│   ├── books.service.js     ← Logique metier pour les livres
│   └── users.service.js     ← Logique metier pour les users
├── middleware/
│   ├── auth.js              ← Middleware d'authentification
│   ├── error-handler.js     ← Middleware de gestion d'erreurs
│   └── logger.js            ← Middleware de logging
└── utils/
    └── errors.js            ← Classes d'erreurs personnalisees
```

### 7.3 Exemple complet MVC

```typescript
// src/services/books.service.js
import crypto from 'crypto';

let books = [
  { id: '1', title: 'Clean Code', author: 'Robert C. Martin', year: 2008 },
];

export function getAllBooks() {
  return books;
}

export function getBookById(id) {
  return books.find(b => b.id === id) || null;
}

export function createBook(data) {
  const newBook = {
    id: crypto.randomUUID(),
    ...data,
  };
  books.push(newBook);
  return newBook;
}

export function updateBook(id, data) {
  const book = books.find(b => b.id === id);
  if (!book) return null;
  Object.assign(book, data);
  return book;
}

export function deleteBook(id) {
  const index = books.findIndex(b => b.id === id);
  if (index === -1) return false;
  books.splice(index, 1);
  return true;
}
```

```typescript
// src/controllers/books.controller.js
import * as booksService from '../services/books.service.js';

export function getAll(req, res) {
  const books = booksService.getAllBooks();
  res.json({ data: books, total: books.length });
}

export function getById(req, res) {
  const book = booksService.getBookById(req.params.id);
  if (!book) {
    return res.status(404).json({ error: 'Livre introuvable' });
  }
  res.json({ data: book });
}

export function create(req, res) {
  const book = booksService.createBook(req.body);
  res.status(201).json({ data: book });
}

export function update(req, res) {
  const book = booksService.updateBook(req.params.id, req.body);
  if (!book) {
    return res.status(404).json({ error: 'Livre introuvable' });
  }
  res.json({ data: book });
}

export function remove(req, res) {
  const deleted = booksService.deleteBook(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Livre introuvable' });
  }
  res.status(204).end();
}
```

```typescript
// src/routes/books.routes.js
import { Router } from 'express';
import * as booksController from '../controllers/books.controller.js';

const router = Router();

router.get('/', booksController.getAll);
router.get('/:id', booksController.getById);
router.post('/', booksController.create);
router.patch('/:id', booksController.update);
router.delete('/:id', booksController.remove);

export default router;
```

```typescript
// src/routes/index.js
import { Router } from 'express';
import booksRouter from './books.routes.js';
// import usersRouter from './users.routes.js';

const router = Router();

router.use('/books', booksRouter);
// router.use('/users', usersRouter);

export default router;
```

```typescript
// src/index.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import apiRouter from './routes/index.js';

const app = express();

// Middleware globaux
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Routes API
app.use('/api', apiRouter);

// Route sante
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} introuvable` });
});

// Error handler (TOUJOURS en dernier !)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur sur http://localhost:${PORT}`);
});
```

---

## 8. Middleware de gestion d'erreurs

### 8.1 Le middleware d'erreur (4 arguments)

```typescript
// middleware/error-handler.js
export function errorHandler(err, req, res, next) {
  // Log l'erreur
  console.error(`[ERROR] ${err.message}`);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  // Determiner le status code
  const statusCode = err.statusCode || 500;

  // Envoyer la reponse
  res.status(statusCode).json({
    error: err.message || 'Erreur interne du serveur',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}
```

### 8.2 Propager les erreurs avec next(err)

```typescript
app.get('/api/users/:id', (req, res, next) => {
  try {
    const user = getUserById(req.params.id);
    if (!user) {
      const error = new Error('Utilisateur introuvable');
      error.statusCode = 404;
      throw error;
    }
    res.json(user);
  } catch (err) {
    next(err); // Passe l'erreur au middleware d'erreur
  }
});
```

> **Bonne pratique** : Place TOUJOURS le middleware d'erreur EN DERNIER, après toutes les routes et les autres middleware. Express détecté les middleware d'erreur grâce à leurs 4 arguments — si tu en oublies un, ça ne fonctionnera pas.

---

## 9. Middleware scoping — Application vs Router

| Scope | Syntaxe | Effet |
|---|---|---|
| **Application** | `app.use(fn)` | S'applique a TOUTES les requêtes |
| **Application + chemin** | `app.use('/api', fn)` | S'applique aux requêtes commencant par `/api` |
| **Routeur** | `router.use(fn)` | S'applique uniquement aux routes de ce routeur |
| **Route spécifique** | `app.get('/path', fn, handler)` | S'applique a cette route uniquement |

```typescript
// Middleware global (toutes les routes)
app.use(express.json());
app.use(cors());

// Middleware pour toutes les routes /api
app.use('/api', (req, res, next) => {
  console.log('Requete API');
  next();
});

// Middleware pour un routeur specifique
const adminRouter = Router();
adminRouter.use(requireAdmin);

// Middleware pour une route specifique
app.get('/api/secret', requireAuth, requireAdmin, (req, res) => {
  res.json({ secret: '42' });
});
```

---

## 10. Résumé — Les concepts clés

| Concept | Definition |
|---|---|
| **Middleware** | Fonction (req, res, next) qui s'insere dans le pipeline |
| **next()** | Passe la main au middleware suivant |
| **app.use()** | Enregistre un middleware global |
| **Router** | Mini-application Express pour regrouper des routes |
| **MVC** | Pattern d'architecture (Model-View-Controller) |
| **Error middleware** | Middleware a 4 arguments (err, req, res, next) |
| **Scoping** | Middleware application, routeur ou route |
| **Pipeline** | Chaine ordonnee de middleware traversee par chaque requête |

> **A retenir** : Les middleware sont le coeur d'Express. Tout est middleware — le parsing du body, le CORS, l'authentification, le logging, et même les route handlers. Comprendre le pipeline d'exécution et l'ordre des middleware est essentiel pour debugger et structurer une application Express. L'architecture MVC avec des Routers modulaires est la base d'une application maintenable.

---

## Navigation

| | Lien |
|---|---|
| Module précédent | [Module 05 — Express — Fondamentaux](./05-express-fondamentaux.md) |
| Module suivant | [Module 07 — Express — Validation & Gestion d'erreurs](./07-express-validation-erreurs.md) |
| Quiz | [Quiz Module 06](../quizzes/06-express-middleware.quiz.md) |
| Lab | [Lab 06 — Middleware et architecture](../labs/06-express-middleware.lab.md) |

---

> **A retenir** : L'architecture d'une application Express repose sur trois piliers : un pipeline de middleware bien ordonne, des Routers pour découper les routes en modules, et une separation MVC claire (routes → controllers → services). Cette organisation te prepare naturellement a NestJS, qui formalise et renforce ces patterns avec de l'injection de dépendances et des decorateurs TypeScript.

---

<!-- parcours-recommande -->

::: tip Parcours recommandé
1. **Screencast** : [screencast 06 middleware](../screencasts/screencast-06-middleware.md)
2. **Lab** : [lab-06-middleware](../labs/lab-06-middleware/README)
3. **Visualisation** : [Middleware Pipeline](../visualizations/middleware-pipeline.html)
4. **Quiz** : [quiz 06 middleware](../quizzes/quiz-06-middleware.html)
:::
