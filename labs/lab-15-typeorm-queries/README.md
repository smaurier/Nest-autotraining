# Lab 15 — TypeORM Queries

## Objectifs

- Utiliser le QueryBuilder de TypeORM
- Implementer la pagination (skip/take)
- Faire des recherches avec LIKE
- Utiliser les jointures (leftJoinAndSelect)
- Gerer les transactions

## Description

Vous allez etendre l'API posts avec des fonctionnalites de requetes avancees :
- Pagination des resultats
- Recherche par titre
- Requetes avec jointures
- Creation transactionnelle

## Endpoints

| Methode | Route                       | Description                     |
|---------|----------------------------|---------------------------------|
| GET     | /posts?page=1&limit=10     | Posts avec pagination           |
| GET     | /posts/search?term=hello   | Recherche par titre             |
| GET     | /posts/user/:userId        | Posts d'un utilisateur + comments|
| POST    | /posts/with-comments       | Creer post avec commentaires    |

## Instructions

1. Les entites sont deja definies (User, Post, Comment)
2. Implementez les methodes avancees dans `src/posts/posts.service.ts`
3. Implementez les routes dans `src/posts/posts.controller.ts`

## Validation

```bash
npm test
```
