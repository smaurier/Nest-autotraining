# Lab 16 — Prisma Setup

## Objectifs

- Installer et configurer Prisma avec SQLite
- Créer un `PrismaService` réutilisable
- Implementer des operations CRUD pour les produits et les categories
- Utiliser les relations Prisma (Product -> Category)

## Mise en place

```bash
npm install
npx prisma generate
npx prisma db push
```

## Lancer les tests

```bash
npm test
```

## Lancer les tests avec la solution

```bash
npm run test:solution
```

## Fichiers a completer (TODO)

1. **`src/prisma/prisma.module.ts`** — Rendre le module `@Global()`, fournir et exporter `PrismaService`
2. **`src/prisma/prisma.service.ts`** — Etendre `PrismaClient`, implementer `OnModuleInit` (`$connect`) et `OnModuleDestroy` (`$disconnect`)
3. **`src/categories/categories.controller.ts`** — Endpoints CRUD pour `/categories`
4. **`src/categories/categories.service.ts`** — Operations CRUD utilisant `PrismaService`
5. **`src/products/products.controller.ts`** — Endpoints CRUD pour `/products`
6. **`src/products/products.service.ts`** — Operations CRUD avec inclusion de la categorie dans les réponses

## Schema Prisma

Le schema est déjà configure dans `prisma/schema.prisma` avec deux modèles :

- **Product** : id, name, description, price, stock, categoryId, createdAt, updatedAt
- **Category** : id, name (unique), description, products[], createdAt

## Endpoints attendus

### Categories
- `POST /categories` — Créer une categorie
- `GET /categories` — Lister toutes les categories (avec produits)
- `GET /categories/:id` — Obtenir une categorie (avec produits)
- `DELETE /categories/:id` — Supprimer une categorie

### Products
- `POST /products` — Créer un produit
- `GET /products` — Lister tous les produits (avec categorie)
- `GET /products/:id` — Obtenir un produit (avec categorie)
- `PATCH /products/:id` — Mettre a jour un produit
- `DELETE /products/:id` — Supprimer un produit

## Solutions

Les solutions se trouvent dans le dossier `solution/`.
