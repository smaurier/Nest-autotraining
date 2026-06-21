# Module 23 — Performance & Déploiement

> **Objectif** : Optimiser les performances d'une application NestJS (caching, rate limiting, compression) et la déployer en production avec Docker, PM2 et les bonnes pratiques de monitoring.
> **Difficulte** : ⭐⭐⭐⭐ (avance+)
> **Prérequis** : Modules 10 a 22 (ensemble du parcours NestJS)
> **Duree estimee** : 6 heures

---

## 1. Caching — Mise en cache des réponses

### 1.1 Pourquoi le cache ?

Le cache evite de recalculer ou re-interroger la base de donnees pour des donnees qui changent rarement. Il peut reduire drastiquement les temps de réponse (de 200ms a 2ms).

> **Analogie** : Le cache c'est comme un post-it sur votre bureau. Au lieu d'aller chercher l'information dans le classeur à chaque fois (base de donnees), vous la notez sur un post-it (cache) et vous la consultez directement. De temps en temps, vous mettez a jour le post-it.

### 1.2 Installation

```bash
npm install @nestjs/cache-manager cache-manager

# Pour utiliser Redis comme store (recommande en production)
npm install cache-manager-redis-yet redis
```

### 1.3 Configuration du cache

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { CacheModule } from "@nestjs/cache-manager";
import { ConfigModule, ConfigService } from "@nestjs/config";

@Module({
  imports: [
    // Cache en memoire (developpement)
    CacheModule.register({
      isGlobal: true,
      ttl: 60, // Duree de vie par defaut : 60 secondes
      max: 100, // Maximum 100 entrees en cache
    }),
  ],
})
export class AppModule {}
```

Configuration avec Redis (production) :

```typescript
// app.module.ts
import { redisStore } from "cache-manager-redis-yet";

@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const isProduction = configService.get("NODE_ENV") === "production";

        if (isProduction) {
          // Redis en production
          return {
            store: await redisStore({
              socket: {
                host: configService.get("REDIS_HOST", "localhost"),
                port: configService.get<number>("REDIS_PORT", 6379),
              },
              password: configService.get("REDIS_PASSWORD"),
              ttl: 60 * 1000, // 60 secondes en millisecondes
            }),
          };
        }

        // Cache memoire en dev
        return {
          ttl: 60,
          max: 100,
        };
      },
    }),
  ],
})
export class AppModule {}
```

### 1.4 Utilisation du cache dans un service

```typescript
// products/products.service.ts
import { Injectable, Inject } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";

@Injectable()
export class ProductsService {
  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly prisma: PrismaService,
  ) {}

  async findAll(page: number, limit: number) {
    const cacheKey = `products:list:${page}:${limit}`;

    // 1. Chercher dans le cache
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached; // Retour instantane !
    }

    // 2. Si pas en cache, interroger la base
    const result = await this.prisma.product.findMany({
      skip: (page - 1) * limit,
      take: limit,
      include: { category: true },
    });

    // 3. Mettre en cache pour les prochaines requetes
    await this.cacheManager.set(cacheKey, result, 120); // 120 secondes

    return result;
  }

  async findOne(id: number) {
    const cacheKey = `product:${id}`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true, images: true },
    });

    if (product) {
      await this.cacheManager.set(cacheKey, product, 300); // 5 minutes
    }

    return product;
  }

  async update(id: number, data: any) {
    const updated = await this.prisma.product.update({
      where: { id },
      data,
    });

    // Invalider le cache apres modification
    await this.cacheManager.del(`product:${id}`);
    // Invalider aussi les listes
    const keys = await this.cacheManager.store.keys("products:list:*");
    for (const key of keys) {
      await this.cacheManager.del(key);
    }

    return updated;
  }

  async remove(id: number) {
    await this.prisma.product.delete({ where: { id } });

    // Invalider le cache
    await this.cacheManager.del(`product:${id}`);
  }
}
```

### 1.5 CacheInterceptor automatique

Pour les cas simples, NestJS fournit un interceptor qui cache automatiquement les réponses GET :

```typescript
import { Controller, Get, UseInterceptors } from "@nestjs/common";
import { CacheInterceptor, CacheTTL, CacheKey } from "@nestjs/cache-manager";

@Controller("categories")
@UseInterceptors(CacheInterceptor) // Cache toutes les routes GET du controller
export class CategoriesController {
  @Get()
  @CacheTTL(300) // Cache 5 minutes (override le TTL global)
  findAll() {
    return this.categoriesService.findAll();
  }

  @Get(":id")
  @CacheKey("category") // Cle de cache personnalisee
  @CacheTTL(600) // Cache 10 minutes
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.categoriesService.findOne(id);
  }
}
```

> **Piege classique** : Le `CacheInterceptor` ne cache que les requêtes GET. Il utilise l'URL comme clé de cache par defaut. Si vous avez des paramètres de requête différents, chaque combinaison unique sera cachee separement.

---

## 2. Compression

### 2.1 Configuration

La compression reduit la taille des réponses HTTP, accelerant le transfert réseau.

```bash
npm install compression
npm install --save-dev @types/compression
```

```typescript
// main.ts
import * as compression from "compression";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Activer la compression gzip
  app.use(
    compression({
      threshold: 1024, // Ne compresser que si la reponse depasse 1 Ko
      level: 6, // Niveau de compression (1-9, 6 = bon compromis)
      filter: (req, res) => {
        // Ne pas compresser les SSE (Server-Sent Events)
        if (req.headers["x-no-compression"]) {
          return false;
        }
        return compression.filter(req, res);
      },
    }),
  );

  await app.listen(3000);
}
```

> **Bonne pratique** : En production, la compression est généralement gérée par le reverse proxy (Nginx, CloudFlare) et pas par NestJS directement. Cela libere les ressources CPU de votre application.

---

## 3. Rate Limiting — Protection contre les abus

### 3.1 Installation et configuration

```bash
npm install @nestjs/throttler
```

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: "short", // Limite courte
        ttl: 1000, // 1 seconde
        limit: 3, // 3 requetes max par seconde
      },
      {
        name: "medium", // Limite moyenne
        ttl: 10000, // 10 secondes
        limit: 20, // 20 requetes max par 10 secondes
      },
      {
        name: "long", // Limite longue
        ttl: 60000, // 1 minute
        limit: 100, // 100 requetes max par minute
      },
    ]),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard, // Applique le rate limiting globalement
    },
  ],
})
export class AppModule {}
```

### 3.2 Personnaliser par route

```typescript
import { Throttle, SkipThrottle } from "@nestjs/throttler";

@Controller("auth")
export class AuthController {
  // Route de login : limiter plus strictement (5 tentatives par minute)
  @Post("login")
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  // Route publique : pas de rate limiting
  @Get("health")
  @SkipThrottle()
  health() {
    return { status: "ok" };
  }
}

// Desactiver le rate limiting pour tout un controller
@SkipThrottle()
@Controller("public")
export class PublicController {}
```

---

## 4. CORS — Cross-Origin Resource Sharing

```typescript
// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configuration CORS detaillee
  app.enableCors({
    // Origines autorisees
    origin: [
      "http://localhost:4200", // Angular dev
      "http://localhost:3001", // React dev
      "https://monsite.com", // Production
    ],
    // Ou une fonction pour plus de controle
    // origin: (origin, callback) => {
    //   if (!origin || allowedOrigins.includes(origin)) {
    //     callback(null, true);
    //   } else {
    //     callback(new Error('Not allowed by CORS'));
    //   }
    // },

    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["X-Total-Count"], // Headers visibles par le client
    credentials: true, // Autoriser les cookies cross-origin
    maxAge: 86400, // Cache le preflight pendant 24h
  });

  await app.listen(3000);
}
```

> **Piege classique** : `origin: '*'` est pratique en développement mais dangereux en production. Specifiez toujours les origines exactes autorisees. Et `credentials: true` est incompatible avec `origin: '*'`.

---

## 5. Graceful Shutdown — Arret propre

### 5.1 Pourquoi c'est important ?

Quand l'application s'arrete (déploiement, redemarrage), il faut :

1. Arreter d'accepter de nouvelles requêtes
2. Terminer les requêtes en cours
3. Fermer proprement les connexions (DB, Redis, WebSocket)

```typescript
// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Activer les hooks de shutdown
  app.enableShutdownHooks();

  await app.listen(3000);
}
```

```typescript
// services/database.service.ts
import {
  Injectable,
  OnModuleDestroy,
  OnApplicationShutdown,
  BeforeApplicationShutdown,
} from "@nestjs/common";

@Injectable()
export class DatabaseService
  implements OnModuleDestroy, BeforeApplicationShutdown, OnApplicationShutdown
{
  // 1. Appele quand le module est detruit
  onModuleDestroy() {
    console.log("Module detruit — nettoyage des resources du module");
  }

  // 2. Appele avant l'arret de l'application (requetes en cours encore traitees)
  async beforeApplicationShutdown(signal?: string) {
    console.log(`Signal d'arret recu : ${signal}`);
    console.log("Attente de la fin des requetes en cours...");
    // Donner du temps aux requetes de se terminer
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  // 3. Appele apres l'arret (plus aucune requete)
  async onApplicationShutdown(signal?: string) {
    console.log("Application arretee — fermeture des connexions");
    // Fermer la connexion a la base de donnees
    // await this.connection.close();
  }
}
```

### 5.2 Ordre des hooks de shutdown

```
Signal SIGTERM/SIGINT recu
         |
         v
  beforeApplicationShutdown()   ← Les requetes peuvent encore etre traitees
         |
         v
  L'application arrete d'accepter de nouvelles connexions
         |
         v
  onModuleDestroy()             ← Pour chaque module
         |
         v
  onApplicationShutdown()       ← Nettoyage final
         |
         v
  Process.exit()
```

---

## 6. Health Checks — Vérification de sante

### 6.1 Installation

```bash
npm install @nestjs/terminus
```

### 6.2 Configuration

```typescript
// health/health.module.ts
import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { HttpModule } from "@nestjs/axios";
import { HealthController } from "./health.controller";

@Module({
  imports: [TerminusModule, HttpModule],
  controllers: [HealthController],
})
export class HealthModule {}
```

```typescript
// health/health.controller.ts
import { Controller, Get } from "@nestjs/common";
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  HttpHealthIndicator,
  DiskHealthIndicator,
  MemoryHealthIndicator,
} from "@nestjs/terminus";

@Controller("health")
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private http: HttpHealthIndicator,
    private disk: DiskHealthIndicator,
    private memory: MemoryHealthIndicator,
  ) {}

  // Endpoint principal de sante
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // Verification de la base de donnees
      () => this.db.pingCheck("database"),

      // Verification d'un service externe
      () =>
        this.http.pingCheck("api-externe", "https://api.example.com/health"),

      // Verification de l'espace disque (80% max)
      () =>
        this.disk.checkStorage("disk", {
          thresholdPercent: 0.8,
          path: "/",
        }),

      // Verification de la memoire (300 Mo max pour le heap)
      () => this.memory.checkHeap("memory_heap", 300 * 1024 * 1024),

      // Verification de la memoire RSS (500 Mo max)
      () => this.memory.checkRSS("memory_rss", 500 * 1024 * 1024),
    ]);
  }

  // Endpoint simplifie pour le load balancer
  @Get("live")
  @HealthCheck()
  liveness() {
    return this.health.check([]);
    // Retourne juste 200 OK si l'application tourne
  }

  // Endpoint pour verifier que toutes les dependances sont prets
  @Get("ready")
  @HealthCheck()
  readiness() {
    return this.health.check([() => this.db.pingCheck("database")]);
  }
}
```

Reponse JSON :

```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "api-externe": { "status": "up" },
    "disk": { "status": "up" },
    "memory_heap": { "status": "up" },
    "memory_rss": { "status": "up" }
  },
  "error": {},
  "details": {
    "database": { "status": "up" },
    "api-externe": { "status": "up" },
    "disk": { "status": "up" },
    "memory_heap": { "status": "up" },
    "memory_rss": { "status": "up" }
  }
}
```

---

> **SWC (alternative rapide)** : NestJS supporte SWC comme compilateur alternatif a tsc. `nest start --builder swc` compile 5-10x plus vite, ideal pour le dev. Ajoutez `"builder": "swc"` dans `nest-cli.json` pour l'activer par defaut.

## 7. Docker — Conteneurisation

### 7.1 Dockerfile multi-stage

```dockerfile
# === Etape 1 : Build ===
FROM node:20-alpine AS builder

# Repertoire de travail dans le conteneur
WORKDIR /app

# Copier les fichiers de dependances
COPY package*.json ./
COPY prisma ./prisma/

# Installer les dependances (y compris devDependencies pour le build)
RUN npm ci

# Copier le code source
COPY . .

# Build de l'application
RUN npm run build

# Generer le client Prisma
RUN npx prisma generate

# === Etape 2 : Production ===
FROM node:20-alpine AS runner

# Creer un utilisateur non-root pour la securite
RUN addgroup --system --gid 1001 nestjs
RUN adduser --system --uid 1001 nestjs

WORKDIR /app

# Copier seulement les fichiers necessaires depuis le builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

# Changer le proprietaire des fichiers
RUN chown -R nestjs:nestjs /app

# Utiliser l'utilisateur non-root
USER nestjs

# Exposer le port
EXPOSE 3000

# Variables d'environnement par defaut
ENV NODE_ENV=production
ENV PORT=3000

# Commande de demarrage
CMD ["node", "dist/main.js"]
```

### 7.2 .dockerignore

```
node_modules
dist
.git
.github
.env
.env.*
*.md
coverage
test
.vscode
.idea
docker-compose*.yml
Dockerfile
.dockerignore
```

### 7.3 Docker Compose

```yaml
# docker-compose.yml
version: "3.8"

services:
  # Application NestJS
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_USERNAME=postgres
      - DB_PASSWORD=secretPassword
      - DB_DATABASE=nest_course
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - JWT_ACCESS_SECRET=monSuperSecretAccess
      - JWT_REFRESH_SECRET=monSuperSecretRefresh
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test:
        ["CMD", "wget", "-q", "--spider", "http://localhost:3000/health/live"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Base de donnees PostgreSQL
  postgres:
    image: postgres:17-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=secretPassword
      - POSTGRES_DB=nest_course
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # Redis (cache et queues)
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

```bash
# Lancer l'ensemble
docker compose up -d

# Voir les logs
docker compose logs -f app

# Arreter
docker compose down

# Reconstruire apres des changements
docker compose up -d --build app
```

---

## 8. PM2 — Process Manager

PM2 est un gestionnaire de processus pour Node.js en production.

```bash
npm install -g pm2
```

```typescript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "nest-api",
      script: "dist/main.js",
      instances: "max", // Utilise tous les CPU disponibles
      exec_mode: "cluster", // Mode cluster pour le multi-threading
      autorestart: true, // Redemarre en cas de crash
      watch: false, // Pas de watch en production
      max_memory_restart: "1G", // Redemarre si >1 Go de RAM
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      // Gestion des logs
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "/var/log/nest-api/error.log",
      out_file: "/var/log/nest-api/out.log",
      merge_logs: true,
      // Graceful shutdown
      kill_timeout: 10000, // 10s pour s'arreter proprement
      listen_timeout: 10000,
    },
  ],
};
```

```bash
# Demarrer
pm2 start ecosystem.config.js

# Voir le statut
pm2 status

# Voir les logs
pm2 logs nest-api

# Monitoring en temps reel
pm2 monit

# Redemarrage sans downtime (zero-downtime reload)
pm2 reload nest-api

# Arreter
pm2 stop nest-api

# Sauvegarder la configuration pour le demarrage auto
pm2 save
pm2 startup
```

---

## 9. Logging structure

### 9.1 Intégration avec Pino (recommande)

```bash
npm install nestjs-pino pino-http pino pino-pretty
```

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === "production" ? "info" : "debug",
        transport:
          process.env.NODE_ENV !== "production"
            ? {
                target: "pino-pretty",
                options: {
                  colorize: true,
                  singleLine: true,
                  translateTime: "SYS:standard",
                },
              }
            : undefined, // JSON en production
        // Masquer les donnees sensibles
        redact: {
          paths: ["req.headers.authorization", "req.body.motDePasse"],
          remove: true,
        },
      },
    }),
  ],
})
export class AppModule {}
```

```typescript
// main.ts
import { Logger } from "nestjs-pino";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  // ...
}
```

---

## 10. Checklist de déploiement production

| Étape                     | Fait ? | Details                                    |
| ------------------------- | ------ | ------------------------------------------ |
| `synchronize: false`      |        | Utiliser les migrations                    |
| Variables d'environnement |        | Pas de secrets en dur                      |
| Validation .env (Joi)     |        | Erreur au démarrage si manquant            |
| CORS configure            |        | Origines spécifiques, pas `*`              |
| Rate limiting actif       |        | `@nestjs/throttler`                        |
| Helmet actif              |        | Headers de sécurité                        |
| Compression               |        | Gzip via Nginx ou app                      |
| Health checks             |        | `/health`, `/health/live`, `/health/ready` |
| Logging structure         |        | Pino ou Winston, JSON en prod              |
| Graceful shutdown         |        | `enableShutdownHooks()`                    |
| Docker multi-stage        |        | Image legere, user non-root                |
| PM2 cluster mode          |        | Utiliser tous les CPU                      |
| Monitoring                |        | Metriques, alertes                         |
| Sauvegarde DB             |        | Backup automatique quotidien               |
| HTTPS                     |        | Certificat SSL via reverse proxy           |
| CI/CD                     |        | Tests automatiques avant déploiement       |

---

## 11. Exercices pratiques

### Exercice 1 : Cache Redis

Implementez un cache Redis pour :

1. La liste des produits (TTL 5 min)
2. Les details d'un produit (TTL 10 min)
3. Invalidation automatique du cache lors des modifications

### Exercice 2 : Docker Compose

Creez un `docker-compose.yml` complet avec :

1. Application NestJS (Dockerfile multi-stage)
2. PostgreSQL
3. Redis
4. Health checks sur les trois services
5. Volumes persistants

### Exercice 3 : Monitoring

Configurez :

1. Health checks avec Terminus (DB, Redis, mémoire, disque)
2. Logging structure avec Pino
3. Rate limiting global et personnalise sur les routes sensibles

---

## Bonus — Performance et observabilite BFF

Un BFF est souvent sensible a la latence car il orchestre plusieurs upstreams par requete frontend. Il faut donc piloter explicitement budget de latence, cache et degradation.

### 1) Budget de latence BFF

Exemple de cible simple :

- p95 endpoint BFF critique < 300ms
- timeout upstream individuel <= 800ms
- au moins un mode degrade pour les widgets non critiques

### 2) Cache adapte au BFF

| Donnee                    | Strategie                            |
| ------------------------- | ------------------------------------ |
| Catalogue / referentiels  | TTL court-moyen (30-120s)            |
| Profil utilisateur        | Cache prudent par utilisateur        |
| Donnees transactionnelles | Peu/pas de cache, priorite fraicheur |

### 3) Trace de bout en bout

Propager un `correlationId` depuis Angular jusqu'aux upstreams pour relier logs BFF + logs services backend lors d'un incident.

### 4) Checklist BFF production-ready

1. Timeouts explicites sur tous les appels sortants.
2. Retry uniquement sur operations idempotentes.
3. Fallback documente par endpoint BFF critique.
4. Metriques par route BFF: latence, erreurs, taux de fallback.
5. Alerting minimal sur p95 et taux d'erreur.

> **A retenir BFF** : La performance BFF n'est pas seulement "optimiser Node.js". C'est surtout maitriser l'orchestration reseau, les timeouts et les degradations pour proteger l'experience frontend.

---

## Liens

| Ressource                     | Lien                                                                        |
| ----------------------------- | --------------------------------------------------------------------------- |
| Quiz Module 23                | `quiz/23-quiz.md`                                                           |
| Lab Module 23                 | `labs/23-lab-performance-deploiement.md`                                    |
| Screencast                    | `screencasts/23-screencast.md`                                              |
| Module précédent              | [Module 22 — Taches planifiees & Files d'attente](22-nestjs-jobs-queues.md) |
| Module suivant                | [Module 24 — Projet Final](24-projet-final.md)                              |
| NestJS Caching                | https://docs.nestjs.com/techniques/caching                                  |
| NestJS Rate Limiting          | https://docs.nestjs.com/security/rate-limiting                              |
| NestJS Health Checks          | https://docs.nestjs.com/recipes/terminus                                    |
| Docker Node.js Best Practices | https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md       |
| PM2 Documentation             | https://pm2.keymetrics.io/docs/                                             |

---

<!-- parcours-recommande -->

::: tip Parcours recommandé

1. **Screencast** : [screencast 23 performance](../screencasts/screencast-23-performance.md)
2. **Lab** : [lab-23-docker-deploy](../labs/lab-23-docker-deploy/README)
3. **Quiz** : [quiz 23 performance](../quizzes/quiz-23-performance.html)
   :::
