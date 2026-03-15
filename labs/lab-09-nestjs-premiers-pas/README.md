# Lab 09 — NestJS Premiers pas

## Objectifs

- Créer votre première application NestJS
- Implementer un CRUD complet (Create, Read, Update, Delete) pour des taches
- Comprendre les Controllers, Services et Modules
- Utiliser les decorateurs NestJS (@Get, @Post, @Patch, @Delete, @Param, @Body)

## Description

Dans ce lab, vous allez créer une API REST pour gérer des taches (tasks) avec un stockage en mémoire.

## Endpoints a implementer

| Méthode | Route        | Description              |
|---------|-------------|--------------------------|
| GET     | /tasks      | Lister toutes les taches |
| GET     | /tasks/:id  | Obtenir une tache        |
| POST    | /tasks      | Créer une tache          |
| PATCH   | /tasks/:id  | Modifier une tache       |
| DELETE  | /tasks/:id  | Supprimer une tache      |

## Structure d'une tache

```typescript
{
  id: number;
  title: string;
  description: string;
  done: boolean;
}
```

## Instructions

1. Ouvrez `src/tasks/tasks.service.ts` et implementez les méthodes :
   - `findAll()` — retourne toutes les taches
   - `findOne(id)` — retourne une tache par son id (leve NotFoundException si non trouvee)
   - `create(data)` — créé une nouvelle tache avec un id auto-incremente
   - `update(id, data)` — met a jour une tache existante
   - `remove(id)` — supprime une tache

2. Ouvrez `src/tasks/tasks.controller.ts` et implementez les routes :
   - Utilisez les decorateurs @Get, @Post, @Patch, @Delete
   - Utilisez @Param('id') et @Body() pour récupérer les donnees
   - Appelez les méthodes du service

## Validation

```bash
npm test
```

## Fichiers a modifier

- `src/tasks/tasks.service.ts`
- `src/tasks/tasks.controller.ts`
