# Lab 13 — Pipes, Guards & Interceptors

## Objectifs

- Creer un pipe de validation personnalise (ParsePositiveIntPipe)
- Implementer un guard d'authentification (AuthGuard)
- Implementer un guard de roles (@Roles + RolesGuard)
- Creer un intercepteur de logging (LoggingInterceptor)
- Creer un intercepteur de transformation (TransformInterceptor)
- Creer un filtre d'exception personnalise (HttpExceptionFilter)

## Description

Vous allez creer une API Items protegee par des guards et enrichie avec des intercepteurs.

## Endpoints

| Methode | Route      | Protection         | Description          |
|---------|-----------|--------------------|-----------------------|
| GET     | /items     | Aucune             | Lister les items      |
| GET     | /items/:id | ParsePositiveInt   | Obtenir un item       |
| POST    | /items     | AuthGuard          | Creer un item         |
| PATCH   | /items/:id | AuthGuard          | Modifier un item      |
| DELETE  | /items/:id | AuthGuard + Admin  | Supprimer un item     |

## Instructions

1. Implementez `src/common/pipes/parse-positive-int.pipe.ts`
2. Implementez `src/common/guards/auth.guard.ts` — verifie le header Authorization
3. Implementez `src/common/guards/roles.guard.ts` — verifie les roles via Reflector
4. Implementez `src/common/interceptors/logging.interceptor.ts` — log methode + url + duree
5. Implementez `src/common/interceptors/transform.interceptor.ts` — wrap { data: ... }
6. Implementez `src/common/filters/http-exception.filter.ts`
7. Implementez le service et controller Items

## Validation

```bash
npm test
```
