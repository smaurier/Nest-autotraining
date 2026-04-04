// =============================================================================
// test-utils.ts — Utilitaires partages pour les labs Node.js/Express (labs 01-08)
// =============================================================================

import http, { type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TestError {
  name: string;
  error: Error;
}

interface TestRunner {
  test: (name: string, fn: () => Promise<void>) => Promise<void>;
  assert: (condition: unknown, message?: string) => void;
  assertEqual: (actual: unknown, expected: unknown, message?: string) => void;
  assertIncludes: (
    str: string | unknown[],
    substr: unknown,
    message?: string,
  ) => void;
  assertGreaterThan: (
    actual: number,
    expected: number,
    message?: string,
  ) => void;
  assertLessThan: (actual: number, expected: number, message?: string) => void;
  summary: () => { passed: number; failed: number; total: number };
}

interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  json: () => unknown;
}

type RequestHandler = (req: IncomingMessage, res: ServerResponse) => void;

interface ServerHandle {
  baseUrl: string;
  close: () => Promise<void>;
  server: http.Server;
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------
export function createTestRunner(labName: string): TestRunner {
  let passed = 0;
  let failed = 0;
  const errors: TestError[] = [];

  async function test(name: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
      passed++;
      console.log(`  \u2705 ${name}`);
    } catch (err) {
      failed++;
      errors.push({ name, error: err as Error });
      console.log(`  \u274C ${name}`);
      console.log(`     \u2192 ${(err as Error).message}`);
    }
  }

  function assert(condition: unknown, message?: string): void {
    if (!condition) throw new Error(message || "Assertion failed");
  }

  function assertEqual(
    actual: unknown,
    expected: unknown,
    message?: string,
  ): void {
    if (actual !== expected) {
      throw new Error(
        message ||
          `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
      );
    }
  }

  function assertIncludes(
    str: string | unknown[],
    substr: unknown,
    message?: string,
  ): void {
    if (typeof str === "string" && !str.includes(substr as string)) {
      throw new Error(message || `Expected string to include "${substr}"`);
    }
    if (Array.isArray(str) && !str.includes(substr)) {
      throw new Error(
        message || `Expected array to include ${JSON.stringify(substr)}`,
      );
    }
  }

  function assertGreaterThan(
    actual: number,
    expected: number,
    message?: string,
  ): void {
    if (!(actual > expected)) {
      throw new Error(message || `Expected ${actual} > ${expected}`);
    }
  }

  function assertLessThan(
    actual: number,
    expected: number,
    message?: string,
  ): void {
    if (!(actual < expected)) {
      throw new Error(message || `Expected ${actual} < ${expected}`);
    }
  }

  function summary(): { passed: number; failed: number; total: number } {
    const total = passed + failed;
    console.log(`\n${"─".repeat(50)}`);
    console.log(
      `\uD83D\uDCCA ${labName} — R\u00e9sultats : ${passed}/${total} tests r\u00e9ussis`,
    );
    if (failed > 0) {
      console.log(`\n\u274C ${failed} test(s) \u00e9chou\u00e9(s) :`);
      errors.forEach(({ name, error }) => {
        console.log(`   \u2022 ${name} : ${error.message}`);
      });
    } else {
      console.log(`\n\uD83C\uDF89 Tous les tests passent !`);
    }
    console.log(`${"─".repeat(50)}\n`);
    return { passed, failed, total };
  }

  return {
    test,
    assert,
    assertEqual,
    assertIncludes,
    assertGreaterThan,
    assertLessThan,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Server helpers
// ---------------------------------------------------------------------------

/**
 * Demarre un serveur HTTP a partir d'un handler ou d'une app Express.
 * Si handler est une fonction avec (req, res) signature, utilise http.createServer.
 * Si handler est une app Express (avec .listen), utilise app.listen.
 * Utilise le port 0 pour obtenir un port aleatoire disponible.
 */
export async function startServer(
  handler:
    | RequestHandler
    | (RequestHandler & { listen: (...args: unknown[]) => unknown }),
  port: number = 0,
): Promise<ServerHandle> {
  return new Promise((resolve, reject) => {
    let server: http.Server;

    if (
      typeof handler === "function" &&
      handler.length <= 2 &&
      !("listen" in handler)
    ) {
      server = http.createServer(handler);
    } else if (
      handler &&
      typeof (handler as { listen: (...args: unknown[]) => unknown }).listen ===
        "function"
    ) {
      const startedServer = (
        handler as {
          listen: (port: number, host: string, callback: () => void) => unknown;
        }
      ).listen(port, "127.0.0.1", () => {
        const address = server.address() as AddressInfo;
        const assignedPort = address.port;
        const baseUrl = `http://127.0.0.1:${assignedPort}`;

        const close = (): Promise<void> => {
          return new Promise((resolveClose, rejectClose) => {
            server.close((err) => {
              if (err) rejectClose(err);
              else resolveClose();
            });
          });
        };

        resolve({ baseUrl, close, server });
      });
      server = startedServer as http.Server;
      server.on("error", reject);
      return;
    } else {
      server = http.createServer(handler);
    }

    server.listen(port, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      const assignedPort = address.port;
      const baseUrl = `http://127.0.0.1:${assignedPort}`;

      const close = (): Promise<void> => {
        return new Promise((resolveClose, rejectClose) => {
          server.close((err) => {
            if (err) rejectClose(err);
            else resolveClose();
          });
        });
      };

      resolve({ baseUrl, close, server });
    });

    server.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// HTTP client helpers
// ---------------------------------------------------------------------------

/**
 * Effectue une requete GET.
 */
export async function httpGet(
  url: string,
  headers: Record<string, string> = {},
): Promise<HttpResponse> {
  const response = await fetch(url, {
    method: "GET",
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
 */
export async function httpPost(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<HttpResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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
 */
export async function httpPut(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<HttpResponse> {
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
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
 */
export async function httpPatch(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<HttpResponse> {
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
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
 */
export async function httpDelete(
  url: string,
  headers: Record<string, string> = {},
): Promise<HttpResponse> {
  const response = await fetch(url, {
    method: "DELETE",
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
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mesure le temps d'execution d'une fonction asynchrone.
 */
export async function measure<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
}
