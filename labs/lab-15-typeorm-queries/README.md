# Lab 15 — TypeORM Queries

## Objectifs

- Utiliser le QueryBuilder de TypeORM
- Implementer la pagination (skip/take)
- Faire des recherches avec LIKE
- Utiliser les jointures (leftJoinAndSelect)
- Gérer les transactions

## Description

Vous allez etendre l'API posts avec des fonctionnalites de requêtes avancees :
- Pagination des résultats
- Recherche par titre
- Requetes avec jointures
- Création transactionnelle

## Endpoints

| Méthode | Route                       | Description                     |
|---------|----------------------------|---------------------------------|
| GET     | /posts?page=1&limit=10     | Posts avec pagination           |
| GET     | /posts/search?term=hello   | Recherche par titre             |
| GET     | /posts/user/:userId        | Posts d'un utilisateur + comments|
| POST    | /posts/with-comments       | Créer post avec commentaires    |

## Instructions

1. Les entites sont déjà definies (User, Post, Comment)
2. Implementez les méthodes avancees dans `src/posts/posts.service.ts`
3. Implementez les routes dans `src/posts/posts.controller.ts`

## Validation

```bash
npm test
```
