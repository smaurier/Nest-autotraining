# Lab 23 — Performance et déploiement

> **Outcome :** à la fin, tu sais dockeriser une app NestJS en multi-stage, exposer un health check live/ready avec Terminus v11, et configurer un arrêt gracieux — le container tourne réellement avec `docker run`.
> **Vrai outil :** Dockerfile multi-stage réel — `docker build` + `docker run` + `curl /health/live`.
> **Feedback :** le coach valide en session (pas de test-runner auto-correcteur).

## Énoncé

Tu dockerises l'API NestJS existante dans ce lab (`09-nestjs/labs/lab-23-docker-deploy/`). Pas de gap-fill — tu écris le Dockerfile, le `HealthModule` et configures le graceful shutdown de A à Z à partir du projet NestJS vide.

Objectif fonctionnel :

- `docker build -t tribuzen-api .` passe sans erreur
- `docker run -p 3000:3000 tribuzen-api` → l'app répond sur le port 3000
- `GET /health/live` → `{ "status": "ok" }` (200)
- `GET /health/ready` → `{ "status": "ok", "info": { "memory_heap": { "status": "up" } } }` (200)
- `docker image ls tribuzen-api` → taille < 300 MB
- `docker stop <container>` → log `Application shutdown` visible, exit 0

## Étapes (en friction)

1. Créer `.dockerignore` à la racine du projet. Exclure au minimum : `node_modules`, `dist`, `.git`, `.env`, `.env.*`, `coverage`.

2. Écrire `Dockerfile` avec **deux stages nommés** `builder` et `runner`. Stage `builder` : `node:20-alpine`, copier `package*.json`, `npm ci`, copier les sources, `npm run build`. Stage `runner` : `node:20-alpine`, créer un utilisateur `nestjs` non-root, copier `dist/` et `package*.json` depuis `builder`, `npm ci --omit=dev`, `chown`, `USER nestjs`, `ENV NODE_ENV=production`, `EXPOSE 3000`, `HEALTHCHECK`, `CMD ["node", "dist/main.js"]`.

3. Installer `@nestjs/terminus`. Créer `src/health/health.module.ts` avec `TerminusModule.forRoot({ gracefulShutdownTimeoutMs: 3000 })`. Créer `src/health/health.controller.ts` avec deux routes : `GET /health/live` (check vide — liveness) et `GET /health/ready` (check mémoire heap 512 MB max via `MemoryHealthIndicator`). Importer `HealthModule` dans `AppModule`.

4. Dans `src/main.ts`, ajouter `app.enableShutdownHooks()` avant `app.listen()`. Vérifier que le log `Application shutdown` (ou `Application is closing`) apparaît lors d'un `Ctrl+C`.

5. Construire l'image, la lancer, vérifier les deux endpoints health avec `curl`. Inspecter la taille avec `docker image ls`. Arrêter proprement avec `docker stop`.

## Corrigé complet commenté

```bash
# .dockerignore
node_modules
dist
.git
.env
.env.*
coverage
*.md
```

```dockerfile
# Dockerfile

# ── Stage 1 : builder ─────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copier lockfile en premier — Docker met ce layer en cache
# tant que package.json ne change pas → npm ci plus rapide
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build   # → dist/main.js

# ── Stage 2 : runner ──────────────────────────────────────────
FROM node:20-alpine AS runner

# Utilisateur non-root — si l'app est compromise,
# l'attaquant n'a pas de droits root sur le container
RUN addgroup --system --gid 1001 nestjs \
 && adduser  --system --uid 1001 --ingroup nestjs nestjs

WORKDIR /app

# Seulement le dist compilé depuis le builder
COPY --from=builder /app/dist          ./dist
COPY --from=builder /app/package*.json ./
# devDependencies exclues — ~200 MB au lieu de ~600 MB de node_modules
RUN npm ci --omit=dev

RUN chown -R nestjs:nestjs /app
USER nestjs

ENV NODE_ENV=production
EXPOSE 3000

# Docker Compose utilise ce HEALTHCHECK
# K8s utilise livenessProbe/readinessProbe dans le manifest YAML
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/health/live || exit 1

CMD ["node", "dist/main.js"]
```

```ts
// src/health/health.module.ts
import { Module } from '@nestjs/common'
import { TerminusModule } from '@nestjs/terminus'
import { HealthController } from './health.controller'

@Module({
  imports: [
    TerminusModule.forRoot({
      // Attend 3 s après SIGTERM avant d'arrêter l'app
      // Laisse l'ingress (Nginx, Render, K8s) rediriger le trafic
      // vers d'autres instances — zéro 502 pendant le rolling deploy
      gracefulShutdownTimeoutMs: 3000,
    }),
  ],
  controllers: [HealthController],
})
export class HealthModule {}
```

```ts
// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common'
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus'

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  // Liveness — check vide : le process répond = vivant
  // K8s redémarre le pod si ce check échoue (timeout ou 503)
  @Get('live')
  @HealthCheck()
  liveness() {
    return this.health.check([])
  }

  // Readiness — K8s ne route pas de trafic si ce check échoue
  // Utile au démarrage (warming up) et en cas de fuite mémoire
  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.health.check([
      // 512 MB heap max — alert si l'app fuite mémoire
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),
    ])
  }
}
```

```ts
// src/main.ts
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Sans enableShutdownHooks(), SIGTERM tue le process instantanément.
  // Toutes les requêtes en vol retournent une connexion coupée.
  // Avec enableShutdownHooks() + gracefulShutdownTimeoutMs :
  // NestJS écoute le signal, Terminus ajoute le délai de drain.
  app.enableShutdownHooks()

  await app.listen(process.env.PORT ?? 3000)
}
bootstrap()
```

```ts
// src/app.module.ts (extrait — ajouter HealthModule)
import { Module } from '@nestjs/common'
import { HealthModule } from './health/health.module'

@Module({
  imports: [
    HealthModule,
    // ...autres modules
  ],
})
export class AppModule {}
```

```bash
# Vérifications step-by-step
docker build -t tribuzen-api .

# Lancer en arrière-plan
docker run -d -p 3000:3000 --name tz tribuzen-api

# Health checks
curl http://localhost:3000/health/live
# {"status":"ok","info":{},"error":{},"details":{}}

curl http://localhost:3000/health/ready
# {"status":"ok","info":{"memory_heap":{"status":"up"}},...}

# Taille de l'image
docker image ls tribuzen-api
# REPOSITORY      TAG     SIZE
# tribuzen-api    latest  ~180MB  ← vs ~900 MB sans multi-stage

# Arrêt gracieux
docker stop tz
# → logs : "Application is closing" puis exit 0
```

## Variante J+30 (fading)

Même exercice, sans consulter le corrigé. Contraintes supplémentaires :

1. Installer `@nestjs/cache-manager cache-manager`. Mettre en cache `GET /` (route racine de l'app) pendant 10 s via `CacheInterceptor` et `CacheTTL(10_000)`. Vérifier avec `curl` que deux appels rapides ne ré-exécutent pas le handler (ajouter un `console.log` pour confirmer). Observer que le TTL est en millisecondes.

2. Ajouter au `Dockerfile` un label OCI : `LABEL org.opencontainers.image.description="TribuZen API"`. Vérifier avec `docker inspect tribuzen-api` que le label est présent.

3. Dans `HealthController.readiness()`, ajouter un check RSS (`memory.checkRSS('memory_rss', 1024 * 1024 * 1024)`) en plus du check heap. Observer la réponse JSON et expliquer en commentaire la différence entre heap et RSS.

Temps cible : 30 minutes sans le corrigé.

## Application TribuZen

Commit cible dans `smaurier/tribuzen` :

```
feat(infra): Dockerfile multi-stage + health check Terminus + graceful shutdown
```

Fichiers à créer :

- `apps/api/Dockerfile`
- `apps/api/.dockerignore`
- `apps/api/src/health/health.module.ts`
- `apps/api/src/health/health.controller.ts`
- `apps/api/src/main.ts` (ajout de `enableShutdownHooks()`)

Critère de done : `docker build` passe sans erreur, `GET /health/ready` répond 200, `docker stop` produit le log `Application is closing` et exit 0.
