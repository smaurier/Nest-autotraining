# Lab 20 — Config & Swagger

## Objectifs

- Utiliser le ConfigModule de NestJS avec des namespaces
- Valider les variables d'environnement avec Joi
- Documenter une API avec Swagger / OpenAPI
- Utiliser les decorateurs @ApiTags, @ApiOperation, @ApiResponse, @ApiProperty

## Description

Vous allez configurer une application NestJS avec :
- La gestion de configuration typee et validee
- La documentation API automatique avec Swagger

## Configuration

Le fichier `.env` contient les variables suivantes :
- `PORT` — port du serveur
- `DATABASE_URL` — URL de la base de donnees
- `JWT_SECRET` — secret pour les tokens JWT
- `APP_NAME` — nom de l'application
- `NODE_ENV` — environnement (development, production)

## Endpoints

| Methode | Route          | Description              |
|---------|---------------|--------------------------|
| GET     | /products      | Lister les produits      |
| GET     | /products/:id  | Obtenir un produit       |
| POST    | /products      | Creer un produit         |
| PATCH   | /products/:id  | Modifier un produit      |
| DELETE  | /products/:id  | Supprimer un produit     |
| GET     | /api           | Documentation Swagger    |

## Instructions

1. **Config namespace app** (`src/config/app.config.ts`)
   - Utilisez `registerAs('app', () => ({ ... }))`
   - Exportez port, name et nodeEnv

2. **Config namespace database** (`src/config/database.config.ts`)
   - Utilisez `registerAs('database', () => ({ url: process.env.DATABASE_URL }))`

3. **Validation Joi** (`src/config/validation.ts`)
   - Validez PORT (number, default 3000)
   - Validez DATABASE_URL (string, required)
   - Validez JWT_SECRET (string, required)
   - Validez APP_NAME (string, default 'NestJS App')
   - Validez NODE_ENV (valid values, default 'development')

4. **ProductsController** (`src/products/products.controller.ts`)
   - Ajoutez les decorateurs Swagger
   - Utilisez le ConfigService pour acceder a la config

5. **CreateProductDto** (`src/products/dto/create-product.dto.ts`)
   - Ajoutez @ApiProperty et les validations class-validator

## Validation

```bash
npm test
```

## Fichiers a modifier

- `src/config/app.config.ts`
- `src/config/database.config.ts`
- `src/config/validation.ts`
- `src/products/products.controller.ts`
- `src/products/products.service.ts`
- `src/products/dto/create-product.dto.ts`
