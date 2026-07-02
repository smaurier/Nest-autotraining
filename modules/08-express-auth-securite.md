---
titre: Express auth et sécurité
cours: 09-nestjs
notions: [authentification vs autorisation, hachage de mot de passe bcrypt, JWT structure et signature, access token et refresh token, stockage du token httpOnly cookie vs localStorage, helmet et en-têtes de sécurité, CORS, rate limiting, bases OWASP]
outcomes: [hacher un mot de passe avec bcrypt, émettre et vérifier un JWT, choisir le bon stockage de token (cookie httpOnly), durcir une API Express (helmet, CORS, rate limit)]
prerequis: [07-express-validation-erreurs]
next: 09-nestjs-introduction
libs: [{ name: express, version: "^5" }, { name: jsonwebtoken, version: "^9" }, { name: bcrypt, version: "^5" }]
tribuzen: authentification JWT de l'API TribuZen (login parent, protection des routes famille)
last-reviewed: 2026-07
---

# Express auth et sécurité

> **Outcomes — tu sauras FAIRE :** hacher un mot de passe avec bcrypt, émettre et vérifier un JWT, choisir le bon stockage de token (cookie httpOnly), durcir une API Express (helmet, CORS, rate limit).
> **Difficulté :** :star::star::star:

## 1. Cas concret d'abord

TribuZen permet à un parent de créer un compte, de se connecter, et d'accéder aux routes de sa famille — mais pas aux familles des autres. Voici la tâche concrète avant la théorie :

```
POST /auth/register   → créer un compte (email + mot de passe)
POST /auth/login      → s'authentifier, recevoir un token
GET  /familles/:id    → route protégée — seulement si token valide + rôle owner/admin
```

Tu essaies de l'écrire et tu bloques immédiatement sur plusieurs problèmes :

- Comment stocker le mot de passe sans le mettre en clair en base ?
- Comment prouver à la requête suivante que l'utilisateur est bien connecté, sans stocker une session côté serveur ?
- Où placer le token côté client sans qu'un script malveillant puisse le voler ?
- Comment empêcher un attaquant de tester 10 000 mots de passe par seconde ?

Ce module répond exactement à ça.

## 2. Théorie complète, concise

### 2.1 Authentification vs autorisation

| Concept | Question | Exemple TribuZen |
|---------|---------|-----------------|
| **Authentification** (AuthN) | "Qui es-tu ?" | Login avec email + mot de passe |
| **Autorisation** (AuthZ) | "As-tu le droit ?" | Seul un `owner` ou `admin` de la famille peut en inviter d'autres |

L'ordre est immuable : authentifier d'abord, autoriser ensuite. Un middleware `authenticate` vérifie l'identité ; un middleware `authorize(roles)` vérifie les droits. Les confondre — ou sauter l'un d'eux — crée des failles OWASP A01 (Broken Access Control).

### 2.2 Hachage de mot de passe avec bcrypt

**Règle absolue : ne jamais stocker un mot de passe en clair.** Si la base de données est compromise, tous les comptes le sont instantanément. bcrypt est l'algorithme recommandé pour le hachage de mots de passe dans Node.js : il est intentionnellement lent (résistant au brute-force GPU), intègre un salt aléatoire par défaut, et produit un hash de 60 caractères incluant le salt et le cost factor.

```bash
npm install bcrypt
npm install -D @types/bcrypt
```

```ts
import bcrypt from 'bcrypt'

const SALT_ROUNDS = 12
// 10 = ~10 hashes/sec sur CPU moderne, 12 = ~2.5 hashes/sec — 12 recommandé en 2026

// Hacher un mot de passe — toujours async pour ne pas bloquer l'event loop
const hash = await bcrypt.hash('MotDePasseSecret42!', SALT_ROUNDS)
// → '$2b$12$K4YjdG7WxKN6tIFhgXOcMe...' (60 chars, jamais le même deux fois grâce au salt)

// Vérifier un mot de passe — bcrypt.compare() rehache avec le salt extrait du hash stocké
const isMatch = await bcrypt.compare('MotDePasseSecret42!', hash) // true
const isWrong = await bcrypt.compare('mauvais', hash)             // false
```

`bcrypt.compare()` ne compare **jamais** deux chaînes de hash directement : il extrait le salt intégré dans `hash`, rehache le mot de passe en clair, et compare les résultats. Un même mot de passe produit un hash différent à chaque appel à `bcrypt.hash()` — c'est le but du salt aléatoire.

**OWASP A02 — Cryptographic Failures** : stocker des mots de passe avec MD5, SHA-256 seul ou en clair est une vulnérabilité critique. bcrypt (ou argon2) sont les seules options acceptables.

### 2.3 JWT — structure et signature

Un JWT (JSON Web Token) est un jeton au format `header.payload.signature`, chaque partie encodée en Base64url et séparée par un point.

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9          ← Header  (algo HS256, type JWT)
.
eyJ1c2VySWQiOiJ1c3ItMSIsInJvbGUiOiJvd25lciIsImV4cCI6MTc1MTQ4MDAwMH0
                                                ← Payload (userId, role, exp)
.
SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c   ← Signature HMAC-SHA256
```

| Partie | Contenu | Encodage |
|--------|---------|---------|
| Header | algorithme (HS256) et type (JWT) | Base64url |
| Payload | claims — userId, role, iat, exp | Base64url |
| Signature | HMAC-SHA256(header + "." + payload, secret) | Base64url |

**Point critique : Base64url ≠ chiffrement.** Le payload est lisible par n'importe qui qui décode la chaîne — aucun secret requis pour lire, seulement pour vérifier. La signature garantit l'**intégrité** (le payload n'a pas été modifié) mais pas la **confidentialité**. Ne jamais mettre de données sensibles dans le payload (mot de passe, hash, numéro de carte).

```ts
import jwt from 'jsonwebtoken'

// jwt.decode() retourne le payload SANS vérifier la signature — ne jamais faire confiance
const raw = jwt.decode('eyJhbGci...')   // lisible, mais PAS sûr
```

### 2.4 Émettre et vérifier un JWT

```ts
import jwt from 'jsonwebtoken'

// JWT_SECRET : chaîne aléatoire d'au moins 32 chars, stockée en variable d'env
// Générer : node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
// JAMAIS de valeur fallback en prod : process.env.JWT_SECRET || 'secret' est dangereux
const JWT_SECRET = process.env.JWT_SECRET!

// Émettre un access token — expiresIn OBLIGATOIRE
// Sans expiration, un token volé est valide pour toujours
function signAccessToken(userId: string, role: string): string {
  return jwt.sign(
    { userId, role },                              // payload — identifiants uniquement
    JWT_SECRET,
    { expiresIn: '15m', algorithm: 'HS256' }
  )
}

// Vérifier un token — jwt.verify() contrôle la signature ET le claim exp
function verifyToken(token: string): jwt.JwtPayload {
  try {
    // Lève une exception si la signature est invalide OU si le token est expiré
    return jwt.verify(token, JWT_SECRET) as jwt.JwtPayload
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new Error('TOKEN_EXPIRED')   // access token expiré → demander un refresh
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw new Error('TOKEN_INVALID')   // signature invalide ou token malformé
    }
    throw err
  }
}
```

`jwt.verify()` valide simultanément la signature HMAC-SHA256 et la date d'expiration (`exp`). Il lève `TokenExpiredError` ou `JsonWebTokenError` selon l'échec — toujours distinguer les deux pour donner un message client adapté.

### 2.5 Access token et refresh token

Un access token de courte durée (15 min) limite la fenêtre d'exploitation en cas de vol. Mais obliger l'utilisateur à se reconnecter toutes les 15 min est inacceptable en UX. La solution : deux tokens.

```
POST /auth/login
  → access token  (15 min)  — envoyé avec chaque requête API protégée
  → refresh token (7 jours)  — utilisé uniquement sur POST /auth/refresh
```

```ts
function signTokens(userId: string, role: string) {
  const accessToken = jwt.sign(
    { userId, role },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  )
  // Secret DIFFÉRENT pour le refresh token — compromission d'un secret n'affecte pas l'autre
  const refreshToken = jwt.sign(
    { userId, tokenType: 'refresh' },
    process.env.REFRESH_TOKEN_SECRET!,
    { expiresIn: '7d' }
  )
  return { accessToken, refreshToken }
}
```

**Rotation des refresh tokens :** à chaque `POST /auth/refresh`, émettre un nouveau refresh token et invalider l'ancien. Stocker les refresh tokens en base de données (table `refresh_tokens`) pour pouvoir les révoquer lors d'un logout, d'un changement de mot de passe ou d'une compromission détectée.

### 2.6 Stockage du token — cookie httpOnly vs localStorage

C'est le choix de sécurité le plus impactant côté client.

| Stockage | Accessible via JS | Vulnérable XSS | Vulnérable CSRF | Recommandé |
|---------|------------------|----------------|-----------------|-----------|
| `localStorage` | `window.localStorage.getItem(...)` | **Oui** | Non | Non |
| `sessionStorage` | `window.sessionStorage.getItem(...)` | **Oui** | Non | Non |
| Cookie sans `httpOnly` | `document.cookie` | **Oui** | Oui | Non |
| Cookie `httpOnly` | Inaccessible depuis JS | **Non** | Oui* | **Oui** |

*Le cookie `httpOnly` est protégé du CSRF par `sameSite: 'strict'` ou un token CSRF explicite.

**XSS + localStorage = vol de token garanti.** Si une page charge un script compromis (CDN piraté, XSS réfléchi, dépendance tierce malveillante), ce script peut appeler `localStorage.getItem('token')` et exfiltrer le token. Avec `httpOnly: true`, le cookie est **invisible** depuis JavaScript — `document.cookie` ne le retourne pas. Le vol devient impossible par ce vecteur.

```ts
import cookieParser from 'cookie-parser'
app.use(cookieParser())   // requis pour que req.cookies soit peuplé

// Envoyer le token dans un cookie httpOnly — jamais dans le body JSON
res.cookie('access_token', accessToken, {
  httpOnly: true,     // inaccessible via document.cookie → protège du XSS
  secure: true,       // envoyé uniquement en HTTPS (obligatoire en production)
  sameSite: 'strict', // bloque l'envoi cross-site → protège du CSRF
  maxAge: 15 * 60 * 1000,   // 15 minutes en ms
  path: '/',
})

// Lire le token dans le middleware d'authentification
const token = req.cookies['access_token']   // string | undefined
```

### 2.7 Helmet — en-têtes de sécurité

`helmet` configure automatiquement une douzaine d'en-têtes HTTP de sécurité pour durcir l'API contre les attaques navigateur courantes.

```bash
npm install helmet
```

```ts
import helmet from 'helmet'

// Déclaré EN PREMIER dans la chaîne middleware — chaque réponse reçoit les en-têtes
app.use(helmet())
```

En-têtes configurés par défaut :

| En-tête | Protection |
|---------|-----------|
| `Content-Security-Policy` | Limite les sources de contenu — réduit la surface XSS |
| `X-Content-Type-Options: nosniff` | Empêche le MIME sniffing |
| `X-Frame-Options: SAMEORIGIN` | Protège du clickjacking |
| `Strict-Transport-Security` | Force HTTPS dans le navigateur |
| `X-XSS-Protection: 0` | Désactive le filtre XSS natif des anciens navigateurs (obsolète et lui-même source de vulnérabilités) |

**OWASP A05 — Security Misconfiguration** : une API sans ces en-têtes expose ses utilisateurs aux attaques de navigateur les plus basiques et documentées.

### 2.8 CORS

CORS contrôle quelles origines peuvent appeler l'API depuis un navigateur. Sans configuration, les navigateurs bloquent les appels cross-origin (Same-Origin Policy).

```bash
npm install cors
npm install -D @types/cors
```

```ts
import cors from 'cors'

app.use(cors({
  // Origines explicites — jamais '*' en production
  origin: process.env.NODE_ENV === 'production'
    ? 'https://tribuzen.app'
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,    // OBLIGATOIRE pour que les cookies httpOnly soient envoyés cross-origin
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type'],
}))
```

**Jamais `origin: '*'` avec `credentials: true`** : le navigateur refuse la combinaison (erreur CORS explicite). De plus, `'*'` signifie que n'importe quel site web peut appeler l'API.

`credentials: true` est indispensable quand des cookies sont utilisés : sans lui, le navigateur ne joint pas les cookies aux requêtes cross-origin même si le cookie existe côté client.

### 2.9 Rate limiting

Le rate limiting limite le nombre de requêtes par IP pour bloquer le brute-force et les attaques par déni de service.

```bash
npm install express-rate-limit
```

```ts
import rateLimit from 'express-rate-limit'

// Limiteur global — 100 req / 15 min par IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,                  // express-rate-limit v7+ utilise 'limit' (ex-'max')
  standardHeaders: 'draft-7', // retourne les headers RateLimit standardisés RFC 6585
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, réessayez dans 15 minutes' },
})

// Limiteur strict pour les routes d'auth — 5 tentatives / 15 min par IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: { error: 'Trop de tentatives de connexion' },
})

app.use(globalLimiter)
app.use('/auth', authLimiter)   // montage sur le préfixe /auth uniquement
```

**OWASP A07 — Identification and Authentication Failures** : sans rate limiting sur `/auth/login`, une attaque par dictionnaire peut tester des milliers de mots de passe sans être bloquée, particulièrement avec bcrypt parallélisé sur GPU.

### 2.10 Bases OWASP

Le Top 10 OWASP identifie les vulnérabilités web les plus critiques. Celles couvertes par ce module :

| Catégorie OWASP | Mesure dans ce module |
|----------------|----------------------|
| A02 — Cryptographic Failures | bcrypt (jamais MD5/SHA seul), HTTPS, cookie `secure` |
| A05 — Security Misconfiguration | helmet, CORS restrictif avec liste d'origines |
| A07 — Identification and Auth Failures | bcrypt + JWT signé + expiré, rate limiting, message d'erreur générique |

**Règle OWASP A07 — message d'erreur générique :** retourner toujours `"Email ou mot de passe incorrect"` — jamais "email introuvable" ni "mot de passe incorrect" séparément. Un message différencié permet à un attaquant de savoir si un email est inscrit (*user enumeration attack*) et de cibler ses attaques.

## 3. Worked examples

### Exemple A — Register + Login avec cookie httpOnly

```ts
// src/routes/auth.ts
import { Router, Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'

const router = Router()
const SALT_ROUNDS = 12
const JWT_SECRET = process.env.JWT_SECRET ?? (() => { throw new Error('JWT_SECRET manquant') })()

// Store en mémoire — remplacé par Prisma + PostgreSQL au module 10
interface User {
  id: string
  email: string
  passwordHash: string   // jamais le mot de passe en clair
  role: 'owner' | 'member' | 'guest'
}
const users: User[] = []

// Hash factice pré-calculé au démarrage — même coût que les vrais hashes
// Sans ça : email inconnu → retour en < 1ms vs ~100ms (bcrypt) → timing attack possible
const DUMMY_HASH = await bcrypt.hash('__tribuzen_dummy__', SALT_ROUNDS)

// Helper : placer le token dans un cookie httpOnly
function setAuthCookie(res: Response, token: string): void {
  res.cookie('access_token', token, {
    httpOnly: true,   // inaccessible depuis document.cookie → protège du XSS
    secure: process.env.NODE_ENV === 'production',   // HTTPS uniquement en prod
    sameSite: 'strict',   // bloque l'envoi cross-site → protège du CSRF
    maxAge: 15 * 60 * 1000,   // 15 minutes en ms
    path: '/',
  })
}

// ─── POST /auth/register ───────────────────────────────────────────────────────
router.post('/register', async (req: Request, res: Response) => {
  const { email, password } = req.body

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'email et password requis (string)' })
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'password doit faire au moins 8 caractères' })
  }

  const normalizedEmail = email.toLowerCase().trim()
  if (users.find(u => u.email === normalizedEmail)) {
    return res.status(409).json({ error: 'Impossible de créer ce compte' })
    // Message vague intentionnellement : ne pas confirmer si l'email est déjà pris
  }

  // bcrypt.hash() génère et intègre le salt automatiquement — jamais stocker 'password'
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

  const user: User = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    passwordHash,       // seul le hash est persisté
    role: 'owner',
  }
  users.push(user)

  const accessToken = jwt.sign(
    { userId: user.id, role: user.role },   // payload minimal — pas de passwordHash ici
    JWT_SECRET,
    { expiresIn: '15m', algorithm: 'HS256' }
  )

  setAuthCookie(res, accessToken)   // token dans le cookie, pas dans le body

  // Réponse sans passwordHash ni token JWT dans le body JSON
  res.status(201).json({ user: { id: user.id, email: user.email, role: user.role } })
})

// ─── POST /auth/login ──────────────────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'email et password requis' })
  }

  const user = users.find(u => u.email === email.toLowerCase().trim())

  // Toujours appeler bcrypt.compare() — même si l'utilisateur n'existe pas
  // Avec DUMMY_HASH, le temps de réponse reste ~100ms qu'il existe ou non
  // Sans ça, un attaquant mesure la durée : 1ms = email absent, 100ms = email valide
  const isMatch = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH)

  if (!user || !isMatch) {
    // Message IDENTIQUE pour "email absent" et "mot de passe incorrect"
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

// ─── POST /auth/logout ─────────────────────────────────────────────────────────
router.post('/logout', (_req: Request, res: Response) => {
  // clearCookie avec les mêmes attributs que lors de la création
  res.clearCookie('access_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  })
  res.json({ message: 'Déconnecté' })
})

export default router
```

**Pas-à-pas :**
1. `bcrypt.hash(password, SALT_ROUNDS)` — salt généré automatiquement, intégré dans le hash ; `passwordHash` va en base, jamais `password`.
2. `DUMMY_HASH` pré-calculé au démarrage (top-level `await` avec `"type": "module"`) — même coût CPU que les vrais hashes ; sans lui, la durée de réponse trahit si un email est inscrit.
3. `isMatch = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH)` — puis `if (!user || !isMatch)` : les deux cas d'échec retournent le même message et la même durée.
4. `jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '15m' })` — payload minimal, pas de `passwordHash`, expiration obligatoire.
5. `setAuthCookie()` place le token dans un cookie `httpOnly; secure; sameSite=strict` — il n'apparaît pas dans le body JSON et ne peut pas être lu par `document.cookie`.

### Exemple B — Middleware authenticate + route protégée

```ts
// src/middleware/authenticate.ts
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET!

// Extension de l'interface Request pour y attacher l'utilisateur courant
declare global {
  namespace Express {
    interface Request {
      user?: { userId: string; role: string }
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  // Lire le token depuis le cookie httpOnly — envoyé automatiquement par le navigateur
  const token = req.cookies['access_token']

  if (!token) {
    res.status(401).json({ error: 'Authentification requise' })
    return
  }

  try {
    // jwt.verify() valide la signature HS256 ET le claim exp simultanément
    const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload

    req.user = {
      userId: payload['userId'] as string,
      role: payload['role'] as string,
    }
    next()
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      // Access token expiré → le client appelle POST /auth/refresh
      res.status(401).json({ error: 'Token expiré — rafraîchir la session' })
      return
    }
    // Signature invalide, token malformé, algorithme inattendu → ne pas détailler
    res.status(401).json({ error: 'Token invalide' })
  }
}
```

```ts
// src/middleware/authorize.ts
import { Request, Response, NextFunction } from 'express'

// Middleware d'autorisation — TOUJOURS appelé après authenticate
export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      // 403 Forbidden = authentifié mais pas autorisé (distinct du 401)
      res.status(403).json({ error: 'Droits insuffisants' })
      return
    }
    next()
  }
}
```

```ts
// src/index.ts — montage avec tous les middleware de sécurité dans le bon ordre
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import cookieParser from 'cookie-parser'
import authRouter from './routes/auth.js'
import { authenticate } from './middleware/authenticate.js'
import { authorize } from './middleware/authorize.js'

const app = express()

// 1. helmet EN PREMIER — en-têtes de sécurité envoyés sur toutes les réponses, y compris 4xx/5xx
app.use(helmet())

// 2. CORS — avant les routes
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 'https://tribuzen.app' : 'http://localhost:5173',
  credentials: true,   // obligatoire pour les cookies cross-origin
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type'],
}))

// 3. Rate limiting global
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 }))

// 4. Parsers
app.use(express.json())
app.use(cookieParser())   // requis pour lire req.cookies['access_token']

// 5. Routes auth avec limiteur strict (5 req / 15 min)
app.use('/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 5 }), authRouter)

// 6. Route protégée — authenticate vérifie le JWT, authorize vérifie le rôle
app.get('/familles/:id', authenticate, authorize('owner', 'admin'), (req, res) => {
  res.json({ familleId: req.params.id, demandeur: req.user })
})

app.listen(3000)
```

**Pas-à-pas :**
1. `helmet()` déclaré en premier — les en-têtes de sécurité sont présents sur toutes les réponses, y compris les erreurs CORS ou 404.
2. `cookieParser()` est requis pour lire `req.cookies` — sans lui, `req.cookies` est `undefined`.
3. Dans `authenticate`, `jwt.verify()` lève `TokenExpiredError` ou `JsonWebTokenError` — on distingue les deux : le client sait s'il doit rafraîchir (401 + "Token expiré") ou se reconnecter (401 + "Token invalide").
4. `authorize('owner', 'admin')` après `authenticate` — `req.user` est garanti non-null ici ; ne jamais appeler `authorize` sans `authenticate` devant.
5. Le rate limiter monté sur `/auth` (5 req / 15 min) ne touche pas les routes `/familles/*`.

## 4. Pièges & misconceptions

- **Comparer les hashes directement.** `storedHash === bcrypt.hash(password, ...)` échoue toujours : deux appels à `bcrypt.hash()` sur le même mot de passe donnent des hashes différents (salt aléatoire). Et même sans ça, l'égalité `===` est sujette aux timing attacks. *Correct* : `await bcrypt.compare(plainPassword, storedHash)` — seule API valide, résistante aux timing attacks.

- **Payload JWT = données privées.** Le payload est encodé en Base64url, pas chiffré. `jwt.decode(token)` le retourne sans connaître le secret. Ne jamais y mettre de hash de mot de passe, de numéro de carte, ou de donnée confidentielle. *Correct* : uniquement des identifiants de session (`userId`, `role`, `exp`).

- **JWT sans `expiresIn`.** Un token sans expiration est valide indéfiniment. S'il est volé (interception réseau, log serveur, cache), l'attaquant dispose d'un accès permanent. *Correct* : `expiresIn: '15m'` pour les access tokens — jamais omettre l'expiration.

- **localStorage pour le token JWT.** Tout script JS de la page peut appeler `localStorage.getItem('token')` — un XSS ou script tiers compromis vole le token instantanément. *Correct* : cookie `httpOnly: true` — `document.cookie` ne retourne pas les cookies `httpOnly`, le navigateur les envoie automatiquement.

- **`origin: '*'` avec `credentials: true`.** Les navigateurs refusent cette combinaison (erreur CORS explicite dans la console). De plus, `'*'` en production signifie que n'importe quel site peut appeler l'API. *Correct* : liste explicite d'origines `['https://tribuzen.app']`.

- **Message d'erreur différencié au login.** "Email introuvable" vs "Mot de passe incorrect" permet la *user enumeration* : l'attaquant sait quels emails sont inscrits et peut cibler ses attaques. *Correct* : `"Email ou mot de passe incorrect"` dans tous les cas d'échec d'authentification — sans exception.

- **`JWT_SECRET` avec valeur fallback.** `process.env.JWT_SECRET || 'mon-secret'` laisse un serveur démarrer sans variable d'env en utilisant une clé publiquement connue (commitée dans le code). *Correct* : `process.env.JWT_SECRET!` ou jeter une erreur au démarrage si la variable est absente — le serveur ne doit pas démarrer sans secret valide.

## 5. Ancrage TribuZen

Couche fil-rouge : **authentification JWT de l'API TribuZen (login parent, protection des routes famille)** (`smaurier/tribuzen`).

- `POST /auth/register` — un parent crée son compte. `bcrypt.hash(password, 12)` produit le hash persisté dans `users(password_hash TEXT NOT NULL)`. La colonne `password` n'existe pas en base.
- `POST /auth/login` — `bcrypt.compare()` vérifie le mot de passe. Si succès, access token (15 min) en cookie `httpOnly` + refresh token (7 j) en second cookie `httpOnly; Path=/auth/refresh`.
- `GET /familles/:id` — `authenticate` lit `req.cookies['access_token']`, appelle `jwt.verify()`. `authorize('owner', 'admin')` vérifie le rôle. Si le token a expiré, le client reçoit 401 + `"Token expiré"` et appelle `POST /auth/refresh`.
- `POST /auth/refresh` — lit le refresh token de son cookie, le vérifie avec `REFRESH_TOKEN_SECRET`, émet un nouvel access token, effectue la rotation : nouveau refresh token émis, ancien invalide en base.
- Au module 10 (PostgreSQL + Prisma), la table `refresh_tokens(id, user_id, token_hash, expires_at, revoked_at)` remplace le `Set` en mémoire — permettant la révocation multi-device et l'audit de sessions.

Structure cible dans `smaurier/tribuzen` :

```
apps/api/src/
  routes/
    auth.ts              ← register, login, logout, refresh
  middleware/
    authenticate.ts      ← jwt.verify sur req.cookies.access_token
    authorize.ts         ← vérification de rôle sur req.user.role
  index.ts               ← helmet, cors, rateLimit, cookieParser, montage routes
```

## 6. Points clés

1. Authentification (AuthN) vérifie l'identité ; autorisation (AuthZ) vérifie les droits — toujours dans cet ordre, jamais inversé.
2. `bcrypt.hash(password, saltRounds)` — jamais stocker le mot de passe en clair ; `bcrypt.compare(plain, hash)` — jamais comparer les hashes directement.
3. JWT = header.payload.signature, tout en Base64url — le payload est lisible sans le secret ; jamais de données sensibles dans le payload.
4. `jwt.sign(payload, secret, { expiresIn: '15m' })` — expiration obligatoire ; `jwt.verify()` lève `TokenExpiredError` ou `JsonWebTokenError`.
5. Cookie `httpOnly: true` — le JS ne peut pas lire le token → protège du XSS ; `localStorage` est accessible à tout script → ne jamais y stocker un token de session.
6. Cookie `secure: true` — HTTPS uniquement ; `sameSite: 'strict'` — bloque l'envoi cross-site → protège du CSRF.
7. Access token court (15 min) + refresh token plus long (7 j, stocké en base pour révocation et rotation).
8. `helmet()` en premier dans la chaîne middleware — en-têtes de sécurité sur toutes les réponses, y compris les erreurs.
9. CORS avec `credentials: true` et liste d'origines explicites — jamais `'*'` avec `credentials: true`.
10. Rate limiting strict sur `/auth` (5 req / 15 min) — bloque le brute-force de mots de passe ; toujours appeler `bcrypt.compare()` même si l'email n'existe pas (anti-timing).

## 7. Seeds Anki

```
Différence authentification vs autorisation ?|AuthN vérifie l'identité ("qui es-tu ?") — AuthZ vérifie les droits ("as-tu le droit ?"). Middleware authenticate avant authorize, toujours dans cet ordre.
Pourquoi bcrypt.compare() et jamais comparer les hashes directement ?|bcrypt génère un salt aléatoire à chaque hash — le même mot de passe donne un hash différent à chaque fois. compare() rehache avec le salt extrait du hash stocké. Comparer les strings serait toujours false et vulnérable aux timing attacks.
Le payload d'un JWT est-il chiffré ?|Non — encodé en Base64url, lisible par quiconque sans le secret. jwt.decode(token) le retourne sans vérifier la signature. Ne jamais y mettre de données sensibles.
Que lève jwt.verify() si le token est expiré ?|TokenExpiredError — distinct de JsonWebTokenError (signature invalide). Toujours distinguer les deux pour donner au client un message adapté (rafraîchir vs se reconnecter).
Pourquoi stocker le JWT dans un cookie httpOnly plutôt que localStorage ?|localStorage est accessible par tout JS de la page — un XSS vole le token immédiatement. httpOnly rend le cookie illisible depuis JS (document.cookie ne le retourne pas) ; le navigateur l'envoie automatiquement.
À quoi sert sameSite: strict sur un cookie d'authentification ?|Empêche le navigateur d'envoyer le cookie sur les requêtes cross-site — protège contre les attaques CSRF où un site malveillant forge une requête vers l'API.
Pourquoi retourner "Email ou mot de passe incorrect" dans les deux cas d'échec ?|Des messages distincts permettent la user enumeration — l'attaquant sait quels emails sont inscrits et peut cibler ses attaques (OWASP A07). Un message unique ne révèle rien.
Pourquoi appeler bcrypt.compare() même si l'email n'existe pas (avec un hash factice) ?|Sans ça, un email inconnu retourne en < 1ms vs ~100ms pour bcrypt — l'attaquant mesure la durée et sait quels emails sont inscrits (timing attack). Un hash factice de même coût efface cette différence.
```

## Pont vers le lab

> Lab associé : `09-nestjs/labs/lab-08-auth-jwt/README.md`. Tu construis le flux complet register → login → route protégée avec bcrypt, JWT en cookie httpOnly, middleware `authenticate` et `authorize` — pas de gap-fill, code de A à Z, corrigé complet commenté inline.
