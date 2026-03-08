// =============================================================================
// test-utils.js — Utilitaires partages pour les labs Node.js/Express (labs 01-08)
// =============================================================================

import http from 'node:http';

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------
export function createTestRunner(labName) {
  let passed = 0;
  let failed = 0;
  const errors = [];

  async function test(name, fn) {
    try {
      await fn();
      passed++;
      console.log(`  ✅ ${name}`);
    } catch (err) {
      failed++;
      errors.push({ name, error: err });
      console.log(`  ❌ ${name}`);
      console.log(`     → ${err.message}`);
    }
  }

  function assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
  }

  function assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  }

  function assertIncludes(str, substr, message) {
    if (typeof str === 'string' && !str.includes(substr)) {
      throw new Error(message || `Expected string to include "${substr}"`);
    }
    if (Array.isArray(str) && !str.includes(substr)) {
      throw new Error(message || `Expected array to include ${JSON.stringify(substr)}`);
    }
  }

  function assertGreaterThan(actual, expected, message) {
    if (!(actual > expected)) {
      throw new Error(message || `Expected ${actual} > ${expected}`);
    }
  }

  function assertLessThan(actual, expected, message) {
    if (!(actual < expected)) {
      throw new Error(message || `Expected ${actual} < ${expected}`);
    }
  }

  function summary() {
    const total = passed + failed;
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`📊 ${labName} — Résultats : ${passed}/${total} tests réussis`);
    if (failed > 0) {
      console.log(`\n❌ ${failed} test(s) échoué(s) :`);
      errors.forEach(({ name, error }) => {
        console.log(`   • ${name} : ${error.message}`);
      });
    } else {
      console.log(`\n🎉 Tous les tests passent !`);
    }
    console.log(`${'─'.repeat(50)}\n`);
    return { passed, failed, total };
  }

  return { test, assert, assertEqual, assertIncludes, assertGreaterThan, assertLessThan, summary };
}

// ---------------------------------------------------------------------------
// Server helpers
// ---------------------------------------------------------------------------

/**
 * Demarre un serveur HTTP a partir d'un handler ou d'une app Express.
 * Si handler est une fonction avec (req, res) signature, utilise http.createServer.
 * Si handler est une app Express (avec .listen), utilise app.listen.
 * Utilise le port 0 pour obtenir un port aleatoire disponible.
 *
 * @param {Function|Object} handler - Fonction (req, res) ou app Express
 * @param {number} port - Port d'ecoute (0 = aleatoire)
 * @returns {Promise<{baseUrl: string, close: Function}>}
 */
export async function startServer(handler, port = 0) {
  return new Promise((resolve, reject) => {
    let server;

    if (typeof handler === 'function' && handler.length <= 2 && !handler.listen) {
      server = http.createServer(handler);
    } else if (handler && typeof handler.listen === 'function') {
      server = handler;
    } else {
      server = http.createServer(handler);
    }

    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      const assignedPort = address.port;
      const baseUrl = `http://127.0.0.1:${assignedPort}`;

      const close = () => {
        return new Promise((resolveClose, rejectClose) => {
          server.close((err) => {
            if (err) rejectClose(err);
            else resolveClose();
          });
        });
      };

      resolve({ baseUrl, close, server });
    });

    server.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// HTTP client helpers
// ---------------------------------------------------------------------------

/**
 * Effectue une requete GET.
 * @param {string} url - URL complete
 * @param {Object} headers - En-tetes HTTP optionnels
 * @returns {Promise<{status: number, headers: Object, body: string, json: Function}>}
 */
export async function httpGet(url, headers = {}) {
  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  const body = await response.text();

  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body,
    json() {
      return JSON.parse(body);
    },
  };
}

/**
 * Effectue une requete POST avec un body JSON.
 * @param {string} url - URL complete
 * @param {*} body - Corps de la requete (sera serialise en JSON)
 * @param {Object} headers - En-tetes HTTP optionnels
 * @returns {Promise<{status: number, headers: Object, body: string, json: Function}>}
 */
export async function httpPost(url, body, headers = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });

  const responseBody = await response.text();

  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: responseBody,
    json() {
      return JSON.parse(responseBody);
    },
  };
}

/**
 * Effectue une requete PUT avec un body JSON.
 * @param {string} url - URL complete
 * @param {*} body - Corps de la requete (sera serialise en JSON)
 * @param {Object} headers - En-tetes HTTP optionnels
 * @returns {Promise<{status: number, headers: Object, body: string, json: Function}>}
 */
export async function httpPut(url, body, headers = {}) {
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });

  const responseBody = await response.text();

  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: responseBody,
    json() {
      return JSON.parse(responseBody);
    },
  };
}

/**
 * Effectue une requete PATCH avec un body JSON.
 * @param {string} url - URL complete
 * @param {*} body - Corps de la requete (sera serialise en JSON)
 * @param {Object} headers - En-tetes HTTP optionnels
 * @returns {Promise<{status: number, headers: Object, body: string, json: Function}>}
 */
export async function httpPatch(url, body, headers = {}) {
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });

  const responseBody = await response.text();

  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: responseBody,
    json() {
      return JSON.parse(responseBody);
    },
  };
}

/**
 * Effectue une requete DELETE.
 * @param {string} url - URL complete
 * @param {Object} headers - En-tetes HTTP optionnels
 * @returns {Promise<{status: number, headers: Object, body: string, json: Function}>}
 */
export async function httpDelete(url, headers = {}) {
  const response = await fetch(url, {
    method: 'DELETE',
    headers,
  });

  const body = await response.text();

  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body,
    json() {
      return JSON.parse(body);
    },
  };
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/**
 * Attend un nombre de millisecondes donne.
 * @param {number} ms - Duree en millisecondes
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mesure le temps d'execution d'une fonction asynchrone.
 * @param {Function} fn - Fonction a mesurer
 * @returns {Promise<{result: *, duration: number}>} Resultat et duree en ms
 */
export async function measure(fn) {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
}
