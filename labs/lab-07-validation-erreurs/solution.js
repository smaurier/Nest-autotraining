// =============================================================================
// Lab 07 — Validation et Gestion d'Erreurs (Solution)
// =============================================================================
// Objectifs :
//   - Definir des schemas Zod
//   - Creer un middleware de validation generique
//   - Creer des classes d'erreur personnalisees
//   - Implementer asyncHandler et un middleware d'erreur centralise
// =============================================================================

import express from 'express';
import { z } from 'zod';
import { createTestRunner, startServer, httpGet, httpPost, httpPut } from '../test-utils.js';

const { test, assert, assertEqual, assertIncludes, summary } = createTestRunner('Lab 07 — Validation & Erreurs');

// =============================================================================
// Base de donnees en memoire
// =============================================================================

let users = [];
let nextId = 1;

function resetDb() {
  users = [
    { id: 1, name: 'Alice', email: 'alice@example.com', age: 30 },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
  ];
  nextId = 3;
}

// =============================================================================
// SOLUTION 1 : UserSchema
// =============================================================================

const UserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  age: z.number().min(0).max(150).optional(),
});

// =============================================================================
// SOLUTION 2 : validate(schema)
// =============================================================================

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      return res.status(400).json({ error: 'Validation failed', details });
    }
    req.body = result.data;
    next();
  };
}

// =============================================================================
// SOLUTION 3 : AppError
// =============================================================================

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
  }
}

// =============================================================================
// SOLUTION 4 : NotFoundError et ValidationError
// =============================================================================

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed') {
    super(message, 400);
  }
}

// =============================================================================
// SOLUTION 5 : asyncHandler(fn)
// =============================================================================

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// =============================================================================
// SOLUTION 6 : errorHandler
// =============================================================================

function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  res.status(500).json({ error: 'Internal Server Error' });
}

// =============================================================================
// SOLUTION 7 : API
// =============================================================================

const app = express();
app.use(express.json());

// GET /users
app.get('/users', asyncHandler(async (req, res) => {
  res.json(users);
}));

// GET /users/:id
app.get('/users/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const user = users.find(u => u.id === id);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  res.json(user);
}));

// POST /users
app.post('/users', validate(UserSchema), asyncHandler(async (req, res) => {
  const { name, email, age } = req.body;
  const newUser = { id: nextId++, name, email };
  if (age !== undefined) newUser.age = age;
  users.push(newUser);
  res.status(201).json(newUser);
}));

// PUT /users/:id
app.put('/users/:id', validate(UserSchema), asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = users.findIndex(u => u.id === id);
  if (index === -1) {
    throw new NotFoundError('User not found');
  }
  const { name, email, age } = req.body;
  users[index] = { id, name, email };
  if (age !== undefined) users[index].age = age;
  res.json(users[index]);
}));

// Middleware d'erreur centralise
app.use(errorHandler);

// =============================================================================
// TESTS
// =============================================================================

console.log('\n🧪 Lab 07 — Validation et Gestion d\'Erreurs\n');

const { baseUrl, close } = await startServer(app);

try {
  resetDb();

  // ── Test 1 : GET /users ────────────────────────────────────────────────
  await test('GET /users retourne la liste', async () => {
    const res = await httpGet(`${baseUrl}/users`);
    assertEqual(res.status, 200, 'Status 200');
    assertEqual(res.json().length, 2, '2 utilisateurs');
  });

  // ── Test 2 : GET /users/:id ────────────────────────────────────────────
  await test('GET /users/:id retourne un utilisateur', async () => {
    const res = await httpGet(`${baseUrl}/users/1`);
    assertEqual(res.status, 200, 'Status 200');
    assertEqual(res.json().name, 'Alice', 'Alice trouvee');
  });

  // ── Test 3 : GET /users/:id — 404 ─────────────────────────────────────
  await test('GET /users/:id retourne 404 via NotFoundError', async () => {
    const res = await httpGet(`${baseUrl}/users/999`);
    assertEqual(res.status, 404, 'Status 404');
    assertIncludes(res.json().error, 'not found', 'Message contient "not found"');
  });

  // ── Test 4 : POST /users — valide ─────────────────────────────────────
  await test('POST /users cree un utilisateur valide', async () => {
    const res = await httpPost(`${baseUrl}/users`, {
      name: 'Charlie',
      email: 'charlie@example.com',
      age: 25,
    });
    assertEqual(res.status, 201, 'Status 201');
    assertEqual(res.json().name, 'Charlie', 'Nom correct');
    assertEqual(res.json().age, 25, 'Age correct');
  });

  // ── Test 5 : POST /users — nom trop court ─────────────────────────────
  await test('POST /users rejette un nom trop court', async () => {
    const res = await httpPost(`${baseUrl}/users`, {
      name: 'A',
      email: 'a@example.com',
    });
    assertEqual(res.status, 400, 'Status 400');
    const data = res.json();
    assertEqual(data.error, 'Validation failed', 'Erreur de validation');
    assert(data.details, 'Details presents');
    assert(data.details.length > 0, 'Au moins 1 detail');
  });

  // ── Test 6 : POST /users — email invalide ─────────────────────────────
  await test('POST /users rejette un email invalide', async () => {
    const res = await httpPost(`${baseUrl}/users`, {
      name: 'Charlie',
      email: 'not-an-email',
    });
    assertEqual(res.status, 400, 'Status 400');
    const data = res.json();
    assert(data.details.some(d => d.field === 'email'), 'Detail pour le champ email');
  });

  // ── Test 7 : POST /users — age invalide ───────────────────────────────
  await test('POST /users rejette un age negatif', async () => {
    const res = await httpPost(`${baseUrl}/users`, {
      name: 'Charlie',
      email: 'charlie@example.com',
      age: -5,
    });
    assertEqual(res.status, 400, 'Status 400');
  });

  // ── Test 8 : PUT /users/:id — mise a jour ─────────────────────────────
  await test('PUT /users/:id met a jour avec validation', async () => {
    const res = await httpPut(`${baseUrl}/users/1`, {
      name: 'Alice Updated',
      email: 'alice.new@example.com',
      age: 31,
    });
    assertEqual(res.status, 200, 'Status 200');
    assertEqual(res.json().name, 'Alice Updated', 'Nom mis a jour');
    assertEqual(res.json().age, 31, 'Age mis a jour');

    const check = await httpGet(`${baseUrl}/users/1`);
    assertEqual(check.json().name, 'Alice Updated', 'Modification persistee');
  });

} finally {
  await close();
  summary();
}
