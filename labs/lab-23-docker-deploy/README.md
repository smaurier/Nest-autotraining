# Lab 23 — Docker & Deploy

## Objectifs

- Créer un Dockerfile multi-stage pour une app NestJS
- Configurer docker-compose avec plusieurs services
- Implementer un endpoint de health check avec @nestjs/terminus
- Comprendre le .dockerignore

## Description

Vous allez containeriser une application NestJS avec Docker et ajouter un endpoint
de health check pour le monitoring.

## Instructions

### 1. Dockerfile

Creez un Dockerfile multi-stage :

**Stage 1 - Builder** :
- Utiliser `node:20-alpine` comme image de base
- Copier package.json et installer les dépendances
- Copier le code source et builder avec `npm run build`

**Stage 2 - Runner** :
- Utiliser `node:20-alpine` comme image de base
- Copier uniquement les fichiers nécessaires depuis le builder
- Exposer le port 3000
- Démarrer avec `node dist/main`

### 2. docker-compose.yml

Configurez les services :
- **app** : l'application NestJS
- **postgres** : base de donnees PostgreSQL
- **redis** : cache Redis

### 3. .dockerignore

Ajoutez les fichiers a ignorer lors du build Docker.

### 4. Health Controller

Implementez GET /health qui retourne l'état de l'application en utilisant
HealthCheckService de @nestjs/terminus.

## Validation

```bash
npm test
```

## Fichiers a modifier

- `Dockerfile`
- `docker-compose.yml`
- `.dockerignore`
- `src/health/health.controller.ts`
