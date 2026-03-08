# Lab 10 — Controllers & DTO

## Objectifs

- Maitriser les controllers NestJS avec des routes avancees
- Utiliser les DTOs avec class-validator pour la validation
- Implementer des routes imbriquees (nested routes)
- Utiliser les pipes de transformation (ParseIntPipe, ValidationPipe)
- Utiliser les decorateurs @HttpCode et @Header

## Description

Vous allez creer une API REST pour gerer des articles avec validation des donnees via class-validator et des routes imbriquees pour les commentaires.

## Endpoints a implementer

| Methode | Route                    | Description                |
|---------|--------------------------|----------------------------|
| GET     | /articles                | Lister tous les articles   |
| GET     | /articles/:id            | Obtenir un article         |
| POST    | /articles                | Creer un article           |
| PATCH   | /articles/:id            | Modifier un article        |
| DELETE  | /articles/:id            | Supprimer un article       |
| GET     | /articles/:id/comments   | Lister les commentaires    |

## Instructions

1. Ouvrez `src/articles/dto/create-article.dto.ts` et ajoutez les decorateurs class-validator :
   - `@IsString()`, `@IsNotEmpty()`, `@MinLength(3)` pour le titre
   - `@IsString()`, `@IsOptional()` pour le contenu
   - `@IsArray()`, `@IsOptional()` pour les tags

2. Ouvrez `src/articles/dto/update-article.dto.ts` et utilisez `PartialType` de `@nestjs/common`

3. Implementez le service dans `src/articles/articles.service.ts`

4. Implementez le controller dans `src/articles/articles.controller.ts`

## Validation

```bash
npm test
```

## Fichiers a modifier

- `src/articles/dto/create-article.dto.ts`
- `src/articles/dto/update-article.dto.ts`
- `src/articles/articles.service.ts`
- `src/articles/articles.controller.ts`
