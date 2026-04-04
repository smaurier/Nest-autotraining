// =============================================================================
// Lab 07 — Validation et Gestion d'Erreurs (Solution)
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

function validate(
  schema: ZodSchema,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      res.status(400).json({ error: "Validation failed", details });
      return;
    }
    req.body = result.data;
    next();
  };
}

// =============================================================================
// SOLUTION 3 : AppError
// =============================================================================

class AppError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
  }
}

// =============================================================================
// SOLUTION 4 : NotFoundError et ValidationError
// =============================================================================

class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(message, 404);
  }
}

class ValidationError extends AppError {
  constructor(message: string = "Validation failed") {
    super(message, 400);
  }
}

let jsonParseAttempts = 0;

function safeJsonParse<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new ValidationError("Invalid JSON payload");
  } finally {
    jsonParseAttempts++;
  }
}

// =============================================================================
// SOLUTION 5 : asyncHandler(fn)
// =============================================================================

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// =============================================================================
// SOLUTION 6 : errorHandler
// =============================================================================

function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: "Internal Server Error" });
}

// =============================================================================
// SOLUTION 7 : API
// =============================================================================

const app = express();
app.use(express.json());

// GET /users
app.get(
  "/users",
  asyncHandler(async (req: Request, res: Response) => {
    res.json(users);
  }),
);

// GET /users/:id
app.get(
  "/users/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const user = users.find((u) => u.id === id);
    if (!user) {
      throw new NotFoundError("User not found");
    }
    res.json(user);
  }),
);

// POST /users
app.post(
  "/users",
  validate(UserSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { name, email, age } = req.body as {
      name: string;
      email: string;
      age?: number;
    };
    const newUser: User = { id: nextId++, name, email };
    if (age !== undefined) newUser.age = age;
    users.push(newUser);
    res.status(201).json(newUser);
  }),
);

// PUT /users/:id
app.put(
  "/users/:id",
  validate(UserSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const index = users.findIndex((u) => u.id === id);
    if (index === -1) {
      throw new NotFoundError("User not found");
    }
    const { name, email, age } = req.body as {
      name: string;
      email: string;
      age?: number;
    };
    users[index] = { id, name, email };
    if (age !== undefined) users[index].age = age;
    res.json(users[index]);
  }),
);

// Middleware d'erreur centralise
app.use(errorHandler);

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
