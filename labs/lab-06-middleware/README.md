# Lab 06 — Middleware Express

## Objectifs

- Comprendre le concept de middleware dans Express
- Créer des middleware personnalises (logger, timer, auth)
- Créer une factory de middleware (validation)
- Organiser les routes avec `express.Router()`
- Appliquer des middleware selectivement sur certaines routes

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

| #   | Description                                                                      |
| --- | -------------------------------------------------------------------------------- |
| 1   | Créer `loggerMiddleware` — log method, url et timestamp sur chaque requête       |
| 2   | Créer `timerMiddleware` — mesure le temps de réponse et ajoute `X-Response-Time` |
| 3   | Créer `authMiddleware` — vérifié le header `Authorization: Bearer secret-token`  |
| 4   | Créer `validateBody(schema)` — factory qui retourne un middleware de validation  |
| 5   | Créer un Router `/users` avec les routes CRUD                                    |
| 6   | Créer un Router `/products` avec les routes CRUD                                 |
| 7   | Assembler l'app : middleware globaux + routers + middleware selectif             |

## Aide

```typescript
// Middleware basique
function myMiddleware(req, res, next) {
  // faire quelque chose...
  next(); // passer au middleware suivant
}

// Factory de middleware
function createValidator(schema) {
  return (req, res, next) => {
    // valider req.body avec le schema
    next();
  };
}

// Router
const router = express.Router();
router.get("/", handler);
router.post("/", middleware, handler);

app.use("/prefix", router);
```

## Defi bonus BFF

- Ajouter un middleware correlation-id qui lit x-correlation-id ou en genere un.
- Le propager dans la reponse via le header x-correlation-id.
- Simuler un endpoint /bff/dashboard avec agregation de 2 sources (mockees) et une structure orientee ecran.
