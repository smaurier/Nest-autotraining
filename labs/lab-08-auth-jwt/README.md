# Lab 08 — Authentification JWT

## Objectifs

- Hacher des mots de passe avec bcrypt
- Générer et vérifier des tokens JWT
- Créer un système d'inscription et de connexion
- Proteger des routes avec un middleware d'authentification
- Implementer un système de roles (RBAC)
- Créer un endpoint de rafraichissement de token

## Pre-requis

- Node.js >= 18 installe
- Installer les dépendances : `npm install` dans ce répertoire

## Instructions

1. Installez les dépendances : `npm install`
2. Ouvrez le fichier `exercise.ts`
3. Completez chaque section marquee `TODO`
4. Lancez le fichier avec `npx tsx exercise.ts`
5. Verifiez que tous les tests passent (10/10)

## TODOs

| #   | Description                                                                   |
| --- | ----------------------------------------------------------------------------- |
| 1   | Implementer `POST /register` — hacher le mot de passe et créer l'utilisateur  |
| 2   | Implementer `POST /login` — vérifier le mot de passe et retourner un JWT      |
| 3   | Créer `authMiddleware` — vérifier le JWT depuis le header Authorization       |
| 4   | Implementer `GET /profile` — route protegee retournant l'utilisateur connecte |
| 5   | Implementer `POST /refresh` — rafraichir un token JWT                         |
| 6   | Créer `rolesMiddleware(...roles)` — vérifier le role de l'utilisateur         |
| 7   | Implementer `GET /admin/users` — route admin-only                             |

## Aide

### bcryptjs

```typescript
import bcrypt from "bcryptjs";

// Hacher un mot de passe
const hash = await bcrypt.hash("password", 10);

// Verifier un mot de passe
const match = await bcrypt.compare("password", hash);
```

### jsonwebtoken

```typescript
import jwt from "jsonwebtoken";

const SECRET = "my-secret-key";

// Generer un token
const token = jwt.sign({ userId: 1, role: "admin" }, SECRET, {
  expiresIn: "1h",
});

// Verifier un token
try {
  const payload = jwt.verify(token, SECRET);
  console.log(payload.userId); // 1
} catch (err) {
  console.log("Token invalide");
}
```

### Header Authorization

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

## Defi bonus BFF

- Faire une variante cookie httpOnly pour access token et refresh token.
- Implementer une rotation de refresh token sur POST /refresh.
- Ajouter une protection CSRF minimale (token ou verification d'origine).
