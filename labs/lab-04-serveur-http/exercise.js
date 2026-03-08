// =============================================================================
// Lab 04 — Serveur HTTP Natif (Exercice)
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
// TODO 1 : Implementer parseBody(req)
// =============================================================================
// Parse le corps d'une requete HTTP en JSON.
// - Lire les chunks avec req.on('data', ...)
// - Quand tous les chunks sont recus (req.on('end', ...)), parser le JSON
// - Si le body est vide, retourner null
// - Si le JSON est invalide, rejeter avec une erreur
// - Retourner une Promise qui resout avec l'objet parse
//
// Exemple :
//   const body = await parseBody(req);
//   // { name: "Alice", email: "alice@example.com" }

function parseBody(req) {
  // TODO: Lire et parser le corps JSON de la requete
  throw new Error('TODO: implementer parseBody()');
}

// =============================================================================
// TODO 2 : Implementer sendJson(res, statusCode, data)
// =============================================================================
// Envoie une reponse JSON.
// - Definir le header Content-Type a 'application/json'
// - Ecrire le status code
// - Serialiser data en JSON et l'envoyer
//
// Si data est null/undefined, envoyer juste le status code sans body.

function sendJson(res, statusCode, data) {
  // TODO: Envoyer une reponse JSON
  throw new Error('TODO: implementer sendJson()');
}

// =============================================================================
// TODO 3 : Implementer addCorsHeaders(res)
// =============================================================================
// Ajoute les headers CORS a la reponse :
//   - Access-Control-Allow-Origin: *
//   - Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
//   - Access-Control-Allow-Headers: Content-Type, Authorization

function addCorsHeaders(res) {
  // TODO: Ajouter les headers CORS
  throw new Error('TODO: implementer addCorsHeaders()');
}

// =============================================================================
// TODO 4-9 : Implementer le handler du serveur
// =============================================================================
// Creer le handler du serveur HTTP qui gere les routes suivantes :
//
// GET    /users       → retourne la liste des users (200)
// GET    /users/:id   → retourne un user par id (200) ou 404
// POST   /users       → cree un user (201), requiert name et email sinon 400
// PUT    /users/:id   → modifie un user (200) ou 404
// DELETE /users/:id   → supprime un user (204) ou 404
// OPTIONS *           → repondre 204 (pour CORS preflight)
// Autre               → 404 { error: 'Not Found' }
//
// Pour chaque requete :
//   1. Appeler addCorsHeaders(res)
//   2. Parser l'URL pour extraire le pathname
//   3. Router vers le bon handler

async function handler(req, res) {
  // TODO: Implementer le routage complet
  //
  // Indices :
  //   - Utiliser new URL(req.url, `http://${req.headers.host}`) pour parser l'URL
  //   - Extraire l'id avec pathname.split('/') : ex. '/users/2' → ['', 'users', '2']
  //   - Pour POST et PUT, utiliser parseBody(req) pour lire le corps
  //   - Pour POST, valider que name et email sont presents (sinon 400)
  //   - Pour DELETE, envoyer status 204 sans body

  throw new Error('TODO: implementer le handler du serveur');
}

// =============================================================================
// TESTS
// =============================================================================

console.log('\n🧪 Lab 04 — Serveur HTTP Natif\n');

// Wrapper pour utiliser avec startServer (qui attend un handler synchrone)
const serverHandler = (req, res) => {
  handler(req, res).catch(err => {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  });
};

const { baseUrl, close } = await startServer(serverHandler);

try {
  // Reset la base pour chaque serie de tests
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

    // Verifier que la modification est persistee
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

    // Verifier que l'utilisateur est supprime
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
