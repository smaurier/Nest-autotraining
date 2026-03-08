# Lab 09 — NestJS Premiers pas

## Objectifs

- Creer votre premiere application NestJS
- Implementer un CRUD complet (Create, Read, Update, Delete) pour des taches
- Comprendre les Controllers, Services et Modules
- Utiliser les decorateurs NestJS (@Get, @Post, @Patch, @Delete, @Param, @Body)

## Description

Dans ce lab, vous allez creer une API REST pour gerer des taches (tasks) avec un stockage en memoire.

## Endpoints a implementer

| Methode | Route        | Description              |
|---------|-------------|--------------------------|
| GET     | /tasks      | Lister toutes les taches |
| GET     | /tasks/:id  | Obtenir une tache        |
| POST    | /tasks      | Creer une tache          |
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

1. Ouvrez `src/tasks/tasks.service.ts` et implementez les methodes :
   - `findAll()` — retourne toutes les taches
   - `findOne(id)` — retourne une tache par son id (leve NotFoundException si non trouvee)
   - `create(data)` — cree une nouvelle tache avec un id auto-incremente
   - `update(id, data)` — met a jour une tache existante
   - `remove(id)` — supprime une tache

2. Ouvrez `src/tasks/tasks.controller.ts` et implementez les routes :
   - Utilisez les decorateurs @Get, @Post, @Patch, @Delete
   - Utilisez @Param('id') et @Body() pour recuperer les donnees
   - Appelez les methodes du service

## Validation

```bash
npm test
```

## Fichiers a modifier

- `src/tasks/tasks.service.ts`
- `src/tasks/tasks.controller.ts`
