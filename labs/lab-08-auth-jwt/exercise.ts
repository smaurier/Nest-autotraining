// =============================================================================
// Lab 08 — Authentification JWT (Exercice)
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
// TODO 1 : Implementer POST /register
// =============================================================================
// Route d'inscription :
//   1. Lire name, email, password et role (defaut: 'user') depuis req.body
//   2. Verifier que name, email et password sont presents -> sinon 400
//   3. Verifier que l'email n'est pas deja utilise -> sinon 409 (Conflict)
//   4. Hacher le mot de passe avec bcrypt (salt rounds = 10)
//   5. Stocker l'utilisateur dans usersDb avec : id, name, email, passwordHash, role
//   6. Retourner 201 avec { id, name, email, role } (SANS le hash du mot de passe)

// =============================================================================
// TODO 2 : Implementer POST /login
// =============================================================================
// Route de connexion :
//   1. Lire email et password depuis req.body
//   2. Chercher l'utilisateur par email -> sinon 401 { error: 'Invalid credentials' }
//   3. Comparer le mot de passe avec bcrypt.compare -> sinon 401
//   4. Generer un JWT avec jwt.sign() contenant { userId: user.id, role: user.role }
//      Utiliser JWT_SECRET et { expiresIn: JWT_EXPIRES_IN }
//   5. Retourner 200 avec { token, user: { id, name, email, role } }

// =============================================================================
// TODO 3 : Creer authMiddleware
// =============================================================================
// Middleware qui verifie le JWT :
//   1. Lire le header Authorization
//   2. Verifier qu'il commence par 'Bearer '
//   3. Extraire le token (tout apres 'Bearer ')
//   4. Verifier le token avec jwt.verify(token, JWT_SECRET)
//   5. Si valide : stocker le payload dans req.user et appeler next()
//   6. Si invalide/absent : repondre 401 { error: 'Unauthorized' }

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // TODO: Verifier le JWT
  throw new Error('TODO: implementer authMiddleware()');
}

// =============================================================================
// TODO 4 : Implementer GET /profile
// =============================================================================
// Route protegee (utiliser authMiddleware) :
//   1. Recuperer req.user.userId (mis par authMiddleware)
//   2. Chercher l'utilisateur dans usersDb
//   3. Retourner { id, name, email, role } (sans passwordHash)
//   4. Si l'utilisateur n'existe pas : 404

// =============================================================================
// TODO 5 : Implementer POST /refresh
// =============================================================================
// Route protegee pour rafraichir un token :
//   1. Utiliser authMiddleware pour verifier le token actuel
//   2. Generer un nouveau token avec les memes donnees (userId, role)
//   3. Retourner { token } avec le nouveau token

// =============================================================================
// TODO 6 : Creer rolesMiddleware(...roles)
// =============================================================================
// Factory de middleware qui verifie le role de l'utilisateur.
// - Prend un ou plusieurs roles autorises en parametre
// - Verifie que req.user.role est dans la liste des roles autorises
// - Si autorise : appeler next()
// - Si non autorise : repondre 403 { error: 'Forbidden' }
//
// Ce middleware doit etre utilise APRES authMiddleware.
//
// Exemple :
//   app.get('/admin', authMiddleware, rolesMiddleware('admin'), handler);

function rolesMiddleware(...roles: string[]): (req: Request, res: Response, next: NextFunction) => void {
  // TODO: Retourner un middleware de verification de role
  throw new Error('TODO: implementer rolesMiddleware()');
}

// =============================================================================
// TODO 7 : Implementer GET /admin/users
// =============================================================================
// Route admin-only (protegee par authMiddleware + rolesMiddleware('admin')) :
//   - Retourne la liste de tous les utilisateurs (sans passwordHash)
//   - Chaque user : { id, name, email, role }

// =============================================================================
// Assembler l'application
// =============================================================================

const app = express();
app.use(express.json());

// TODO: Monter toutes les routes ici
// app.post('/register', ...);
// app.post('/login', ...);
// app.get('/profile', authMiddleware, ...);
// app.post('/refresh', authMiddleware, ...);
// app.get('/admin/users', authMiddleware, rolesMiddleware('admin'), ...);

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
