# Lab 25 - MongoDB & Mongoose

## Objectif

Implementer une API REST de gestion de **produits** avec **MongoDB** et **Mongoose** dans NestJS.

Vous allez apprendre a :

- Definir un schema Mongoose avec les decorateurs `@Schema()` et `@Prop()`
- Injecter un `Model<Product>` via `@InjectModel()`
- Implementer les operations CRUD avec Mongoose
- Utiliser les regex MongoDB pour la recherche textuelle
- Ecrire une aggregation pour calculer des statistiques par categorie

## Structure du produit

```typescript
{
  name: string;        // requis
  description: string; // optionnel, defaut ''
  price: number;       // requis, minimum 0
  category: string;    // requis
  inStock: boolean;    // defaut true
  tags: string[];      // defaut []
}
```

## Endpoints a implementer

| Methode | Route                      | Description                          |
|---------|----------------------------|--------------------------------------|
| GET     | /products                  | Lister tous les produits             |
| GET     | /products/search?q=term    | Rechercher des produits              |
| GET     | /products/stats/by-category| Statistiques par categorie           |
| GET     | /products/:id              | Obtenir un produit par son id        |
| POST    | /products                  | Creer un produit                     |
| PATCH   | /products/:id              | Modifier partiellement un produit    |
| DELETE  | /products/:id              | Supprimer un produit                 |

> **Attention** : Les routes `/products/search` et `/products/stats/by-category` doivent etre declarees **avant** `/products/:id` dans le controller, sinon NestJS interpretera `search` et `stats` comme un `:id`.

## Etapes

### 1. Schema Mongoose (`src/products/schemas/product.schema.ts`)

Completez le fichier en ajoutant :
- Le decorateur `@Schema({ timestamps: true })` sur la classe
- Les decorateurs `@Prop()` sur chaque propriete avec les bonnes options
- La generation du schema via `SchemaFactory.createForClass(Product)`

### 2. Service (`src/products/products.service.ts`)

Implementez les methodes :
- `findAll()` : retourne tous les produits
- `findOne(id)` : retourne un produit par id, leve `NotFoundException` si introuvable
- `create(dto)` : cree et sauvegarde un nouveau produit
- `update(id, dto)` : met a jour un produit, leve `NotFoundException` si introuvable
- `remove(id)` : supprime un produit, leve `NotFoundException` si introuvable
- `search(query)` : recherche par nom ou description avec une regex case-insensitive
- `statsByCategory()` : aggregation groupant par categorie avec count et prix moyen

### 3. Controller (`src/products/products.controller.ts`)

Ajoutez les decorateurs NestJS sur chaque methode :
- `@Get()`, `@Post()`, `@Patch()`, `@Delete()`
- `@Param('id')`, `@Body()`, `@Query('q')`

## Lancer les tests

```bash
# Installer les dependances
pnpm install

# Lancer les tests (mode exercice)
pnpm test

# Lancer les tests (mode solution)
pnpm test:solution
```

Les tests utilisent `mongodb-memory-server` pour lancer une instance MongoDB en memoire. Aucune installation de MongoDB n'est necessaire.

## Verification

Tous les tests doivent passer au vert une fois l'implementation terminee.
