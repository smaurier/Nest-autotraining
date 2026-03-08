// =============================================================================
// Lab 04 — Serveur HTTP Natif (Solution)
// =============================================================================
// Objectifs :
//   - Creer un serveur HTTP avec le module http natif
//   - Implementer une API REST CRUD pour "users"
//   - Parser les corps JSON, gerer le routage et les erreurs
//   - Ajouter des headers CORS
// =============================================================================

import http from 'node:http';
import { createTestRunner, startServer, httpGet, httpPost, httpPut, httpDelete } from '../test-utils.js';

const { test, assert, assertEqual, summary } = createTestRunner('Lab 04 — Serveur HTTP natif');

// =============================================================================
// Base de donnees en memoire
// =============================================================================

let users = [];
let nextId = 1;

function resetDb() {
  users = [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
    { id: 3, name: 'Charlie', email: 'charlie@example.com' },
  ];
  nextId = 4;
}

// =============================================================================
// SOLUTION 1 : parseBody(req)
// =============================================================================

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      if (!body) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// =============================================================================
// SOLUTION 2 : sendJson(res, statusCode, data)
// =============================================================================

function sendJson(res, statusCode, data) {
  if (data === null || data === undefined) {
    res.writeHead(statusCode);
    res.end();
    return;
  }
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// =============================================================================
// SOLUTION 3 : addCorsHeaders(res)
// =============================================================================

function addCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// =============================================================================
// SOLUTION 4-9 : Handler du serveur
// =============================================================================

async function handler(req, res) {
  addCorsHeaders(res);

  const { method } = req;
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const pathname = urlObj.pathname;
  const parts = pathname.split('/').filter(Boolean); // ['users'] ou ['users', '2']

  // OPTIONS (CORS preflight)
  if (method === 'OPTIONS') {
    sendJson(res, 204, null);
    return;
  }

  // Verifier que la route commence par /users
  if (parts[0] !== 'users') {
    sendJson(res, 404, { error: 'Not Found' });
    return;
  }

  const id = parts[1] ? parseInt(parts[1], 10) : null;

  // GET /users
  if (method === 'GET' && !id) {
    sendJson(res, 200, users);
    return;
  }

  // GET /users/:id
  if (method === 'GET' && id) {
    const user = users.find(u => u.id === id);
    if (!user) {
      sendJson(res, 404, { error: 'User not found' });
      return;
    }
    sendJson(res, 200, user);
    return;
  }

  // POST /users
  if (method === 'POST' && !id) {
    let body;
    try {
      body = await parseBody(req);
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON' });
      return;
    }

    if (!body || !body.name || !body.email) {
      sendJson(res, 400, { error: 'name and email are required' });
      return;
    }

    const newUser = { id: nextId++, name: body.name, email: body.email };
    users.push(newUser);
    sendJson(res, 201, newUser);
    return;
  }

  // PUT /users/:id
  if (method === 'PUT' && id) {
    const userIndex = users.findIndex(u => u.id === id);
    if (userIndex === -1) {
      sendJson(res, 404, { error: 'User not found' });
      return;
    }

    let body;
    try {
      body = await parseBody(req);
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON' });
      return;
    }

    users[userIndex] = { ...users[userIndex], ...body };
    sendJson(res, 200, users[userIndex]);
    return;
  }

  // DELETE /users/:id
  if (method === 'DELETE' && id) {
    const userIndex = users.findIndex(u => u.id === id);
    if (userIndex === -1) {
      sendJson(res, 404, { error: 'User not found' });
      return;
    }

    users.splice(userIndex, 1);
    sendJson(res, 204, null);
    return;
  }

  // Route non trouvee
  sendJson(res, 404, { error: 'Not Found' });
}

// =============================================================================
// TESTS
// =============================================================================

console.log('\n🧪 Lab 04 — Serveur HTTP Natif\n');

const serverHandler = (req, res) => {
  handler(req, res).catch(err => {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  });
};

const { baseUrl, close } = await startServer(serverHandler);

try {
  resetDb();

  // ── Test 1 : GET /users ────────────────────────────────────────────────
  await test('GET /users retourne la liste des utilisateurs', async () => {
    const res = await httpGet(`${baseUrl}/users`);
    assertEqual(res.status, 200, 'Status 200');
    const data = res.json();
    assertEqual(data.length, 3, 'Doit retourner 3 utilisateurs');
    assertEqual(data[0].name, 'Alice', 'Premier utilisateur: Alice');
  });

  // ── Test 2 : GET /users/:id ────────────────────────────────────────────
  await test('GET /users/:id retourne un utilisateur', async () => {
    const res = await httpGet(`${baseUrl}/users/2`);
    assertEqual(res.status, 200, 'Status 200');
    const data = res.json();
    assertEqual(data.name, 'Bob', 'Utilisateur 2 est Bob');
    assertEqual(data.email, 'bob@example.com', 'Email de Bob correct');
  });

  // ── Test 3 : GET /users/:id — 404 ─────────────────────────────────────
  await test('GET /users/:id retourne 404 si inexistant', async () => {
    const res = await httpGet(`${baseUrl}/users/999`);
    assertEqual(res.status, 404, 'Status 404 pour un id inexistant');
  });

  // ── Test 4 : POST /users ───────────────────────────────────────────────
  await test('POST /users cree un utilisateur', async () => {
    const res = await httpPost(`${baseUrl}/users`, {
      name: 'Diana',
      email: 'diana@example.com',
    });
    assertEqual(res.status, 201, 'Status 201 Created');
    const data = res.json();
    assertEqual(data.name, 'Diana', 'Nom correct');
    assertEqual(data.email, 'diana@example.com', 'Email correct');
    assert(data.id, 'Doit avoir un id');
  });

  // ── Test 5 : POST /users — validation ──────────────────────────────────
  await test('POST /users retourne 400 si champs manquants', async () => {
    const res = await httpPost(`${baseUrl}/users`, { name: 'NoEmail' });
    assertEqual(res.status, 400, 'Status 400 pour email manquant');

    const res2 = await httpPost(`${baseUrl}/users`, { email: 'no@name.com' });
    assertEqual(res2.status, 400, 'Status 400 pour name manquant');
  });

  // ── Test 6 : PUT /users/:id ────────────────────────────────────────────
  await test('PUT /users/:id modifie un utilisateur', async () => {
    const res = await httpPut(`${baseUrl}/users/1`, {
      name: 'Alice Updated',
      email: 'alice.updated@example.com',
    });
    assertEqual(res.status, 200, 'Status 200');
    const data = res.json();
    assertEqual(data.name, 'Alice Updated', 'Nom mis a jour');
    assertEqual(data.email, 'alice.updated@example.com', 'Email mis a jour');

    const check = await httpGet(`${baseUrl}/users/1`);
    assertEqual(check.json().name, 'Alice Updated', 'Modification persistee');
  });

  // ── Test 7 : PUT /users/:id — 404 ─────────────────────────────────────
  await test('PUT /users/:id retourne 404 si inexistant', async () => {
    const res = await httpPut(`${baseUrl}/users/999`, { name: 'Ghost' });
    assertEqual(res.status, 404, 'Status 404');
  });

  // ── Test 8 : DELETE /users/:id ─────────────────────────────────────────
  await test('DELETE /users/:id supprime un utilisateur', async () => {
    const res = await httpDelete(`${baseUrl}/users/2`);
    assertEqual(res.status, 204, 'Status 204 No Content');

    const check = await httpGet(`${baseUrl}/users/2`);
    assertEqual(check.status, 404, 'Utilisateur supprime');
  });

  // ── Test 9 : Route inconnue — 404 ─────────────────────────────────────
  await test('Route inconnue retourne 404', async () => {
    const res = await httpGet(`${baseUrl}/unknown`);
    assertEqual(res.status, 404, 'Status 404');
    const data = res.json();
    assertEqual(data.error, 'Not Found', 'Message d\'erreur correct');
  });

  // ── Test 10 : Headers CORS ────────────────────────────────────────────
  await test('Les reponses contiennent les headers CORS', async () => {
    const res = await httpGet(`${baseUrl}/users`);
    assertEqual(res.headers['access-control-allow-origin'], '*', 'CORS Allow-Origin: *');
    assert(
      res.headers['access-control-allow-methods'],
      'Doit avoir Access-Control-Allow-Methods'
    );
  });

} finally {
  await close();
  summary();
}
