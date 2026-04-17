# Lab 07 — Validation et Gestion d'Erreurs

## Objectifs

- Définir des schemas de validation avec Zod
- Créer un middleware générique de validation
- Créer des classes d'erreur personnalisees
- Implementer un wrapper asyncHandler
- Centraliser la gestion d'erreurs avec un middleware d'erreur

## Pre-requis

- Node.js >= 18 installe
- Installer les dépendances : `npm install` dans ce répertoire

## Instructions

1. Installez les dépendances : `npm install`
2. Ouvrez le fichier `exercise.ts`
3. Completez chaque section marquee `TODO`
4. Lancez le fichier avec `npx tsx exercise.ts`
5. Verifiez que tous les tests passent (8/8)

## TODOs

| #   | Description                                                                    |
| --- | ------------------------------------------------------------------------------ |
| 1   | Définir le schema Zod `UserSchema` (name, email, age optionnel)                |
| 2   | Créer le middleware `validate(schema)` qui valide `req.body` avec Zod          |
| 3   | Créer la classe `AppError` (message, statusCode)                               |
| 4   | Créer les classes `NotFoundError` et `ValidationError` qui etendent `AppError` |
| 5   | Créer le wrapper `asyncHandler(fn)` pour capturer les erreurs async            |
| 6   | Créer le middleware d'erreur centralise `errorHandler`                         |
| 7   | Construire l'API avec validation sur POST/PUT                                  |

## Aide

### Zod

```typescript
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  age: z.number().min(0).max(150).optional(),
});

// Valider
const result = schema.safeParse(data);
if (!result.success) {
  console.log(result.error.errors); // tableau d'erreurs
}
```

### Classes d'erreur

```typescript
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}
```

### asyncHandler

```typescript
// Wrapper pour les routes async
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
```

## Defi bonus BFF

- Normaliser toutes les erreurs dans ce format: success, error.code, error.message, error.details, requestId.
- Mapper une erreur upstream simulee (timeout) en 503 avec un code metier stable (ex: UPSTREAM_TIMEOUT).
- Garantir que le frontend recoit toujours le meme shape de reponse d'erreur.
