# Module 08 — Express — Authentification & Securite

> **Objectif** : Implementer un systeme d'authentification complet avec bcrypt et JWT, gerer les roles et permissions, configurer les cookies securises, et appliquer les bonnes pratiques de securite (helmet, CORS, rate limiting).
>
> **Difficulte** : ⭐⭐⭐ (avance)

---

## 1. Authentification vs Autorisation

### 1.1 Definitions

| Concept | Question | Exemple |
|---|---|---|
| **Authentification** (AuthN) | "Qui es-tu ?" | Login avec email + mot de passe |
| **Autorisation** (AuthZ) | "As-tu le droit de faire ca ?" | Seuls les admins peuvent supprimer des utilisateurs |

> **Analogie** : L'authentification, c'est montrer ta carte d'identite a l'entree d'un immeuble. L'autorisation, c'est le badge qui te donne acces au 3e etage mais pas au 5e. Tu peux etre identifie sans avoir tous les droits.

```
  Client                          Serveur
    │                               │
    │  1. POST /auth/login          │
    │  { email, password }          │
    │──────────────────────────────▶│  ← Authentification
    │                               │  (verifier qui tu es)
    │  2. { token: "eyJhb..." }     │
    │◀──────────────────────────────│
    │                               │
    │  3. GET /api/admin/dashboard  │
    │  Authorization: Bearer eyJ... │
    │──────────────────────────────▶│  ← Autorisation
    │                               │  (verifier tes droits)
    │  4. 200 OK / 403 Forbidden    │
    │◀──────────────────────────────│
```

---

## 2. Hachage de mots de passe avec bcrypt

### 2.1 Pourquoi hacher

**JAMAIS** stocker les mots de passe en clair. Si ta base de donnees est compromise, tous les mots de passe sont exposes.

| Methode | Securite | Explication |
|---|---|---|
| En clair | Catastrophique | Un vol de BDD = tous les mots de passe |
| MD5/SHA256 | Faible | Vulnerable aux rainbow tables et au brute force |
| bcrypt | Forte | Lent par design, salt integre, resistant au GPU |
| argon2 | Tres forte | Le plus moderne, vainqueur du PHC |

### 2.2 Comment fonctionne bcrypt

```
  Mot de passe     Salt              Hash bcrypt
  "MyP@ss123"  + "abc123xyz"  →  "$2b$10$K4YjdG7..."
                                      │  │
                                      │  └─ Cost factor (10 rounds = 2^10 iterations)
                                      └─ Version de bcrypt
```

> **Analogie** : bcrypt c'est comme mettre ton mot de passe dans un mixeur industriel. Le salt (sel) rend chaque mixage unique — meme si deux personnes ont le meme mot de passe, le resultat est different. Le "cost factor" (10) c'est la puissance du mixeur — plus c'est eleve, plus c'est lent a casser.

### 2.3 Implementation avec bcrypt

```bash
npm install bcrypt
```

```javascript
import bcrypt from 'bcrypt';

// === Hacher un mot de passe ===
const SALT_ROUNDS = 10; // 10-12 est recommande (plus = plus lent = plus sur)

async function hashPassword(plainPassword) {
  const hash = await bcrypt.hash(plainPassword, SALT_ROUNDS);
  return hash;
  // '$2b$10$K4YjdG7WxKN6tIFhgXOcMeSGzD5Z9oJ3V2zzqH8jvPNJ7Q5YRXwGS'
}

// === Verifier un mot de passe ===
async function verifyPassword(plainPassword, hashedPassword) {
  const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
  return isMatch; // true ou false
}

// === Exemple ===
const hash = await hashPassword('MonMotDePasse123');
console.log(hash); // '$2b$10$...' (60 caracteres, different a chaque fois)

console.log(await verifyPassword('MonMotDePasse123', hash)); // true
console.log(await verifyPassword('MauvaisMotDePasse', hash)); // false
```

> **Piege classique** : Ne compare JAMAIS les hashes directement (`hash1 === hash2`). Utilise TOUJOURS `bcrypt.compare()`. A cause du salt aleatoire, le meme mot de passe produit un hash different a chaque fois.

---

## 3. JWT — JSON Web Tokens

### 3.1 Qu'est-ce qu'un JWT

Un **JWT** (prononce "jot") est un token d'authentification au format JSON, signe cryptographiquement. Il contient des informations (claims) sur l'utilisateur, lisibles sans base de donnees.

```
  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI0MiIsImVtYWlsIjoiYWxpY2VAZXhhbXBsZS5jb20iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3MDk4MjAwMDAsImV4cCI6MTcwOTgyMzYwMH0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
  └──────── Header ────────┘└──────────────────────── Payload ─────────────────────────┘└──────── Signature ──────┘
```

| Partie | Contenu | Encode en |
|---|---|---|
| **Header** | Algorithme (HS256) et type (JWT) | Base64url |
| **Payload** | Claims (userId, email, role, exp...) | Base64url |
| **Signature** | HMAC-SHA256(header + payload, secret) | Base64url |

### 3.2 Implementation avec jsonwebtoken

```bash
npm install jsonwebtoken
```

```javascript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'mon-secret-ultra-long-minimum-32-caracteres';
const JWT_EXPIRES_IN = '1h'; // Duree de validite

// === Creer un token ===
function generateToken(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'mon-api',         // Qui a cree le token
    audience: 'mon-frontend',   // A qui il est destine
  });
}

// === Verifier et decoder un token ===
function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
    // {
    //   userId: '42',
    //   email: 'alice@example.com',
    //   role: 'admin',
    //   iat: 1709820000,    ← Issued At (timestamp)
    //   exp: 1709823600,    ← Expiration (timestamp)
    //   iss: 'mon-api',
    //   aud: 'mon-frontend'
    // }
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new Error('Token expire');
    }
    if (err.name === 'JsonWebTokenError') {
      throw new Error('Token invalide');
    }
    throw err;
  }
}

// === Decoder sans verifier (pour debug) ===
const decoded = jwt.decode(token);
// Retourne le payload SANS verifier la signature
// ATTENTION : ne jamais faire confiance a un token non verifie !
```

> **Piege classique** : Le payload d'un JWT est encode en Base64, PAS chiffre. N'importe qui peut decoder et lire le contenu. Ne mets JAMAIS de donnees sensibles (mot de passe, numero de carte) dans un JWT. Le JWT garantit l'integrite (pas modifie) mais PAS la confidentialite.

---

## 4. Flux d'authentification complet

### 4.1 Register (inscription)

```javascript
// services/auth.service.js
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { ConflictError, ValidationError } from '../utils/errors.js';

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET;

// Simuler une base de donnees
let users = [];

export async function register({ email, password, nom }) {
  // Verifier si l'email est deja pris
  const existing = users.find(u => u.email === email);
  if (existing) {
    throw new ConflictError('Cet email est deja utilise');
  }

  // Hacher le mot de passe
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  // Creer l'utilisateur
  const user = {
    id: crypto.randomUUID(),
    email,
    nom,
    password: hashedPassword,
    role: 'user',
    createdAt: new Date().toISOString(),
  };

  users.push(user);

  // Generer le token
  const token = generateToken(user);

  // Retourner l'utilisateur SANS le mot de passe
  const { password: _, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, token };
}

function generateToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}
```

### 4.2 Login (connexion)

```javascript
// services/auth.service.js (suite)
import { UnauthorizedError } from '../utils/errors.js';

export async function login({ email, password }) {
  // Trouver l'utilisateur
  const user = users.find(u => u.email === email);
  if (!user) {
    // Message generique pour ne pas reveler si l'email existe
    throw new UnauthorizedError('Email ou mot de passe incorrect');
  }

  // Verifier le mot de passe
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new UnauthorizedError('Email ou mot de passe incorrect');
  }

  // Generer le token
  const token = generateToken(user);

  const { password: _, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, token };
}
```

> **Bonne pratique** : Renvoie TOUJOURS le meme message d'erreur pour "email introuvable" et "mot de passe incorrect". Sinon, un attaquant peut deviner quels emails sont inscrits en observant les messages d'erreur.

### 4.3 Routes et controller

```javascript
// routes/auth.routes.js
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import * as authService from '../services/auth.service.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).max(72),
  nom: z.string().min(2).max(50).trim(),
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1, 'Mot de passe requis'),
});

router.post('/register',
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  })
);

router.post('/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.login(req.body);
    res.json(result);
  })
);

export default router;
```

---

## 5. Middleware d'authentification

### 5.1 Extraire et verifier le token

```javascript
// middleware/auth.js
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../utils/errors.js';

const JWT_SECRET = process.env.JWT_SECRET;

export function authenticate(req, res, next) {
  // 1. Extraire le token du header Authorization
  const authHeader = req.get('Authorization');

  if (!authHeader) {
    throw new UnauthorizedError('Token d\'authentification manquant');
  }

  if (!authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Format de token invalide (attendu: Bearer <token>)');
  }

  const token = authHeader.slice(7);

  // 2. Verifier le token
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // 3. Attacher l'utilisateur a la requete
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new UnauthorizedError('Token expire — reconnectez-vous');
    }
    throw new UnauthorizedError('Token invalide');
  }
}
```

### 5.2 Utilisation dans les routes

```javascript
import { authenticate } from '../middleware/auth.js';

// Route protegee — necessite un token valide
app.get('/api/profile', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// Proteger un groupe de routes
app.use('/api/admin', authenticate);
```

---

## 6. Les Cookies

### 6.1 Stocker le token dans un cookie

Au lieu d'envoyer le token dans le body JSON et de le stocker dans le localStorage (vulnerable au XSS), tu peux utiliser un **cookie httpOnly** :

```javascript
// A la connexion
router.post('/login', asyncHandler(async (req, res) => {
  const { user, token } = await authService.login(req.body);

  // Stocker le token dans un cookie securise
  res.cookie('token', token, {
    httpOnly: true,       // Inaccessible depuis JavaScript (anti-XSS)
    secure: true,         // Envoye uniquement en HTTPS
    sameSite: 'strict',   // Protection CSRF
    maxAge: 3600000,      // 1 heure en ms
    path: '/',            // Envoye sur toutes les routes
  });

  res.json({ user }); // Le token n'est PAS dans le body
}));

// A la deconnexion
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
  });
  res.json({ message: 'Deconnecte' });
});
```

### 6.2 Lire le token depuis le cookie

```bash
npm install cookie-parser
```

```javascript
import cookieParser from 'cookie-parser';
app.use(cookieParser());

// Middleware auth qui lit le cookie
export function authenticate(req, res, next) {
  // Chercher le token dans le header OU dans le cookie
  let token = null;

  const authHeader = req.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    throw new UnauthorizedError('Authentification requise');
  }

  // ... verifier le token (meme code qu'avant)
}
```

### 6.3 Attributs de securite des cookies

| Attribut | Valeur | Protection |
|---|---|---|
| `httpOnly` | `true` | Le cookie est inaccessible via `document.cookie` (anti-XSS) |
| `secure` | `true` | Le cookie est envoye uniquement en HTTPS |
| `sameSite` | `'strict'` | Le cookie n'est pas envoye sur les requetes cross-site (anti-CSRF) |
| `maxAge` | Millisecondes | Duree de vie du cookie |
| `path` | `'/'` | Chemin sur lequel le cookie est envoye |
| `domain` | `'.example.com'` | Domaine(s) sur lesquels le cookie est valide |
| `signed` | `true` | Le cookie est signe avec un secret (anti-tampering) |

> **Bonne pratique** : Pour les tokens d'authentification, utilise TOUJOURS `httpOnly: true` et `secure: true` (en production). Le `sameSite: 'strict'` empeche les attaques CSRF. C'est plus sur que le localStorage.

---

## 7. Refresh Tokens

### 7.1 Le probleme des tokens courts

Un access token avec une duree de vie courte (15 min) est plus sur — s'il est vole, il expire rapidement. Mais l'utilisateur doit se reconnecter toutes les 15 minutes.

### 7.2 La solution : deux tokens

```
  Client                          Serveur
    │                               │
    │  POST /auth/login             │
    │──────────────────────────────▶│
    │                               │
    │  accessToken (15 min)         │
    │  refreshToken (7 jours)       │
    │◀──────────────────────────────│
    │                               │
    │  GET /api/data                │
    │  Authorization: Bearer access │  ← Access token (valide 15 min)
    │──────────────────────────────▶│
    │  200 OK                       │
    │◀──────────────────────────────│
    │                               │
    │  ... 15 minutes plus tard ... │
    │                               │
    │  GET /api/data                │
    │  Authorization: Bearer access │  ← Access token expire !
    │──────────────────────────────▶│
    │  401 Token expire             │
    │◀──────────────────────────────│
    │                               │
    │  POST /auth/refresh           │
    │  { refreshToken: "..." }      │  ← Utiliser le refresh token
    │──────────────────────────────▶│
    │                               │
    │  Nouveau accessToken (15 min) │
    │◀──────────────────────────────│
```

```javascript
// services/auth.service.js
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

// Stocker les refresh tokens (en production → base de donnees)
const refreshTokens = new Set();

export function generateTokens(user) {
  const accessToken = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  refreshTokens.add(refreshToken);

  return { accessToken, refreshToken };
}

export function refreshAccessToken(refreshToken) {
  // Verifier que le refresh token est dans notre liste
  if (!refreshTokens.has(refreshToken)) {
    throw new UnauthorizedError('Refresh token invalide ou revoque');
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET);

    if (decoded.type !== 'refresh') {
      throw new UnauthorizedError('Ce n\'est pas un refresh token');
    }

    // Trouver l'utilisateur
    const user = users.find(u => u.id === decoded.userId);
    if (!user) {
      throw new UnauthorizedError('Utilisateur introuvable');
    }

    // Generer un nouveau access token
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    return { accessToken };
  } catch (err) {
    // Si le refresh token est expire ou invalide, le supprimer
    refreshTokens.delete(refreshToken);
    throw new UnauthorizedError('Refresh token expire ou invalide');
  }
}

export function revokeRefreshToken(refreshToken) {
  refreshTokens.delete(refreshToken);
}
```

---

## 8. RBAC — Controle d'acces base sur les roles

### 8.1 Middleware d'autorisation par role

```javascript
// middleware/authorize.js
import { ForbiddenError } from '../utils/errors.js';

/**
 * Middleware qui verifie que l'utilisateur a un des roles autorises
 * @param  {...string} allowedRoles - Les roles autorises
 */
export function authorize(...allowedRoles) {
  return (req, res, next) => {
    // L'utilisateur doit etre authentifie (middleware authenticate avant)
    if (!req.user) {
      throw new ForbiddenError('Utilisateur non authentifie');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError(
        `Role "${req.user.role}" non autorise. Roles requis : ${allowedRoles.join(', ')}`
      );
    }

    next();
  };
}
```

### 8.2 Utilisation dans les routes

```javascript
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';

// Accessible a tous les utilisateurs authentifies
router.get('/api/profile', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// Accessible uniquement aux admins
router.delete('/api/users/:id',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    await userService.deleteUser(req.params.id);
    res.status(204).end();
  })
);

// Accessible aux admins ET moderateurs
router.patch('/api/posts/:id/moderate',
  authenticate,
  authorize('admin', 'moderator'),
  asyncHandler(async (req, res) => {
    const post = await postService.moderate(req.params.id, req.body);
    res.json({ data: post });
  })
);
```

---

## 9. Rate Limiting

```bash
npm install express-rate-limit
```

```javascript
import rateLimit from 'express-rate-limit';

// Limiteur global : 100 requetes par fenetre de 15 minutes
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // Maximum 100 requetes par IP
  message: {
    error: 'Trop de requetes, reessayez dans 15 minutes',
  },
  standardHeaders: true,     // Retourne les headers RateLimit-*
  legacyHeaders: false,      // Desactive les headers X-RateLimit-*
});

// Limiteur strict pour l'authentification : 5 tentatives par 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error: 'Trop de tentatives de connexion, reessayez dans 15 minutes',
  },
});

// Appliquer les limiteurs
app.use(globalLimiter);
app.use('/auth/login', authLimiter);
app.use('/auth/register', authLimiter);
```

---

## 10. Helmet — Headers de securite

```javascript
import helmet from 'helmet';

app.use(helmet());

// Ou configurer individuellement
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Si tu sers des images externes
}));
```

---

## 11. CORS — Configuration detaillee

```javascript
import cors from 'cors';

const corsOptions = {
  // Origines autorisees
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:4200',     // Angular dev
      'http://localhost:3001',     // React dev
      'https://monapp.com',       // Production
    ];

    // Autoriser les requetes sans origin (Postman, curl, mobile)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origine ${origin} non autorisee par CORS`));
    }
  },

  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id', 'X-Total-Count'],
  credentials: true,      // Autoriser les cookies cross-origin
  maxAge: 86400,           // Cache preflight 24h
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
```

---

## 12. Checklist de securite

| Mesure | Implementation | Module |
|---|---|---|
| Hacher les mots de passe | bcrypt, salt rounds 10-12 | Ce module |
| Tokens JWT signes | jsonwebtoken, secret long | Ce module |
| Cookies httpOnly + secure | `res.cookie()` avec les bons flags | Ce module |
| Rate limiting | express-rate-limit | Ce module |
| Headers de securite | helmet | Ce module |
| CORS configure | cors avec origines explicites | Ce module |
| Validation des entrees | Zod sur body/params/query | Module 07 |
| Gestion d'erreurs | Error handler centralise | Module 07 |
| Variables sensibles | .env + dotenv, JAMAIS dans le code | Module 02 |
| HTTPS en production | Certificat SSL/TLS (Let's Encrypt) | Deploiement |
| Dependances a jour | `npm audit` regulierement | Maintenance |
| Logging | morgan + logs structures | Module 06 |

> **A retenir** : La securite n'est pas une feature optionnelle — c'est une exigence. Chaque mesure de cette checklist est un mur dans la forteresse de ton API. Un seul mur manquant et un attaquant peut entrer.

---

## 13. Exercices pratiques

### Exercice 1 — Systeme d'authentification complet

Implemente le flux complet : register, login, logout, profile, refresh token.

### Exercice 2 — API multi-roles

Cree une API de blog avec 3 roles :
- `user` : peut lire et creer des posts
- `moderator` : peut aussi editer et moderer les posts
- `admin` : peut tout faire + gerer les utilisateurs

### Exercice 3 — Protection contre le brute force

Implemente un systeme qui bloque un compte apres 5 tentatives de login echouees, avec un deblocage apres 30 minutes.

---

## Navigation

| | Lien |
|---|---|
| Module precedent | [Module 07 — Express — Validation & Gestion d'erreurs](./07-express-validation-erreurs.md) |
| Module suivant | [Module 09 — NestJS — Introduction & Premiers pas](./09-nestjs-introduction.md) |
| Quiz | [Quiz Module 08](../quizzes/08-express-auth-securite.quiz.md) |
| Lab | [Lab 08 — Authentification et securite](../labs/08-express-auth-securite.lab.md) |

---

> **A retenir** : L'authentification (bcrypt + JWT) et la securite (helmet, CORS, rate limiting) sont les piliers de toute API de production. Hache toujours les mots de passe, signe tes tokens avec un secret robuste, utilise des cookies httpOnly, et protege tes endpoints sensibles avec des middleware d'autorisation. Ces concepts s'appliqueront directement dans NestJS avec les Guards et les Strategies Passport.
