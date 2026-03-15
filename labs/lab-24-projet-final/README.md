# Lab 24 — Projet Final : API E-Commerce Complete

## Objectifs

Ce projet final combine tous les concepts appris durant la formation NestJS pour créer une API e-commerce complete :

- **Authentification** : JWT, Passport, guards, roles
- **Base de donnees** : Prisma ORM avec SQLite
- **Validation** : class-validator, pipes
- **Documentation** : Swagger/OpenAPI
- **WebSockets** : notifications en temps réel
- **Taches planifiees** : nettoyage automatique des paniers abandonnes
- **Health checks** : endpoint de surveillance
- **Docker** : déploiement containerise

## Mise en place

```bash
npm install
npx prisma generate
npx prisma db push
```

Créer un fichier `.env` à partir de `.env.example` :
```bash
cp .env.example .env
```

## Lancer l'application

```bash
npm run start:dev
```

L'API sera disponible sur `http://localhost:3000`
La documentation Swagger sera sur `http://localhost:3000/api`

## Lancer les tests

```bash
npm test
```

## Lancer les tests avec la solution

```bash
npm run test:solution
```

## Docker

```bash
docker-compose up --build
```

## Architecture

```
src/
  config/          # Configuration et validation
  auth/            # Authentification JWT + Passport
  users/           # Gestion des utilisateurs
  products/        # CRUD produits avec recherche
  categories/      # CRUD categories
  orders/          # Commandes avec transactions
  cart/            # Panier d'achat
  notifications/   # WebSocket gateway
  tasks/           # Taches planifiees (cron)
  health/          # Health check endpoint
  prisma/          # PrismaService global
```

## Fichiers a completer (TODO)

### Configuration
1. **`src/config/app.config.ts`** — Configuration avec `registerAs()`
2. **`src/config/validation.ts`** — Schema de validation Joi pour les variables d'environnement

### Authentification
3. **`src/auth/auth.module.ts`** — Configurer JwtModule.registerAsync()
4. **`src/auth/auth.controller.ts`** — Endpoints register, login, profile
5. **`src/auth/auth.service.ts`** — Register (hash password), validateUser, login (JWT)
6. **`src/auth/strategies/local.strategy.ts`** — Stratégie locale Passport
7. **`src/auth/strategies/jwt.strategy.ts`** — Stratégie JWT Passport
8. **`src/auth/guards/roles.guard.ts`** — Guard de vérification des roles
9. **`src/auth/decorators/current-user.decorator.ts`** — Decorateur pour extraire l'utilisateur

### Utilisateurs
10. **`src/users/users.service.ts`** — findByEmail, findById, create

### Produits
11. **`src/products/products.controller.ts`** — CRUD avec recherche, decorateurs Swagger, protection admin
12. **`src/products/products.service.ts`** — CRUD avec recherche par nom

### Categories
13. **`src/categories/categories.controller.ts`** — CRUD avec protection admin
14. **`src/categories/categories.service.ts`** — CRUD basique

### Commandes
15. **`src/orders/orders.controller.ts`** — Créer, lister, consulter, changer le statut
16. **`src/orders/orders.service.ts`** — Création transactionnelle, mise a jour du statut

### Panier
17. **`src/cart/cart.controller.ts`** — Ajouter, consulter, supprimer, vider
18. **`src/cart/cart.service.ts`** — Gestion du panier

### Notifications
19. **`src/notifications/notifications.gateway.ts`** — WebSocket pour notifications de commandes

### Taches
20. **`src/tasks/tasks.service.ts`** — Nettoyage planifie des paniers abandonnes

### Health
21. **`src/health/health.controller.ts`** — Endpoint de health check

## Endpoints

### Auth
- `POST /auth/register` — Inscription
- `POST /auth/login` — Connexion (retourne JWT)
- `GET /auth/profile` — Profil (protege)

### Products
- `GET /products` — Liste (public, recherche via ?search=)
- `GET /products/:id` — Detail (public)
- `POST /products` — Créer (admin)
- `PATCH /products/:id` — Modifier (admin)
- `DELETE /products/:id` — Supprimer (admin)

### Categories
- `GET /categories` — Liste (public)
- `GET /categories/:id` — Detail (public)
- `POST /categories` — Créer (admin)
- `DELETE /categories/:id` — Supprimer (admin)

### Orders
- `POST /orders` — Créer une commande (auth)
- `GET /orders` — Mes commandes / toutes (admin)
- `GET /orders/:id` — Detail (auth)
- `PATCH /orders/:id/status` — Changer statut (admin)

### Cart
- `GET /cart` — Mon panier (auth)
- `POST /cart/items` — Ajouter au panier (auth)
- `DELETE /cart/items/:id` — Retirer du panier (auth)
- `DELETE /cart` — Vider le panier (auth)

### Health
- `GET /health` — État de l'application

## Solutions

Les solutions se trouvent dans le dossier `solution/`.
