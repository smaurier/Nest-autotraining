# Node.js, Express & NestJS — Maîtriser le backend JavaScript/TypeScript

![VitePress](https://img.shields.io/badge/-VitePress-646CFF?style=flat-square&logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
[![fullstack-autotraining](https://img.shields.io/badge/curriculum-fullstack--autotraining-4C1?style=flat-square)](https://github.com/smaurier/fullstack-autotraining)

Formation complete sur Node.js, Express et NestJS : de l'event loop au déploiement en production (débutant -> expert).

**Ce cours couvre tout le spectre** : l'event loop Node.js, les modules, les streams, les serveurs HTTP natifs, Express (routing, middleware, validation, auth), NestJS (controllers, providers, DI, modules, pipes, guards, interceptors), TypeORM, Prisma, testing, authentification JWT, WebSockets, taches planifiees, files d'attente, déploiement Docker, MongoDB/Mongoose et GraphQL.

<!-- labs-gestes:start -->
## Labs — refonte du 22/09/2026 : un lab = un geste métier complet

> Règle qualité 5 du parcours : chaque lab est **un geste métier complet**, sous deux formes — **Zéro** (construire de zéro un artefact réel et entier) ou **Intervention** (modifier de l'existant avec consommateurs, findings avant code, non-régression). Un lab n'entre en file qu'avec un **oracle exécutable** (`src/` starter · `test/` · `solution/` séparée). Les labs historiques de ce cours (un concept par lab, sans oracle) restent dans `labs/` jusqu'à remplacement et **ne sont plus la file**. Cible détaillée : [`docs/gestes-complets.md`](../docs/gestes-complets.md). État : **5/8 avec oracle**.

| # | Lab | Forme | Geste | Oracle |
|---|-----|-------|-------|--------|
| 01 | [`lab-01-api-de-zero`](labs/lab-01-api-de-zero/README.md) | Zéro | module, DTO + validation, guard, service, repository, tests unit + e2e, Docker, jusqu'au curl | ✅ vérifié |
| 02 | [`lab-02-auth-jwt-de-zero`](labs/lab-02-auth-jwt-de-zero/README.md) | Zéro | AuthModule complet avec tests | ✅ vérifié |
| 03 | [`lab-03-websockets-de-zero`](labs/lab-03-websockets-de-zero/README.md) | Zéro | NotificationsGateway temps réel testée | ✅ vérifié |
| 04 | [`lab-04-clean-archi-de-zero`](labs/lab-04-clean-archi-de-zero/README.md) | Zéro | domain/application/infrastructure avec tests de frontière | ✅ vérifié |
| 05 | [`lab-05-ajouter-un-endpoint`](labs/lab-05-ajouter-un-endpoint/README.md) | Intervention | API existante consommée par un front, contrat OpenAPI à ne pas casser | ✅ vérifié |
| 06 | `lab-06-faille-autorisation` | Intervention | faille rapportée à reproduire, corriger, tester | · à écrire |
| 07 | `lab-07-migrer-nestjs-11` | Intervention | migrer le lab-18 historique (pinné ^10) vers NestJS 11 | · à écrire |
| 08 | `lab-08-relire-une-pr-api` | Intervention | findings avant vérité | · à écrire |

<!-- labs-gestes:end -->

## Prérequis

- JavaScript courant (ES2020+, async/await, Promises)
- Notions de base en développement web (HTTP, REST, JSON)
- Node.js 20+ installe
- npm installe
- VS Code (recommande)
- PostgreSQL 17 via Docker (pour les labs TypeORM/Prisma)
- Redis via Docker (pour les labs avances : queues, sessions)

## Structure

```
modules/        → 27 cours theoriques (Markdown)
labs/           → 26 labs pratiques executables (Node.js, Express, NestJS)
quizzes/        → 27 quizzes interactifs (HTML)
visualizations/ → 5 visualisations animees (HTML)
screencasts/    → 27 scripts de screencast (Markdown)
```

## Programme

| #   | Module                                         | Lab                                    | Theme            |
| --- | ---------------------------------------------- | -------------------------------------- | ---------------- |
| 00  | Prérequis & Le monde du backend                | —                                      | Introduction     |
| 01  | Node.js — Event Loop & Asynchrone              | Event loop en action                   | Node.js          |
| 02  | Node.js — Modules, FS & Process                | Modules & système de fichiers          | Node.js          |
| 03  | Node.js — Streams & Buffers                    | Streams en pratique                    | Node.js          |
| 04  | Node.js — Serveur HTTP natif                   | Serveur HTTP from scratch              | Node.js          |
| 05  | Express — Fondamentaux                         | CRUD Express                           | Express          |
| 06  | Express — Middleware & Architecture            | Pipeline middleware                    | Express          |
| 07  | Express — Validation & Gestion d'erreurs       | Validation & error handling            | Express          |
| 08  | Express — Authentification & Sécurité          | Auth JWT                               | Express          |
| 09  | NestJS — Introduction & Premiers pas           | Premiers pas NestJS                    | NestJS           |
| 10  | NestJS — Controllers & Routing                 | Controllers & DTO                      | NestJS           |
| 11  | NestJS — Providers & Injection de Dependances  | Providers & DI                         | NestJS           |
| 12  | NestJS — Modules & Architecture                | Architecture modulaire                 | NestJS           |
| 13  | NestJS — Pipes, Guards, Interceptors & Filters | Request pipeline                       | NestJS           |
| 14  | TypeORM — Entites & Relations                  | Entites TypeORM                        | ORM              |
| 15  | TypeORM — Requetes, Transactions & Migrations  | Requetes avancees TypeORM              | ORM              |
| 16  | Prisma — Schema, Client & Migrations           | Setup Prisma                           | ORM              |
| 17  | Prisma — Requetes avancees & Comparaison       | Prisma avance                          | ORM              |
| 18  | NestJS — Testing                               | Tests unitaires & e2e                  | Testing          |
| 19  | NestJS — Authentification & Autorisation       | Auth complete NestJS                   | Auth             |
| 20  | NestJS — Configuration & Swagger               | Config & documentation API             | Config           |
| 21  | NestJS — WebSockets, Fichiers & Temps réel     | WebSockets & upload                    | Temps réel       |
| 22  | NestJS — Taches planifiees & Files d'attente   | Queues & cron jobs                     | Queues           |
| 23  | Performance & Déploiement                      | Docker & production                    | DevOps           |
| 24  | Projet Final — API E-commerce complete         | API complete                           | Synthese         |
| 25  | MongoDB & Mongoose                             | CRUD NoSQL & aggregation               | NoSQL            |
| 26  | GraphQL avec NestJS                            | Schema GraphQL, resolvers & DataLoader | API alternatives |

## Exécution des labs

### Labs Node.js & Express (01-08)

```bash
# Installer les dependances racine
npm install

# Executer un exercice
node labs/lab-01-event-loop/exercise.js

# Comparer avec la solution
node labs/lab-01-event-loop/solution.js

# Ou via les scripts npm
npm run lab:01
npm run solution:01
```

### Labs NestJS (09-26)

```bash
# Se placer dans le dossier du lab
cd labs/lab-09-nestjs-premiers-pas

# Installer les dependances du lab
npm install

# Lancer les tests
npm test

# Lancer les tests de la solution
npm run test:solution

# Ou depuis la racine via les scripts npm
npm run lab:09
npm run solution:09
```

### Services externes

```bash
# Demarrer PostgreSQL via Docker (labs 14-17, 19, 24)
docker run --name pg-nest-course -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:17

# Demarrer Redis via Docker (labs 22, 24)
docker run --name redis-nest-course -p 6379:6379 -d redis:7-alpine
```

## Duree estimee

~95h (27 modules : 1 module d'introduction + 26 modules x ~3h30 en moyenne : lecture + lab + defi)

## Objectifs de sortie

A la fin de ce cursus, tu es capable de :

- Comprendre le fonctionnement interne de Node.js (event loop, libuv, V8)
- Manipuler les modules, le système de fichiers et les streams Node.js
- Créer un serveur HTTP natif et comprendre le protocole HTTP en detail
- Construire une API REST complete avec Express (routing, middleware, validation, auth)
- Maîtriser NestJS de A a Z (controllers, providers, DI, modules, pipes, guards, interceptors, filters)
- Modeliser des donnees avec TypeORM et Prisma (entites, relations, migrations, requêtes)
- Écrire des tests unitaires, d'intégration et e2e avec Jest et supertest
- Implementer l'authentification JWT et l'autorisation RBAC
- Configurer Swagger/OpenAPI pour documenter une API
- Utiliser les WebSockets pour le temps réel
- Mettre en place des taches planifiees et des files d'attente avec BullMQ
- Concevoir des traitements asynchrones fiables (retries, idempotence, gestion des erreurs transitoires)
- Diagnostiquer un flux backend en production avec logs structures, correlation id et indicateurs techniques
- Déployer une application NestJS avec Docker et PM2
- Manipuler MongoDB avec Mongoose dans une application NestJS
- Exposer une API GraphQL avec resolvers, schema et DataLoader

## Niveau

**Débutant -> Expert.** Ce cours part des bases de Node.js et progresse jusqu'à la construction et le déploiement d'une API NestJS enterprise-grade complete.

## Lancer le cours

```bash
npm install          # une seule fois
npm run docs:dev     # ouvre http://localhost:5173
```

Le site s'ouvre avec une sidebar navigable. Commence par le premier module (00).
