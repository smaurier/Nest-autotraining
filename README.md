# Node.js, Express & NestJS — Maitriser le backend JavaScript/TypeScript

Formation complete sur Node.js, Express et NestJS : de l'event loop au deploiement en production (debutant -> expert).

**Ce cours couvre tout le spectre** : l'event loop Node.js, les modules, les streams, les serveurs HTTP natifs, Express (routing, middleware, validation, auth), NestJS (controllers, providers, DI, modules, pipes, guards, interceptors), TypeORM, Prisma, testing, authentification JWT, WebSockets, taches planifiees, files d'attente et deploiement Docker.

## Prerequis

- JavaScript courant (ES2020+, async/await, Promises)
- Notions de base en developpement web (HTTP, REST, JSON)
- Node.js 20+ installe
- npm installe
- VS Code (recommande)
- PostgreSQL 16 via Docker (pour les labs TypeORM/Prisma)
- Redis via Docker (pour les labs avances : queues, sessions)

## Structure

```
modules/        → 25 cours theoriques (Markdown)
labs/           → 24 labs pratiques executables (Node.js, Express, NestJS)
quizzes/        → 25 quizzes interactifs (HTML)
visualizations/ → 5 visualisations animees (HTML)
screencasts/    → 25 scripts de screencast (Markdown)
```

## Programme

| # | Module | Lab | Theme |
|---|--------|-----|-------|
| 00 | Prerequis & Le monde du backend | — | Introduction |
| 01 | Node.js — Event Loop & Asynchrone | Event loop en action | Node.js |
| 02 | Node.js — Modules, FS & Process | Modules & systeme de fichiers | Node.js |
| 03 | Node.js — Streams & Buffers | Streams en pratique | Node.js |
| 04 | Node.js — Serveur HTTP natif | Serveur HTTP from scratch | Node.js |
| 05 | Express — Fondamentaux | CRUD Express | Express |
| 06 | Express — Middleware & Architecture | Pipeline middleware | Express |
| 07 | Express — Validation & Gestion d'erreurs | Validation & error handling | Express |
| 08 | Express — Authentification & Securite | Auth JWT | Express |
| 09 | NestJS — Introduction & Premiers pas | Premiers pas NestJS | NestJS |
| 10 | NestJS — Controllers & Routing | Controllers & DTO | NestJS |
| 11 | NestJS — Providers & Injection de Dependances | Providers & DI | NestJS |
| 12 | NestJS — Modules & Architecture | Architecture modulaire | NestJS |
| 13 | NestJS — Pipes, Guards, Interceptors & Filters | Request pipeline | NestJS |
| 14 | TypeORM — Entites & Relations | Entites TypeORM | ORM |
| 15 | TypeORM — Requetes, Transactions & Migrations | Requetes avancees TypeORM | ORM |
| 16 | Prisma — Schema, Client & Migrations | Setup Prisma | ORM |
| 17 | Prisma — Requetes avancees & Comparaison | Prisma avance | ORM |
| 18 | NestJS — Testing | Tests unitaires & e2e | Testing |
| 19 | NestJS — Authentification & Autorisation | Auth complete NestJS | Auth |
| 20 | NestJS — Configuration & Swagger | Config & documentation API | Config |
| 21 | NestJS — WebSockets, Fichiers & Temps reel | WebSockets & upload | Temps reel |
| 22 | NestJS — Taches planifiees & Files d'attente | Queues & cron jobs | Queues |
| 23 | Performance & Deploiement | Docker & production | DevOps |
| 24 | Projet Final — API E-commerce complete | API complete | Synthese |

## Execution des labs

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

### Labs NestJS (09-24)

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
docker run --name pg-nest-course -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16

# Demarrer Redis via Docker (labs 22, 24)
docker run --name redis-nest-course -p 6379:6379 -d redis:7-alpine
```

## Duree estimee

~80h (25 modules : 1 module d'introduction + 24 modules x ~3h : lecture + lab + defi)

## Objectifs de sortie

A la fin de ce cursus, tu es capable de :
- Comprendre le fonctionnement interne de Node.js (event loop, libuv, V8)
- Manipuler les modules, le systeme de fichiers et les streams Node.js
- Creer un serveur HTTP natif et comprendre le protocole HTTP en detail
- Construire une API REST complete avec Express (routing, middleware, validation, auth)
- Maitriser NestJS de A a Z (controllers, providers, DI, modules, pipes, guards, interceptors, filters)
- Modeliser des donnees avec TypeORM et Prisma (entites, relations, migrations, requetes)
- Ecrire des tests unitaires, d'integration et e2e avec Jest et supertest
- Implementer l'authentification JWT et l'autorisation RBAC
- Configurer Swagger/OpenAPI pour documenter une API
- Utiliser les WebSockets pour le temps reel
- Mettre en place des taches planifiees et des files d'attente avec BullMQ
- Deployer une application NestJS avec Docker et PM2

## Niveau

**Debutant -> Expert.** Ce cours part des bases de Node.js et progresse jusqu'a la construction et le deploiement d'une API NestJS enterprise-grade complete.
