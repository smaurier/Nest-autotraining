// =============================================================================
// Lab 06 — Middleware Express (Solution)
// =============================================================================
// Objectifs :
//   - Creer des middleware personnalises
//   - Creer une factory de middleware
//   - Organiser les routes avec express.Router()
//   - Appliquer des middleware selectivement
// =============================================================================

import express from 'express';
import { createTestRunner, startServer, httpGet, httpPost, httpDelete, sleep } from '../test-utils.js';

const { test, assert, assertEqual, assertIncludes, assertGreaterThan, summary } = createTestRunner('Lab 06 — Middleware');

// =============================================================================
// Base de donnees en memoire
// =============================================================================

let users = [];
let products = [];
let nextUserId = 1;
let nextProductId = 1;

function resetDb() {
  users = [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
  ];
  products = [
    { id: 1, name: 'Laptop', price: 999 },
    { id: 2, name: 'Mouse', price: 29 },
  ];
  nextUserId = 3;
  nextProductId = 3;
}

const logs = [];

// =============================================================================
// SOLUTION 1 : loggerMiddleware
// =============================================================================

function loggerMiddleware(req, res, next) {
  logs.push({
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
  next();
}

// =============================================================================
// SOLUTION 2 : timerMiddleware
// =============================================================================

function timerMiddleware(req, res, next) {
  const start = performance.now();

  const originalEnd = res.end.bind(res);
  res.end = function (...args) {
    const duration = (performance.now() - start).toFixed(2);
    res.setHeader('X-Response-Time', `${duration}ms`);
    originalEnd(...args);
  };

  next();
}

// =============================================================================
// SOLUTION 3 : authMiddleware
// =============================================================================

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader === 'Bearer secret-token') {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// =============================================================================
// SOLUTION 4 : validateBody(schema)
// =============================================================================

function validateBody(schema) {
  return (req, res, next) => {
    for (const [field, type] of Object.entries(schema)) {
      const value = req.body[field];
      if (value === undefined || value === null || typeof value !== type) {
        return res.status(400).json({
          error: `Field "${field}" is required and must be a ${type}`,
        });
      }
    }
    next();
  };
}

// =============================================================================
// SOLUTION 5 : Router /users
// =============================================================================

const usersRouter = express.Router();

usersRouter.get('/', (req, res) => {
  res.json(users);
});

usersRouter.post('/', validateBody({ name: 'string', email: 'string' }), (req, res) => {
  const { name, email } = req.body;
  const newUser = { id: nextUserId++, name, email };
  users.push(newUser);
  res.status(201).json(newUser);
});

usersRouter.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = users.findIndex(u => u.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  users.splice(index, 1);
  res.status(204).send();
});

// =============================================================================
// SOLUTION 6 : Router /products
// =============================================================================

const productsRouter = express.Router();

productsRouter.get('/', (req, res) => {
  res.json(products);
});

// POST et DELETE sont proteges par authMiddleware
productsRouter.post('/', authMiddleware, validateBody({ name: 'string', price: 'number' }), (req, res) => {
  const { name, price } = req.body;
  const newProduct = { id: nextProductId++, name, price };
  products.push(newProduct);
  res.status(201).json(newProduct);
});

productsRouter.delete('/:id', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = products.findIndex(p => p.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Product not found' });
  }
  products.splice(index, 1);
  res.status(204).send();
});

// =============================================================================
// SOLUTION 7 : Assembler l'application
// =============================================================================

const app = express();
app.use(express.json());
app.use(loggerMiddleware);
app.use(timerMiddleware);
app.use('/users', usersRouter);
app.use('/products', productsRouter);

// =============================================================================
// TESTS
// =============================================================================

console.log('\n🧪 Lab 06 — Middleware Express\n');

const { baseUrl, close } = await startServer(app);

try {
  resetDb();
  logs.length = 0;

  // ── Test 1 : Logger middleware ─────────────────────────────────────────
  await test('Le logger enregistre les requetes', async () => {
    logs.length = 0;
    await httpGet(`${baseUrl}/users`);
    assertGreaterThan(logs.length, 0, 'Le logger doit enregistrer au moins 1 log');
    assertEqual(logs[0].method, 'GET', 'Methode GET enregistree');
    assertIncludes(logs[0].url, '/users', 'URL /users enregistree');
    assert(logs[0].timestamp, 'Timestamp present');
  });

  // ── Test 2 : Timer middleware ──────────────────────────────────────────
  await test('Le timer ajoute le header X-Response-Time', async () => {
    const res = await httpGet(`${baseUrl}/users`);
    const responseTime = res.headers['x-response-time'];
    assert(responseTime, 'Header X-Response-Time doit etre present');
    assertIncludes(responseTime, 'ms', 'Doit contenir "ms"');
  });

  // ── Test 3 : Auth middleware — succes ──────────────────────────────────
  await test('Auth middleware accepte un token valide', async () => {
    const res = await httpPost(`${baseUrl}/products`, {
      name: 'Keyboard',
      price: 79,
    }, { 'Authorization': 'Bearer secret-token' });
    assertEqual(res.status, 201, 'Status 201 avec token valide');
  });

  // ── Test 4 : Auth middleware — echec ───────────────────────────────────
  await test('Auth middleware rejette sans token', async () => {
    const res = await httpPost(`${baseUrl}/products`, {
      name: 'Keyboard',
      price: 79,
    });
    assertEqual(res.status, 401, 'Status 401 sans token');
    assertEqual(res.json().error, 'Unauthorized', 'Message Unauthorized');
  });

  // ── Test 5 : Validation middleware — succes ────────────────────────────
  await test('Validation middleware accepte un body valide', async () => {
    const res = await httpPost(`${baseUrl}/users`, {
      name: 'Charlie',
      email: 'charlie@example.com',
    });
    assertEqual(res.status, 201, 'Status 201 avec body valide');
    assertEqual(res.json().name, 'Charlie', 'Nom correct');
  });

  // ── Test 6 : Validation middleware — echec ─────────────────────────────
  await test('Validation middleware rejette un body invalide', async () => {
    const res = await httpPost(`${baseUrl}/users`, { name: 'NoEmail' });
    assertEqual(res.status, 400, 'Status 400 pour champ manquant');
    assertIncludes(res.json().error, 'email', 'Erreur mentionne le champ manquant');
  });

  // ── Test 7 : Router users fonctionne ───────────────────────────────────
  await test('Router /users fonctionne', async () => {
    resetDb();
    const res = await httpGet(`${baseUrl}/users`);
    assertEqual(res.status, 200, 'Status 200');
    assertEqual(res.json().length, 2, '2 utilisateurs');

    const del = await httpDelete(`${baseUrl}/users/1`);
    assertEqual(del.status, 204, 'Status 204 pour delete');

    const after = await httpGet(`${baseUrl}/users`);
    assertEqual(after.json().length, 1, '1 utilisateur apres suppression');
  });

  // ── Test 8 : Auth selective — GET products sans token OK ───────────────
  await test('GET /products fonctionne sans token (auth selective)', async () => {
    resetDb();
    const res = await httpGet(`${baseUrl}/products`);
    assertEqual(res.status, 200, 'Status 200 sans token pour GET');
    assertEqual(res.json().length, 2, '2 produits');

    const del = await httpDelete(`${baseUrl}/products/1`);
    assertEqual(del.status, 401, 'DELETE sans token retourne 401');
  });

} finally {
  await close();
  summary();
}
