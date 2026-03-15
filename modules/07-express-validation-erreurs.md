# Module 07 — Express — Validation & Gestion d'erreurs

> **Objectif** : Implementer une validation robuste des donnees entrantes avec Zod, créer un système centralise de gestion d'erreurs avec des classes d'erreurs personnalisees, et eliminer le boilerplate try/catch avec un wrapper async.
>
> **Difficulte** : ⭐⭐⭐ (avance)

---

## 1. Pourquoi la validation est critique

### 1.1 Ne jamais faire confiance au client

Le client (navigateur, application mobile, Postman) peut envoyer **n'importe quoi**. Même si ton formulaire Angular à une validation cote client, un attaquant peut :

- Modifier le body JSON directement avec les DevTools ou curl
- Envoyer des types inattendus (string au lieu de number)
- Injecter du code malveillant (SQL injection, XSS)
- Envoyer des donnees manquantes ou supplementaires

```typescript
// Ce que tu esperes recevoir :
{ "email": "alice@example.com", "age": 28 }

// Ce que tu peux REELLEMENT recevoir :
{ "email": "", "age": "vingt-huit" }
{ "email": "<script>alert('xss')</script>" }
{ "age": -5, "role": "admin" }
{ }
null
"une string au lieu d'un objet"
```

> **Analogie** : La validation backend, c'est comme le controle de sécurité a l'aeroport. La compagnie aerienne (frontend) peut vérifier ton billet, mais la sécurité (backend) vérifié quand même — parce que n'importe qui peut se présenter à la porte.

### 1.2 La validation frontend ne suffit JAMAIS

| Validation | Frontend | Backend |
|---|---|---|
| **Objectif** | UX — guider l'utilisateur | **Sécurité** — proteger les donnees |
| **Contournable** | Oui (DevTools, curl, scripts) | Non (seul le serveur controle) |
| **Obligatoire** | Recommandee | **Indispensable** |
| **Quand** | Avant l'envoi | A la reception |

> **Piege classique** : "J'ai déjà la validation dans mon formulaire Angular/React, pas besoin de la refaire au backend." FAUX. La validation frontend est un confort utilisateur, pas une protection. Un attaquant contourne la validation frontend en 5 secondes.

---

## 2. Zod — Validation avec des schemas

### 2.1 Qu'est-ce que Zod

**Zod** est une librairie de validation et de parsing de schemas pour TypeScript/JavaScript. Elle est :

- **Type-safe** : infere automatiquement les types TypeScript
- **Zero dépendance** : très legere
- **Composable** : les schemas se combinent facilement
- **Immutable** : chaque transformation retourne un nouveau schema

```bash
npm install zod
```

### 2.2 Schemas de base

```typescript
import { z } from 'zod';

// === Types primitifs ===
const stringSchema = z.string();
const numberSchema = z.number();
const booleanSchema = z.boolean();
const dateSchema = z.date();
const bigintSchema = z.bigint();

// === Validation avec parse (lance une erreur si invalide) ===
stringSchema.parse('hello');     // 'hello'
stringSchema.parse(42);          // ERREUR: ZodError

// === Validation avec safeParse (retourne un resultat) ===
const result = stringSchema.safeParse('hello');
if (result.success) {
  console.log(result.data); // 'hello'
} else {
  console.log(result.error.issues); // tableau d'erreurs
}
```

### 2.3 Validations sur les strings

```typescript
import { z } from 'zod';

const emailSchema = z.string()
  .email('Email invalide')                    // Validation email
  .min(5, 'Minimum 5 caracteres')             // Longueur minimum
  .max(100, 'Maximum 100 caracteres')         // Longueur maximum
  .toLowerCase()                               // Transforme en minuscules
  .trim();                                     // Supprime les espaces

const passwordSchema = z.string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caracteres')
  .max(72, 'Maximum 72 caracteres (limite bcrypt)')
  .regex(/[A-Z]/, 'Doit contenir au moins une majuscule')
  .regex(/[a-z]/, 'Doit contenir au moins une minuscule')
  .regex(/[0-9]/, 'Doit contenir au moins un chiffre');

const urlSchema = z.string().url('URL invalide');
const uuidSchema = z.string().uuid('UUID invalide');
const isoDateSchema = z.string().datetime('Date ISO invalide');

// Tester
emailSchema.parse('  ALICE@Example.Com  '); // 'alice@example.com'
emailSchema.parse('pas-un-email');          // ERREUR
```

### 2.4 Validations sur les nombres

```typescript
import { z } from 'zod';

const ageSchema = z.number()
  .int('L\'age doit etre un entier')
  .min(0, 'L\'age ne peut pas etre negatif')
  .max(150, 'Age non realiste');

const priceSchema = z.number()
  .positive('Le prix doit etre positif')
  .multipleOf(0.01, 'Maximum 2 decimales'); // Precision centimes

const pageSchema = z.number()
  .int()
  .min(1)
  .default(1); // Valeur par defaut si non fourni

// Coerce — convertir une string en number automatiquement
const coercedNumber = z.coerce.number();
coercedNumber.parse('42');  // 42 (number, pas string)
coercedNumber.parse('abc'); // ERREUR: NaN n'est pas un nombre valide
```

### 2.5 Schemas d'objets

```typescript
import { z } from 'zod';

// Schema pour creer un utilisateur
const createUserSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).max(72),
  nom: z.string().min(2).max(50).trim(),
  age: z.number().int().min(13).max(150).optional(),
  role: z.enum(['user', 'admin', 'moderator']).default('user'),
  preferences: z.object({
    newsletter: z.boolean().default(false),
    theme: z.enum(['light', 'dark']).default('light'),
  }).optional(),
});

// Inferer le type TypeScript automatiquement
// type CreateUserInput = z.infer<typeof createUserSchema>

// Validation
const userData = createUserSchema.parse({
  email: '  ALICE@Example.Com  ',
  password: 'MyP@ssw0rd',
  nom: '  Alice Dupont  ',
  role: 'user',
});
// {
//   email: 'alice@example.com',  ← trim + lowercase
//   password: 'MyP@ssw0rd',
//   nom: 'Alice Dupont',         ← trim
//   role: 'user',
//   age: undefined,              ← optionnel
// }
```

### 2.6 Schema pour les mises a jour (PATCH)

```typescript
// Pour un PATCH, tous les champs sont optionnels
const updateUserSchema = createUserSchema.partial();
// Equivalent de rendre chaque champ .optional()

// Ou choisir les champs modifiables
const updateUserSchema2 = createUserSchema
  .pick({ nom: true, age: true, preferences: true })
  .partial();
```

### 2.7 Tableaux et enums

```typescript
import { z } from 'zod';

// Tableau de strings
const tagsSchema = z.array(z.string().min(1).max(30))
  .min(1, 'Au moins un tag')
  .max(10, 'Maximum 10 tags');

// Enum
const statusSchema = z.enum(['draft', 'published', 'archived']);
statusSchema.parse('draft');     // 'draft'
statusSchema.parse('invalid');   // ERREUR

// Enum natif (TypeScript)
// enum Status { Draft = 'draft', Published = 'published' }
// const statusSchema = z.nativeEnum(Status);

// Union de types
const idSchema = z.union([z.string().uuid(), z.number().int().positive()]);
idSchema.parse('550e8400-e29b-41d4-a716-446655440000'); // OK
idSchema.parse(42);                                       // OK
idSchema.parse('pas-un-uuid');                             // ERREUR
```

### 2.8 Nullable et optional

```typescript
import { z } from 'zod';

// optional : le champ peut etre absent (undefined)
z.string().optional();    // string | undefined

// nullable : le champ peut etre null
z.string().nullable();    // string | null

// Les deux
z.string().optional().nullable(); // string | null | undefined

// default : valeur par defaut si absent
z.string().default('N/A');

// Difference dans un objet
const schema = z.object({
  requis: z.string(),                    // DOIT etre present et etre une string
  optionnel: z.string().optional(),      // Peut etre absent
  nullable: z.string().nullable(),       // Peut etre null mais DOIT etre present
  defaut: z.string().default('hello'),   // Absent → 'hello'
});
```

### 2.9 Messages d'erreur personnalises

```typescript
import { z } from 'zod';

const schema = z.object({
  email: z.string({
    required_error: 'L\'email est obligatoire',
    invalid_type_error: 'L\'email doit etre une chaine de caracteres',
  }).email('Format d\'email invalide'),

  age: z.number({
    required_error: 'L\'age est obligatoire',
    invalid_type_error: 'L\'age doit etre un nombre',
  }).min(13, { message: 'Tu dois avoir au moins 13 ans' }),
});

// Formatter les erreurs de facon lisible
function formatZodErrors(error) {
  return error.issues.map(issue => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}

const result = schema.safeParse({ email: 123, age: 'abc' });
if (!result.success) {
  console.log(formatZodErrors(result.error));
  // [
  //   { field: 'email', message: "L'email doit etre une chaine de caracteres" },
  //   { field: 'age', message: "L'age doit etre un nombre" }
  // ]
}
```

---

## 3. Middleware de validation générique

### 3.1 Un middleware réutilisable

```typescript
// middleware/validate.js
import { ZodError } from 'zod';

/**
 * Middleware de validation generique pour Zod
 * @param {import('zod').ZodSchema} schema - Le schema Zod
 * @param {'body' | 'query' | 'params'} source - L'endroit a valider
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const errors = result.error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      }));

      return res.status(400).json({
        error: 'Validation echouee',
        details: errors,
      });
    }

    // Remplacer les donnees par les donnees validees et transformees
    req[source] = result.data;
    next();
  };
}
```

### 3.2 Utilisation dans les routes

```typescript
// routes/users.routes.js
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import * as usersController from '../controllers/users.controller.js';

const router = Router();

// Schemas
const createUserSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).max(72),
  nom: z.string().min(2).max(50).trim(),
});

const updateUserSchema = createUserSchema.partial();

const paramsSchema = z.object({
  id: z.string().uuid('ID invalide'),
});

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
});

// Routes avec validation
router.get('/',
  validate(querySchema, 'query'),
  usersController.getAll
);

router.get('/:id',
  validate(paramsSchema, 'params'),
  usersController.getById
);

router.post('/',
  validate(createUserSchema, 'body'),
  usersController.create
);

router.patch('/:id',
  validate(paramsSchema, 'params'),
  validate(updateUserSchema, 'body'),
  usersController.update
);

export default router;
```

> **Bonne pratique** : Avec ce pattern, la validation est declarative et separee de la logique metier. Tu declares le schema, tu l'appliques comme middleware, et ton controller recoit toujours des donnees valides et correctement typees. C'est le même principe que NestJS utilise avec les Pipes et les DTO.

---

## 4. Gestion centralisee des erreurs

### 4.1 Classes d'erreurs personnalisees

```typescript
// utils/errors.js

export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = true; // Erreur prevue vs bug
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Ressource', id) {
    const message = id
      ? `${resource} avec l'ID "${id}" introuvable`
      : `${resource} introuvable`;
    super(message, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Donnees invalides', details = []) {
    super(message, 400);
    this.details = details;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentification requise') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acces interdit') {
    super(message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflit avec une ressource existante') {
    super(message, 409);
  }
}
```

### 4.2 Middleware de gestion d'erreurs centralise

```typescript
// middleware/error-handler.js
import { AppError } from '../utils/errors.js';
import { ZodError } from 'zod';

export function errorHandler(err, req, res, next) {
  // Log l'erreur
  console.error(`[${new Date().toISOString()}] ${err.name}: ${err.message}`);

  // Erreurs Zod (validation)
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation echouee',
      details: err.issues.map(i => ({
        field: i.path.join('.'),
        message: i.message,
      })),
    });
  }

  // Erreurs applicatives (nos classes personnalisees)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      ...(err.details && { details: err.details }),
    });
  }

  // Erreur JSON parse (body mal forme)
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'JSON invalide dans le body de la requete',
    });
  }

  // Erreur inattendue (bug) — ne pas exposer les details en production
  if (process.env.NODE_ENV === 'production') {
    return res.status(500).json({
      error: 'Erreur interne du serveur',
    });
  }

  // En developpement, exposer les details
  res.status(500).json({
    error: err.message,
    stack: err.stack,
    name: err.name,
  });
}
```

### 4.3 Utilisation dans les controllers

```typescript
// controllers/books.controller.js
import * as booksService from '../services/books.service.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';

export function getAll(req, res) {
  const { page, limit } = req.query; // Deja valide par le middleware
  const books = booksService.getAllBooks({ page, limit });
  res.json(books);
}

export function getById(req, res) {
  const book = booksService.getBookById(req.params.id);
  if (!book) {
    throw new NotFoundError('Livre', req.params.id);
  }
  res.json({ data: book });
}

export function create(req, res) {
  // Verifier l'unicite
  if (booksService.existsByIsbn(req.body.isbn)) {
    throw new ConflictError('Un livre avec cet ISBN existe deja');
  }

  const book = booksService.createBook(req.body);
  res.status(201).json({ data: book });
}
```

---

## 5. Async handler wrapper

### 5.1 Le problème du try/catch repetitif

```typescript
// SANS wrapper — try/catch dans CHAQUE handler async
app.get('/api/books/:id', async (req, res, next) => {
  try {
    const book = await booksService.getById(req.params.id);
    if (!book) throw new NotFoundError('Livre', req.params.id);
    res.json(book);
  } catch (err) {
    next(err); // Il faut TOUJOURS passer l'erreur a next()
  }
});

app.post('/api/books', async (req, res, next) => {
  try {
    const book = await booksService.create(req.body);
    res.status(201).json(book);
  } catch (err) {
    next(err); // Encore et encore...
  }
});
```

> **Piege classique** : Si tu oublies le `try/catch` et le `next(err)` dans un handler async, Express ne capte PAS l'erreur. La requête reste en attente indefiniment (timeout). C'est un des bugs les plus courants en Express.

### 5.2 La solution : asyncHandler

```typescript
// utils/async-handler.js

/**
 * Wrapper qui attrape les erreurs des handlers async
 * et les passe automatiquement a next()
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
```

### 5.3 Utilisation — Code propre sans try/catch

```typescript
import { asyncHandler } from '../utils/async-handler.js';
import { NotFoundError } from '../utils/errors.js';

// AVEC wrapper — plus de try/catch !
router.get('/:id', asyncHandler(async (req, res) => {
  const book = await booksService.getById(req.params.id);
  if (!book) throw new NotFoundError('Livre', req.params.id);
  res.json({ data: book });
}));

router.post('/', asyncHandler(async (req, res) => {
  const book = await booksService.create(req.body);
  res.status(201).json({ data: book });
}));

// Si booksService.getById() rejette ou si le throw est execute,
// l'erreur est automatiquement passee a next() → error handler
```

> **Bonne pratique** : Utilise `asyncHandler` (où la librairie `express-async-errors`) pour TOUS tes handlers async. C'est un petit utilitaire qui elimine des dizaines de blocs try/catch et empeche les erreurs silencieuses. Express 5 (sorti en octobre 2024) intégré ce comportement nativement.
>
> **Note Express 5** : Express 5 géré nativement les erreurs dans les handlers async — plus besoin de `express-async-errors` ni de `asyncHandler`. Si vous demarrez un nouveau projet, privilegiez Express 5.

---

## 6. Gestion globale des erreurs Node.js

### 6.1 Filets de sécurité globaux

```typescript
// A mettre au debut de ton fichier principal (src/index.js)

// Promise rejection non geree
process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION !', reason);
  // En production : logger, alerter, puis arreter proprement
  // process.exit(1);
});

// Exception non attrapee
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION !', err);
  // TOUJOURS arreter le processus apres une uncaughtException
  // L'application est dans un etat inconsistant
  process.exit(1);
});

// Arret propre (Ctrl+C, Docker stop, etc.)
process.on('SIGTERM', () => {
  console.log('SIGTERM recu. Arret propre...');
  server.close(() => {
    console.log('Serveur ferme.');
    process.exit(0);
  });
});
```

### 6.2 Erreur operationnelle vs Bug

| Type | Description | Reaction |
|---|---|---|
| **Operationnelle** | Situation prevue (404, validation, timeout) | Renvoyer une erreur au client |
| **Bug (programmation)** | Erreur dans le code (TypeError, ReferenceError) | Logger, alerter, possiblement redemarrer |

```typescript
// middleware/error-handler.js
export function errorHandler(err, req, res, next) {
  if (err.isOperational) {
    // Erreur prevue — reponse normale au client
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Bug — situation anormale
  console.error('BUG DETECTE :', err);
  // En production : alerter l'equipe (Slack, email, Sentry)

  res.status(500).json({ error: 'Erreur interne du serveur' });
}
```

---

## 7. Patterns courants et pieges

### 7.1 Pattern : Validation + Controller + Service

```typescript
// Le flux complet d'une requete validee :

// 1. Le middleware validate() verifie les donnees
// 2. Le controller orchestre (pas de logique metier)
// 3. Le service contient la logique metier
// 4. En cas d'erreur, le error handler centralise la reponse

// Route
router.post('/',
  validate(createBookSchema),    // 1. Validation
  asyncHandler(booksCtrl.create) // 2. Controller (async-safe)
);

// Controller
export async function create(req, res) {
  const book = await booksService.create(req.body); // 3. Service
  res.status(201).json({ data: book });
}

// Service
export async function create(data) {
  if (await existsByIsbn(data.isbn)) {
    throw new ConflictError('ISBN deja utilise'); // 4. Erreur → error handler
  }
  // ... creer le livre
}
```

### 7.2 Piege : Oublier next(err) avec les erreurs async

```typescript
// MAUVAIS — l'erreur est perdue, le client attend indefiniment
app.get('/api/data', async (req, res) => {
  const data = await fetchData(); // Si ca rejette → crash silencieux
  res.json(data);
});

// BON — avec asyncHandler
app.get('/api/data', asyncHandler(async (req, res) => {
  const data = await fetchData();
  res.json(data);
}));

// BON — avec try/catch et next
app.get('/api/data', async (req, res, next) => {
  try {
    const data = await fetchData();
    res.json(data);
  } catch (err) {
    next(err);
  }
});
```

### 7.3 Piege : Envoyer deux réponses

```typescript
// MAUVAIS — res.json() est appele deux fois
app.get('/api/users/:id', (req, res) => {
  const user = findUser(req.params.id);
  if (!user) {
    res.status(404).json({ error: 'Not found' });
    // OUBLI du return ! Le code continue...
  }
  res.json(user); // Error: Cannot set headers after they are sent
});

// BON — return apres chaque reponse
app.get('/api/users/:id', (req, res) => {
  const user = findUser(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json(user);
});
```

---

## 8. Structure finale recommandee

```
src/
├── index.js
├── middleware/
│   ├── validate.js          ← Middleware Zod generique
│   ├── error-handler.js     ← Error handler centralise
│   ├── async-handler.js     ← Wrapper async
│   └── auth.js
├── routes/
│   ├── index.js
│   └── books.routes.js
├── controllers/
│   └── books.controller.js
├── services/
│   └── books.service.js
├── schemas/                  ← Schemas Zod
│   └── books.schema.js
└── utils/
    └── errors.js            ← Classes d'erreurs
```

---

## 9. Exercices pratiques

### Exercice 1 — Schema Zod complet

Cree un schema Zod pour une API de blog avec les regles suivantes :
- `title` : string, 5-200 caracteres, trim
- `content` : string, minimum 50 caracteres
- `tags` : tableau de strings, 1-5 tags, chaque tag 2-30 caracteres
- `status` : 'draft' | 'published' | 'archived', defaut 'draft'
- `publishedAt` : date ISO optionnelle, requise si status = 'published'

### Exercice 2 — Error handler avance

Ameliore le error handler pour :
- Logger les erreurs dans un fichier `errors.log`
- Ajouter un identifiant unique à chaque erreur (pour la retrouver dans les logs)
- Retourner cet identifiant au client pour le support

### Exercice 3 — Middleware de validation avance

Cree un middleware qui valide body, params ET query en une seule declaration :

```typescript
router.post('/:id',
  validate({ body: bodySchema, params: paramsSchema, query: querySchema }),
  handler
);
```

---

## 10. Résumé — Les concepts clés

| Concept | Definition |
|---|---|
| **Zod** | Librairie de validation de schemas TypeScript-first |
| **parse vs safeParse** | parse lance une erreur, safeParse retourne un résultat |
| **validate middleware** | Middleware générique qui valide req.body/query/params |
| **AppError** | Classe de base pour les erreurs applicatives |
| **Error handler** | Middleware Express a 4 arguments pour centraliser les erreurs |
| **asyncHandler** | Wrapper qui passe les rejections async a next() |
| **Operationnelle vs Bug** | Erreur prevue (404) vs erreur de code (TypeError) |
| **unhandledRejection** | Événement global pour les Promises non gerees |

> **A retenir** : Une bonne gestion des erreurs et une validation robuste sont les deux piliers d'une API fiable. Zod pour valider les entrees, des classes d'erreurs pour structurer les cas d'erreur, un error handler centralise pour formater les réponses, et asyncHandler pour eliminer le boilerplate — ces patterns sont la base de toute API Express professionnelle. NestJS formalisera ces concepts avec les Pipes, Filters et Exception Filters.

---

## Navigation

| | Lien |
|---|---|
| Module précédent | [Module 06 — Express — Middleware & Architecture](./06-express-middleware.md) |
| Module suivant | [Module 08 — Express — Authentification & Sécurité](./08-express-auth-securite.md) |
| Quiz | [Quiz Module 07](../quizzes/07-express-validation-erreurs.quiz.md) |
| Lab | [Lab 07 — Validation et erreurs](../labs/07-express-validation-erreurs.lab.md) |

---

> **A retenir** : Ne fais jamais confiance aux donnees du client. Valide TOUT avec Zod, centralise tes erreurs avec un error handler, et utilise asyncHandler pour éviter les erreurs silencieuses. Ces pratiques ne sont pas optionnelles — elles sont la différence entre une API amateur et une API de production.

---

<!-- parcours-recommande -->

::: tip Parcours recommandé
1. **Screencast** : [screencast 07 validation erreurs](../screencasts/screencast-07-validation-erreurs.md)
2. **Lab** : [lab-07-validation-erreurs](../labs/lab-07-validation-erreurs/README)
3. **Visualisation** : [Middleware Pipeline](../visualizations/middleware-pipeline.html)
4. **Quiz** : [quiz 07 validation erreurs](../quizzes/quiz-07-validation-erreurs.html)
:::
