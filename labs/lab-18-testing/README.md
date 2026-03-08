# Lab 18 — Testing

## Objectifs

- Ecrire des tests unitaires pour un service NestJS
- Ecrire des tests E2E (end-to-end) avec supertest
- Comprendre la difference entre tests unitaires et tests d'integration
- Utiliser le TestingModule de NestJS

## Description

Dans ce lab, le service et le controller sont deja implementes. Votre travail consiste a ecrire les tests.

Vous allez tester un CRUD complet pour des utilisateurs (users) :
- Tests unitaires : tester le service directement
- Tests E2E : tester les endpoints HTTP avec supertest

## Structure d'un utilisateur

```typescript
{
  id: number;
  name: string;
  email: string;
}
```

## Instructions

### Tests unitaires (`test/users.unit.spec.ts`)

1. Creez un TestingModule avec le UsersService
2. Implementez les tests suivants :
   - `findAll` retourne un tableau
   - `create` ajoute un utilisateur et le retourne
   - `findOne` retourne un utilisateur par id
   - `findOne` leve NotFoundException pour un id invalide
   - `update` modifie un utilisateur
   - `remove` supprime un utilisateur

### Tests E2E (`test/users.e2e-spec.ts`)

1. Creez une application de test avec supertest
2. Implementez les tests suivants :
   - POST /users cree un utilisateur
   - GET /users retourne tous les utilisateurs
   - GET /users/:id retourne un utilisateur
   - GET /users/:id retourne 404 pour un id inexistant
   - PATCH /users/:id met a jour un utilisateur
   - DELETE /users/:id supprime un utilisateur

## Validation

```bash
npm test
```

## Fichiers a modifier

- `test/users.unit.spec.ts`
- `test/users.e2e-spec.ts`
