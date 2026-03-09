// =============================================================================
// Lab 06 — Middleware Express (Solution)
// =============================================================================
// Objectifs :
//   - Creer des middleware personnalises
//   - Creer une factory de middleware
//   - Organiser les routes avec express.Router()
//   - Appliquer des middleware selectivement
// =============================================================================

import express, { type Request, type Response, type NextFunction } from 'express';
import { createTestRunner, startServer, httpGet, httpPost, httpDelete, sleep } from '../test-utils.ts';

const { test, assert, assertEqual, assertIncludes, assertGreaterThan, summary } = createTestRunner('Lab 06 — Middleware');

// =============================================================================
// Base de donnees en memoire
// =============================================================================

interface User {
  id: number;
  name: string;
  email: string;
}

interface Product {
  id: number;
  name: string;
  price: number;
}

let users: User[] = [];
let products: Product[] = [];
let nextUserId = 1;
let nextProductId = 1;

function resetDb(): void {
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

interface LogEntry {
  method: string;
  url: string;
  timestamp: string;
}

const logs: LogEntry[] = [];

// =============================================================================
// SOLUTION 1 : loggerMiddleware
// =============================================================================

function loggerMiddleware(req: Request, res: Response, next: NextFunction): void {
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

function timerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = performance.now();

  const originalEnd = res.end.bind(res) as typeof res.end;
  (res as Response).end = function (...args: Parameters<typeof res.end>): ReturnType<typeof res.end> {
    const duration = (performance.now() - start).toFixed(2);
    res.setHeader('X-Response-Time', `${duration}ms`);
    return originalEnd(...args);
  } as typeof res.end;

  next();
}

// =============================================================================
// SOLUTION 3 : authMiddleware
// =============================================================================

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
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

function validateBody(schema: Record<string, string>): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    for (const [field, type] of Object.entries(schema)) {
      const value = (req.body as Record<string, unknown>)[field];
      if (value === undefined || value === null || typeof value !== type) {
        res.status(400).json({
          error: `Field "${field}" is required and must be a ${type}`,
        });
        return;
      }
    }
    next();
  };
}

// =============================================================================
// SOLUTION 5 : Router /users
// =============================================================================

const usersRouter = express.Router();

usersRouter.get('/', (req: Request, res: Response) => {
  res.json(users);
});

usersRouter.post('/', validateBody({ name: 'string', email: 'string' }), (req: Request, res: Response) => {
  const { name, email } = req.body as { name: string; email: string };
  const newUser: User = { id: nextUserId++, name, email };
  users.push(newUser);
  res.status(201).json(newUser);
});

usersRouter.delete('/:id', (req: Request, res: Response) => {
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

productsRouter.get('/', (req: Request, res: Response) => {
  res.json(products);
});

// POST et DELETE sont proteges par authMiddleware
productsRouter.post('/', authMiddleware, validateBody({ name: 'string', price: 'number' }), (req: Request, res: Response) => {
  const { name, price } = req.body as { name: string; price: number };
  const newProduct: Product = { id: nextProductId++, name, price };
  products.push(newProduct);
  res.status(201).json(newProduct);
});

productsRouter.delete('/:id', authMiddleware, (req: Request, res: Response) => {
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

console.log('\n\uD83E\uDDEA Lab 06 — Middleware Express\n');

const { baseUrl, close } = await startServer(app);

try {
  resetDb();
  logs.length = 0;

  // -- Test 1 : Logger middleware -------------------------------------------
  await test('Le logger enregistre les requetes', async () => {
    logs.length = 0;
    await httpGet(`${baseUrl}/users`);
    assertGreaterThan(logs.length, 0, 'Le logger doit enregistrer au moins 1 log');
    assertEqual(logs[0].method, 'GET', 'Methode GET enregistree');
    assertIncludes(logs[0].url, '/users', 'URL /users enregistree');
    assert(logs[0].timestamp, 'Timestamp present');
  });

  // -- Test 2 : Timer middleware --------------------------------------------
  await test('Le timer ajoute le header X-Response-Time', async () => {
    const res = await httpGet(`${baseUrl}/users`);
    const responseTime = res.headers['x-response-time'];
    assert(responseTime, 'Header X-Response-Time doit etre present');
    assertIncludes(responseTime, 'ms', 'Doit contenir "ms"');
  });

  // -- Test 3 : Auth middleware -- succes -----------------------------------
  await test('Auth middleware accepte un token valide', async () => {
    const res = await httpPost(`${baseUrl}/products`, {
      name: 'Keyboard',
      price: 79,
    }, { 'Authorization': 'Bearer secret-token' });
    assertEqual(res.status, 201, 'Status 201 avec token valide');
  });

  // -- Test 4 : Auth middleware -- echec ------------------------------------
  await test('Auth middleware rejette sans token', async () => {
    const res = await httpPost(`${baseUrl}/products`, {
      name: 'Keyboard',
      price: 79,
    });
    assertEqual(res.status, 401, 'Status 401 sans token');
    assertEqual((res.json() as { error: string }).error, 'Unauthorized', 'Message Unauthorized');
  });

  // -- Test 5 : Validation middleware -- succes -----------------------------
  await test('Validation middleware accepte un body valide', async () => {
    const res = await httpPost(`${baseUrl}/users`, {
      name: 'Charlie',
      email: 'charlie@example.com',
    });
    assertEqual(res.status, 201, 'Status 201 avec body valide');
    assertEqual((res.json() as User).name, 'Charlie', 'Nom correct');
  });

  // -- Test 6 : Validation middleware -- echec ------------------------------
  await test('Validation middleware rejette un body invalide', async () => {
    const res = await httpPost(`${baseUrl}/users`, { name: 'NoEmail' });
    assertEqual(res.status, 400, 'Status 400 pour champ manquant');
    assertIncludes((res.json() as { error: string }).error, 'email', 'Erreur mentionne le champ manquant');
  });

  // -- Test 7 : Router users fonctionne ------------------------------------
  await test('Router /users fonctionne', async () => {
    resetDb();
    const res = await httpGet(`${baseUrl}/users`);
    assertEqual(res.status, 200, 'Status 200');
    assertEqual((res.json() as User[]).length, 2, '2 utilisateurs');

    const del = await httpDelete(`${baseUrl}/users/1`);
    assertEqual(del.status, 204, 'Status 204 pour delete');

    const after = await httpGet(`${baseUrl}/users`);
    assertEqual((after.json() as User[]).length, 1, '1 utilisateur apres suppression');
  });

  // -- Test 8 : Auth selective -- GET products sans token OK ----------------
  await test('GET /products fonctionne sans token (auth selective)', async () => {
    resetDb();
    const res = await httpGet(`${baseUrl}/products`);
    assertEqual(res.status, 200, 'Status 200 sans token pour GET');
    assertEqual((res.json() as Product[]).length, 2, '2 produits');

    const del = await httpDelete(`${baseUrl}/products/1`);
    assertEqual(del.status, 401, 'DELETE sans token retourne 401');
  });

} finally {
  await close();
  summary();
}
