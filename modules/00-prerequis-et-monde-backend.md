---
titre: Prérequis et monde backend
cours: 09-nestjs
notions: [rôle du backend, modèle client-serveur, HTTP et JSON, runtime Node.js, npm et package.json, TypeScript côté serveur, objectif et parcours du cours]
outcomes: [situer le rôle d'un backend et le modèle client-serveur, comprendre ce que Node.js exécute, préparer un projet Node TypeScript, savoir où va le cours]
prerequis: [TypeScript labs 01-10]
next: 01-nodejs-event-loop
libs: [{ name: node, version: "22" }, { name: typescript, version: "^5" }]
tribuzen: poser les fondations de l'API backend TribuZen (familles, invitations, posts)
last-reviewed: 2026-07
---

# Prérequis et monde backend

> **Outcomes — tu sauras FAIRE :** situer le rôle d'un backend dans une architecture web, comprendre ce que Node.js exécute et en quoi il diffère du navigateur, initialiser un projet Node.js avec TypeScript, savoir où va ce cours.
> **Difficulté :** :star:
>
> **Portée :** ce module pose le vocabulaire et l'environnement. Pas de lab. Le module 01 démarre l'implémentation avec l'event loop et les I/O asynchrones.

| ← Précédent | Suivant → |
|---|---|
| *(début du cours)* | [01 — Node.js event loop](./01-nodejs-event-loop.md) |

## 1. Cas concret d'abord

Tu veux construire TribuZen — une app de gestion de familles. Le front affiche les familles, les invitations en attente, les posts de la communauté. Dans un composant Vue, tu écris :

```ts
// front/src/composables/useFamilies.ts
const res = await fetch('/api/families')
const families = await res.json()
```

La requête part... vers où ? Qui répond ? Qui vérifie que tu es authentifié ? Qui persiste les invitations en base ? Qui empêche un `guest` d'inviter un nouveau membre ? Le composant ne peut pas faire ça — il tourne dans le navigateur de l'utilisateur, son code est visible, il n'a pas accès à la base de données.

C'est le rôle du **backend** : le processus serveur qui reçoit `GET /api/families`, vérifie le token JWT, interroge la base, et retourne du JSON.

Ce module répond exactement à ça : qu'est-ce qui tourne côté serveur, comment le client lui parle via HTTP, quel runtime (Node.js) et quelle configuration TypeScript on va utiliser, et où ce cours nous emmène.

## 2. Théorie complète, concise

### 2.1 Rôle du backend

Le **backend** est le code qui s'exécute sur un serveur distant, invisible au navigateur. Il prend en charge :

| Responsabilité | Exemple TribuZen |
|---|---|
| Logique métier | seul un `owner` ou `admin` peut inviter |
| Stockage des données | familles, membres, posts en base |
| Authentification et autorisation | JWT, RBAC par rôle |
| Intégrations externes | envoi d'email d'invitation |
| Sécurité | validation des entrées, chiffrement |

**Piège fondamental :** ne jamais mettre de logique sensible dans le frontend. Le code JavaScript du navigateur est lisible et modifiable par n'importe quel utilisateur. La validation, les règles RBAC, et les accès base doivent toujours être vérifiés côté serveur.

### 2.2 Modèle client-serveur

Le web fonctionne sur le modèle **client-serveur** : c'est toujours le client qui initie la communication.

```
  Client (navigateur, app mobile)
      │
      │  1. Requête HTTP  →  GET /api/families
      ▼
  Serveur (Node.js / NestJS)
      │
      │  2. Traitement (auth, base de données, logique)
      │
      └─ 3. Réponse HTTP  →  200 OK  +  [{ id, name, ... }]
```

Le serveur ne contacte jamais le client de lui-même en HTTP classique. Pour du temps réel (chat, notifications), on utilise des WebSockets — un protocole différent, vu plus loin dans le cours.

Chaque requête HTTP est **stateless** : le serveur ne se souvient pas de la précédente. L'état (session, identité) est porté par le client dans chaque requête, typiquement via un header `Authorization: Bearer <jwt>`.

### 2.3 HTTP et JSON

**HTTP** (HyperText Transfer Protocol) est le protocole de communication entre client et serveur. Une requête HTTP se compose de :

```
POST /api/families HTTP/1.1
Host: api.tribuzen.app
Content-Type: application/json
Authorization: Bearer eyJhbGci...

{
  "name": "Les Dupont",
  "ownerId": "usr-42"
}
```

- **Ligne de requête** : méthode + chemin + version du protocole
- **Headers** : métadonnées (format du body, authentification, cache)
- **Body** : données envoyées (présent pour POST/PUT/PATCH)

#### Méthodes HTTP

| Méthode | Rôle | Idempotent | Body |
|---|---|---|---|
| GET | Lire une ressource | Oui | Non |
| POST | Créer une ressource | Non | Oui |
| PUT | Remplacer complètement | Oui | Oui |
| PATCH | Modifier partiellement | Non* | Oui |
| DELETE | Supprimer | Oui | Non |

**Idempotent** = répéter la même requête donne le même résultat. `DELETE /families/42` exécuté 5 fois donne toujours le même état final. `POST /families` exécuté 5 fois crée 5 familles — pas idempotent.

#### Codes de statut HTTP essentiels

| Famille | Codes clés | Sens |
|---|---|---|
| 2xx — Succès | 200 OK, 201 Created, 204 No Content | Tout s'est bien passé |
| 4xx — Erreur client | 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict | Le client a fait une erreur |
| 5xx — Erreur serveur | 500 Internal Server Error | Bug dans le code du serveur |

Règle : utiliser le code le plus précis. `201` pour une création (POST réussi), `204` pour une suppression (pas de body à retourner), `401` quand le token manque, `403` quand le token est valide mais le rôle insuffisant.

#### JSON comme format d'échange

JSON (JavaScript Object Notation) est le format standard des API REST. Le header `Content-Type: application/json` l'annonce dans les deux sens.

```ts
// Réponse de GET /api/families/fam-1
{
  "id": "fam-1",
  "name": "Les Dupont",
  "memberCount": 4,
  "createdAt": "2026-01-15T10:30:00Z"
}
```

Tout ce qui transite en JSON doit être sérialisable : pas de `Date`, `Map`, ou `Set` natifs — on les convertit en `string` (ISO 8601 pour les dates) ou en tableaux.

### 2.4 Runtime Node.js

**Node.js** est un runtime JavaScript côté serveur, basé sur le moteur **V8** de Chrome. Il exécute du JavaScript (ou TypeScript) en dehors du navigateur, avec accès au système de fichiers, réseau, et processus — ce que le navigateur interdit par sécurité.

Node.js **22 LTS** (Long Term Support depuis octobre 2024) est la version recommandée. Elle apporte :

- Support natif de TypeScript stable (type stripping sans `tsc` ni `ts-node` pour des scripts simples)
- `fetch` et `WebSocket` globaux sans polyfill
- Performances V8 améliorées

```bash
node --version   # v22.x.x
npm --version    # 10.x.x  (bundlé avec Node 22)
```

**Ce que Node.js expose que le navigateur n'a pas :**

| API | Module Node | Navigateur |
|---|---|---|
| Lecture de fichiers | `fs` | Non |
| Informations système | `os` | Non |
| Créer un serveur HTTP | `http` / `https` | Non |
| Variables d'environnement | `process.env` | Non |
| `document`, `window`, `DOM` | Non | Oui |
| `fetch` | Oui (Node 18+) | Oui |
| `console`, `setTimeout`, `JSON` | Oui | Oui |

Node.js est **single-threaded** avec un event loop non-bloquant — c'est le sujet du module 01. Ce point est critique pour comprendre pourquoi les I/O (fichiers, réseau, base de données) doivent être asynchrones.

### 2.5 npm et package.json

**npm** (Node Package Manager) est le gestionnaire de paquets livré avec Node.js. Initialiser un projet :

```bash
mkdir tribuzen-api
cd tribuzen-api
npm init -y          # crée package.json avec des valeurs par défaut
```

Anatomie du `package.json` :

```json
{
  "name": "tribuzen-api",
  "version": "1.0.0",
  "scripts": {
    "start": "node dist/main.js",
    "dev": "tsx watch src/main.ts",
    "build": "tsc --noEmit && tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "express": "^5.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "tsx": "^4.0.0",
    "@types/node": "^22.0.0"
  }
}
```

| Champ | Rôle |
|---|---|
| `scripts` | Raccourcis `npm run dev`, `npm run build` |
| `dependencies` | Paquets nécessaires en production |
| `devDependencies` | Paquets uniquement pour le développement (compilateur, types) |
| `version` | Versionnement sémantique `major.minor.patch` |

Le fichier `package-lock.json` verrouille les versions exactes de toutes les dépendances transitives. Ne pas l'éditer manuellement — le committer pour garantir des installations reproductibles.

### 2.6 TypeScript côté serveur

TypeScript apporte la vérification de types au code Node.js — indispensable pour une API : une propriété manquante dans un DTO ou un type de retour erroné est détecté à la compilation, pas en production.

**Configuration minimale pour Node.js 22 :**

```bash
npm install --save-dev typescript @types/node
npx tsc --init
```

`tsconfig.json` cible pour Node 22 :

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noEmit": false,
    "erasableSyntaxOnly": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**Deux approches pour le dev :**

| Outil | Commande | Quand l'utiliser |
|---|---|---|
| `tsx` (recommandé) | `tsx watch src/main.ts` | Dev rapide, pas de transpilation explicite |
| `tsc + node` | `tsc && node dist/main.js` | Build de production |
| Node 22 natif | `node src/main.ts` | Scripts simples sans `enum`, `namespace`, décorateurs |

**Note Node 22 :** le type stripping natif (`node file.ts`) est stable mais limité — il ne supporte pas les décorateurs TypeScript expérimentaux utilisés par NestJS. Pour NestJS, on utilisera la chaîne NestJS CLI + `@swc/core` qui gère ça correctement (module 09).

### 2.7 Objectif et parcours du cours

Ce cours suit une progression en trois blocs, avec TribuZen comme fil rouge à chaque étape :

| Bloc | Modules | Compétences | Couche TribuZen |
|---|---|---|---|
| Node.js fondamental | 00-04 | Event loop, modules ESM, streams, serveur HTTP natif | Comprendre le runtime sous NestJS |
| Express.js | 05-08 | Routing, middleware, validation, authentification JWT | API minimale TribuZen (familles) |
| NestJS | 09-12 | Controllers, providers, injection de dépendances, modules | API complète TribuZen (invitations, RBAC, posts) |

Les modules 01-04 recouvrent intentionnellement le cours `01-js-runtime` (event loop, V8, GC). Si tu l'as déjà fait, c'est une révision en contexte backend. Si non, tu découvres ici — `01-js-runtime` approfondira ensuite avec JIT et garbage collection.

## 3. Worked examples

### Exemple A — Premier projet Node.js TypeScript

Partir de zéro jusqu'à un script TypeScript qui s'exécute.

```bash
mkdir tribuzen-scratch
cd tribuzen-scratch
npm init -y
npm install --save-dev typescript @types/node tsx
```

```json
{
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

```ts
// src/index.ts
import { createServer, IncomingMessage, ServerResponse } from 'node:http'

const PORT = 3000

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  // Seule route : GET /api/status
  if (req.method === 'GET' && req.url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', service: 'tribuzen-api' }))
    return
  }

  // Toute autre route : 404
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(PORT, () => {
  console.log(`TribuZen API démarrée sur http://localhost:${PORT}`)
})
```

```bash
npm run dev
# TribuZen API démarrée sur http://localhost:3000

curl http://localhost:3000/api/status
# {"status":"ok","service":"tribuzen-api"}

curl http://localhost:3000/unknown
# {"error":"Not found"}
```

Pas-à-pas : (1) `node:http` est le module natif — préfixe `node:` recommandé depuis Node 22 pour distinguer les modules core des paquets npm ; (2) `tsx` exécute le TypeScript directement sans `tsc` — idéal pour le dev ; (3) `writeHead(200, { 'Content-Type': 'application/json' })` envoie la ligne de statut et les headers avant le body ; (4) `res.end(JSON.stringify(...))` sérialise l'objet en JSON et ferme la réponse.

### Exemple B — Lire une réponse HTTP à la main

Comprendre ce que le client reçoit réellement (pas juste ce que le navigateur affiche).

```bash
# curl -i affiche les headers + le body brut
curl -i http://localhost:3000/api/status
```

Sortie typique :

```
HTTP/1.1 200 OK
Content-Type: application/json
Date: Wed, 02 Jul 2026 14:00:00 GMT
Connection: keep-alive
Transfer-Encoding: chunked

{"status":"ok","service":"tribuzen-api"}
```

Lecture ligne par ligne : (1) `HTTP/1.1 200 OK` — protocole + code de statut + texte ; (2) `Content-Type: application/json` — le body est du JSON ; (3) ligne vide — séparation entre headers et body ; (4) body JSON.

C'est exactement ce que `fetch()` côté client reçoit. `res.json()` parse le body après avoir lu le header `Content-Type`.

## 4. Pièges & misconceptions

**"Validation côté client suffit."** Non. Tout ce qui s'exécute dans le navigateur peut être contourné (DevTools, Postman, scripts). Si seul le frontend valide qu'un champ `email` est requis, un attaquant peut envoyer une requête sans ce champ directement au serveur. La validation doit toujours exister côté backend — le frontend valide pour l'expérience utilisateur, pas pour la sécurité.

**"Node.js est multi-threadé comme Java."** Node.js est single-threaded. Un seul thread JavaScript exécute tout le code applicatif. C'est l'event loop qui donne l'illusion de parallélisme pour les I/O — mais bloquer ce thread avec un calcul CPU lourd (`while` infini, parsing d'un gros fichier en synchrone) bloque **toutes** les requêtes en cours. Conséquence directe : toujours utiliser les API asynchrones (`fs.promises.readFile`, `await db.query(...)`) jamais les variantes synchrones en production.

**"`401 Unauthorized` et `403 Forbidden` sont pareils."** Non. `401` signifie "je ne sais pas qui tu es" — le token est absent ou invalide, il faut s'authentifier. `403` signifie "je sais qui tu es, mais tu n'as pas le droit" — l'utilisateur est authentifié (token valide) mais son rôle (`member`) ne permet pas l'action. Confondre les deux produit des messages d'erreur trompeurs et des clients qui essaient de se reconnecter alors que le problème est d'autorisation.

**"Le `package-lock.json` est inutile."** Il verrouille les versions exactes de toutes les dépendances transitives. Sans lui, `npm install` peut installer des versions différentes selon la date d'exécution, introduisant des bugs impossibles à reproduire en CI. Il doit être commité dans le dépôt et jamais édité manuellement.

**"Node 22 exécute tout TypeScript nativement."** Le type stripping natif de Node 22 (`node file.ts`) fonctionne pour la syntaxe TypeScript "effaçable" (annotations, interfaces). Il ne supporte pas les décorateurs expérimentaux (`@Controller()`, `@Injectable()`) utilisés par NestJS, ni `enum` dans certains modes. Pour NestJS, la chaîne NestJS CLI + `@swc/core` reste indispensable.

## 5. Ancrage TribuZen

Couche fil rouge : **fondations de l'API backend TribuZen — familles, invitations, posts**.

- La requête `fetch('/api/families')` du front TribuZen (Vue/React) est le point de départ de ce cours. Tout ce qu'on construit ici est ce qui répond à cette requête.
- Le modèle client-serveur est la structure architecturale de TribuZen : le front (02-vue, déployé sur Vercel) appelle l'API (09-nestjs, déployée sur Railway/Fly) via HTTPS. Jamais l'inverse.
- Les codes de statut 401/403 sont au cœur du RBAC TribuZen : `owner` et `admin` peuvent inviter (route protégée → 403 pour `member`), tout utilisateur non authentifié → 401.
- Le `package.json` du projet TribuZen aura des scripts `dev` (tsx watch), `build` (NestJS CLI), `test` (Vitest) — la structure posée ici est exactement celle du vrai repo.
- Node.js 22 LTS est la version cible de déploiement TribuZen — les features utilisées (`fetch` natif, ESM, async/await) sont toutes disponibles sur cette version.

```
tribuzen-api/           ← racine du projet backend (créé dans ce cours)
  src/
    main.ts             ← point d'entrée (HTTP natif module 01, NestJS module 09)
    families/           ← resource REST (module 10)
    invitations/        ← resource REST + RBAC (module 11)
    posts/              ← resource REST (module 12)
  package.json          ← posé dans ce module
  tsconfig.json         ← posé dans ce module
```

## 6. Points clés

1. Le backend exécute la logique métier, le stockage, l'auth et les intégrations — tout ce que le navigateur ne peut pas faire de façon sécurisée.
2. Le modèle client-serveur est asymétrique : le client initie toujours, le serveur répond. Stateless — chaque requête est indépendante.
3. HTTP = méthode + URL + headers + body optionnel. Codes de statut : 2xx succès, 4xx erreur client (401 non authentifié, 403 non autorisé, 404 introuvable), 5xx erreur serveur.
4. JSON est le format d'échange universel des API REST. Les dates s'envoient en string ISO 8601.
5. Node.js 22 LTS est le runtime — single-threaded, basé sur V8, avec event loop non-bloquant. Les I/O doivent toujours être asynchrones.
6. `npm init -y` + `package.json` organise les dépendances (`dependencies` vs `devDependencies`) et les scripts (`dev`, `build`, `test`).
7. TypeScript côté serveur se configure avec `strict: true`, `target: ES2022`, `module: NodeNext`. `tsx` pour le dev, `tsc` pour le build.
8. Node 22 supporte le type stripping natif pour les scripts simples, mais NestJS (décorateurs) nécessite la chaîne CLI + `@swc/core`.

## 7. Seeds Anki

```
Quelle est la différence de rôle entre frontend et backend ?|Frontend = interface dans le navigateur (HTML/CSS/JS, code visible) ; Backend = logique, stockage, auth sur un serveur distant (code invisible, accès direct à la base)
Pourquoi HTTP est-il dit "stateless" ?|Chaque requête est indépendante — le serveur ne se souvient pas des précédentes. L'état est porté par le client (ex. token JWT dans le header Authorization) à chaque requête
Différence entre 401 et 403 ?|401 Unauthorized = non authentifié (token absent ou invalide, il faut se connecter) ; 403 Forbidden = authentifié mais rôle insuffisant pour cette action
Qu'est-ce que Node.js et sur quel moteur tourne-t-il ?|Runtime JavaScript côté serveur basé sur le moteur V8 de Chrome — permet d'exécuter du JS/TS hors navigateur avec accès à fs, http, os, process
Différence dependencies vs devDependencies dans package.json ?|dependencies = paquets nécessaires en production (express, nestjs) ; devDependencies = paquets uniquement pour le développement et le build (typescript, tsx, types)
Pourquoi le type stripping natif de Node 22 ne suffit pas pour NestJS ?|NestJS utilise des décorateurs TypeScript expérimentaux (@Controller, @Injectable) que le type stripping natif ne supporte pas — la chaîne NestJS CLI + @swc/core est indispensable
Quelle tsconfig target recommande-t-on pour Node 22 ?|target ES2022 avec module NodeNext et moduleResolution NodeNext — couvre toutes les features ES2022 disponibles nativement sur Node 22
Quel code HTTP retourner quand un POST crée une ressource avec succès ?|201 Created — pas 200 OK. 200 est pour GET/PUT/PATCH réussi, 204 No Content pour DELETE réussi sans body
```
