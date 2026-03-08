# Lab 19 — Auth NestJS

## Objectifs

- Implementer l'authentification avec Passport.js dans NestJS
- Utiliser les strategies Local et JWT
- Creer des guards pour proteger les routes
- Implementer le RBAC (Role-Based Access Control)
- Creer un decorateur @CurrentUser personnalise
- Gerer les refresh tokens

## Description

Vous allez creer un systeme d'authentification complet avec :
- Inscription et connexion
- Tokens JWT (access + refresh)
- Routes protegees
- Controle d'acces par roles (admin, user)

## Endpoints

| Methode | Route          | Description                | Auth     |
|---------|---------------|----------------------------|----------|
| POST    | /auth/register | Inscription                | Non      |
| POST    | /auth/login    | Connexion (Local Strategy) | Non      |
| GET     | /auth/profile  | Profil utilisateur         | JWT      |
| POST    | /auth/refresh  | Rafraichir le token        | Non      |

## Instructions

1. **UsersService** (`src/users/users.service.ts`)
   - Implementez le stockage en memoire des utilisateurs
   - `create(dto)` : creer un utilisateur
   - `findByUsername(username)` : trouver par nom d'utilisateur

2. **AuthService** (`src/auth/auth.service.ts`)
   - `register(dto)` : hasher le mot de passe et creer l'utilisateur
   - `validateUser(username, password)` : verifier les credentials
   - `login(user)` : generer les tokens JWT
   - `refreshToken(token)` : valider et renouveler les tokens

3. **LocalStrategy** (`src/auth/strategies/local.strategy.ts`)
   - Etendre PassportStrategy(Strategy) de passport-local
   - Appeler authService.validateUser

4. **JwtStrategy** (`src/auth/strategies/jwt.strategy.ts`)
   - Etendre PassportStrategy(Strategy) de passport-jwt
   - Extraire le token du header Authorization Bearer

5. **RolesGuard** (`src/auth/guards/roles.guard.ts`)
   - Verifier les roles avec le Reflector

6. **CurrentUser decorator** (`src/auth/decorators/current-user.decorator.ts`)
   - Creer un decorateur de parametre personnalise

7. **AuthController** (`src/auth/auth.controller.ts`)
   - Implementer les routes avec les guards

## Validation

```bash
npm test
```

## Fichiers a modifier

- `src/users/users.service.ts`
- `src/auth/auth.service.ts`
- `src/auth/auth.controller.ts`
- `src/auth/strategies/local.strategy.ts`
- `src/auth/strategies/jwt.strategy.ts`
- `src/auth/guards/roles.guard.ts`
- `src/auth/decorators/current-user.decorator.ts`
