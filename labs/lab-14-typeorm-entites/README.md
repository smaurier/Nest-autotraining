# Lab 14 — TypeORM Entites

## Objectifs

- Configurer TypeORM avec NestJS (SQLite en mémoire)
- Créer des entites avec des decorateurs TypeORM (@Entity, @Column, @PrimaryGeneratedColumn)
- Définir des relations (@OneToMany, @ManyToOne)
- Implementer un CRUD avec le Repository pattern

## Description

Vous allez créer une API avec trois entites liees :
- **User** — possede plusieurs posts
- **Post** — appartient à un user, possede plusieurs commentaires
- **Comment** — appartient à un post

## Endpoints

| Méthode | Route           | Description            |
|---------|----------------|------------------------|
| GET     | /users          | Lister les utilisateurs|
| POST    | /users          | Créer un utilisateur   |
| GET     | /users/:id      | Obtenir un utilisateur |
| GET     | /posts          | Lister les posts       |
| POST    | /posts          | Créer un post          |
| GET     | /posts/:id      | Obtenir un post        |

## Instructions

1. Definissez les entites dans `src/users/user.entity.ts` et `src/posts/post.entity.ts`, `src/posts/comment.entity.ts`
2. Implementez les services avec le Repository pattern (inject @InjectRepository)
3. Implementez les controllers

## Validation

```bash
npm test
```
