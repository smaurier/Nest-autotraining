# Screencast 23 — Performance & Déploiement

## Informations

- **Duree estimee** : 18-22 min
- **Module** : `modules/23-performance-deploiement.md`
- **Lab associe** : `labs/lab-23-docker-deploy/`
- **Prérequis** : Screencast 22 (Queues & Taches)

## Setup

- [ ] Node.js 20+ installe
- [ ] Docker et docker-compose installes
- [ ] Terminal ouvert dans `nest-course/`
- [ ] Editeur de code ouvert
- [ ] Projet NestJS complet fonctionnel

## Script

### [00:00-03:00] Introduction — De dev a production

> Salut ! On a construit une API NestJS complete : auth, base de donnees, WebSockets, queues. Mais tout ça tourne sur votre machine. Aujourd'hui on va la containeriser avec Docker et la preparer pour la production.

**Action** : Afficher le slide de titre "Module 23 — Performance & Déploiement".

> Le déploiement, c'est trois étapes : containeriser l'application, orchestrer les services (API, base de donnees, Redis), et monitorer la sante de l'application.

### [03:00-08:00] Dockerfile — Containeriser l'application

**Action** : Créer le Dockerfile multi-stage.

```dockerfile
# Dockerfile
# Stage 1 : Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2 : Production
FROM node:20-alpine AS production
WORKDIR /app

RUN addgroup -g 1001 -S nestjs && \
    adduser -S nestjs -u 1001

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/main.js"]
```

> Le Dockerfile multi-stage separe le build de la production. Le premier stage compile le TypeScript. Le deuxieme copie uniquement les fichiers nécessaires. L'image finale est legere et securisee — on ne lance pas en root.

**Action** : Créer le .dockerignore.

```
node_modules
dist
.git
.env
*.md
test
```

**Action** : Builder et tester l'image.

```bash
docker build -t nest-api .
docker run -p 3000:3000 --env-file .env nest-api
```

### [08:00-13:00] Docker Compose — Orchestrer les services

**Action** : Créer le docker-compose.yml.

```yaml
# docker-compose.yml
version: "3.8"

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/nestcourse
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: nestcourse
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

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

volumes:
  postgres_data:
  redis_data:
```

**Action** : Lancer l'ensemble des services.

```bash
docker-compose up -d
docker-compose ps
docker-compose logs -f api
```

> Docker Compose lance les trois services : l'API, PostgreSQL et Redis. Les healthchecks s'assurent que chaque service est pret avant de démarrer les services dependants. Les volumes persistent les donnees entre les redemarrages.

**Action** : Tester l'application.

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/docs
```

### [13:00-16:00] Health Checks — Monitorer la sante

**Action** : Installer et configurer les health checks NestJS.

```bash
npm install @nestjs/terminus
```

```typescript
// src/health/health.controller.ts
import { Controller, Get } from "@nestjs/common";
import {
  HealthCheckService,
  HealthCheck,
  TypeOrmHealthIndicator,
  DiskHealthIndicator,
  MemoryHealthIndicator,
} from "@nestjs/terminus";

@Controller("health")
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private disk: DiskHealthIndicator,
    private memory: MemoryHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck("database"),
      () =>
        this.disk.checkStorage("storage", {
          path: "/",
          thresholdPercent: 0.9,
        }),
      () => this.memory.checkHeap("memory_heap", 200 * 1024 * 1024),
    ]);
  }

  @Get("ready")
  @HealthCheck()
  readiness() {
    return this.health.check([() => this.db.pingCheck("database")]);
  }
}
```

**Action** : Tester les endpoints de sante.

```bash
curl http://localhost:3000/health | jq
```

```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "storage": { "status": "up" },
    "memory_heap": { "status": "up" }
  }
}
```

> Le health check vérifié la base de donnees, le disque et la mémoire. Les orchestrateurs (Kubernetes, Docker Swarm, AWS ECS) utilisent ces endpoints pour redemarrer les conteneurs defaillants.

### [16:00-19:00] PM2 et optimisations de production

**Action** : Configurer PM2 pour le mode cluster.

```bash
npm install -g pm2
```

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "nest-api",
      script: "dist/main.js",
      instances: "max",
      exec_mode: "cluster",
      env_production: {
        NODE_ENV: "production",
      },
      max_memory_restart: "500M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
```

```bash
pm2 start ecosystem.config.js --env production
pm2 monit
pm2 logs
```

> PM2 en mode cluster lance une instance par CPU. Si une instance crashe, PM2 la redemarre automatiquement. `max_memory_restart` tue les instances qui consomment trop de mémoire.

**Action** : Montrer les optimisations de production.

```typescript
// src/main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === "production"
        ? ["error", "warn"]
        : ["log", "debug", "verbose", "error", "warn"],
  });

  // Compression
  app.use(require("compression")());

  // CORS restrictif
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
    methods: "GET,POST,PUT,DELETE,PATCH",
    credentials: true,
  });

  // Rate limiting
  // Helmet pour les headers de securite
}
```

### [19:00-20:00] Bonus BFF — SLO frontend-centric

> Sur un BFF, monitorer la latence p95 par route critique, le taux d'erreur et le taux de fallback est prioritaire.

**Action** : Montrer une cible simple (ex: p95 < 300ms) et comment suivre cette metrique dans les logs/monitoring.

### [19:00-21:00] Recap

> On a containerise l'application avec un Dockerfile multi-stage. Docker Compose orchestre l'API, PostgreSQL et Redis. Les health checks surveillent la sante de l'application. PM2 géré le mode cluster et le redemarrage automatique.

**Action** : Afficher le slide recap.

> Le lab est dans `labs/lab-23-docker-deploy/`. Vous allez dockeriser votre API, configurer docker-compose et ajouter les health checks. Au prochain et dernier screencast, le projet final e-commerce !

## Points d'attention pour l'enregistrement

- Docker doit etre lance avant de commencer la demo
- Le build Docker peut prendre du temps — couper la video pendant l'attente
- Montrer les logs docker-compose pour voir les services démarrer dans l'ordre
- Le health check doit afficher un JSON bien formate avec jq
