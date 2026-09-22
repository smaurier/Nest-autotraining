# Lab 02 — Un AuthModule complet, de zéro : register, login, JWT, guard maison

> **Outcome :** à la fin, tu as construit une authentification par mot de passe + JWT de bout
> en bout — hash (jamais de mot de passe en clair, jamais de hash dans une réponse), émission
> de token, et un **Guard maison** (pas Passport) qui vérifie le token sur une route protégée.
> Tu sais aussi pourquoi « email inconnu » et « mot de passe faux » doivent renvoyer exactement
> le même message (énumération de comptes).
> **Vrai outil :** NestJS 11.2.5, `@nestjs/jwt` 12, `bcryptjs` 3 (implémentation JS pure — pas
> de compilation native, contrairement à `bcrypt`), Jest 30, supertest.
> **Feedback :** `npm run lab:02` — unitaire puis e2e. `npm run solution:02` prouve l'oracle.

## Lire avant (une lecture bornée)

- Module [`19-nestjs-auth.md`](../../modules/19-nestjs-auth.md) §2 — hash, JWT, la différence
  entre authentification (qui es-tu) et autorisation (le Guard du lab 01).
- Module [`08-express-auth-securite.md`](../../modules/08-express-auth-securite.md) — pourquoi
  ne jamais révéler si un email existe (le §"énumération de comptes").
- Module [`13-nestjs-pipes-guards-interceptors.md`](../../modules/13-nestjs-pipes-guards-interceptors.md) — tu as déjà écrit un Guard au lab 01 ; celui-ci a une dépendance injectée (`JwtService`).

## Énoncé

Tu écris `src/users/` et `src/auth/` en entier (`src/main.ts` et `src/app.module.ts` sont donnés) :

- `users/users.repository.ts` — stockage en mémoire des comptes.
- `auth/dto/register.dto.ts`, `auth/dto/login.dto.ts` — validation (`class-validator`).
- `auth/password.service.ts` — encapsule `bcryptjs` (hash, compare). Le reste du code n'importe
  jamais `bcryptjs` directement.
- `auth/jwt-auth.guard.ts` — lit `Authorization: Bearer <token>`, vérifie avec `JwtService`
  **injecté**, pose `request.user`, renvoie `false` (jamais une exception) si invalide.
- `auth/auth.service.ts` — `register` (hash + stockage, `ConflictException` si email pris) et
  `login` (vérifie, émet un JWT `{ sub, email }`, `UnauthorizedException` avec **le même message**
  que l'email soit inconnu ou le mot de passe faux).
- `auth/auth.controller.ts` — `POST /auth/register`, `POST /auth/login`, `GET /auth/me` (protégée).
- `auth/auth.module.ts` — assemble tout, y compris `JwtModule.register({...})`.

## Étapes (en friction)

1. `users.repository.ts`, puis les deux DTO.
2. `password.service.ts` — deux méthodes, `bcryptjs` fait le travail.
3. `auth.service.ts` — `register` d'abord (plus simple), puis `login`. Relis le test unitaire
   du message d'erreur identique : c'est une contrainte réelle, pas un détail.
4. `jwt-auth.guard.ts` — inspire-toi du Guard du lab 01, mais celui-ci a une dépendance
   injectée dans son constructeur.
5. `auth.controller.ts` puis `auth.module.ts`.
6. `npm run lab:02`.

## Vérifier

```bash
cd 09-nestjs/labs
npm install       # une fois par lab (dépendances propres à chaque dossier)
npm run lab:02
npm run check:02
```

**Ce que l'oracle vérifie**

Unitaire (9 cas) : `register` hash et ne renvoie jamais le hash, `ConflictException` sur doublon ;
`login` — même message d'erreur pour email inconnu et mot de passe faux, jamais de token émis sur
échec, token émis avec `{ sub, email }` sur succès. Le Guard, testé avec un **vrai** `JwtService`
(pas mocké : c'est lui qui produit/vérifie de vrais tokens) : refuse sans en-tête, refuse un
format non-Bearer, refuse une mauvaise signature, refuse un token expiré, accepte et pose
`request.user`. E2E (7 cas) : inscription réussie sans fuite de mot de passe, mot de passe trop
court rejeté par le DTO, doublon → 409, `/auth/me` sans token → 403, mauvais mot de passe → 401,
**le parcours complet** register → login → me avec le vrai token reçu, un token bricolé refusé.

## Variante J+30 (fading)

Ajoute `POST /auth/refresh` : accepte le token actuel (même s'il est sur le point d'expirer, pas
s'il est invalide) et en émet un nouveau. Écris le test e2e d'abord (y compris le cas « token
invalide → toujours refusé, refresh n'est pas une porte dérobée »), puis implémente.

## Application TribuZen

`tribuzen-api/src/auth/`, posé maintenant comme base ; l'OIDC/PKCE du cours Sécurité viendra
**remplacer** ce JWT local, pas s'y ajouter (cf note du cours 03 dans `PARCOURS-SYLVAIN.md`).
Commit : `feat(auth): register/login/me — hash, JWT, guard maison, tests unit+e2e`.
