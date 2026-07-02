# Lab 08 — Authentification JWT avec cookie httpOnly

> **Outcome :** à la fin, tu sais écrire un flux register/login/logout avec bcrypt + JWT stocké en cookie httpOnly, et protéger des routes Express avec un middleware JWT.
> **Vrai outil :** Express 5, jsonwebtoken ^9, bcrypt ^5, cookie-parser.
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

Construis l'API d'authentification de TribuZen : un parent s'inscrit, se connecte, et peut accéder aux routes de sa famille. Le token JWT est stocké dans un cookie `httpOnly` — **pas dans `localStorage`**. Aucun mot de passe ne transite ou n'est stocké en clair.

**Starter :**

```bash
cd 09-nestjs/labs/lab-08-auth-jwt
npm install bcrypt @types/bcrypt jsonwebtoken @types/jsonwebtoken express@^5 @types/express cookie-parser @types/cookie-parser helmet express-rate-limit
```

Crée `src/index.ts` from scratch — aucun fichier de départ à compléter.

**Endpoints à implémenter :**

```
POST /auth/register   → valider email + password, hacher bcrypt, émettre JWT en cookie httpOnly
POST /auth/login      → vérifier le mot de passe, émettre JWT en cookie httpOnly
POST /auth/logout     → clearCookie
GET  /profile         → route protégée — retourne req.user
GET  /familles/:id    → route protégée owner/admin — retourne familleId + demandeur
GET  /health          → 200 { status: 'ok' } — vérification de démarrage
```

## Étapes (en friction)

1. Initialise l'app Express avec `helmet()`, `cors({ credentials: true })`, `express.json()`, `cookieParser()` dans le bon ordre. Démarre sur le port 3000. Vérifie `GET /health` → 200 avec `curl http://localhost:3000/health`.

2. Définis le store en mémoire (`users: User[]`) avec l'interface `User { id, email, passwordHash, role }`. Calcule `DUMMY_HASH = await bcrypt.hash('__dummy__', 12)` une seule fois au démarrage.

3. Implémente `POST /auth/register` : valider `email` (string) et `password` (string, ≥ 8 chars), normaliser l'email (lowercase + trim), hacher avec `bcrypt.hash(password, 12)`, stocker uniquement le hash, émettre un JWT avec `expiresIn: '15m'`, le placer dans un cookie `httpOnly; secure; sameSite: strict`.

4. Implémente `POST /auth/login` : trouver l'utilisateur par email, appeler `bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH)` pour une durée constante, retourner `"Email ou mot de passe incorrect"` dans les deux cas d'échec (email absent ET mauvais password), émettre le cookie si succès.

5. Implémente le middleware `authenticate` : lire `req.cookies['access_token']`, appeler `jwt.verify()`, gérer `TokenExpiredError` (401 + "Token expiré") distinct de `JsonWebTokenError` (401 + "Token invalide"), attacher `req.user` si valide puis `next()`.

6. Implémente `GET /profile` avec `authenticate`. Teste avec `curl` : sans cookie → 401, avec cookie valide → 200. Teste `POST /auth/logout` puis `GET /profile` → 401.

7. Implémente le middleware `authorize(...roles)` puis `GET /familles/:id` avec `authenticate + authorize('owner', 'admin')`. Vérifie qu'un rôle `guest` reçoit 403.

## Corrigé complet commenté

```ts
// src/index.ts
import express, { Request, Response, NextFunction } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'

// ── Sécurité de démarrage ────────────────────────────────────────────────────
// Le serveur ne doit PAS démarrer sans JWT_SECRET — pas de fallback silencieux
const JWT_SECRET = process.env.JWT_SECRET
  ?? (() => { throw new Error('JWT_SECRET manquant — définir dans .env') })()

const SALT_ROUNDS = 12

// Hash factice pré-calculé UNE FOIS au démarrage (top-level await avec "type":"module")
// Même coût CPU (~100ms) que les vrais hashes — efface la différence de timing
// sans ça : email inconnu → retour en < 1ms → l'attaquant sait quels emails sont inscrits
const DUMMY_HASH = await bcrypt.hash('__tribuzen_dummy__', SALT_ROUNDS)

// ── Store en mémoire ──────────────────────────────────────────────────────────
interface User {
  id: string
  email: string
  passwordHash: string   // jamais le mot de passe en clair — colonne 'password' n'existe pas
  role: 'owner' | 'member' | 'guest'
}
const users: User[] = []

// ── Extension des types Express ───────────────────────────────────────────────
declare global {
  namespace Express {
    interface Request {
      user?: { userId: string; role: string }
    }
  }
}

// ── Application ───────────────────────────────────────────────────────────────
const app = express()

// 1. helmet EN PREMIER — en-têtes de sécurité sur TOUTES les réponses (y compris 4xx/5xx)
app.use(helmet())

// 2. CORS — credentials: true OBLIGATOIRE pour que les cookies httpOnly soient envoyés
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 'https://tribuzen.app' : 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type'],
}))

// 3. Rate limiting global — 100 req / 15 min par IP
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 }))

// 4. Parsers — express.json() avant les routes, cookieParser() pour lire req.cookies
app.use(express.json())
app.use(cookieParser())

// ── Limiteur strict pour /auth — 5 tentatives / 15 min (brute-force protection) ──
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5 })

// ── Helper : placer le token dans un cookie httpOnly ──────────────────────────
function setAuthCookie(res: Response, token: string): void {
  res.cookie('access_token', token, {
    httpOnly: true,   // inaccessible via document.cookie → le XSS ne peut pas voler le token
    secure: process.env.NODE_ENV === 'production',   // HTTPS uniquement en production
    sameSite: 'strict',   // bloque l'envoi cross-site → protège du CSRF
    maxAge: 15 * 60 * 1000,   // 15 minutes en ms
    path: '/',
  })
}

// ── Middleware authenticate ───────────────────────────────────────────────────
function authenticate(req: Request, res: Response, next: NextFunction): void {
  // Le cookie est envoyé automatiquement par le navigateur — pas d'header Authorization
  const token = req.cookies['access_token']

  if (!token) {
    res.status(401).json({ error: 'Authentification requise' })
    return
  }

  try {
    // jwt.verify() valide la signature HS256 ET le claim exp simultanément
    // { algorithms: ['HS256'] } restreint l'algo accepté — défense en profondeur
    // contre l'attaque "alg confusion" (ex. passage en RS256 ou injection alg:none)
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload
    req.user = { userId: payload['userId'] as string, role: payload['role'] as string }
    next()
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      // Access token expiré → le client doit appeler POST /auth/refresh
      res.status(401).json({ error: 'Token expiré — rafraîchir la session' })
      return
    }
    // JsonWebTokenError : signature invalide, token malformé, algorithme non supporté
    // Ne pas détailler la cause — ne pas aider un attaquant à forger un token valide
    res.status(401).json({ error: 'Token invalide' })
  }
}

// ── Middleware authorize ──────────────────────────────────────────────────────
function authorize(...roles: string[]) {
  // Retourne un middleware — TOUJOURS appelé après authenticate (req.user garanti)
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      // 403 Forbidden = authentifié mais PAS autorisé (distinct du 401 non authentifié)
      res.status(403).json({ error: 'Droits insuffisants' })
      return
    }
    next()
  }
}

// ── POST /auth/register ───────────────────────────────────────────────────────
app.post('/auth/register', authLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'email et password requis (string)' })
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'password doit faire au moins 8 caractères' })
  }

  const normalizedEmail = email.toLowerCase().trim()

  if (users.find(u => u.email === normalizedEmail)) {
    // Message vague — ne pas confirmer que l'email est déjà pris
    return res.status(409).json({ error: 'Impossible de créer ce compte' })
  }

  // bcrypt.hash() génère et intègre le salt — jamais stocker 'password' tel quel
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

  const user: User = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    passwordHash,   // seul le hash est persisté en base
    role: 'owner',
  }
  users.push(user)

  const accessToken = jwt.sign(
    { userId: user.id, role: user.role },   // payload minimal — pas de passwordHash ici
    JWT_SECRET,
    { expiresIn: '15m', algorithm: 'HS256' }
  )

  setAuthCookie(res, accessToken)   // token dans le cookie httpOnly, pas dans le body

  // Réponse sans passwordHash ni token JWT
  res.status(201).json({ user: { id: user.id, email: user.email, role: user.role } })
})

// ── POST /auth/login ──────────────────────────────────────────────────────────
app.post('/auth/login', authLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'email et password requis' })
  }

  const user = users.find(u => u.email === email.toLowerCase().trim())

  // bcrypt.compare() est toujours appelé — même si l'utilisateur n'existe pas (DUMMY_HASH)
  // → durée constante ~100ms qu'il existe ou non → timing attack impossible
  const isMatch = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH)

  if (!user || !isMatch) {
    // Message IDENTIQUE pour "email absent" et "mauvais password" — anti user-enumeration (OWASP A07)
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' })
  }

  const accessToken = jwt.sign(
    { userId: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: '15m', algorithm: 'HS256' }
  )

  setAuthCookie(res, accessToken)
  res.json({ user: { id: user.id, email: user.email, role: user.role } })
})

// ── POST /auth/logout ─────────────────────────────────────────────────────────
app.post('/auth/logout', (_req: Request, res: Response) => {
  // Mêmes attributs que lors de la création — sinon le navigateur ignore clearCookie
  res.clearCookie('access_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  })
  res.json({ message: 'Déconnecté' })
})

// ── GET /profile — route protégée ────────────────────────────────────────────
app.get('/profile', authenticate, (req: Request, res: Response) => {
  // req.user est garanti non-null ici — authenticate appelle next() seulement si valide
  res.json({ user: req.user })
})

// ── GET /familles/:id — protégée + autorisation par rôle ─────────────────────
app.get(
  '/familles/:id',
  authenticate,
  authorize('owner', 'admin'),   // guest → 403 Forbidden
  (req: Request, res: Response) => {
    res.json({ familleId: req.params.id, demandeur: req.user })
  }
)

// ── GET /health ───────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.listen(3000, () => console.log('API TribuZen auth sur http://localhost:3000'))
```

## Variante J+30 (fading)

Même système d'auth, en 25 minutes, sans regarder le corrigé, avec les contraintes suivantes :

1. Implémenter register + login + `GET /profile` protégée.
2. Ajouter un **refresh token** : `POST /auth/refresh` lit le refresh token depuis un cookie séparé (`refresh_token; Path=/auth/refresh`), le vérifie avec un secret différent (`REFRESH_TOKEN_SECRET`), émet un nouvel access token.
3. La **rotation** est obligatoire : stocker le refresh token courant par user (ou un `Set` de tokens révoqués) — l'ancien doit être invalide après le premier refresh.
4. `POST /auth/logout` révoque également le refresh token (clearCookie + suppression du store).

## Application TribuZen

Dans `smaurier/tribuzen/apps/api/` :

- Extraire `authenticate` et `authorize` dans `src/middleware/` — réutilisés sur toutes les routes de l'API.
- La table `users` en mémoire devient `User` dans Prisma avec `password_hash TEXT NOT NULL`. La migration SQL ne crée pas de colonne `password`.
- La table `refresh_tokens(id, user_id, token_hash, expires_at, revoked_at)` remplace le `Set` en mémoire — révocation multi-device et audit de sessions actives.
- En production, `JWT_SECRET` et `REFRESH_TOKEN_SECRET` sont injectés via les secrets Railway / Docker — jamais dans un `.env` commité.
- `helmet()` et le CORS strict restent dans `index.ts` ; les limiteurs d'auth passent dans un middleware dédié monté sur le router `/auth`.
