// =============================================================================
// Lab 06 — Middleware Express (Exercice)
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

// Variable pour capturer les logs du middleware
interface LogEntry {
  method: string;
  url: string;
  timestamp: string;
}

const logs: LogEntry[] = [];

// =============================================================================
// TODO 1 : Creer loggerMiddleware
// =============================================================================
// Middleware qui log chaque requete avec :
//   - La methode HTTP (req.method)
//   - L'URL (req.originalUrl)
//   - Un timestamp (new Date().toISOString())
//
// Pour les tests, pusher le log dans le tableau `logs` au lieu de console.log :
//   logs.push({ method: req.method, url: req.originalUrl, timestamp: new Date().toISOString() });
//
// N'oubliez pas d'appeler next() !

function loggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  // TODO: Logger la requete et appeler next()
  throw new Error('TODO: implementer loggerMiddleware()');
}

// =============================================================================
// TODO 2 : Creer timerMiddleware
// =============================================================================
// Middleware qui mesure le temps de traitement de la requete.
// - Au debut : enregistrer le temps avec performance.now()
// - A la fin : calculer la duree et l'ajouter comme header X-Response-Time
//
// ASTUCE : Utiliser le pattern suivant :
//   const originalEnd = res.end.bind(res);
//   res.end = function(...args) {
//     const duration = (performance.now() - start).toFixed(2);
//     res.setHeader('X-Response-Time', `${duration}ms`);
//     originalEnd(...args);
//   };

function timerMiddleware(req: Request, res: Response, next: NextFunction): void {
  // TODO: Mesurer le temps de reponse et ajouter le header X-Response-Time
  throw new Error('TODO: implementer timerMiddleware()');
}

// =============================================================================
// TODO 3 : Creer authMiddleware
// =============================================================================
// Middleware qui verifie l'authentification.
// - Lire le header Authorization
// - Verifier qu'il est egal a 'Bearer secret-token'
// - Si valide : appeler next()
// - Si invalide ou absent : repondre 401 { error: 'Unauthorized' }

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // TODO: Verifier le token d'authentification
  throw new Error('TODO: implementer authMiddleware()');
}

// =============================================================================
// TODO 4 : Creer validateBody(schema)
// =============================================================================
// Factory de middleware qui prend un schema de validation.
// Le schema est un objet ou chaque cle correspond a un champ requis
// et la valeur est le type attendu (string).
//
// Exemple de schema :
//   { name: 'string', email: 'string' }
//
// Le middleware doit :
// - Verifier que chaque champ du schema est present dans req.body
// - Verifier que chaque champ est du bon type (typeof)
// - Si valide : appeler next()
// - Si invalide : repondre 400 { error: `Field "${field}" is required and must be a ${type}` }

function validateBody(schema: Record<string, string>): (req: Request, res: Response, next: NextFunction) => void {
  // TODO: Retourner un middleware de validation
  throw new Error('TODO: implementer validateBody()');
}

// =============================================================================
// TODO 5 : Creer le Router /users
// =============================================================================
// Routes :
//   GET /     -> liste des users (200)
//   POST /    -> creer un user avec validation (name: string, email: string)
//   DELETE /:id -> supprimer un user (204) ou 404
//
// Utiliser validateBody() sur POST uniquement.

// TODO: Creer usersRouter
// const usersRouter = express.Router();
// ...

// =============================================================================
// TODO 6 : Creer le Router /products
// =============================================================================
// Routes :
//   GET /     -> liste des products (200)
//   POST /    -> creer un product avec validation (name: string, price: number) -- protege par authMiddleware
//   DELETE /:id -> supprimer un product (204) ou 404 -- protege par authMiddleware

// TODO: Creer productsRouter
// const productsRouter = express.Router();
// ...

// =============================================================================
// TODO 7 : Assembler l'application
// =============================================================================
// 1. Creer l'app Express
// 2. Ajouter express.json() en global
// 3. Ajouter loggerMiddleware en global
// 4. Ajouter timerMiddleware en global
// 5. Monter usersRouter sur /users
// 6. Monter productsRouter sur /products

// TODO: Assembler l'application
// const app = express();
// ...

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

    // Mais DELETE sans token doit echouer
    const del = await httpDelete(`${baseUrl}/products/1`);
    assertEqual(del.status, 401, 'DELETE sans token retourne 401');
  });

} finally {
  await close();
  summary();
}
