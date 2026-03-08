# Lab 08 — Authentification JWT

## Objectifs

- Hacher des mots de passe avec bcrypt
- Generer et verifier des tokens JWT
- Creer un systeme d'inscription et de connexion
- Proteger des routes avec un middleware d'authentification
- Implementer un systeme de roles (RBAC)
- Creer un endpoint de rafraichissement de token

## Pre-requis

- Node.js >= 18 installe
- Installer les dependances : `npm install` dans ce repertoire

## Instructions

1. Installez les dependances : `npm install`
2. Ouvrez le fichier `exercise.js`
3. Completez chaque section marquee `TODO`
4. Lancez le fichier avec `node exercise.js`
5. Verifiez que tous les tests passent (10/10)

## TODOs

| # | Description |
|---|-------------|
| 1 | Implementer `POST /register` — hacher le mot de passe et creer l'utilisateur |
| 2 | Implementer `POST /login` — verifier le mot de passe et retourner un JWT |
| 3 | Creer `authMiddleware` — verifier le JWT depuis le header Authorization |
| 4 | Implementer `GET /profile` — route protegee retournant l'utilisateur connecte |
| 5 | Implementer `POST /refresh` — rafraichir un token JWT |
| 6 | Creer `rolesMiddleware(...roles)` — verifier le role de l'utilisateur |
| 7 | Implementer `GET /admin/users` — route admin-only |

## Aide

### bcryptjs
```js
import bcrypt from 'bcryptjs';

// Hacher un mot de passe
const hash = await bcrypt.hash('password', 10);

// Verifier un mot de passe
const match = await bcrypt.compare('password', hash);
```

### jsonwebtoken
```js
import jwt from 'jsonwebtoken';

const SECRET = 'my-secret-key';

// Generer un token
const token = jwt.sign({ userId: 1, role: 'admin' }, SECRET, { expiresIn: '1h' });

// Verifier un token
try {
  const payload = jwt.verify(token, SECRET);
  console.log(payload.userId); // 1
} catch (err) {
  console.log('Token invalide');
}
```

### Header Authorization
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```
