// =============================================================================
// Lab 08 — Authentification JWT (Solution)
// =============================================================================
// Objectifs :
//   - Hacher les mots de passe avec bcrypt
//   - Generer et verifier des tokens JWT
//   - Proteger des routes avec un middleware d'auth
//   - Implementer un systeme de roles
// =============================================================================

import express, { type Request, type Response, type NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createTestRunner, startServer, httpGet, httpPost } from '../test-utils.ts';

const { test, assert, assertEqual, assertIncludes, summary } = createTestRunner('Lab 08 — Auth JWT');

// =============================================================================
// Configuration
// =============================================================================

const JWT_SECRET = 'super-secret-key-for-lab-08';
const JWT_EXPIRES_IN = '1h';

// =============================================================================
// Base de donnees en memoire
// =============================================================================

interface UserDb {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
}

interface JwtPayload {
  userId: number;
  role: string;
}

let usersDb: UserDb[] = [];
let nextId = 1;

function resetDb(): void {
  usersDb = [];
  nextId = 1;
}

// =============================================================================
// SOLUTION 3 : authMiddleware
// =============================================================================

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.slice(7); // Apres 'Bearer '
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    (req as Request & { user: JwtPayload }).user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// =============================================================================
// SOLUTION 6 : rolesMiddleware(...roles)
// =============================================================================

function rolesMiddleware(...roles: string[]): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as Request & { user?: JwtPayload }).user;
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}

// =============================================================================
// SOLUTION : Fonctions utilitaires
// =============================================================================

function sanitizeUser(user: UserDb): Omit<UserDb, 'passwordHash'> {
  const { passwordHash, ...safe } = user;
  return safe;
}

// =============================================================================
// SOLUTION : Application Express
// =============================================================================

const app = express();
app.use(express.json());

// SOLUTION 1 : POST /register
app.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password, role = 'user' } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
    };

    if (!name || !email || !password) {
      res.status(400).json({ error: 'name, email, and password are required' });
      return;
    }

    // Verifier l'unicite de l'email
    if (usersDb.find(u => u.email === email)) {
      res.status(409).json({ error: 'Email already exists' });
      return;
    }

    // Hacher le mot de passe
    const passwordHash = await bcrypt.hash(password, 10);

    // Creer l'utilisateur
    const user: UserDb = { id: nextId++, name, email, passwordHash, role };
    usersDb.push(user);

    res.status(201).json(sanitizeUser(user));
  } catch {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// SOLUTION 2 : POST /login
app.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    // Chercher l'utilisateur
    const user = usersDb.find(u => u.email === email);
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Verifier le mot de passe
    const match = await bcrypt.compare(password!, user.passwordHash);
    if (!match) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Generer le JWT
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// SOLUTION 4 : GET /profile
app.get('/profile', authMiddleware, (req: Request, res: Response) => {
  const { userId } = (req as Request & { user: JwtPayload }).user;
  const user = usersDb.find(u => u.id === userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(sanitizeUser(user));
});

// SOLUTION 5 : POST /refresh
app.post('/refresh', authMiddleware, (req: Request, res: Response) => {
  const { userId, role } = (req as Request & { user: JwtPayload }).user;
  const token = jwt.sign(
    { userId, role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
  res.json({ token });
});

// SOLUTION 7 : GET /admin/users
app.get('/admin/users', authMiddleware, rolesMiddleware('admin'), (req: Request, res: Response) => {
  const safeUsers = usersDb.map(sanitizeUser);
  res.json(safeUsers);
});

// =============================================================================
// TESTS
// =============================================================================

console.log('\n\uD83E\uDDEA Lab 08 — Authentification JWT\n');

const { baseUrl, close } = await startServer(app);

try {
  resetDb();

  let userToken = '';
  let adminToken = '';

  // -- Test 1 : Register -- succes ------------------------------------------
  await test('POST /register cree un utilisateur', async () => {
    const res = await httpPost(`${baseUrl}/register`, {
      name: 'Alice',
      email: 'alice@example.com',
      password: 'password123',
    });
    assertEqual(res.status, 201, 'Status 201');
    const data = res.json() as Record<string, unknown>;
    assertEqual(data.name, 'Alice', 'Nom correct');
    assertEqual(data.email, 'alice@example.com', 'Email correct');
    assertEqual(data.role, 'user', 'Role par defaut: user');
    assert(!data.passwordHash, 'Le hash ne doit pas etre retourne');
    assert(!data.password, 'Le mot de passe ne doit pas etre retourne');
  });

  // -- Test 2 : Register -- admin -------------------------------------------
  await test('POST /register cree un admin', async () => {
    const res = await httpPost(`${baseUrl}/register`, {
      name: 'Admin',
      email: 'admin@example.com',
      password: 'admin123',
      role: 'admin',
    });
    assertEqual(res.status, 201, 'Status 201');
    assertEqual((res.json() as Record<string, unknown>).role, 'admin', 'Role admin');
  });

  // -- Test 3 : Register -- email duplique ----------------------------------
  await test('POST /register rejette un email duplique', async () => {
    const res = await httpPost(`${baseUrl}/register`, {
      name: 'Alice2',
      email: 'alice@example.com',
      password: 'other',
    });
    assertEqual(res.status, 409, 'Status 409 Conflict');
  });

  // -- Test 4 : Login -- succes ---------------------------------------------
  await test('POST /login retourne un token JWT', async () => {
    const res = await httpPost(`${baseUrl}/login`, {
      email: 'alice@example.com',
      password: 'password123',
    });
    assertEqual(res.status, 200, 'Status 200');
    const data = res.json() as { token: string; user: { name: string; role: string } };
    assert(data.token, 'Token present');
    assertEqual(data.user.name, 'Alice', 'Nom correct');
    assertEqual(data.user.role, 'user', 'Role correct');
    userToken = data.token;
  });

  // -- Test 5 : Login admin -------------------------------------------------
  await test('POST /login admin retourne un token', async () => {
    const res = await httpPost(`${baseUrl}/login`, {
      email: 'admin@example.com',
      password: 'admin123',
    });
    assertEqual(res.status, 200, 'Status 200');
    adminToken = (res.json() as { token: string }).token;
    assert(adminToken, 'Token admin present');
  });

  // -- Test 6 : Login -- echec ----------------------------------------------
  await test('POST /login rejette un mauvais mot de passe', async () => {
    const res = await httpPost(`${baseUrl}/login`, {
      email: 'alice@example.com',
      password: 'wrong',
    });
    assertEqual(res.status, 401, 'Status 401');
    assertEqual((res.json() as { error: string }).error, 'Invalid credentials', 'Message correct');
  });

  // -- Test 7 : Profile -- avec token ---------------------------------------
  await test('GET /profile retourne le profil avec un token valide', async () => {
    const res = await httpGet(`${baseUrl}/profile`, {
      'Authorization': `Bearer ${userToken}`,
    });
    assertEqual(res.status, 200, 'Status 200');
    const data = res.json() as Record<string, unknown>;
    assertEqual(data.name, 'Alice', 'Nom correct');
    assertEqual(data.email, 'alice@example.com', 'Email correct');
    assert(!data.passwordHash, 'Pas de hash dans la reponse');
  });

  // -- Test 8 : Profile -- sans token ---------------------------------------
  await test('GET /profile retourne 401 sans token', async () => {
    const res = await httpGet(`${baseUrl}/profile`);
    assertEqual(res.status, 401, 'Status 401');
    assertEqual((res.json() as { error: string }).error, 'Unauthorized', 'Message Unauthorized');
  });

  // -- Test 9 : Admin route -- admin OK -------------------------------------
  await test('GET /admin/users accessible aux admins', async () => {
    const res = await httpGet(`${baseUrl}/admin/users`, {
      'Authorization': `Bearer ${adminToken}`,
    });
    assertEqual(res.status, 200, 'Status 200');
    const data = res.json() as Record<string, unknown>[];
    assert(Array.isArray(data), 'Retourne un tableau');
    assertEqual(data.length, 2, '2 utilisateurs');
    assert(data.every(u => !u.passwordHash), 'Aucun hash dans les reponses');
  });

  // -- Test 10 : Admin route -- user interdit -------------------------------
  await test('GET /admin/users interdit aux users normaux', async () => {
    const res = await httpGet(`${baseUrl}/admin/users`, {
      'Authorization': `Bearer ${userToken}`,
    });
    assertEqual(res.status, 403, 'Status 403 Forbidden');
    assertEqual((res.json() as { error: string }).error, 'Forbidden', 'Message Forbidden');
  });

} finally {
  await close();
  summary();
}
