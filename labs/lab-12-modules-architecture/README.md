# Lab 12 — Architecture Modules

## Objectifs

- Structurer une application NestJS en plusieurs modules
- Creer un SharedModule qui exporte des services reutilisables
- Comprendre les imports/exports entre modules
- Creer un module dynamique (DatabaseModule avec forRoot)

## Description

Vous allez creer une application multi-modules :
- **SharedModule** — exporte LoggerService et DateService
- **UsersModule** — gestion des utilisateurs (importe SharedModule)
- **ProductsModule** — gestion des produits (importe SharedModule)
- **DatabaseModule** — module dynamique avec forRoot

## Endpoints

| Methode | Route      | Description               |
|---------|-----------|---------------------------|
| GET     | /users     | Lister les utilisateurs   |
| POST    | /users     | Creer un utilisateur      |
| GET     | /products  | Lister les produits       |
| POST    | /products  | Creer un produit          |

## Instructions

1. Implementez les services dans `src/shared/` (LoggerService, DateService)
2. Creez le SharedModule qui exporte ces services
3. Implementez le CRUD Users et Products
4. Creez le DatabaseModule dynamique avec forRoot

## Validation

```bash
npm test
```

## Fichiers a modifier

- `src/shared/shared.module.ts`
- `src/shared/logger.service.ts`
- `src/shared/date.service.ts`
- `src/users/users.module.ts`
- `src/users/users.controller.ts`
- `src/users/users.service.ts`
- `src/products/products.module.ts`
- `src/products/products.controller.ts`
- `src/products/products.service.ts`
- `src/database/database.module.ts`
