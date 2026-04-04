// =============================================================================
// Lab 07 — Validation et Gestion d'Erreurs (Exercice)
// =============================================================================
// Objectifs :
//   - Definir des schemas Zod
//   - Creer un middleware de validation generique
//   - Creer des classes d'erreur personnalisees
//   - Implementer asyncHandler et un middleware d'erreur centralise
// =============================================================================

import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { z, type ZodSchema } from "zod";
import {
  createTestRunner,
  startServer,
  httpGet,
  httpPost,
  httpPut,
} from "../test-utils.ts";

const { test, assert, assertEqual, assertIncludes, summary } = createTestRunner(
  "Lab 07 — Validation & Erreurs",
);

// =============================================================================
// Base de donnees en memoire
// =============================================================================

interface User {
  id: number;
  name: string;
  email: string;
  age?: number;
}

let users: User[] = [];
let nextId = 1;

function resetDb(): void {
  users = [
    { id: 1, name: "Alice", email: "alice@example.com", age: 30 },
    { id: 2, name: "Bob", email: "bob@example.com" },
  ];
  nextId = 3;
}

// =============================================================================
// TODO 1 : Definir le schema Zod UserSchema
// =============================================================================
// Schema de validation pour un utilisateur :
//   - name  : string, minimum 2 caracteres
//   - email : string au format email valide
//   - age   : number, entre 0 et 150, optionnel
//
// Utiliser z.object(), z.string(), z.number(), .min(), .max(), .email(), .optional()

// const UserSchema = z.object({ ... });

// TODO: Definir UserSchema

// =============================================================================
// TODO 2 : Creer le middleware validate(schema)
// =============================================================================
// Factory qui retourne un middleware Express.
// - Valider req.body avec schema.safeParse(req.body)
// - Si valide : remplacer req.body par result.data (donnees parsees/nettoyees) et appeler next()
// - Si invalide : repondre 400 avec { error: 'Validation failed', details: [...] }
//   ou details est un tableau de messages d'erreur extraits de result.error.errors
//
// Exemple de details :
//   [
//     { field: 'name', message: 'String must contain at least 2 character(s)' },
//     { field: 'email', message: 'Invalid email' }
//   ]

function validate(
  schema: ZodSchema,
): (req: Request, res: Response, next: NextFunction) => void {
  // TODO: Retourner un middleware de validation Zod
  throw new Error("TODO: implementer validate()");
}

// =============================================================================
// TODO 3 : Creer la classe AppError
// =============================================================================
// Classe d'erreur de base pour l'application.
// - Etend Error
// - Proprietes : message (string), statusCode (number)
// - Le constructeur prend (message, statusCode)

class AppError extends Error {
  public statusCode: number;

  // TODO: Implementer le constructeur
  constructor(message: string, statusCode: number) {
    throw new Error("TODO: implementer AppError");
  }
}

// =============================================================================
// TODO 4 : Creer NotFoundError et ValidationError
// =============================================================================
// NotFoundError :
//   - Etend AppError
//   - statusCode = 404
//   - Constructeur prend un message (defaut: 'Resource not found')
//
// ValidationError :
//   - Etend AppError
//   - statusCode = 400
//   - Constructeur prend un message (defaut: 'Validation failed')

class NotFoundError extends AppError {
  // TODO: Implementer
  constructor(message: string = "Resource not found") {
    throw new Error("TODO: implementer NotFoundError");
  }
}

class ValidationError extends AppError {
  // TODO: Implementer
  constructor(message: string = "Validation failed") {
    throw new Error("TODO: implementer ValidationError");
  }
}

// =============================================================================
// TODO 4 bis : Rappel JS — JSON.parse avec try/catch/finally
// =============================================================================

// JS-REPETITION: json,try_catch_finally
// safeJsonParse<T>(raw) doit :
// - dans le try : parser raw avec JSON.parse et retourner T
// - dans le catch : lancer ValidationError('Invalid JSON payload')
// - dans le finally : incrementer jsonParseAttempts

let jsonParseAttempts = 0;

function safeJsonParse<T>(raw: string): T {
  // TODO: Implementer avec try/catch/finally
  throw new Error("TODO: implementer safeJsonParse()");
}

// =============================================================================
// TODO 5 : Creer asyncHandler(fn)
// =============================================================================
// Wrapper pour les handlers async d'Express.
// - Prend une fonction async (req, res, next) => { ... }
// - Retourne une nouvelle fonction qui catch les erreurs et les passe a next()
//
// Ceci permet d'utiliser async/await dans les routes Express sans
// avoir a mettre un try/catch dans chaque handler.

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  // TODO: Retourner un wrapper qui catch les erreurs
  throw new Error("TODO: implementer asyncHandler()");
}

// =============================================================================
// TODO 6 : Creer le middleware errorHandler
// =============================================================================
// Middleware d'erreur centralise (4 arguments : err, req, res, next).
// - Si err est une instance de AppError : utiliser err.statusCode et err.message
// - Sinon : utiliser status 500 et message 'Internal Server Error'
// - Repondre avec { error: message }

function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // TODO: Gerer les erreurs de maniere centralisee
  throw new Error("TODO: implementer errorHandler()");
}

// =============================================================================
// TODO 7 : Construire l'API
// =============================================================================
// Routes :
//   GET    /users      -> liste tous les users
//   GET    /users/:id  -> un user par id (lancer NotFoundError si inexistant)
//   POST   /users      -> creer un user (avec validate(UserSchema))
//   PUT    /users/:id  -> modifier un user (avec validate(UserSchema))
//
// Utiliser asyncHandler() pour chaque route.
// Ajouter errorHandler en dernier middleware.

const app = express();
app.use(express.json());

// TODO: Implementer les routes

// TODO: Ajouter errorHandler
// app.use(errorHandler);

// =============================================================================
// TESTS
// =============================================================================

console.log("\n\uD83E\uDDEA Lab 07 — Validation et Gestion d'Erreurs\n");

const { baseUrl, close } = await startServer(app);

try {
  resetDb();

  await test("safeJsonParse parse un JSON valide", () => {
    jsonParseAttempts = 0;
    const parsed = safeJsonParse<{ ok: boolean; count: number }>(
      '{"ok":true,"count":2}',
    );
    assertEqual(parsed.ok, true, "ok parse");
    assertEqual(parsed.count, 2, "count parse");
    assertEqual(jsonParseAttempts, 1, "finally execute meme en succes");
  });

  await test("safeJsonParse transforme une erreur JSON en ValidationError", () => {
    jsonParseAttempts = 0;

    let error: unknown;
    try {
      safeJsonParse("{invalid json");
    } catch (err) {
      error = err;
    }

    assert(error instanceof ValidationError, "ValidationError attendue");
    assertIncludes(
      (error as Error).message,
      "Invalid JSON payload",
      "Message correct",
    );
    assertEqual(jsonParseAttempts, 1, "finally execute meme en echec");
  });

  // -- Test 1 : GET /users -------------------------------------------------
  await test("GET /users retourne la liste", async () => {
    const res = await httpGet(`${baseUrl}/users`);
    assertEqual(res.status, 200, "Status 200");
    assertEqual((res.json() as User[]).length, 2, "2 utilisateurs");
  });

  // -- Test 2 : GET /users/:id ---------------------------------------------
  await test("GET /users/:id retourne un utilisateur", async () => {
    const res = await httpGet(`${baseUrl}/users/1`);
    assertEqual(res.status, 200, "Status 200");
    assertEqual((res.json() as User).name, "Alice", "Alice trouvee");
  });

  // -- Test 3 : GET /users/:id -- 404 --------------------------------------
  await test("GET /users/:id retourne 404 via NotFoundError", async () => {
    const res = await httpGet(`${baseUrl}/users/999`);
    assertEqual(res.status, 404, "Status 404");
    assertIncludes(
      (res.json() as { error: string }).error,
      "not found",
      'Message contient "not found"',
    );
  });

  // -- Test 4 : POST /users -- valide --------------------------------------
  await test("POST /users cree un utilisateur valide", async () => {
    const res = await httpPost(`${baseUrl}/users`, {
      name: "Charlie",
      email: "charlie@example.com",
      age: 25,
    });
    assertEqual(res.status, 201, "Status 201");
    assertEqual((res.json() as User).name, "Charlie", "Nom correct");
    assertEqual((res.json() as User).age, 25, "Age correct");
  });

  // -- Test 5 : POST /users -- nom trop court ------------------------------
  await test("POST /users rejette un nom trop court", async () => {
    const res = await httpPost(`${baseUrl}/users`, {
      name: "A",
      email: "a@example.com",
    });
    assertEqual(res.status, 400, "Status 400");
    const data = res.json() as {
      error: string;
      details: { field: string; message: string }[];
    };
    assertEqual(data.error, "Validation failed", "Erreur de validation");
    assert(data.details, "Details presents");
    assert(data.details.length > 0, "Au moins 1 detail");
  });

  // -- Test 6 : POST /users -- email invalide ------------------------------
  await test("POST /users rejette un email invalide", async () => {
    const res = await httpPost(`${baseUrl}/users`, {
      name: "Charlie",
      email: "not-an-email",
    });
    assertEqual(res.status, 400, "Status 400");
    const data = res.json() as {
      details: { field: string; message: string }[];
    };
    assert(
      data.details.some((d) => d.field === "email"),
      "Detail pour le champ email",
    );
  });

  // -- Test 7 : POST /users -- age invalide --------------------------------
  await test("POST /users rejette un age negatif", async () => {
    const res = await httpPost(`${baseUrl}/users`, {
      name: "Charlie",
      email: "charlie@example.com",
      age: -5,
    });
    assertEqual(res.status, 400, "Status 400");
  });

  // -- Test 8 : PUT /users/:id -- mise a jour ------------------------------
  await test("PUT /users/:id met a jour avec validation", async () => {
    const res = await httpPut(`${baseUrl}/users/1`, {
      name: "Alice Updated",
      email: "alice.new@example.com",
      age: 31,
    });
    assertEqual(res.status, 200, "Status 200");
    assertEqual((res.json() as User).name, "Alice Updated", "Nom mis a jour");
    assertEqual((res.json() as User).age, 31, "Age mis a jour");

    // Verification avec GET
    const check = await httpGet(`${baseUrl}/users/1`);
    assertEqual(
      (check.json() as User).name,
      "Alice Updated",
      "Modification persistee",
    );
  });
} finally {
  await close();
  summary();
}
