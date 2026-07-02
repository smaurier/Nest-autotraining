---
titre: Performance et déploiement
cours: 09-nestjs
notions: [cache avec cache-manager, compression des réponses, Docker multi-stage pour NestJS, variables d'environnement en production, health checks avec terminus, logging structuré, arrêt gracieux, bonnes pratiques de déploiement]
outcomes: [mettre en cache des réponses, dockeriser une app NestJS en multi-stage, exposer un health check, configurer un arrêt gracieux et un logging structuré pour la prod]
prerequis: [22-nestjs-jobs-queues]
next: 24-nestjs-projet-final
libs: [{ name: "@nestjs/cache-manager", version: "^3" }, { name: "@nestjs/terminus", version: "^11" }]
tribuzen: dockeriser et durcir pour la prod l'API TribuZen (cache, health check, graceful shutdown)
last-reviewed: 2026-07
---

# Performance et déploiement

> **Outcomes — tu sauras FAIRE :** mettre en cache des réponses avec `@nestjs/cache-manager`, dockeriser une app NestJS en multi-stage, exposer un health check avec Terminus v11, configurer un arrêt gracieux et un logging structuré pour la prod.
> **Difficulté :** :star::star::star::star:

## 1. Cas concret d'abord

L'API TribuZen répond à `GET /families`. Chaque requête interroge Prisma → PostgreSQL : 80 ms en local, 200 ms avec la latence réseau en prod. Un `SIGTERM` pendant un rolling deploy tue les requêtes en vol. Kubernetes ne sait pas si le pod est prêt à recevoir du trafic. L'image Docker pèse 900 MB parce qu'elle embarque les `devDependencies`.

Tu essaies de déployer sur Render.com et tu constates :

```bash
# Rolling deploy — le pod redémarre avant que le nouveau soit prêt
# curl http://api.tribuzen.io/families
# ← 502 Bad Gateway (20-40 s d'indisponibilité)
```

Ce module résout les quatre problèmes dans l'ordre d'impact : cache (réponses < 1 ms au lieu de 200 ms), health check (l'orchestrateur sait quand le pod est prêt), graceful shutdown (requêtes en vol terminées proprement), Dockerfile multi-stage (image < 200 MB, pull 4× plus rapide).

## 2. Théorie complète, concise

### 2.1 Cache avec @nestjs/cache-manager v3

`@nestjs/cache-manager` v3 est un module NestJS qui encapsule `cache-manager` v5. Il utilise [Keyv](https://keyv.org/) comme abstraction de store : une interface unique, plusieurs backends (mémoire, Redis, Memcached) sans changer le code applicatif.

```bash
npm i @nestjs/cache-manager cache-manager
# Store Redis en production
npm i @keyv/redis cacheable
```

**Enregistrement global — mémoire (dev) :**

```ts
// app.module.ts
import { CacheModule } from '@nestjs/cache-manager'

@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,  // CACHE_MANAGER injectable partout sans réimporter
      ttl: 60_000,     // ⚠️ millisecondes en v3 (pas secondes) — 60 000 ms = 60 s
      max: 200,        // nombre max d'entrées en mémoire
    }),
  ],
})
export class AppModule {}
```

**Enregistrement async — Redis prod, mémoire dev :**

```ts
// app.module.ts
import { CacheModule } from '@nestjs/cache-manager'
import { ConfigModule, ConfigService } from '@nestjs/config'
import Keyv from 'keyv'
import { CacheableMemory } from 'cacheable'
import KeyvRedis from '@keyv/redis'

CacheModule.registerAsync({
  isGlobal: true,
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const isProd = config.get('NODE_ENV') === 'production'
    if (isProd) {
      return {
        stores: [
          new KeyvRedis(config.get<string>('REDIS_URL', 'redis://localhost:6379')),
        ],
      }
    }
    return {
      stores: [
        new Keyv({ store: new CacheableMemory({ ttl: 60_000, lruSize: 5000 }) }),
      ],
    }
  },
})
```

**Injection et API :**

```ts
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cache } from 'cache-manager'
import { Inject, Injectable } from '@nestjs/common'

@Injectable()
export class FamilyService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async findAll(): Promise<Family[]> {
    const key = 'families:all'
    const cached = await this.cache.get<Family[]>(key)
    if (cached) return cached  // retour < 1 ms

    const families = await this.prisma.family.findMany()
    await this.cache.set(key, families, 300_000)  // 5 min en ms
    return families
  }

  async update(id: string, data: Partial<Family>): Promise<Family> {
    const updated = await this.prisma.family.update({ where: { id }, data })
    // Invalider après mutation — prochain findAll reconstruira depuis Prisma
    await this.cache.del('families:all')
    await this.cache.del(`family:${id}`)
    return updated
  }
}
```

**`CacheInterceptor`** — cache automatique sur les routes GET :

```ts
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager'
import { UseInterceptors, Get, Controller } from '@nestjs/common'

@Controller('families')
@UseInterceptors(CacheInterceptor)  // toutes les routes GET du controller
export class FamilyController {
  @Get()
  @CacheTTL(300_000)  // override du TTL global — 5 min
  findAll() {
    return this.familyService.findAll()
  }
}
```

### 2.2 Compression des réponses

```bash
npm i compression && npm i -D @types/compression
```

```ts
// main.ts
import * as compression from 'compression'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.use(compression({ threshold: 1024 }))  // compresser si réponse > 1 Ko
  await app.listen(process.env.PORT ?? 3000)
}
```

En production, déléguer à Nginx (zéro CPU applicatif) :

```nginx
gzip on;
gzip_min_length 1024;
gzip_types application/json text/plain;
```

### 2.3 Docker multi-stage pour NestJS

Un Dockerfile multi-stage produit deux images intermédiaires : `builder` (compile TypeScript + installe toutes les deps) et `runner` (exécute seulement le JS compilé + prod deps). L'image finale n'embarque ni TypeScript, ni les `devDependencies`, ni le code source brut.

```dockerfile
# Stage 1 — builder : installe tout, compile
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci                  # lockfile strict, build reproductible

COPY . .
RUN npm run build           # → dist/main.js + dist/**

# Stage 2 — runner : image finale allégée
FROM node:20-alpine AS runner

# Utilisateur non-root — bonne pratique sécurité obligatoire
RUN addgroup --system --gid 1001 nestjs \
 && adduser  --system --uid 1001 --ingroup nestjs nestjs

WORKDIR /app

COPY --from=builder /app/dist          ./dist
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev                  # prod deps seulement (~200 MB vs ~600 MB)

RUN chown -R nestjs:nestjs /app
USER nestjs                            # le process tourne sans droits root

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/health/live || exit 1

CMD ["node", "dist/main.js"]
```

**`.dockerignore`** — indispensable pour exclure `node_modules` (slow COPY) et `.env` (fuite de secrets) :

```bash
node_modules
dist
.git
.env
.env.*
coverage
*.md
```

### 2.4 Variables d'environnement en production

Valider les variables obligatoires au démarrage avec Joi — l'app refuse de démarrer avec un message d'erreur clair plutôt que de crasher en prod avec un `undefined` mystérieux :

```ts
// app.module.ts
import * as Joi from 'joi'
import { ConfigModule } from '@nestjs/config'

ConfigModule.forRoot({
  isGlobal: true,
  validationSchema: Joi.object({
    DATABASE_URL: Joi.string().required(),
    JWT_SECRET:   Joi.string().min(32).required(),
    REDIS_URL:    Joi.string().uri().optional(),
    NODE_ENV:     Joi.string()
                    .valid('development', 'production', 'test')
                    .default('development'),
    PORT:         Joi.number().default(3000),
  }),
})
```

Jamais de secrets en dur dans le `Dockerfile` (ni `ENV JWT_SECRET=...`). Passer via `docker run --env-file .env.prod` ou les secrets de l'orchestrateur (K8s Secrets, Render environment).

### 2.5 Health checks avec @nestjs/terminus v11

Terminus expose des endpoints que l'orchestrateur interroge pour décider du routage du trafic :

- `/health/live` — **liveness** : le process tourne-t-il ? (200 = vivant, K8s redémarre le pod si échoue)
- `/health/ready` — **readiness** : les dépendances sont-elles prêtes ? (K8s ne route pas de trafic si échoue)

```bash
npm i @nestjs/terminus
```

```ts
// health/health.module.ts
import { Module } from '@nestjs/common'
import { TerminusModule } from '@nestjs/terminus'
import { HealthController } from './health.controller'

@Module({
  imports: [
    TerminusModule.forRoot({
      // Attend 3 s après SIGTERM avant d'arrêter l'app
      // Laisse l'ingress rediriger le trafic vers d'autres pods
      gracefulShutdownTimeoutMs: 3000,
    }),
  ],
  controllers: [HealthController],
})
export class HealthModule {}
```

```ts
// health/health.controller.ts
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

  // Liveness — check vide : si le process répond = vivant
  @Get('live')
  @HealthCheck()
  liveness() {
    return this.health.check([])
  }

  // Readiness — DB et mémoire vérifiées
  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),  // 512 MB max
    ])
  }
}
```

Réponse JSON (statut 200) :

```json
{
  "status": "ok",
  "info": { "memory_heap": { "status": "up" } },
  "error": {},
  "details": { "memory_heap": { "status": "up" } }
}
```

Si un indicateur échoue, le statut HTTP passe à 503 et le payload indique le composant en erreur.

### 2.6 Logging structuré

En production, les logs doivent être en JSON (ingérables par Datadog, Grafana Loki, CloudWatch). `nestjs-pino` remplace le logger intégré NestJS par Pino, le logger Node.js le plus rapide :

```bash
npm i nestjs-pino pino-http
npm i -D pino-pretty
```

```ts
// app.module.ts
import { LoggerModule } from 'nestjs-pino'

LoggerModule.forRoot({
  pinoHttp: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
      : undefined,  // JSON brut en production
    redact: ['req.headers.authorization', 'req.body.password'],
  },
})
```

```ts
// main.ts
import { Logger } from 'nestjs-pino'

const app = await NestFactory.create(AppModule, { bufferLogs: true })
app.useLogger(app.get(Logger))
```

### 2.7 Arrêt gracieux

Sans `enableShutdownHooks()`, NestJS ignore `SIGTERM` — le process meurt immédiatement et toutes les requêtes en vol retournent une erreur 500.

```ts
// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.enableShutdownHooks()  // écoute SIGTERM et SIGINT
  await app.listen(process.env.PORT ?? 3000)
}
```

`TerminusModule.forRoot({ gracefulShutdownTimeoutMs: 3000 })` ajoute un délai après `SIGTERM` — pendant ces 3 s, l'ingress redirige le trafic vers d'autres pods avant que le pod s'arrête. Cycle complet :

```
SIGTERM reçu
    ↓
Terminus attend gracefulShutdownTimeoutMs (3 s)
    ↓
beforeApplicationShutdown() — requêtes en vol encore traitées
    ↓
onModuleDestroy() — nettoyage de chaque module
    ↓
onApplicationShutdown() — fermeture connexions (Prisma, Redis)
    ↓
process.exit(0)
```

Implémenter `OnApplicationShutdown` dans `PrismaService` pour fermer la connexion proprement :

```ts
// prisma/prisma.service.ts
import { Injectable, OnApplicationShutdown } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnApplicationShutdown {
  async onApplicationShutdown() {
    await this.$disconnect()  // ferme le pool de connexions PostgreSQL
  }
}
```

## 3. Worked examples

### Exemple A — Cache des familles TribuZen avec invalidation

```ts
// src/family/family.service.ts
import { Injectable, Inject } from '@nestjs/common'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cache } from 'cache-manager'
import { PrismaService } from '../prisma/prisma.service'

export interface Family {
  id: string
  name: string
  memberCount: number
}

// Constantes nommées — évite d'écrire 300 quand on veut 300 000 ms
const FAMILIES_ALL_KEY = 'families:all'
const FAMILY_TTL_MS    = 300_000  // 5 minutes

@Injectable()
export class FamilyService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async findAll(): Promise<Family[]> {
    // 1. Cache-aside — chercher en cache avant Prisma
    const cached = await this.cache.get<Family[]>(FAMILIES_ALL_KEY)
    if (cached) return cached  // < 1 ms — Prisma non sollicité

    // 2. Cache miss — interroger la DB (100-200 ms en prod)
    const families = await this.prisma.family.findMany({
      select: { id: true, name: true, memberCount: true },
    })

    // 3. Stocker pour les prochains appelants
    await this.cache.set(FAMILIES_ALL_KEY, families, FAMILY_TTL_MS)
    return families
  }

  async findOne(id: string): Promise<Family | null> {
    const key = `family:${id}`
    const cached = await this.cache.get<Family>(key)
    if (cached) return cached

    const family = await this.prisma.family.findUnique({ where: { id } })
    if (family) await this.cache.set(key, family, FAMILY_TTL_MS)
    return family
  }

  async update(id: string, data: Partial<Family>): Promise<Family> {
    const updated = await this.prisma.family.update({ where: { id }, data })

    // Invalider les deux clés stales — l'ordre n'a pas d'importance
    await this.cache.del(FAMILIES_ALL_KEY)
    await this.cache.del(`family:${id}`)

    return updated
  }
}
```

```ts
// src/app.module.ts (extrait cache — configuration complète)
import { Module } from '@nestjs/common'
import { CacheModule } from '@nestjs/cache-manager'
import { ConfigModule, ConfigService } from '@nestjs/config'
import Keyv from 'keyv'
import { CacheableMemory } from 'cacheable'
import KeyvRedis from '@keyv/redis'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        if (config.get('NODE_ENV') === 'production') {
          return {
            stores: [
              new KeyvRedis(config.get<string>('REDIS_URL', 'redis://localhost:6379')),
            ],
          }
        }
        // Dev — mémoire LRU, TTL 60 s, 5 000 entrées max
        return {
          stores: [
            new Keyv({ store: new CacheableMemory({ ttl: 60_000, lruSize: 5000 }) }),
          ],
        }
      },
    }),
    // ...autres modules
  ],
})
export class AppModule {}
```

**Pas-à-pas :** (1) `isGlobal: true` — `CACHE_MANAGER` injectable dans toute l'app sans réimporter `CacheModule` dans chaque module ; (2) `useFactory` retourne un store différent selon `NODE_ENV` — même code applicatif en dev et prod, seul le backend change ; (3) `cache.get<Family[]>(key)` — le générique type le retour, `undefined` si miss (pas `null`) ; (4) `cache.del()` après `update` — invalidation manuelle ; le prochain `findAll()` reconstruira depuis Prisma puis remettra en cache ; (5) TTL en ms — la constante `FAMILY_TTL_MS = 300_000` rend l'intention claire et empêche l'erreur `300` (300 ms) au lieu de `300_000` (5 min).

### Exemple B — Dockerfile multi-stage + HealthController

```dockerfile
# Dockerfile — TribuZen API
# Image finale < 200 MB (vs ~900 MB sans multi-stage)

# ── Stage 1 : builder ─────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build          # produit dist/main.js

# ── Stage 2 : runner ──────────────────────────────────────────
FROM node:20-alpine AS runner

RUN addgroup --system --gid 1001 nestjs \
 && adduser  --system --uid 1001 --ingroup nestjs nestjs

WORKDIR /app

COPY --from=builder /app/dist          ./dist
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev                  # devDeps exclues de l'image finale

RUN chown -R nestjs:nestjs /app
USER nestjs

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/health/live || exit 1

CMD ["node", "dist/main.js"]
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

  // Liveness — K8s redémarre le pod si ce check échoue
  @Get('live')
  @HealthCheck()
  liveness() {
    return this.health.check([])  // process vivant = 200
  }

  // Readiness — K8s bloque le trafic vers ce pod si check échoue
  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),
    ])
  }
}
```

```ts
// src/health/health.module.ts
import { Module } from '@nestjs/common'
import { TerminusModule } from '@nestjs/terminus'
import { HealthController } from './health.controller'

@Module({
  imports: [
    TerminusModule.forRoot({ gracefulShutdownTimeoutMs: 3000 }),
  ],
  controllers: [HealthController],
})
export class HealthModule {}
```

```bash
# Construire l'image et tester localement
docker build -t tribuzen-api .
docker run -d -p 3000:3000 --name tz tribuzen-api

curl http://localhost:3000/health/live
# {"status":"ok","info":{},"error":{},"details":{}}

curl http://localhost:3000/health/ready
# {"status":"ok","info":{"memory_heap":{"status":"up"}},...}

docker image ls tribuzen-api
# REPOSITORY      TAG     SIZE
# tribuzen-api    latest  ~180MB

docker stop tz
# → logs NestJS : "Application shutdown"
```

**Pas-à-pas :** (1) `AS builder` embarque TypeScript, `tsconfig.json`, `devDependencies` — le stage `runner` ne les voit jamais ; (2) `npm ci --omit=dev` dans le runner installe seulement les prod deps — `node_modules` passe de ~600 MB à ~200 MB ; (3) `USER nestjs` — si une dépendance est compromise, l'attaquant n'a pas les droits root sur le container ; (4) `HEALTHCHECK` dans le Dockerfile est utilisé par Docker Compose ; en K8s, on configure `livenessProbe`/`readinessProbe` dans le manifest YAML en pointant les mêmes URLs ; (5) `TerminusModule.forRoot({ gracefulShutdownTimeoutMs: 3000 })` + `app.enableShutdownHooks()` — les deux sont nécessaires pour le shutdown propre : Terminus gère le délai, NestJS écoute le signal.

## 4. Pièges & misconceptions

- **TTL en ms dans cache-manager v3.** `cache.set(key, value, 300)` met en cache 300 ms, pas 5 min. En v3, le TTL est toujours en millisecondes. La migration de v2 vers v3 a changé l'unité sans changer le type — le bug compile et passe en prod silencieusement. Écrire `300_000` ou une constante nommée `5 * 60 * 1000`.

- **`CacheModule` non global.** Sans `isGlobal: true`, chaque module qui veut injecter `CACHE_MANAGER` doit importer `CacheModule`. L'erreur `Nest can't resolve dependencies of FamilyService (?, PrismaService)` indique souvent un oubli d'import ou l'absence de `isGlobal`.

- **`CacheInterceptor` cache l'URL entière.** `GET /families?page=1` et `GET /families?page=2` sont deux clés distinctes — chacune cachée séparément, ce qui est correct. Mais `CacheInterceptor` ne s'applique qu'aux requêtes GET. Les routes POST/PATCH/DELETE ne sont jamais cachées automatiquement.

- **Oublier `USER nestjs` dans le Dockerfile.** Sans cette ligne, le process NestJS tourne en `root` dans le container. Si une dépendance est compromise, l'attaquant dispose d'un shell root — potentiellement exploitable pour s'échapper vers l'hôte. `adduser` + `USER` représente une ligne de sécurité peu coûteuse.

- **`enableShutdownHooks()` absent.** Sans cette ligne, `SIGTERM` tue le process instantanément. Toutes les requêtes en vol retournent une connexion coupée. En K8s, chaque rolling deploy provoque des erreurs visibles par les utilisateurs. `enableShutdownHooks()` est requis même si `TerminusModule.forRoot({ gracefulShutdownTimeoutMs })` est configuré — les deux jouent des rôles différents.

- **Health check protégé par auth.** Si `/health/*` passe par un guard JWT global, l'orchestrateur reçoit 401 et considère le pod en erreur — il le redémarre en boucle. Exclure `/health/*` du guard global (whitelist ou `@SkipGuard()` sur le controller).

- **Compression en double.** Activer `compression()` dans NestJS ET `gzip on` dans Nginx compresse deux fois — CPU gaspillé, en-têtes parfois incohérents. Choisir un seul niveau : Nginx en prod (recommandé), NestJS en dev ou quand il n'y a pas de proxy.

## 5. Ancrage TribuZen

Couche fil-rouge : **dockeriser et durcir pour la prod l'API TribuZen (cache, health check, graceful shutdown)** (`smaurier/tribuzen`).

- `FamilyService` met en cache `GET /families` (TTL 5 min) — la liste des familles change rarement. Chaque `PATCH /families/:id` invalide `families:all` et `family:${id}`. Sur un profil de charge réel (100 req/s), le taux de hit Redis devrait dépasser 95 %.

- `HealthModule` expose `/health/live` (liveness) et `/health/ready` (readiness). Le manifest K8s de l'API configure `livenessProbe` et `readinessProbe` sur ces endpoints — le pod n'accepte pas de trafic tant que la mémoire heap n'est pas sous le seuil.

- `PrismaService.onApplicationShutdown()` appelle `$disconnect()` — la connexion PostgreSQL est fermée proprement lors d'un redeploy, sans attendre le timeout TCP (60 s par défaut sur PostgreSQL).

- Le Dockerfile multi-stage produit une image ~ 180 MB (vs ~ 900 MB sans multi-stage). Dans le pipeline CI/CD avec GitHub Container Registry, le pull time lors d'un scale-up passe de 40 s à < 10 s.

- `TerminusModule.forRoot({ gracefulShutdownTimeoutMs: 3000 })` laisse 3 s à l'ingress Render.com pour rediriger le trafic — zéro 502 visible par les utilisateurs lors des deploys.

Structure cible dans `smaurier/tribuzen` :

```
apps/api/
  Dockerfile                         ← multi-stage builder/runner, USER nestjs
  .dockerignore
  src/
    health/
      health.controller.ts           ← GET /health/live, /health/ready
      health.module.ts               ← TerminusModule.forRoot + gracefulShutdown
    prisma/
      prisma.service.ts              ← OnApplicationShutdown → $disconnect()
    family/
      family.service.ts              ← CACHE_MANAGER injecté, pattern cache-aside
    app.module.ts                    ← CacheModule.registerAsync isGlobal
    main.ts                          ← enableShutdownHooks()
```

## 6. Points clés

1. `@nestjs/cache-manager` v3 — TTL en **millisecondes**. `300_000` = 5 min. Écrire `300` cache 300 ms — bug silencieux.
2. `CacheModule.register({ isGlobal: true })` dans `AppModule` — une seule fois, `CACHE_MANAGER` injectable partout sans réimporter le module.
3. Pattern cache-aside — `get` → si `undefined`, requête DB → `set` ; invalider avec `del` sur mutation. Ne jamais laisser de données stales sans TTL.
4. Dockerfile multi-stage — `AS builder` compile, `AS runner` copie seulement `dist` + prod deps. Image divisée par 4-5, pull 4× plus rapide.
5. `USER nestjs` dans le Dockerfile — non-root, une ligne de sécurité dont le coût est nul.
6. `app.enableShutdownHooks()` + `TerminusModule.forRoot({ gracefulShutdownTimeoutMs })` — les deux sont nécessaires pour un shutdown sans 502 : NestJS écoute le signal, Terminus gère le délai.
7. Deux endpoints health — `/health/live` (liveness, toujours 200 si le process tourne) et `/health/ready` (readiness, vérifie les dépendances).
8. Exclure `/health/*` des guards JWT — un health check protégé par auth fait crasher l'orchestrateur en boucle de redémarrage.

## 7. Seeds Anki

```
Quelle est l'unité du TTL dans @nestjs/cache-manager v3 ?|Millisecondes — cache.set(key, value, 300_000) = 5 minutes. Écrire 300 = 300 ms (bug silencieux de migration v2 vers v3)
À quoi sert isGlobal: true dans CacheModule.register() ?|Rend CACHE_MANAGER injectable dans tous les modules sans réimporter CacheModule dans chaque module
Différence /health/live vs /health/ready pour K8s ?|live = liveness — process tourne (K8s redémarre le pod si échoue) ; ready = readiness — dépendances prêtes (K8s bloque le trafic si échoue)
Pourquoi enableShutdownHooks() est-il nécessaire même avec TerminusModule.forRoot({ gracefulShutdownTimeoutMs }) ?|Ils jouent des rôles différents — enableShutdownHooks() fait écouter NestJS le signal SIGTERM/SIGINT ; gracefulShutdownTimeoutMs ajoute un délai avant l'arrêt effectif. Sans enableShutdownHooks(), SIGTERM tue le process immédiatement.
Pourquoi USER nestjs dans le Dockerfile NestJS ?|Évite de tourner en root dans le container — si l'app est compromise, l'attaquant n'a pas de droits root sur le container
À quoi sert le stage builder vs runner dans un Dockerfile multi-stage ?|builder installe devDependencies et compile TypeScript ; runner copie seulement dist + prod deps — l'image finale n'embarque ni TypeScript ni devDependencies
Comment invalider le cache après une mutation en cache-aside ?|Appeler cache.del(key) sur toutes les clés dépendantes après la mise à jour — par exemple del('families:all') et del('family:id') après PATCH /families/:id
Pourquoi exclure /health/* des guards JWT globaux ?|L'orchestrateur interroge ces endpoints sans token — s'il reçoit 401 il considère le pod en erreur et le redémarre en boucle
```

## Pont vers le lab

> Lab associé : `09-nestjs/labs/lab-23-docker-deploy/README.md`. Tu y construis un Dockerfile multi-stage réel pour l'API TribuZen, configures le health check avec Terminus, testes le graceful shutdown et mesures le poids de l'image avant/après multi-stage.
