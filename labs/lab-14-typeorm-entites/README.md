# Lab 14 — TypeORM Entites

## Objectifs

- Configurer TypeORM avec NestJS (SQLite en memoire)
- Creer des entites avec des decorateurs TypeORM (@Entity, @Column, @PrimaryGeneratedColumn)
- Definir des relations (@OneToMany, @ManyToOne)
- Implementer un CRUD avec le Repository pattern

## Description

Vous allez creer une API avec trois entites liees :
- **User** — possede plusieurs posts
- **Post** — appartient a un user, possede plusieurs commentaires
- **Comment** — appartient a un post

## Endpoints

| Methode | Route           | Description            |
|---------|----------------|------------------------|
| GET     | /users          | Lister les utilisateurs|
| POST    | /users          | Creer un utilisateur   |
| GET     | /users/:id      | Obtenir un utilisateur |
| GET     | /posts          | Lister les posts       |
| POST    | /posts          | Creer un post          |
| GET     | /posts/:id      | Obtenir un post        |

## Instructions

1. Definissez les entites dans `src/users/user.entity.ts` et `src/posts/post.entity.ts`, `src/posts/comment.entity.ts`
2. Implementez les services avec le Repository pattern (inject @InjectRepository)
3. Implementez les controllers

## Validation

```bash
npm test
```
